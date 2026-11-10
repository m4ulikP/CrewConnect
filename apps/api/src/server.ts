import http from "http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectToDatabase, disconnectDatabase } from "./db/connection.js";
import { initSocketServer, closeSocketServer } from "./realtime/index.js";

const server = http.createServer(app);
const io = initSocketServer(server);

async function startServer(): Promise<void> {
  try {
    // Attempt database connection on startup
    try {
      await connectToDatabase();
      console.log(`Connected to MongoDB at ${env.MONGODB_URI}`);
    } catch (dbError) {
      console.warn(
        "Could not connect to MongoDB on startup. Server running in disconnected mode. Error:",
        (dbError as Error).message
      );
    }

    server.listen(env.PORT, () => {
      console.log(`CrewConnect API server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
      console.log(`Health check: http://localhost:${env.PORT}/health`);
      console.log(`API root: http://localhost:${env.PORT}/api/v1`);
    });
  } catch (error) {
    console.error("Fatal error starting server:", error);
    process.exit(1);
  }
}

// Graceful shutdown handling
async function gracefulShutdown(signal: string): Promise<void> {
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

export { server, io, startServer, gracefulShutdown };
