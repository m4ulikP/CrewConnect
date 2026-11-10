import { describe, it, expect, vi, afterEach } from "vitest";
import mongoose from "mongoose";
import { initializeDatabaseAndIndexes, startServer, server } from "../src/server.js";
import * as connectionModule from "../src/db/connection.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";

describe("API Startup Reliability & Database Readiness Invariants", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await connectToDatabase();
  });

  it("1. Successfully initializes database and synchronizes indexes when replica set is online", async () => {
    await expect(
      initializeDatabaseAndIndexes({ maxRetries: 3, initialRetryDelayMs: 50 })
    ).resolves.toBeUndefined();
    expect(mongoose.connection.readyState).toBe(1);
  });

  it("2. Fails and does NOT start server when database connection is unreachable within retry bounds", async () => {
    await disconnectDatabase();

    // Mock connectToDatabase to reject with connection error
    const connectSpy = vi
      .spyOn(connectionModule, "connectToDatabase")
      .mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:27017"));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      initializeDatabaseAndIndexes({
        maxRetries: 2,
        initialRetryDelayMs: 10,
        maxRetryDelayMs: 20,
      })
    ).rejects.toThrow(/Fatal: Unable to establish database connection/);

    expect(server.listening).toBe(false);

    connectSpy.mockRestore();
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });

  it("3. Rejects startup if connected instance is a standalone MongoDB (not a replica set)", async () => {
    await connectToDatabase();

    // Mock hello response to simulate standalone MongoDB
    vi.spyOn(mongoose.mongo.Admin.prototype, "command").mockImplementation(
      async (cmd: Record<string, unknown>) => {
        if (cmd && (cmd.hello || cmd.isMaster)) {
          return {
            ok: 1,
            isWritablePrimary: true,
            // No setName -> standalone
          };
        }
        return { ok: 1 };
      }
    );

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      initializeDatabaseAndIndexes({
        maxRetries: 1,
        initialRetryDelayMs: 20,
      })
    ).rejects.toThrow(/standalone/i);

    warnSpy.mockRestore();
    errSpy.mockRestore();
  });

  it("4. startServer({ listen: false }) returns the configured HTTP server instance upon verification", async () => {
    await connectToDatabase();
    const appServer = await startServer({
      listen: false,
      maxRetries: 2,
      initialRetryDelayMs: 50,
    });

    expect(appServer).toBeDefined();
    expect(mongoose.connection.readyState).toBe(1);
  });
});
