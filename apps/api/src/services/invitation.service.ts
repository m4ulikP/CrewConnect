import crypto from "node:crypto";
import { Types } from "mongoose";
import { Team, Invitation, User, AuditLog, type IInvitation } from "../models/index.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "@crewconnect/shared";
import { SeatReservationService, type ReserveSeatResult } from "./seat-reservation.service.js";

export interface CreateInvitationInput {
  inviteeId?: string;
  maxUses?: number;
  expiresInHours?: number;
}

export class InvitationService {
  /**
   * Hashes a raw secret token using SHA-256.
   */
  static hashToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
  }

  /**
   * Generates a cryptographically secure random invitation token.
   * Returns the raw token once. Only the SHA-256 hash is persisted in MongoDB.
   */
  static async createInvitation(
    teamId: string,
    leaderUserId: string,
    input: CreateInvitationInput = {}
  ): Promise<{ invitation: IInvitation; rawToken: string }> {
    if (!Types.ObjectId.isValid(teamId)) {
      throw AppError.validation("Invalid team ID format");
    }

    const team = await Team.findById(teamId);
    if (!team) {
      throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
    }

    if (team.status === "DISBANDED") {
      throw AppError.conflict(
        ERROR_CODES.TEAM_DISBANDED,
        "Cannot create invitations for a disbanded team"
      );
    }

    if (team.leaderId.toString() !== leaderUserId.toString()) {
      throw AppError.forbidden(
        "Only the team leader can create invitations",
        ERROR_CODES.NOT_TEAM_LEADER
      );
    }

    let inviteeObjectId: Types.ObjectId | undefined;
    if (input.inviteeId) {
      if (!Types.ObjectId.isValid(input.inviteeId)) {
        throw AppError.validation("Invalid invitee user ID format");
      }
      if (input.inviteeId.toString() === leaderUserId.toString()) {
        throw AppError.badRequest("Cannot invite yourself", ERROR_CODES.VALIDATION_ERROR);
      }
      const inviteeUser = await User.findById(input.inviteeId);
      if (!inviteeUser) {
        throw AppError.notFound("Invited user not found", ERROR_CODES.NOT_FOUND);
      }
      inviteeObjectId = new Types.ObjectId(input.inviteeId);
    }

    const rawToken = `crew_${crypto.randomBytes(32).toString("hex")}`;
    const tokenHash = this.hashToken(rawToken);

    const maxUses = Math.max(1, Math.min(10, input.maxUses || 1));
    const expiresInHours = Math.max(1, Math.min(168, input.expiresInHours || 24));
    const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);

    const invitation = await Invitation.create({
      hackathonId: team.hackathonId,
      teamId: team._id,
      inviterId: new Types.ObjectId(leaderUserId),
      inviteeId: inviteeObjectId,
      tokenHash,
      status: "ACTIVE",
      usesCount: 0,
      maxUses,
      expiresAt,
    });

    await AuditLog.create({
      hackathonId: team.hackathonId,
      teamId: team._id,
      actorId: new Types.ObjectId(leaderUserId),
      targetUserId: inviteeObjectId,
      action: "INVITE_CREATED",
      metadata: {
        invitationId: String(invitation._id),
        maxUses,
        expiresAt: expiresAt.toISOString(),
      },
      timestamp: new Date(),
    });

    return {
      invitation,
      rawToken,
    };
  }

  /**
   * Lists invitations for a team (Leader only). Token hashes are never exposed.
   */
  static async listInvitations(teamId: string, leaderUserId: string): Promise<IInvitation[]> {
    if (!Types.ObjectId.isValid(teamId)) {
      throw AppError.validation("Invalid team ID format");
    }

    const team = await Team.findById(teamId);
    if (!team) {
      throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
    }

    if (team.leaderId.toString() !== leaderUserId.toString()) {
      throw AppError.forbidden(
        "Only the team leader can view invitations",
        ERROR_CODES.NOT_TEAM_LEADER
      );
    }

    return await Invitation.find({ teamId: new Types.ObjectId(teamId) })
      .populate("inviteeId", "displayName email")
      .populate("inviterId", "displayName email")
      .sort({ createdAt: -1 });
  }

  /**
   * Revokes an invitation (Leader only).
   */
  static async revokeInvitation(
    teamId: string,
    invitationId: string,
    leaderUserId: string
  ): Promise<IInvitation> {
    if (!Types.ObjectId.isValid(teamId) || !Types.ObjectId.isValid(invitationId)) {
      throw AppError.validation("Invalid ID format");
    }

    const team = await Team.findById(teamId);
    if (!team) {
      throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
    }

    if (team.leaderId.toString() !== leaderUserId.toString()) {
      throw AppError.forbidden(
        "Only the team leader can revoke invitations",
        ERROR_CODES.NOT_TEAM_LEADER
      );
    }

    const updated = await Invitation.findOneAndUpdate(
      {
        _id: new Types.ObjectId(invitationId),
        teamId: new Types.ObjectId(teamId),
        status: "ACTIVE",
      },
      {
        $set: { status: "REVOKED" },
      },
      { new: true }
    );

    if (!updated) {
      throw AppError.notFound(
        "Active invitation not found or already revoked/exhausted",
        ERROR_CODES.NOT_FOUND
      );
    }

    return updated;
  }

  /**
   * Accepts an invitation using a raw secret token and the central atomic seat-reservation service.
   */
  static async acceptInvitation(
    token: string,
    userId: string,
    idempotency?: {
      recordId: Types.ObjectId | string;
      ownerToken: string;
      payloadHash: string;
    }
  ): Promise<ReserveSeatResult> {
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      throw AppError.badRequest("Invitation token is required", ERROR_CODES.INVITATION_INVALID);
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw AppError.validation("Invalid user ID format");
    }

    const tokenHash = this.hashToken(token);

    const invitation = await Invitation.findOne({ tokenHash });
    if (!invitation) {
      throw AppError.badRequest("Invalid invitation token", ERROR_CODES.INVITATION_INVALID);
    }

    if (invitation.status === "REVOKED") {
      throw AppError.badRequest("This invitation has been revoked", ERROR_CODES.INVITATION_REVOKED);
    }

    if (invitation.status === "EXHAUSTED" || invitation.usesCount >= invitation.maxUses) {
      throw AppError.badRequest(
        "This invitation has already reached its maximum allowed uses",
        ERROR_CODES.INVITATION_EXHAUSTED
      );
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      // Mark expired lazily if not already marked
      await Invitation.findByIdAndUpdate(invitation._id, { status: "EXPIRED" });
      throw AppError.badRequest("This invitation has expired", ERROR_CODES.INVITATION_EXPIRED);
    }

    if (invitation.inviteeId && invitation.inviteeId.toString() !== userId.toString()) {
      throw AppError.forbidden(
        "This invitation was addressed to a different user account",
        ERROR_CODES.INVITATION_WRONG_ACCOUNT
      );
    }

    return await SeatReservationService.reserveSeatAndJoin({
      teamId: invitation.teamId.toString(),
      userId,
      action: "INVITE_REDEEMED",
      idempotency,
      metadata: {
        invitationId: String(invitation._id),
      },
      onBeforeCommit: async (session) => {
        const willBeExhausted = invitation.usesCount + 1 >= invitation.maxUses;
        const consumed = await Invitation.findOneAndUpdate(
          {
            _id: invitation._id,
            status: "ACTIVE",
            usesCount: { $lt: invitation.maxUses },
            expiresAt: { $gt: new Date() },
          },
          {
            $inc: { usesCount: 1 },
            ...(willBeExhausted ? { $set: { status: "EXHAUSTED" } } : {}),
          },
          { session, new: true }
        );

        if (!consumed) {
          throw AppError.badRequest(
            "Invitation is no longer active, has expired, or reached its usage limit",
            ERROR_CODES.INVITATION_INVALID
          );
        }
      },
    });
  }
}
