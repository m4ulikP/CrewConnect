import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../src/app.js";
import {
  connectToDatabase,
  disconnectDatabase,
  checkDatabaseHealth,
} from "../src/db/connection.js";

describe("Health Check & Database Readiness Semantics", () => {
  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("1. Connected replica set with writable primary returns 200 OK and ready status", async () => {
    const response = await request(app).get("/health/ready");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "ok");
    expect(response.body.database).toHaveProperty("connected", true);
    expect(response.body.database).toHaveProperty("status", "connected");
    expect(response.body.database).toHaveProperty("isReplicaSet", true);
    expect(response.body.database).toHaveProperty("replicaSet", "rs0");
    expect(response.body.database).toHaveProperty("isWritablePrimary", true);
  });

  it("Comprehensive GET /health returns 200 with full replica set metadata when database is ready", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "ok");
    expect(response.body).toHaveProperty("timestamp");
    expect(response.body).toHaveProperty("uptime");
    expect(response.body).toHaveProperty("version", "0.1.0");
    expect(response.body.database).toHaveProperty("connected", true);
    expect(response.body.database).toHaveProperty("isReplicaSet", true);
    expect(response.body.database).toHaveProperty("isWritablePrimary", true);
  });

  it("Liveness probe GET /health/live returns 200 regardless of database status", async () => {
    const response = await request(app).get("/health/live");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "ok");
    expect(response.body).toHaveProperty("uptime");
  });

  it("3. Connected standalone MongoDB must NOT be reported as ready (returns 503)", async () => {
    // Mock hello command response simulating a standalone MongoDB instance (no setName)
    const spy = vi
      .spyOn(mongoose.mongo.Admin.prototype, "command")
      .mockImplementation(async (cmd: Record<string, unknown>) => {
        if (cmd && (cmd.hello || cmd.isMaster)) {
          return {
            ok: 1,
            isWritablePrimary: true,
            maxBsonObjectSize: 16777216,
          };
        }
        return { ok: 1 };
      });

    const response = await request(app).get("/health/ready");

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty("status", "not_ready");
    expect(response.body.database).toHaveProperty("connected", false);
    expect(response.body.database).toHaveProperty("status", "standalone");
    expect(response.body.database).toHaveProperty("isReplicaSet", false);
    expect(response.body.database.error).toContain("standalone MongoDB server");

    spy.mockRestore();
  });

  it("4. Replica set without an available writable primary must NOT be reported as ready (returns 503)", async () => {
    // Mock hello command response simulating an in-election replica set node with no primary
    const spy = vi
      .spyOn(mongoose.mongo.Admin.prototype, "command")
      .mockImplementation(async (cmd: Record<string, unknown>) => {
        if (cmd && (cmd.hello || cmd.isMaster)) {
          return {
            ok: 1,
            setName: "rs0",
            isWritablePrimary: false,
            secondary: true,
            // primary is intentionally omitted / undefined
          };
        }
        return { ok: 1 };
      });

    const response = await request(app).get("/health/ready");

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty("status", "not_ready");
    expect(response.body.database).toHaveProperty("connected", false);
    expect(response.body.database).toHaveProperty("status", "no_primary");
    expect(response.body.database).toHaveProperty("isReplicaSet", true);
    expect(response.body.database.error).toContain(
      "does not currently have an elected writable primary"
    );

    spy.mockRestore();
  });

  it("2 & 5. Disconnected MongoDB returns 503 not_ready, and recovers to 200 once reconnected", async () => {
    // Disconnect database to verify disconnected readiness
    await disconnectDatabase();

    const disconnectedHealth = await checkDatabaseHealth();
    expect(disconnectedHealth.ok).toBe(false);
    expect(disconnectedHealth.status).toBe("disconnected");

    const disconnectedRes = await request(app).get("/health/ready");
    expect(disconnectedRes.status).toBe(503);
    expect(disconnectedRes.body).toHaveProperty("status", "not_ready");
    expect(disconnectedRes.body.database).toHaveProperty("connected", false);
    expect(disconnectedRes.body.database).toHaveProperty("status", "disconnected");

    // Liveness remains 200 while disconnected
    const livenessRes = await request(app).get("/health/live");
    expect(livenessRes.status).toBe(200);

    // Reconnect database to verify recovery
    await connectToDatabase();

    const recoveredRes = await request(app).get("/health/ready");
    expect(recoveredRes.status).toBe(200);
    expect(recoveredRes.body).toHaveProperty("status", "ok");
    expect(recoveredRes.body.database).toHaveProperty("connected", true);
    expect(recoveredRes.body.database).toHaveProperty("isWritablePrimary", true);
  });

  it("GET /api/v1 returns 200 with API version information", async () => {
    const response = await request(app).get("/api/v1");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("name", "CrewConnect API");
    expect(response.body).toHaveProperty("version", "v1");
  });

  it("returns 404 for non-existent route with standardized error envelope", async () => {
    const response = await request(app).get("/non-existent-route-404");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("success", false);
    expect(response.body.error).toHaveProperty("code", "NOT_FOUND");
    expect(response.body.error).toHaveProperty("message");
    expect(response.body.error).toHaveProperty("timestamp");
  });
});
