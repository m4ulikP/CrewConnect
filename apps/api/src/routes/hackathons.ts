import { Router, type Request, type Response, type NextFunction } from "express";
import { Types } from "mongoose";
import { Hackathon } from "../models/index.js";
import { TeamService } from "../services/team.service.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import {
  CreateTeamSchema,
  ListTeamsQuerySchema,
  type CreateTeamInput,
  type ListTeamsQueryInput,
} from "@crewconnect/shared";
import { AppError } from "../errors/AppError.js";

export const hackathonsRouter = Router();

/**
 * GET /api/v1/hackathons
 * List all available hackathons
 */
hackathonsRouter.get(
  "/",
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hackathons = await Hackathon.find().sort({ startDate: -1 });
      res.status(200).json({
        success: true,
        data: hackathons,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/hackathons/:id
 * Get single hackathon details
 */
hackathonsRouter.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        throw AppError.validation("Invalid hackathon ID format");
      }
      const hackathon = await Hackathon.findById(id);
      if (!hackathon) {
        throw AppError.notFound("Hackathon not found");
      }
      res.status(200).json({
        success: true,
        data: hackathon,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/hackathons/:hackathonId/teams
 * List / search teams in a hackathon
 */
hackathonsRouter.get(
  "/:hackathonId/teams",
  validateQuery(ListTeamsQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { hackathonId } = req.params;
      const { page, limit, search, hasVacancies, skills } =
        req.query as unknown as ListTeamsQueryInput;

      const result = await TeamService.listTeams(hackathonId, {
        page,
        limit,
        search,
        hasVacancies,
        skills,
      });

      res.status(200).json({
        success: true,
        data: result.teams,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/hackathons/:hackathonId/teams
 * Create a new team in a hackathon (leader membership created atomically)
 */
hackathonsRouter.post(
  "/:hackathonId/teams",
  requireAuth,
  validateBody(CreateTeamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { hackathonId } = req.params;
      const userId = req.user!.id;
      const input = req.body as CreateTeamInput;

      const result = await TeamService.createTeam(hackathonId, userId, input);

      res.status(201).json({
        success: true,
        data: {
          team: result.team,
          membership: result.membership,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/hackathons/:hackathonId/my-team
 * Get current user's active team in this hackathon (if any)
 */
hackathonsRouter.get(
  "/:hackathonId/my-team",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { hackathonId } = req.params;
      const userId = req.user!.id;

      const result = await TeamService.getUserActiveTeamInHackathon(hackathonId, userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);
