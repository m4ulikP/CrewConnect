import { Types } from "mongoose";
import {
  Team,
  JoinRequest,
  Hackathon,
  Membership,
  AuditLog,
  type IJoinRequest,
} from "../models/index.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "@crewconnect/shared";
import { SeatReservationService, type ReserveSeatResult } from "./seat-reservation.service.js";

export class JoinRequestService {
  /**
   * Submits a join request to an open team.
   */
  static async createJoinRequest(
    teamId: string,
    userId: string,
    message?: string
  ): Promise<IJoinRequest> {
    if (!Types.ObjectId.isValid(teamId)) {
      throw AppError.validation("Invalid team ID format");
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw AppError.validation("Invalid user ID format");
    }

    const team = await Team.findById(teamId);
    if (!team) {
      throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
    }

    if (team.status === "DISBANDED") {
      throw AppError.conflict(
        ERROR_CODES.TEAM_DISBANDED,
        "Cannot submit join request to a disbanded team"
      );
    }

    if (!team.isOpen) {
      throw AppError.conflict(
        ERROR_CODES.TEAM_CLOSED,
        "This team is not currently accepting new members"
      );
    }

    if (team.memberCount >= team.maxCapacity) {
      throw AppError.conflict(
        ERROR_CODES.TEAM_FULL,
        `The team has reached maximum capacity (${team.memberCount}/${team.maxCapacity}).`
      );
    }

    const hackathon = await Hackathon.findById(team.hackathonId);
    if (!hackathon || hackathon.status === "COMPLETED") {
      throw AppError.badRequest(
        "Hackathon has completed and is no longer accepting requests",
        ERROR_CODES.HACKATHON_NOT_ACTIVE
      );
    }

    const existingMembership = await Membership.findOne({
      hackathonId: team.hackathonId,
      userId: new Types.ObjectId(userId),
      status: "ACTIVE",
    });
    if (existingMembership) {
      throw AppError.conflict(
        ERROR_CODES.ALREADY_IN_TEAM,
        "User is already an active member of a team in this hackathon"
      );
    }

    const existingRequest = await JoinRequest.findOne({
      teamId: new Types.ObjectId(teamId),
      userId: new Types.ObjectId(userId),
      status: "PENDING",
    });
    if (existingRequest) {
      throw AppError.conflict(
        ERROR_CODES.JOIN_REQUEST_ALREADY_EXISTS,
        "You already have a pending join request for this team"
      );
    }

    try {
      const joinRequest = await JoinRequest.create({
        hackathonId: team.hackathonId,
        teamId: team._id,
        userId: new Types.ObjectId(userId),
        message: message?.trim() || "",
        status: "PENDING",
      });

      await AuditLog.create({
        hackathonId: team.hackathonId,
        teamId: team._id,
        actorId: new Types.ObjectId(userId),
        action: "JOIN_REQUEST_SUBMITTED",
        metadata: {
          requestId: String(joinRequest._id),
          message: joinRequest.message,
        },
        timestamp: new Date(),
      });

      return joinRequest;
    } catch (err: unknown) {
      const mongoErr = err as { code?: number };
      if (mongoErr?.code === 11000) {
        throw AppError.conflict(
          ERROR_CODES.JOIN_REQUEST_ALREADY_EXISTS,
          "You already have a pending join request for this team"
        );
      }
      throw err;
    }
  }

  /**
   * Lists pending join requests for a team (Leader only).
   */
  static async listJoinRequests(teamId: string, leaderUserId: string): Promise<IJoinRequest[]> {
    if (!Types.ObjectId.isValid(teamId)) {
      throw AppError.validation("Invalid team ID format");
    }

    const team = await Team.findById(teamId);
    if (!team) {
      throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
    }

    if (team.leaderId.toString() !== leaderUserId.toString()) {
      throw AppError.forbidden(
        "Only the team leader can view join requests",
        ERROR_CODES.NOT_TEAM_LEADER
      );
    }

    return await JoinRequest.find({
      teamId: new Types.ObjectId(teamId),
      status: "PENDING",
    })
      .populate("userId", "displayName email skills bio githubUrl experienceLevel")
      .sort({ createdAt: -1 });
  }

