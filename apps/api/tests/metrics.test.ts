import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import http from "http";
import type { AddressInfo } from "net";
import type { Request } from "express";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { app } from "../src/app.js";
import {
  metricsRegistry,
  incrementActiveConnections,
  decrementActiveConnections,
  getActiveConnectionsCount,
  resetActiveConnections,
  resetMetricsForTesting,
  extractNormalizedRoute,
} from "../src/metrics/index.js";
import { initSocketServer, closeSocketServer } from "../src/realtime/socket.js";
import { AuthService } from "../src/services/auth.service.js";
import { User } from "../src/models/index.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";
import { env } from "../src/config/env.js";

describe("Prometheus Metrics & Observability Suite", () => {
  beforeEach(() => {
    resetMetricsForTesting();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await closeSocketServer();
    resetMetricsForTesting();
    vi.restoreAllMocks();
  });

  // 1. /metrics returns HTTP 200 and a valid Prometheus response
  it("1. GET /metrics returns HTTP 200 with standard Prometheus exposition format and content-type", async () => {
    const res = await request(app).get("/metrics");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("# HELP process_cpu_user_seconds_total");
    expect(res.text).toContain("# TYPE process_cpu_user_seconds_total");
    expect(res.text).toContain("# HELP http_request_duration_seconds");
    expect(res.text).toContain("# TYPE http_request_duration_seconds histogram");
    expect(res.text).toContain("# HELP socket_io_active_connections");
    expect(res.text).toContain("# TYPE socket_io_active_connections gauge");
  });

  it("1b. GET /api/v1/metrics also resolves the metrics exposition format", async () => {
    const res = await request(app).get("/api/v1/metrics");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("http_request_duration_seconds");
  });

  // 2. The HTTP request histogram records completed requests
  it("2. HTTP request duration histogram records completed requests and increments bucket counters", async () => {
    // Send a request to /health/live
    const healthRes = await request(app).get("/health/live");
    expect(healthRes.status).toBe(200);

    const metricsRes = await request(app).get("/metrics");
    expect(metricsRes.status).toBe(200);

    // Look for observed count and buckets for GET /health/live
    expect(metricsRes.text).toMatch(
      /http_request_duration_seconds_count\{method="GET",route="\/health\/live",status_code="200"\}\s+1/
    );
    expect(metricsRes.text).toMatch(
      /http_request_duration_seconds_bucket\{le="0\.2",method="GET",route="\/health\/live",status_code="200"\}\s+1/
    );
  });

  // 3. Histogram labels are bounded and do not contain raw URLs, user IDs, or other sensitive values
  it("3. Histogram labels use parameterized routes and do not leak high-cardinality IDs or unmapped paths", async () => {
    // Simulate requests to unmatched / 404 routes with raw IDs or UUIDs
    const fakeId = "65f1234567890abcdef12345";
    const res404 = await request(app).get(`/some/unmapped/resource/${fakeId}?token=secret123`);
    expect(res404.status).toBe(404);

    const metricsRes = await request(app).get("/metrics");
    expect(metricsRes.status).toBe(200);

    // The raw path, dynamic ID, and query parameters must NOT appear in metric labels
    expect(metricsRes.text).not.toContain(fakeId);
    expect(metricsRes.text).not.toContain("secret123");
    expect(metricsRes.text).not.toContain("/some/unmapped/resource");

    // The unmapped route should be safely normalized to UNMATCHED_ROUTE
    expect(metricsRes.text).toMatch(
      /http_request_duration_seconds_count\{method="GET",route="UNMATCHED_ROUTE",status_code="404"\}\s+1/
    );
  });

  it("3b. extractNormalizedRoute helper returns parameterized pattern when route is matched", () => {
    const mockReqWithRoute = {
      baseUrl: "/api/v1/teams",
      route: { path: "/:id/join" },
    } as unknown as Request;

    expect(extractNormalizedRoute(mockReqWithRoute)).toBe("/api/v1/teams/:id/join");

    const mockReqRoot = {
      baseUrl: "",
      route: { path: "/" },
    } as unknown as Request;

    expect(extractNormalizedRoute(mockReqRoot)).toBe("/");

    const mockReqUnmatched = {
      baseUrl: "",
      route: undefined,
    } as unknown as Request;

    expect(extractNormalizedRoute(mockReqUnmatched)).toBe("UNMATCHED_ROUTE");
  });

  // 4. /metrics does not recursively record its own scrape request
  it("4. GET /metrics does not record its own scrape request in http_request_duration_seconds", async () => {
    // Scrape /metrics multiple times
    await request(app).get("/metrics");
    await request(app).get("/metrics");
    await request(app).get("/metrics");

    const finalRes = await request(app).get("/metrics");
    expect(finalRes.status).toBe(200);

    // Assert that route="/metrics" was never observed in the histogram
    expect(finalRes.text).not.toContain('route="/metrics"');
    expect(finalRes.text).not.toContain('route="/api/v1/metrics"');
  });

  // 5. Active WebSocket gauge increments on connection
  // 6. Active WebSocket gauge decrements on disconnect
  it("5 & 6. Active WebSocket gauge increments on client connection and decrements on disconnect", async () => {
    await connectToDatabase();

    const mockUser = await User.create({
      email: `socket-metrics-${Date.now()}@test.com`,
      passwordHash: "argon2id$v=19$m=65536,t=3,p=4$dummyhashforwsmetrics",
      displayName: "WS Metrics User",
      skills: ["TypeScript"],
      status: "ACTIVE",
    });

    const token = AuthService.generateToken(mockUser);

    const server = http.createServer(app);
    initSocketServer(server);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    expect(getActiveConnectionsCount()).toBe(0);

    // Connect Client 1
    const client1: ClientSocket = ioClient(`http://localhost:${port}`, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });

    await new Promise<void>((resolve) => {
      client1.on("connect", () => resolve());
    });

    expect(getActiveConnectionsCount()).toBe(1);

    const metricsAfterConnect1 = await request(app).get("/metrics");
    expect(metricsAfterConnect1.text).toMatch(/socket_io_active_connections\s+1/);

    // Connect Client 2
    const client2: ClientSocket = ioClient(`http://localhost:${port}`, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });

    await new Promise<void>((resolve) => {
      client2.on("connect", () => resolve());
    });

    expect(getActiveConnectionsCount()).toBe(2);

    // Disconnect Client 1
    client1.disconnect();
    await new Promise((r) => setTimeout(r, 80));

    expect(getActiveConnectionsCount()).toBe(1);

    // Disconnect Client 2
    client2.disconnect();
    await new Promise((r) => setTimeout(r, 80));

    expect(getActiveConnectionsCount()).toBe(0);

    const metricsAfterDisconnect = await request(app).get("/metrics");
    expect(metricsAfterDisconnect.text).toMatch(/socket_io_active_connections\s+0/);

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDatabase();
  });

  // 7. Repeated disconnect handling does not produce a negative gauge
  it("7. Repeated disconnect triggers cannot produce a negative gauge", () => {
    resetActiveConnections();
    expect(getActiveConnectionsCount()).toBe(0);

    // Simulate multiple disconnect calls when already at 0
    decrementActiveConnections();
    decrementActiveConnections();
    decrementActiveConnections();

    expect(getActiveConnectionsCount()).toBe(0);

    // Increment to 1, decrement twice
    incrementActiveConnections();
    expect(getActiveConnectionsCount()).toBe(1);

    decrementActiveConnections();
    expect(getActiveConnectionsCount()).toBe(0);

    decrementActiveConnections();
    expect(getActiveConnectionsCount()).toBe(0);
  });

  // 8. Metrics instrumentation does not change normal API response behavior
  it("8. Metrics middleware does not alter normal API responses, headers, or status codes", async () => {
    const res = await request(app).get("/api/v1");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("name", "CrewConnect API");
    expect(res.body).toHaveProperty("version", "v1");
    expect(res.body).toHaveProperty("status", "active");
  });

  // 9. Metrics endpoint behavior when collection encounters an error
  it("9. Handles internal registry collection error gracefully with HTTP 500 without crashing", async () => {
    const spy = vi
      .spyOn(metricsRegistry, "metrics")
      .mockRejectedValueOnce(new Error("Simulated Registry Metrics Error"));

    const res = await request(app).get("/metrics");

    expect(res.status).toBe(500);
    expect(res.text).toContain("Error generating metrics");
    spy.mockRestore();
  });

  // 10. Optional Bearer Token Authentication
  it("10. Enforces bearer token when METRICS_BEARER_TOKEN is configured", async () => {
    const mutableEnv = env as unknown as Record<string, unknown>;
    mutableEnv.METRICS_BEARER_TOKEN = "super-secret-metrics-token";

    // Request without token -> 401
    const unauthRes = await request(app).get("/metrics");
    expect(unauthRes.status).toBe(401);

    // Request with invalid token -> 401
    const badTokenRes = await request(app)
      .get("/metrics")
      .set("Authorization", "Bearer wrong-token");
    expect(badTokenRes.status).toBe(401);

    // Request with valid token -> 200
    const authRes = await request(app)
      .get("/metrics")
      .set("Authorization", "Bearer super-secret-metrics-token");
    expect(authRes.status).toBe(200);
    expect(authRes.text).toContain("http_request_duration_seconds");

    // Clean up
    delete mutableEnv.METRICS_BEARER_TOKEN;
  });

  // 11. Disabled metrics behavior
  it("11. Returns 404 when METRICS_ENABLED is false", async () => {
    const mutableEnv = env as unknown as Record<string, unknown>;
    mutableEnv.METRICS_ENABLED = false;

    const res = await request(app).get("/metrics");
    expect(res.status).toBe(404);

    mutableEnv.METRICS_ENABLED = true;
  });
});
