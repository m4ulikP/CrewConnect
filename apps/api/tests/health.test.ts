import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";

describe("Health Check API", () => {
  beforeAll(async () => {
    try {
      await connectToDatabase();
    } catch {
      // Allow disconnected testing if DB is offline
    }
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("GET /health returns 200 with status ok and uptime", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "ok");
    expect(response.body).toHaveProperty("timestamp");
    expect(response.body).toHaveProperty("uptime");
    expect(response.body).toHaveProperty("version", "0.1.0");
    expect(response.body).toHaveProperty("database");
  });

  it("GET /api/v1/health returns 200 with matching schema", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("GET /health/live returns 200 for process liveness probes", async () => {
    const response = await request(app).get("/health/live");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "ok");
    expect(response.body).toHaveProperty("uptime");
  });

  it("GET /health/ready returns 200 for container readiness probes when DB is reachable", async () => {
    const response = await request(app).get("/health/ready");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "ok");
    expect(response.body.database).toHaveProperty("connected", true);
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
