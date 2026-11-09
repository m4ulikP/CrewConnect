import { Router } from "express";
import { healthRouter } from "./health.js";
import { authRouter } from "./auth.js";
import { hackathonsRouter } from "./hackathons.js";
import { teamsRouter } from "./teams.js";

export const v1Router = Router();

// Health check endpoint under /api/v1/health
v1Router.use("/health", healthRouter);

// Authentication module under /api/v1/auth
v1Router.use("/auth", authRouter);

// Hackathon module under /api/v1/hackathons
v1Router.use("/hackathons", hackathonsRouter);

// Team module under /api/v1/teams
v1Router.use("/teams", teamsRouter);

// Root /api/v1 info
v1Router.get("/", (_req, res) => {
  res.status(200).json({
    name: "CrewConnect API",
    version: "v1",
    status: "active",
    documentation: "/docs",
  });
});
