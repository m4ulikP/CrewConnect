import { Types, type ClientSession } from "mongoose";
import {
  Team,
  JoinRequest,
  Hackathon,
  Membership,
  AuditLog,
  User,
  type IJoinRequest,
} from "../models/index.js";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "@crewconnect/shared";
import { withTransactionRetry } from "../db/transaction.js";
import { SeatReservationService, type ReserveSeatResult } from "./seat-reservation.service.js";
import { EventDispatcher } from "../realtime/index.js";

function getJoinRequestExpirationMs(): number {
  return env.JOIN_REQUEST_EXPIRATION_HOURS * 3_600 * 1000;
}

function getEffectiveExpiresAt(request: {
  expiresAt?: Date | null;
  createdAt?: Date | null;
}): Date | null {
  if (request.expiresAt instanceof Date && !Number.isNaN(request.expiresAt.getTime())) {
    return request.expiresAt;
  }
  if (request.createdAt instanceof Date && !Number.isNaN(request.createdAt.getTime())) {
    return new Date(request.createdAt.getTime() + getJoinRequestExpirationMs());
  }
  return null;
}

function isRequestExpired(
  request: { expiresAt?: Date | null; createdAt?: Date | null },
  now: Date
): boolean {
  const effectiveExpiresAt = getEffectiveExpiresAt(request);
  return effectiveExpiresAt !== null && effectiveExpiresAt.getTime() <= now.getTime();
}

function buildExpiredQueryCondition(now: Date, durationMs: number): Record<string, unknown> {
  const legacyCutoff = new Date(now.getTime() - durationMs);
  return {
    $or: [
      { expiresAt: { $lte: now } },
      {
        $and: [
          { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }] },
          { createdAt: { $lte: legacyCutoff } },
        ],
      },
    ],
  };
}

function buildNonExpiredQueryCondition(now: Date, durationMs: number): Record<string, unknown> {
  const legacyCutoff = new Date(now.getTime() - durationMs);
  return {
    $or: [
      { expiresAt: { $gt: now } },
      {
        $and: [
          { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }] },
          {
            $or: [{ createdAt: { $gt: legacyCutoff } }, { createdAt: { $exists: false } }],
          },
        ],
      },
    ],
  };
}

export class JoinRequestService {
  /**
   * Computes server-side expiration timestamp for newly created join requests.
   */
  static computeExpiresAt(now: Date = new Date()): Date {
    return new Date(now.getTime() + getJoinRequestExpirationMs());
  }

  /**
   * Atomically transitions any matching stale PENDING join requests to EXPIRED and
   * writes transactional JOIN_REQUEST_EXPIRED audit entries within the same session.
   * Safe against concurrent execution: only conditional `status: "PENDING"` winners log audit events.
   */
  static async expireMatchingPendingRequests(
    scopeFilter: Record<string, unknown>,
    now: Date = new Date(),
    existingSession?: ClientSession
  ): Promise<number> {
    const durationMs = getJoinRequestExpirationMs();
    const expiredCondition = buildExpiredQueryCondition(now, durationMs);

    const runInSession = async (session: ClientSession): Promise<number> => {
      const candidates = await JoinRequest.find({
        ...scopeFilter,
        status: "PENDING",
        ...expiredCondition,
      }).session(session);

      if (candidates.length === 0) {
        return 0;
      }

      const auditEntries: Array<Record<string, unknown>> = [];

      for (const candidate of candidates) {
        const updated = await JoinRequest.findOneAndUpdate(
          {
            _id: candidate._id,
            status: "PENDING",
            ...expiredCondition,
          },
          {
            $set: {
              status: "EXPIRED",
              resolvedAt: now,
            },
          },
          { session, new: true }
        );

        if (updated) {
          const previousExpiresAt = getEffectiveExpiresAt(candidate);
          auditEntries.push({
            hackathonId: updated.hackathonId,
            teamId: updated.teamId,
            actorId: updated.userId,
            targetUserId: updated.userId,
            action: "JOIN_REQUEST_EXPIRED",
            metadata: {
              requestId: String(updated._id),
              expiredAt: now.toISOString(),
              previousExpiresAt: previousExpiresAt ? previousExpiresAt.toISOString() : null,
            },
            timestamp: now,
          });
        }
      }

      if (auditEntries.length > 0) {
        await AuditLog.create(auditEntries, { session, ordered: true });
      }

      return auditEntries.length;
    };

    if (existingSession) {
      return await runInSession(existingSession);
    }

    return await withTransactionRetry(runInSession);
  }

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