  /**
   * Approves a pending join request using the central atomic seat-reservation service (Leader only).
   */
  static async approveJoinRequest(
    teamId: string,
    requestId: string,
    leaderUserId: string,
    idempotency?: {
      recordId: Types.ObjectId | string;
      ownerToken: string;
      payloadHash: string;
    }
  ): Promise<ReserveSeatResult> {
    if (!Types.ObjectId.isValid(teamId) || !Types.ObjectId.isValid(requestId)) {
      throw AppError.validation("Invalid ID format");
    }

    const team = await Team.findById(teamId);
    if (!team) {
      throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
    }

    if (team.leaderId.toString() !== leaderUserId.toString()) {
      throw AppError.forbidden(
        "Only the team leader can approve join requests",
        ERROR_CODES.NOT_TEAM_LEADER
      );
    }

    const request = await JoinRequest.findOne({
      _id: new Types.ObjectId(requestId),
      teamId: new Types.ObjectId(teamId),
    });

    if (!request) {
      throw AppError.notFound("Join request not found", ERROR_CODES.NOT_FOUND);
    }

    if (request.status !== "PENDING") {
      throw AppError.badRequest(
        "Join request is not pending",
        ERROR_CODES.JOIN_REQUEST_NOT_PENDING
      );
    }

    return await SeatReservationService.reserveSeatAndJoin({
      teamId,
      userId: request.userId.toString(),
      action: "JOIN_REQUEST_APPROVED",
      idempotency,
      metadata: {
        requestId,
        approvedBy: leaderUserId,
      },
      onBeforeCommit: async (session) => {
        const updated = await JoinRequest.findOneAndUpdate(
          {
            _id: new Types.ObjectId(requestId),
            teamId: new Types.ObjectId(teamId),
            status: "PENDING",
          },
          {
            $set: {
              status: "APPROVED",
              resolvedAt: new Date(),
              resolvedBy: new Types.ObjectId(leaderUserId),
            },
          },
          { session, new: true }
        );

        if (!updated) {
          throw AppError.badRequest(
            "Join request is no longer pending",
            ERROR_CODES.JOIN_REQUEST_NOT_PENDING
          );
        }
      },
    });
  }

  /**
   * Rejects a pending join request (Leader only). Does not affect capacity.
   */
  static async rejectJoinRequest(
    teamId: string,
    requestId: string,
    leaderUserId: string
  ): Promise<IJoinRequest> {
    if (!Types.ObjectId.isValid(teamId) || !Types.ObjectId.isValid(requestId)) {
      throw AppError.validation("Invalid ID format");
    }

    const team = await Team.findById(teamId);
    if (!team) {
      throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
    }

    if (team.leaderId.toString() !== leaderUserId.toString()) {
      throw AppError.forbidden(
        "Only the team leader can reject join requests",
        ERROR_CODES.NOT_TEAM_LEADER
      );
    }

    const updated = await JoinRequest.findOneAndUpdate(
      {
        _id: new Types.ObjectId(requestId),
        teamId: new Types.ObjectId(teamId),
        status: "PENDING",
      },
      {
        $set: {
          status: "REJECTED",
          resolvedAt: new Date(),
          resolvedBy: new Types.ObjectId(leaderUserId),
        },
      },
      { new: true }
    );

    if (!updated) {
      throw AppError.badRequest(
        "Join request not found or not in PENDING state",
        ERROR_CODES.JOIN_REQUEST_NOT_PENDING
      );
    }

    await AuditLog.create({
      hackathonId: team.hackathonId,
      teamId: team._id,
      actorId: new Types.ObjectId(leaderUserId),
      targetUserId: updated.userId,
      action: "JOIN_REQUEST_REJECTED",
      metadata: { requestId },
      timestamp: new Date(),
    });

    return updated;
  }

  /**
   * Cancels a pending join request (Request Owner only). Does not affect capacity.
   */
  static async cancelJoinRequest(
    teamId: string,
    requestId: string,
    userId: string
  ): Promise<IJoinRequest> {
    if (!Types.ObjectId.isValid(teamId) || !Types.ObjectId.isValid(requestId)) {
      throw AppError.validation("Invalid ID format");
    }

    const request = await JoinRequest.findOne({
      _id: new Types.ObjectId(requestId),
      teamId: new Types.ObjectId(teamId),
    });

    if (!request) {
      throw AppError.notFound("Join request not found", ERROR_CODES.NOT_FOUND);
    }

    if (request.userId.toString() !== userId.toString()) {
      throw AppError.forbidden("You can only cancel your own join request", ERROR_CODES.FORBIDDEN);
    }

    if (request.status !== "PENDING") {
      throw AppError.badRequest(
        "Only pending join requests can be cancelled",
        ERROR_CODES.JOIN_REQUEST_NOT_PENDING
      );
    }

    const updated = await JoinRequest.findOneAndUpdate(
      {
        _id: new Types.ObjectId(requestId),
        teamId: new Types.ObjectId(teamId),
        userId: new Types.ObjectId(userId),
        status: "PENDING",
      },
      {
        $set: {
          status: "CANCELLED",
          resolvedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updated) {
      throw AppError.badRequest(
        "Join request is no longer pending",
        ERROR_CODES.JOIN_REQUEST_NOT_PENDING
      );
    }

    return updated;
  }
}
