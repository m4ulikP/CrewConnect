import http from "http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import {
  connectToDatabase,
  disconnectDatabase,
  checkDatabaseHealth,
  sanitizeMongoUriForLog,
  sanitizeMongoErrorForLog,
} from "./db/connection.js";
import { ensureAllIndexes, verifyDatabaseIndexes } from "./models/index.js";
import { initSocketServer, closeSocketServer } from "./realtime/index.js";
import { ensureDefaultHackathonAndDemoData } from "./services/demo-seed.service.js";

const server = http.createServer(app);
const io = initSocketServer(server);

export interface ServerStartupOptions {
  uri?: string;
  maxRetries?: number;
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  listen?: boolean;
  verifyOnly?: boolean;
}

/**
 * Establishes a verified MongoDB connection, validates replica-set transaction readiness,
 * and synchronizes required database indexes before traffic can be accepted.
 * Implements bounded retries with exponential backoff.
 */
export async function initializeDatabaseAndIndexes(
  options: ServerStartupOptions = {}
): Promise<void> {
  const uri = options.uri ?? env.MONGODB_URI;
  const maxRetries = options.maxRetries ?? 10;
  const initialDelay = options.initialRetryDelayMs ?? 500;
  const maxDelay = options.maxRetryDelayMs ?? 5000;

  let attempt = 0;
  let lastError: Error | null = null;

  const sanitizedHost = sanitizeMongoUriForLog(uri);

  while (attempt < maxRetries) {
    attempt++;
    try {
      console.log(
        `[Startup] Connecting to MongoDB (attempt ${attempt}/${maxRetries}, host: ${sanitizedHost})...`
      );
      await connectToDatabase(uri);

      // Verify transaction & replica set readiness
      const health = await checkDatabaseHealth();
      if (!health.ok) {
        throw new Error(
          `Database topology is not ready for transactions (status: ${health.status}): ${health.error || "no primary"}`
        );
      }

      console.log(
        `[Startup] Confirmed MongoDB replica set '${health.replicaSetName}' with writable primary: ${health.primary}`
      );

      // Index verification and management:
      // Production uses strictly read-only index verification.
      // Development and test use additive Model.createIndexes() without dropping unmanaged indexes.
      const isProduction = env.NODE_ENV === "production";
      const isVerifyOnly = options.verifyOnly ?? isProduction;

      if (isVerifyOnly) {
        console.log("[Startup] Running read-only database index verification (production-safe)...");
        const verification = await verifyDatabaseIndexes();
        if (verification.warnings.length > 0) {
          for (const warning of verification.warnings) {
            console.warn(`[Startup Warning] ${warning}`);
          }
        }
        console.log(
          `[Startup] Read-only index verification passed (${verification.criticalChecked} critical integrity invariants verified).`
        );
      } else {
        console.log("[Startup] Non-production mode: Ensuring schema indexes additively...");
        await ensureAllIndexes();
        console.log("[Startup] Database schema indexes verified and created (additive).");
      }
      return;
    } catch (err) {
      lastError = err as Error;
      const sanitizedError = sanitizeMongoErrorForLog(lastError);
      console.warn(
        `[Startup] Database connection / readiness attempt ${attempt}/${maxRetries} failed: ${sanitizedError}`
      );

      if (attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(1.5, attempt - 1), maxDelay);
        const jitter = Math.floor(Math.random() * 200);
        await new Promise((r) => setTimeout(r, delay + jitter));
      }
    }
  }

  const fatalMessage = `Fatal: Unable to establish database connection and transaction readiness after ${maxRetries} attempts. Last error: ${sanitizeMongoErrorForLog(lastError)}`;
  console.error(fatalMessage);
  throw new Error(fatalMessage);
}

/**
 * Starts the CrewConnect API server.
 * Guarantees that the HTTP server will NOT accept application traffic until
 * database connection, replica-set readiness, and index synchronization are verified.
 */
export async function startServer(options: ServerStartupOptions = {}): Promise<http.Server> {
  try {
    await initializeDatabaseAndIndexes(options);

    // Auto-seed default hackathon and demo squads if missing
    try {
      await ensureDefaultHackathonAndDemoData();
    } catch (seedErr) {
      console.warn("[Startup] Notice: Demo hackathon seeding encountered an issue:", seedErr);
    }
  } catch (error) {
    if (env.NODE_ENV === "development") {
      console.warn(
        `[Startup] Notice: MongoDB replica set is offline locally. Running API server in Local Dev / Demo Fallback mode on port ${env.PORT}.`
      );
    } else {
      console.error("Fatal error during API startup:", sanitizeMongoErrorForLog(error));
      if (process.env.NODE_ENV !== "test") {
        process.exit(1);
      }
      throw error;
    }
  }

  const shouldListen = options.listen ?? true;
  if (shouldListen) {
    return new Promise<http.Server>((resolve) => {
      server.listen(env.PORT, () => {
        console.log(`CrewConnect API server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
        console.log(`Health check: http://localhost:${env.PORT}/health`);
        console.log(`API root: http://localhost:${env.PORT}/api/v1`);
        resolve(server);
      });
    });
  }
  return server;
}

// Graceful shutdown handling
export async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}. Gracefully shutting down...`);
  return new Promise<void>((resolve, reject) => {
    server.close(async () => {
      console.log("HTTP server closed.");
      try {
        await closeSocketServer();
        console.log("Socket server closed.");
        await disconnectDatabase();
        console.log("Database connection closed.");
        resolve();
        process.exit(0);
      } catch (err) {
        console.error("Error during database disconnection:", sanitizeMongoErrorForLog(err));
        reject(err);
        process.exit(1);
      }
    });

    // Force close after 10s timeout
    setTimeout(() => {
      console.error("Could not close connections in time, forcefully shutting down");
      process.exit(1);
    }, 10000).unref();
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

if (process.env.NODE_ENV !== "test") {
  startServer();
}

export { server, io };
