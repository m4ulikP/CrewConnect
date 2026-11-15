import { Router } from "express";
import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { metricsRegistry } from "./registry.js";

export const metricsRouter = Router();

/**
 * GET /metrics and GET /api/v1/metrics
 * Standard Prometheus exposition endpoint returning plaintext telemetry.
 */
metricsRouter.get("/", async (req: Request, res: Response) => {
  if (env.METRICS_ENABLED === false) {
    res.status(404).send("Metrics endpoint is disabled");
    return;
  }

  // Optional scrape protection via bearer token (if configured in production environment)
  if (env.METRICS_BEARER_TOKEN) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${env.METRICS_BEARER_TOKEN}`) {
      res.status(401).send("Unauthorized: Invalid metrics bearer token\n");
      return;
    }
  }

  try {
    res.setHeader("Content-Type", metricsRegistry.contentType);
    const metricsData = await metricsRegistry.metrics();
    res.status(200).send(metricsData);
  } catch (err: unknown) {
    console.error("Prometheus metrics collection error:", err);
    res.status(500).send("Error generating metrics\n");
  }
});
