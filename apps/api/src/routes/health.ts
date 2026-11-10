import { Router } from "express";
import type { Request, Response } from "express";
import { checkDatabaseHealth } from "../db/connection.js";
import { env } from "../config/env.js";

export const healthRouter = Router();

/**
 * GET /health and GET /api/v1/health
 * Comprehensive health status including database connectivity and replica set state
 */
healthRouter.get("/", async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();

  const payload = {
    status: dbHealth.ok ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    database: {
      connected: dbHealth.ok,
      status: dbHealth.status,
      isReplicaSet: dbHealth.isReplicaSet,
      replicaSet: dbHealth.replicaSetName,
    },
    version: "0.1.0",
  };

  res.status(200).json(payload);
});

/**
 * GET /health/live
 * Container liveness probe: returns 200 as long as Node process is responsive
 */
healthRouter.get("/live", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/ready
 * Container readiness probe: returns 200 only if MongoDB connection & replica set are healthy
 */
healthRouter.get("/ready", async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();
  const isReady = dbHealth.ok;

  res.status(isReady ? 200 : 503).json({
    status: isReady ? "ok" : "not_ready",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      connected: dbHealth.ok,
      status: dbHealth.status,
      isReplicaSet: dbHealth.isReplicaSet,
      replicaSet: dbHealth.replicaSetName,
    },
  });
});
