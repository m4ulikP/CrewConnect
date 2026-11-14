import { Router } from "express";
import { healthRouter } from "./health.js";
import { authRouter } from "./auth.js";
import { usersRouter } from "./users.js";
import { hackathonsRouter } from "./hackathons.js";
import { teamsRouter } from "./teams.js";
import { invitationsRouter } from "./invitations.js";
import { apiRateLimiter } from "../middleware/rateLimiter.js";

export const v1Router = Router();

// Health check endpoint under /api/v1/health (unthrottled for monitoring probes)
v1Router.use("/health", healthRouter);

// Apply general API rate limiter to all application routes
v1Router.use(apiRateLimiter);

// Authentication module under /api/v1/auth
v1Router.use("/auth", authRouter);

// User profile module under /api/v1/users
v1Router.use("/users", usersRouter);

// Hackathon module under /api/v1/hackathons
v1Router.use("/hackathons", hackathonsRouter);

// Team module under /api/v1/teams
v1Router.use("/teams", teamsRouter);

// Invitations module under /api/v1/invitations
v1Router.use("/invitations", invitationsRouter);

// Root /api/v1 info
v1Router.get("/", (_req, res) => {
  res.status(200).json({
    name: "CrewConnect API",
    version: "v1",
    status: "active",
    documentation: "/docs",
  });
});
