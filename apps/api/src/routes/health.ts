import { Router } from "express";
import type { Request, Response } from "express";
import { checkDatabaseHealth } from "../db/connection.js";
import { env } from "../config/env.js";

export const healthRouter = Router();

/**
 * GET /health and GET /api/v1/health
 * Comprehensive health status including database connectivity, replica set topology, and primary state
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
      expectedReplicaSet: dbHealth.expectedReplicaSetName,
      isWritablePrimary: dbHealth.isWritablePrimary,
      primary: dbHealth.primary,
      error: dbHealth.error,
    },
    version: "0.1.0",
  };

  res.status(dbHealth.ok ? 200 : 503).json(payload);
});

/**
 * GET /health/live
 * Container liveness probe: returns 200 as long as Node process is responsive (independent of database)
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
 * Container readiness probe: returns 200 ONLY if MongoDB is connected as a replica set with a writable primary.
 * Returns 503 if disconnected, standalone, or if no writable primary is elected.
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
      expectedReplicaSet: dbHealth.expectedReplicaSetName,
      isWritablePrimary: dbHealth.isWritablePrimary,
      primary: dbHealth.primary,
      error: dbHealth.error,
    },
  });
});
