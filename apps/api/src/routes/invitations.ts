import { Router, type Request, type Response, type NextFunction } from "express";
import { InvitationService } from "../services/invitation.service.js";
import { requireAuth } from "../middleware/auth.js";
import { idempotency } from "../middleware/idempotency.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "@crewconnect/shared";

export const invitationsRouter = Router();

/**
 * POST /api/v1/invitations/accept
 * Redeem an invitation token using the central atomic seat-reservation service.
 */
invitationsRouter.post(
  "/accept",
  requireAuth,
  idempotency({ required: true, endpoint: "POST /api/v1/invitations/accept" }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = (req.body?.token || req.body?.inviteCode) as string;
      if (!token || typeof token !== "string") {
        throw AppError.badRequest("Invitation token is required", ERROR_CODES.INVITATION_INVALID);
      }

      const result = await InvitationService.acceptInvitation(token, req.user!.id, req.idempotency);

      res.status(201).json({
        success: true,
        data: result.responsePayload,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/invitations/redeem
 * Alias for /accept
 */
invitationsRouter.post(
  "/redeem",
  requireAuth,
  idempotency({ required: true, endpoint: "POST /api/v1/invitations/accept" }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = (req.body?.token || req.body?.inviteCode) as string;
      if (!token || typeof token !== "string") {
        throw AppError.badRequest("Invitation token is required", ERROR_CODES.INVITATION_INVALID);
      }

      const result = await InvitationService.acceptInvitation(token, req.user!.id, req.idempotency);

      res.status(201).json({
        success: true,
        data: result.responsePayload,
      });
    } catch (error) {
      next(error);
    }
  }
);