    const newRequest = await withTransactionRetry(async (session) => {
      const now = new Date();
      const team = await Team.findById(teamId).session(session);
      if (!team) {
        throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
      }

      if (team.status === "DISBANDED") {
        throw AppError.conflict(
          ERROR_CODES.TEAM_DISBANDED,
          "Cannot submit join request to a disbanded team"
        );
      }

      if (team.status === "ARCHIVED") {
        throw AppError.conflict(
          ERROR_CODES.TEAM_ARCHIVED,
          "Cannot submit join request to an archived team"
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

      const hackathon = await Hackathon.findById(team.hackathonId).session(session);
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
      }).session(session);
      if (existingMembership) {
        throw AppError.conflict(
          ERROR_CODES.ALREADY_IN_TEAM,
          "User is already an active member of a team in this hackathon"
        );
      }

      // Lazily expire any prior stale PENDING request for this applicant & team
      // within the same transaction before checking active pending uniqueness.
      await this.expireMatchingPendingRequests(
        {
          teamId: new Types.ObjectId(teamId),
          userId: new Types.ObjectId(userId),
        },
        now,
        session
      );

      const existingRequest = await JoinRequest.findOne({
        teamId: new Types.ObjectId(teamId),
        userId: new Types.ObjectId(userId),
        status: "PENDING",
      }).session(session);
      if (existingRequest) {
        throw AppError.conflict(
          ERROR_CODES.JOIN_REQUEST_ALREADY_EXISTS,
          "You already have a pending join request for this team"
        );
      }

      const expiresAt = this.computeExpiresAt(now);

      try {
        const [joinRequest] = await JoinRequest.create(
          [
            {
              hackathonId: team.hackathonId,
              teamId: team._id,
              userId: new Types.ObjectId(userId),
              message: message?.trim() || "",
              status: "PENDING",
              expiresAt,
            },
          ],
          { session }
        );

        await AuditLog.create(
          [
            {
              hackathonId: team.hackathonId,
              teamId: team._id,
              actorId: new Types.ObjectId(userId),
              action: "JOIN_REQUEST_SUBMITTED",
              metadata: {
                requestId: String(joinRequest._id),
                message: joinRequest.message,
                expiresAt: expiresAt.toISOString(),
              },
              timestamp: now,
            },
          ],
          { session }
        );

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
    });

    try {
      const applicant = await User.findById(userId);
      const team = await Team.findById(teamId);
      if (team) {
        EventDispatcher.dispatchJoinRequestSubmitted(team.leaderId.toString(), {
          requestId: newRequest._id.toString(),
          teamId,
          hackathonId: team.hackathonId.toString(),
          user: {
            id: userId,
            displayName: applicant?.displayName || "Applicant",
            skills: applicant?.skills || [],
          },
          message: newRequest.message,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn("Real-time event dispatch warning:", err);
    }

    return newRequest;
  }

  /**
   * Lists non-expired pending join requests for a team (Leader only).
   * Lazily expires stale pending requests before querying.
   */
  static async listJoinRequests(teamId: string, leaderUserId: string): Promise<IJoinRequest[]> {
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
        "Cannot approve join request for a disbanded team"
      );
    }

    if (team.status === "ARCHIVED") {
      throw AppError.conflict(
        ERROR_CODES.TEAM_ARCHIVED,
        "Cannot approve join request for an archived team"
      );
    }

    if (team.leaderId.toString() !== leaderUserId.toString()) {
      throw AppError.forbidden(
        "Only the team leader can view join requests",
        ERROR_CODES.NOT_TEAM_LEADER
      );
    }

    const now = new Date();
    const teamObjectId = new Types.ObjectId(teamId);
    await this.expireMatchingPendingRequests({ teamId: teamObjectId }, now);

    return await JoinRequest.find({
      teamId: teamObjectId,
      status: "PENDING",
      ...buildNonExpiredQueryCondition(now, getJoinRequestExpirationMs()),
    })
      .populate("userId", "displayName email skills bio githubUrl experienceLevel")
      .sort({ createdAt: -1 });
  }

  /**
   * Approves a pending, non-expired join request using the central atomic seat-reservation
   * service (Leader only). Never reserves capacity or creates membership if expired.
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

    if (team.status === "DISBANDED") {
      throw AppError.conflict(
        ERROR_CODES.TEAM_DISBANDED,
        "Cannot approve join request for a disbanded team"
      );
    }

    if (team.status === "ARCHIVED") {
      throw AppError.conflict(
        ERROR_CODES.TEAM_ARCHIVED,
        "Cannot approve join request for an archived team"
      );
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

    if (request.status === "EXPIRED") {
      throw AppError.badRequest("Join request has expired", ERROR_CODES.JOIN_REQUEST_EXPIRED);
    }

    if (request.status !== "PENDING") {
      throw AppError.badRequest(
        "Join request is not pending",
        ERROR_CODES.JOIN_REQUEST_NOT_PENDING
      );
    }

    const preCheckNow = new Date();
    if (isRequestExpired(request, preCheckNow)) {
      await this.expireMatchingPendingRequests(
        {
          _id: request._id,
          teamId: request.teamId,
        },
        preCheckNow
      );
      throw AppError.badRequest("Join request has expired", ERROR_CODES.JOIN_REQUEST_EXPIRED);
    }

    let expiredDuringRace = false;
    let raceTimestamp = preCheckNow;

    try {
      const result = await SeatReservationService.reserveSeatAndJoin({
        teamId,
        userId: request.userId.toString(),
        action: "JOIN_REQUEST_APPROVED",
        idempotency,
        metadata: {
          requestId,
          approvedBy: leaderUserId,
        },
        onBeforeCommit: async (session) => {
          const txNow = new Date();
          const nonExpiredCondition = buildNonExpiredQueryCondition(
            txNow,
            getJoinRequestExpirationMs()
          );

          const updated = await JoinRequest.findOneAndUpdate(
            {
              _id: new Types.ObjectId(requestId),
              teamId: new Types.ObjectId(teamId),
              status: "PENDING",
              ...nonExpiredCondition,
            },
            {
              $set: {
                status: "APPROVED",
                resolvedAt: txNow,
                resolvedBy: new Types.ObjectId(leaderUserId),
              },
            },
            { session, new: true }
          );

          if (!updated) {
            const current = await JoinRequest.findOne({
              _id: new Types.ObjectId(requestId),
              teamId: new Types.ObjectId(teamId),
            }).session(session);

            if (current && (current.status === "EXPIRED" || isRequestExpired(current, txNow))) {
              expiredDuringRace = current.status === "PENDING";
              raceTimestamp = txNow;
              throw AppError.badRequest(
                "Join request has expired",
                ERROR_CODES.JOIN_REQUEST_EXPIRED
              );
            }

            throw AppError.badRequest(
              "Join request is no longer pending",
              ERROR_CODES.JOIN_REQUEST_NOT_PENDING
            );
          }
        },
      });

      try {
        EventDispatcher.dispatchJoinRequestResolved(request.userId.toString(), {
          requestId,
          teamId,
          hackathonId: team.hackathonId.toString(),
          userId: request.userId.toString(),
          status: "APPROVED",
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("Real-time event dispatch warning:", err);
      }

      return result;
    } catch (error) {
      if (expiredDuringRace) {
        await this.expireMatchingPendingRequests(
          {
            _id: new Types.ObjectId(requestId),
            teamId: new Types.ObjectId(teamId),
          },
          raceTimestamp
        );
      }
      throw error;
    }
  }

  /**
   * Rejects a pending, non-expired join request (Leader only). Does not affect capacity.
   */
  static async rejectJoinRequest(
    teamId: string,
    requestId: string,
    leaderUserId: string
  ): Promise<IJoinRequest> {
    if (!Types.ObjectId.isValid(teamId) || !Types.ObjectId.isValid(requestId)) {
      throw AppError.validation("Invalid ID format");
    }

    let expiredDuringRace = false;
    let raceTimestamp = new Date();

    try {
      const rejectedRequest = await withTransactionRetry(async (session) => {
        const team = await Team.findById(teamId).session(session);
        if (!team) {
          throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
        }

        if (team.status === "DISBANDED") {
          throw AppError.conflict(
            ERROR_CODES.TEAM_DISBANDED,
            "Cannot reject join request for a disbanded team"
          );
        }

        if (team.status === "ARCHIVED") {
          throw AppError.conflict(
            ERROR_CODES.TEAM_ARCHIVED,
            "Cannot reject join request for an archived team"
          );
        }

        if (team.leaderId.toString() !== leaderUserId.toString()) {
          throw AppError.forbidden(
            "Only the team leader can reject join requests",
            ERROR_CODES.NOT_TEAM_LEADER
          );
        }

        const txNow = new Date();
        const nonExpiredCondition = buildNonExpiredQueryCondition(
          txNow,
          getJoinRequestExpirationMs()
        );

        const updated = await JoinRequest.findOneAndUpdate(
          {
            _id: new Types.ObjectId(requestId),
            teamId: new Types.ObjectId(teamId),
            status: "PENDING",
            ...nonExpiredCondition,
          },
          {
            $set: {
              status: "REJECTED",
              resolvedAt: txNow,
              resolvedBy: new Types.ObjectId(leaderUserId),
            },
          },
          { session, new: true }
        );

        if (!updated) {
          const current = await JoinRequest.findOne({
            _id: new Types.ObjectId(requestId),
            teamId: new Types.ObjectId(teamId),
          }).session(session);

          if (!current) {
            throw AppError.notFound("Join request not found", ERROR_CODES.NOT_FOUND);
          }

          if (current.status === "EXPIRED" || isRequestExpired(current, txNow)) {
            expiredDuringRace = current.status === "PENDING";
            raceTimestamp = txNow;
            throw AppError.badRequest("Join request has expired", ERROR_CODES.JOIN_REQUEST_EXPIRED);
          }

          throw AppError.badRequest(
            "Join request not found or not in PENDING state",
            ERROR_CODES.JOIN_REQUEST_NOT_PENDING
          );
        }

        await AuditLog.create(
          [
            {
              hackathonId: team.hackathonId,
              teamId: team._id,
              actorId: new Types.ObjectId(leaderUserId),
              targetUserId: updated.userId,
              action: "JOIN_REQUEST_REJECTED",
              metadata: { requestId },
              timestamp: txNow,
            },
          ],
          { session }
        );

        return updated;
      });

      try {
        EventDispatcher.dispatchJoinRequestResolved(rejectedRequest.userId.toString(), {
          requestId,
          teamId,
          hackathonId: rejectedRequest.hackathonId.toString(),
          userId: rejectedRequest.userId.toString(),
          status: "REJECTED",
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("Real-time event dispatch warning:", err);
      }

      return rejectedRequest;
    } catch (error) {
      if (expiredDuringRace) {
        await this.expireMatchingPendingRequests(
          {
            _id: new Types.ObjectId(requestId),
            teamId: new Types.ObjectId(teamId),
          },
          raceTimestamp
        );
      }
      throw error;
    }
  }

  /**
   * Cancels a pending, non-expired join request (Request Owner only). Does not affect capacity.
   */
  static async cancelJoinRequest(
    teamId: string,
    requestId: string,
    userId: string
  ): Promise<IJoinRequest> {
    if (!Types.ObjectId.isValid(teamId) || !Types.ObjectId.isValid(requestId)) {
      throw AppError.validation("Invalid ID format");
    }

    let expiredDuringRace = false;
    let raceTimestamp = new Date();

    try {
      return await withTransactionRetry(async (session) => {
        const request = await JoinRequest.findOne({
          _id: new Types.ObjectId(requestId),
          teamId: new Types.ObjectId(teamId),
        }).session(session);

        if (!request) {
          throw AppError.notFound("Join request not found", ERROR_CODES.NOT_FOUND);
        }

        if (request.userId.toString() !== userId.toString()) {
          throw AppError.forbidden(
            "You can only cancel your own join request",
            ERROR_CODES.FORBIDDEN
          );
        }

        if (request.status === "EXPIRED") {
          throw AppError.badRequest("Join request has expired", ERROR_CODES.JOIN_REQUEST_EXPIRED);
        }

        if (request.status !== "PENDING") {
          throw AppError.badRequest(
            "Only pending join requests can be cancelled",
            ERROR_CODES.JOIN_REQUEST_NOT_PENDING
          );
        }

        const txNow = new Date();
        const nonExpiredCondition = buildNonExpiredQueryCondition(
          txNow,
          getJoinRequestExpirationMs()
        );

        const updated = await JoinRequest.findOneAndUpdate(
          {
            _id: new Types.ObjectId(requestId),
            teamId: new Types.ObjectId(teamId),
            userId: new Types.ObjectId(userId),
            status: "PENDING",
            ...nonExpiredCondition,
          },
          {
            $set: {
              status: "CANCELLED",
              resolvedAt: txNow,
            },
          },
          { session, new: true }
        );

        if (!updated) {
          const current = await JoinRequest.findOne({
            _id: new Types.ObjectId(requestId),
            teamId: new Types.ObjectId(teamId),
          }).session(session);

          if (current && (current.status === "EXPIRED" || isRequestExpired(current, txNow))) {
            expiredDuringRace = current.status === "PENDING";
            raceTimestamp = txNow;
            throw AppError.badRequest("Join request has expired", ERROR_CODES.JOIN_REQUEST_EXPIRED);
          }

          throw AppError.badRequest(
            "Join request is no longer pending",
            ERROR_CODES.JOIN_REQUEST_NOT_PENDING
          );
        }

        await AuditLog.create(
          [
            {
              hackathonId: request.hackathonId,
              teamId: request.teamId,
              actorId: new Types.ObjectId(userId),
              action: "JOIN_REQUEST_CANCELLED",
              metadata: { requestId },
              timestamp: txNow,
            },
          ],
          { session }
        );

        return updated;
      });
    } catch (error) {
      if (expiredDuringRace) {
        await this.expireMatchingPendingRequests(
          {
            _id: new Types.ObjectId(requestId),
            teamId: new Types.ObjectId(teamId),
          },
          raceTimestamp
        );
      }
      throw error;
    }
  }
}
