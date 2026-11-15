import client, { Registry, Histogram, Gauge } from "prom-client";
import type { Request } from "express";

/**
 * Dedicated Prometheus registry for CrewConnect metrics.
 * Using a dedicated registry avoids global state leakage across test suites.
 */
export const metricsRegistry: Registry = new Registry();

/**
 * Sensible latency histogram buckets (in seconds).
 * Explicitly includes boundaries around 0.2s (200ms) to track the team discovery p95 requirement.
 */
export const HTTP_DURATION_BUCKETS = [
  0.005, // 5ms
  0.01, // 10ms
  0.025, // 25ms
  0.05, // 50ms
  0.1, // 100ms
  0.15, // 150ms
  0.2, // 200ms - Primary latency SLA boundary
  0.25, // 250ms
  0.3, // 300ms
  0.5, // 500ms
  1.0, // 1s
  2.5, // 2.5s
  5.0, // 5s
  10.0, // 10s
];

/**
 * Histogram tracking HTTP request durations across method, normalized route, and status code.
 * High-cardinality values (raw URLs, user IDs, emails, tokens, IP addresses) are strictly excluded.
 */
export const httpRequestDurationHistogram = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of completed HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: HTTP_DURATION_BUCKETS,
  registers: [metricsRegistry],
});

/**
 * Gauge tracking currently active Socket.IO client connections.
 * Guaranteed never to become negative.
 */
export const socketActiveConnectionsGauge = new Gauge({
  name: "socket_io_active_connections",
  help: "Current number of active Socket.IO client connections",
  registers: [metricsRegistry],
});

// Register standard Node.js process and runtime metrics
client.collectDefaultMetrics({
  register: metricsRegistry,
});

// Internal connection counter to ensure non-negative bounds
let activeConnectionsCount = 0;

export function incrementActiveConnections(): number {
  activeConnectionsCount += 1;
  socketActiveConnectionsGauge.set(activeConnectionsCount);
  return activeConnectionsCount;
}

export function decrementActiveConnections(): number {
  activeConnectionsCount = Math.max(0, activeConnectionsCount - 1);
  socketActiveConnectionsGauge.set(activeConnectionsCount);
  return activeConnectionsCount;
}

export function getActiveConnectionsCount(): number {
  return activeConnectionsCount;
}

export function resetActiveConnections(): void {
  activeConnectionsCount = 0;
  socketActiveConnectionsGauge.set(0);
}

/**
 * Normalizes an Express request route path to prevent label cardinality explosions.
 * Returns parameterized route templates (e.g. '/api/v1/teams/:id/join') instead of raw paths.
 */
export function extractNormalizedRoute(req: Request): string {
  if (req.route?.path) {
    const basePath = req.baseUrl || "";
    let routePath = "";
    if (typeof req.route.path === "string") {
      routePath = req.route.path;
    } else if (Array.isArray(req.route.path)) {
      routePath = req.route.path.join("");
    } else if (req.route.path instanceof RegExp) {
      routePath = req.route.path.source;
    } else {
      routePath = String(req.route.path);
    }

    let fullPath = `${basePath}${routePath}`;
    fullPath = fullPath.replace(/\/+/g, "/");
    if (fullPath.length > 1 && fullPath.endsWith("/")) {
      fullPath = fullPath.slice(0, -1);
    }
    return fullPath || "/";
  }

  return "UNMATCHED_ROUTE";
}

/**
 * Resets recorded metrics values without unregistering them.
 * Useful for test isolation between Vitest suites.
 */
export function resetMetricsForTesting(): void {
  httpRequestDurationHistogram.reset();
  resetActiveConnections();
}
