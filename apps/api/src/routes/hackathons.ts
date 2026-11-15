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
import { ensureDefaultHackathonAndDemoData } from "../services/demo-seed.service.js";
import {
  FALLBACK_DEMO_HACKATHON,
  FALLBACK_DEMO_TEAMS,
  isDevFallbackActive,
} from "../services/demo-fixtures.js";

export const hackathonsRouter = Router();

/**
 * GET /api/v1/hackathons
 * List all available hackathons
 */
hackathonsRouter.get(
  "/",
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (isDevFallbackActive()) {
        res.status(200).json({
          success: true,
          data: [FALLBACK_DEMO_HACKATHON],
        });
        return;
      }
      const hackathons = await Hackathon.find().sort({ startDate: -1 });
      res.status(200).json({
        success: true,
        data: hackathons,
      });
    } catch (error) {
      if (isDevFallbackActive()) {
        res.status(200).json({
          success: true,
          data: [FALLBACK_DEMO_HACKATHON],
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/hackathons/seed-demo
 * Seed or verify the default demo hackathon (Hack4Hack 2026) and initial demo squads.
 */
hackathonsRouter.post(
  "/seed-demo",
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await ensureDefaultHackathonAndDemoData();
      res.status(200).json({
        success: true,
        message: "Demo hackathon and sample squads ensured successfully",
        data: result,
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
      const {
        page = 1,
        limit = 10,
        search,
        hasVacancies,
        skills,
      } = req.query as unknown as ListTeamsQueryInput;

      if (isDevFallbackActive()) {
        let filtered = [...FALLBACK_DEMO_TEAMS];
        if (search) {
          const lower = search.toLowerCase();
          filtered = filtered.filter(
            (t) => t.name.toLowerCase().includes(lower) || t.tagline.toLowerCase().includes(lower)
          );
        }
        if (hasVacancies) {
          filtered = filtered.filter((t) => t.isOpen && t.memberCount < t.maxCapacity);
        }
        if (skills && skills.length > 0) {
          filtered = filtered.filter((t) => skills.some((s) => t.skillsNeeded.includes(s)));
        }
        res.status(200).json({
          success: true,
          data: filtered,
          meta: {
            page: Number(page),
            limit: Number(limit),
            total: filtered.length,
          },
        });
        return;
      }

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
      if (isDevFallbackActive()) {
        res.status(200).json({
          success: true,
          data: FALLBACK_DEMO_TEAMS,
          meta: { page: 1, limit: 10, total: FALLBACK_DEMO_TEAMS.length },
        });
        return;
      }
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
