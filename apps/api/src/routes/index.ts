import { Router } from "express";
import { healthRouter } from "./health.js";
import { authRouter } from "./auth.js";

export const v1Router = Router();

// Health check endpoint under /api/v1/health
v1Router.use("/health", healthRouter);

// Authentication module under /api/v1/auth
v1Router.use("/auth", authRouter);

// Root /api/v1 info
v1Router.get("/", (_req, res) => {
  res.status(200).json({
    name: "CrewConnect API",
    version: "v1",
    status: "active",
    documentation: "/docs",
  });
});
