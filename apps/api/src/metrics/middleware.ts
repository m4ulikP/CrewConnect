import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { httpRequestDurationHistogram, extractNormalizedRoute } from "./registry.js";

/**
 * Express middleware that observes completed HTTP request durations in seconds.
 *
 * Requirements enforced:
 * - Scrape endpoint (/metrics and /api/v1/metrics) is never recorded recursively.
 * - Labels are strictly bounded (method, normalized route template, status code).
 * - Premature client disconnection (res close) is recorded safely without unhandled errors.
 * - Duplicate observations per request are prevented via once-guard.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // If metrics collection is disabled, pass through
  if (env.METRICS_ENABLED === false) {
    return next();
  }

  // Avoid recording the /metrics scrape endpoint itself
  const url = req.originalUrl || req.url || "";
  if (
    url === "/metrics" ||
    url.startsWith("/metrics?") ||
    url.startsWith("/metrics/") ||
    url === "/api/v1/metrics" ||
    url.startsWith("/api/v1/metrics?") ||
    url.startsWith("/api/v1/metrics/")
  ) {
    return next();
  }

  const startTime = process.hrtime.bigint();
  let recorded = false;

  const recordObservation = () => {
    if (recorded) return;
    recorded = true;

    try {
      const endTime = process.hrtime.bigint();
      const durationSeconds = Number(endTime - startTime) / 1e9;

      const method = req.method;
      const route = extractNormalizedRoute(req);
      const statusCode = String(res.statusCode || 200);

      httpRequestDurationHistogram.observe(
        {
          method,
          route,
          status_code: statusCode,
        },
        durationSeconds
      );
    } catch {
      // Invariant: Metrics observation failures must never crash or block request lifecycle
    }
  };

  res.once("finish", recordObservation);
  res.once("close", recordObservation);

  next();
}
