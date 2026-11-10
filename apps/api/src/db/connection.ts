import mongoose from "mongoose";
import { env } from "../config/env.js";

interface DbState {
  isConnected: boolean;
}

const state: DbState = {
  isConnected: false,
};

export async function connectToDatabase(uri = env.MONGODB_URI): Promise<typeof mongoose> {
  if (state.isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  try {
    const conn = await mongoose.connect(uri, {
      dbName: env.MONGODB_DB_NAME,
      maxPoolSize: 200,
      serverSelectionTimeoutMS: 5000,
    });

    state.isConnected = true;

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB Connection Error:", err);
      state.isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB Disconnected");
      state.isConnected = false;
    });

    return conn;
  } catch (error) {
    state.isConnected = false;
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    state.isConnected = false;
  }
}

export async function checkDatabaseHealth(): Promise<{
  ok: boolean;
  status: string;
  isReplicaSet: boolean;
  replicaSetName?: string;
}> {
  try {
    if (mongoose.connection.readyState !== 1) {
      return { ok: false, status: "disconnected", isReplicaSet: false };
    }

    const admin = mongoose.connection.db?.admin();
    if (!admin) {
      return { ok: false, status: "no_admin_db", isReplicaSet: false };
    }

    const ping = await admin.ping();
    const isOk = ping.ok === 1;

    // Check replica set status
    let isReplicaSet = false;
    let replicaSetName: string | undefined;

    try {
      const serverStatus = await admin.serverStatus();
      if (serverStatus.repl) {
        isReplicaSet = true;
        replicaSetName = serverStatus.repl.setName;
      }
    } catch {
      // Replica set status command may require special privileges or standalone
    }

    return {
      ok: isOk,
      status: isOk ? "connected" : "error",
      isReplicaSet,
      replicaSetName,
    };
  } catch {
    return { ok: false, status: "error", isReplicaSet: false };
  }
}
