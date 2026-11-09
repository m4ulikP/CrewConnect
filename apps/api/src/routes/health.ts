import { Router } from "express";
import type { Request, Response } from "express";
import { checkDatabaseHealth } from "../db/connection.js";
import { env } from "../config/env.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();

  const payload = {
    status: "ok",
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
