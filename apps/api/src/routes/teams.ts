import { Router, type Request, type Response, type NextFunction } from "express";
import { Types } from "mongoose";
import { TeamService } from "../services/team.service.js";
import { AuditLog, Membership } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  UpdateTeamSchema,
  TransferLeadershipSchema,
  type UpdateTeamInput,
  type TransferLeadershipInput,
} from "@crewconnect/shared";
import { AppError } from "../errors/AppError.js";

export const teamsRouter = Router();

/**
 * GET /api/v1/teams/:id
 * Retrieve team details with populated leader info
 */
teamsRouter.get("/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const team = await TeamService.getTeamById(req.params.id);
    res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/teams/:id/members
 * Retrieve active member roster with user profile details
 */
teamsRouter.get(
  "/:id/members",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roster = await TeamService.getTeamRoster(req.params.id);
      res.status(200).json({
        success: true,
        data: roster,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/teams/:id
 * Update non-protected team details (leader only)
 */
teamsRouter.patch(
  "/:id",
  requireAuth,
  validateBody(UpdateTeamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teamId = req.params.id;
      if (!Types.ObjectId.isValid(teamId)) {
        throw AppError.validation("Invalid team ID format");
      }
      const userId = req.user!.id;
      const input = req.body as UpdateTeamInput;

      const updated = await TeamService.updateTeamDetails(teamId, userId, input);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/teams/:id/open
 * Open team to accept new members (leader only)
 */
teamsRouter.post(
  "/:id/open",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teamId = req.params.id;
      if (!Types.ObjectId.isValid(teamId)) {
        throw AppError.validation("Invalid team ID format");
      }
      const userId = req.user!.id;

      const updated = await TeamService.setTeamOpenStatus(teamId, userId, true);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/teams/:id/close
 * Close team from accepting new members (leader only)
 */
teamsRouter.post(
  "/:id/close",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teamId = req.params.id;
      if (!Types.ObjectId.isValid(teamId)) {
        throw AppError.validation("Invalid team ID format");
      }
      const userId = req.user!.id;

      const updated = await TeamService.setTeamOpenStatus(teamId, userId, false);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/teams/:id/transfer-leadership
 * Atomically transfer leadership to an active team member (leader only)
 */
teamsRouter.post(
  "/:id/transfer-leadership",
  requireAuth,
  validateBody(TransferLeadershipSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teamId = req.params.id;
      const currentLeaderId = req.user!.id;
      const { newLeaderId } = req.body as TransferLeadershipInput;

      const updated = await TeamService.transferLeadership(teamId, currentLeaderId, newLeaderId);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/teams/:id/leave
 * Member voluntary departure.
 * If sole remaining member leaves, team is disbanded atomically.
 */
teamsRouter.post(
  "/:id/leave",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teamId = req.params.id;
      if (!Types.ObjectId.isValid(teamId)) {
        throw AppError.validation("Invalid team ID format");
      }
      const userId = req.user!.id;

      const result = await TeamService.leaveTeam(teamId, userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/teams/:id/members/:userId
 * Leader removes an active member
 */
teamsRouter.delete(
  "/:id/members/:userId",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teamId = req.params.id;
      const callerUserId = req.user!.id;
      const targetUserId = req.params.userId;

      const updatedTeam = await TeamService.removeMember(teamId, callerUserId, targetUserId);

      res.status(200).json({
        success: true,
        data: updatedTeam,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/teams/:id/disband
 * Leader disbands the team atomically
 */
teamsRouter.post(
  "/:id/disband",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teamId = req.params.id;
      const callerUserId = req.user!.id;

      const disbandedTeam = await TeamService.disbandTeam(teamId, callerUserId);

      res.status(200).json({
        success: true,
        data: disbandedTeam,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/teams/:id/audit-logs
 * Retrieve audit log events for team members/leader
 */
teamsRouter.get(
  "/:id/audit-logs",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teamId = req.params.id;
      if (!Types.ObjectId.isValid(teamId)) {
        throw AppError.validation("Invalid team ID format");
      }
      const userId = req.user!.id;

      // Verify user is or was an active member of this team or has permissions
      const membership = await Membership.findOne({ teamId, userId });
      if (!membership) {
        throw AppError.forbidden("You must be a team member to view audit logs");
      }

      const logs = await AuditLog.find({ teamId })
        .populate("actorId", "displayName email")
        .populate("targetUserId", "displayName email")
        .sort({ timestamp: -1 })
        .limit(100);

      res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  }
);
