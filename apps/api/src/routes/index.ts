import { Router } from "express";
import { healthRouter } from "./health.js";

export const v1Router = Router();

// Health check endpoint under /api/v1/health
v1Router.use("/health", healthRouter);

// Root /api/v1 info
v1Router.get("/", (_req, res) => {
  res.status(200).json({
    name: "CrewConnect API",
    version: "v1",
    status: "active",
    documentation: "/docs",
  });
});
