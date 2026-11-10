import http from "http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectToDatabase, disconnectDatabase, checkDatabaseHealth } from "./db/connection.js";
import { syncAllIndexes } from "./models/index.js";
import { initSocketServer, closeSocketServer } from "./realtime/index.js";

const server = http.createServer(app);
const io = initSocketServer(server);

export interface ServerStartupOptions {
  uri?: string;
  maxRetries?: number;
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  listen?: boolean;
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

  while (attempt < maxRetries) {
    attempt++;
    try {
      console.log(
        `[Startup] Connecting to MongoDB (attempt ${attempt}/${maxRetries}) at ${uri}...`
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

      // Synchronize required database indexes
      await syncAllIndexes();
      console.log("[Startup] Database indexes verified and synchronized.");
      return;
    } catch (err) {
      lastError = err as Error;
      console.warn(
        `[Startup] Database connection / readiness attempt ${attempt}/${maxRetries} failed: ${lastError.message}`
      );

      if (attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(1.5, attempt - 1), maxDelay);
        const jitter = Math.floor(Math.random() * 200);
        await new Promise((r) => setTimeout(r, delay + jitter));
      }
    }
  }

  const fatalMessage = `Fatal: Unable to establish database connection and transaction readiness after ${maxRetries} attempts. Last error: ${lastError?.message}`;
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
  } catch (error) {
    console.error("Fatal error during API startup:", (error as Error).message);
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
    throw error;
  }
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
        console.error("Error during database disconnection:", err);
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
