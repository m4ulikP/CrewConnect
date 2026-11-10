import mongoose from "mongoose";
import { env } from "../config/env.js";

interface DbState {
  isConnected: boolean;
}

const state: DbState = {
  isConnected: false,
};

/**
 * Extracts a sanitized host target from a MongoDB URI without exposing credentials,
 * usernames, passwords, or sensitive query parameters.
 */
export function sanitizeMongoUriForLog(uri: string): string {
  if (!uri || typeof uri !== "string") {
    return "[redacted]";
  }

  try {
    const match = uri.match(/^(mongodb(?:\+srv)?):\/\/(?:[^/@\s]+@)?([^/?\s]+)/i);
    if (match && match[2]) {
      return match[2];
    }
    const parsed = new URL(uri);
    return parsed.host || "[redacted]";
  } catch {
    return "[redacted]";
  }
}

/**
 * Strips any embedded MongoDB URIs (including userinfo credentials and query tokens)
 * or sensitive key=value parameters from error messages before logging.
 */
export function sanitizeMongoErrorForLog(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "Unknown error");

  return rawMessage
    .replace(/mongodb(?:\+srv)?:\/\/[^\s'"`]+/gi, (matchedUri) => {
      const sanitizedHost = sanitizeMongoUriForLog(matchedUri);
      return `[mongodb://${sanitizedHost}]`;
    })
    .replace(/\b(password|pwd|secret|token|authToken|apiKey)=([^&\s'"]+)/gi, "$1=[REDACTED]");
}

export async function connectToDatabase(uri = env.MONGODB_URI): Promise<typeof mongoose> {
  if (state.isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    state.isConnected = false;
  }

  try {
    const conn = await mongoose.connect(uri, {
      dbName: env.MONGODB_DB_NAME,
      maxPoolSize: 200,
      serverSelectionTimeoutMS: 5000,
    });

    state.isConnected = true;

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB Connection Error:", sanitizeMongoErrorForLog(err));
      state.isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB Disconnected");
      state.isConnected = false;
    });

    return conn;
  } catch (error) {
    state.isConnected = false;
    console.error("Failed to connect to MongoDB:", sanitizeMongoErrorForLog(error));
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    state.isConnected = false;
  }
}

export interface DatabaseHealthResult {
  ok: boolean;
  status:
    | "connected"
    | "disconnected"
    | "standalone"
    | "no_primary"
    | "replica_set_mismatch"
    | "no_admin_db"
    | "error";
  isReplicaSet: boolean;
  replicaSetName?: string;
  expectedReplicaSetName?: string;
  isWritablePrimary: boolean;
  primary?: string;
  error?: string;
}

export function getExpectedReplicaSetName(uri = env.MONGODB_URI): string | undefined {
  if (process.env.EXPECTED_REPLICA_SET_NAME) {
    return process.env.EXPECTED_REPLICA_SET_NAME;
  }
  const match = uri.match(/[?&]replicaSet=([^&#]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealthResult> {
  try {
    if (mongoose.connection.readyState !== 1) {
      return {
        ok: false,
        status: "disconnected",
        isReplicaSet: false,
        isWritablePrimary: false,
        error: "Mongoose connection is not in readyState 1 (connected)",
      };
    }

    const admin = mongoose.connection.db?.admin();
    if (!admin) {
      return {
        ok: false,
        status: "no_admin_db",
        isReplicaSet: false,
        isWritablePrimary: false,
        error: "Cannot access admin database interface",
      };
    }

    // Run unprivileged topology probe: hello (or legacy isMaster fallback)
    let hello: Record<string, unknown> | null = null;
    try {
      hello = (await admin.command({ hello: 1 })) as Record<string, unknown>;
    } catch {
      try {
        hello = (await admin.command({ isMaster: 1 })) as Record<string, unknown>;
      } catch (cmdErr) {
        return {
          ok: false,
          status: "error",
          isReplicaSet: false,
          isWritablePrimary: false,
          error: `Topology probe failed: ${(cmdErr as Error).message}`,
        };
      }
    }

    if (!hello || hello.ok !== 1) {
      return {
        ok: false,
        status: "error",
        isReplicaSet: false,
        isWritablePrimary: false,
        error: "MongoDB hello command returned non-ok status",
      };
    }

    // Standalone instances lack setName in hello/isMaster response
    if (!hello.setName) {
      return {
        ok: false,
        status: "standalone",
        isReplicaSet: false,
        isWritablePrimary: Boolean(hello.isWritablePrimary ?? hello.ismaster),
        error:
          "Connected instance is a standalone MongoDB server without replica set support for transactions",
      };
    }

    const replicaSetName = String(hello.setName);
    const expectedReplicaSetName = getExpectedReplicaSetName();

    // Verify expected replica set name if explicitly configured or embedded in connection URI
    if (expectedReplicaSetName && replicaSetName !== expectedReplicaSetName) {
      return {
        ok: false,
        status: "replica_set_mismatch",
        isReplicaSet: true,
        replicaSetName,
        expectedReplicaSetName,
        isWritablePrimary: Boolean(hello.isWritablePrimary ?? hello.ismaster),
        primary: typeof hello.primary === "string" ? hello.primary : undefined,
        error: `Connected to replica set '${replicaSetName}' but expected '${expectedReplicaSetName}'`,
      };
    }

    const isWritablePrimary = Boolean(hello.isWritablePrimary ?? hello.ismaster);
    const primary =
      typeof hello.primary === "string"
        ? hello.primary
        : isWritablePrimary
          ? String(hello.me || "self")
          : undefined;

    // Verify that the connected node is a writable primary to safely execute transactions.
    // Note: Do NOT confuse a reported primary hostname (on a secondary) with this node being writable.
    if (!isWritablePrimary) {
      return {
        ok: false,
        status: "no_primary",
        isReplicaSet: true,
        replicaSetName,
        expectedReplicaSetName,
        isWritablePrimary: false,
        primary,
        error: primary
          ? `Connected MongoDB node is not a writable primary (reported primary: ${primary})`
          : "Replica set does not currently have an elected writable primary",
      };
    }

    return {
      ok: true,
      status: "connected",
      isReplicaSet: true,
      replicaSetName,
      expectedReplicaSetName,
      isWritablePrimary: true,
      primary,
    };
  } catch (err) {
    return {
      ok: false,
      status: "error",
      isReplicaSet: false,
      isWritablePrimary: false,
      error: `Database health check exception: ${(err as Error).message}`,
    };
  }
}
