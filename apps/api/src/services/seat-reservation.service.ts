import { Types, type ClientSession } from "mongoose";
import {
  Team,
  Membership,
  Hackathon,
  AuditLog,
  type ITeam,
  type IMembership,
} from "../models/index.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES, type AuditAction } from "@crewconnect/shared";
import { withTransactionRetry } from "../db/transaction.js";
import { IdempotencyService } from "./idempotency.service.js";

export interface ReserveSeatParams {
  teamId: string;
  userId: string;
  action: AuditAction;
  idempotency?: {
    recordId: Types.ObjectId | string;
    ownerToken: string;
    payloadHash: string;
  };
  metadata?: Record<string, unknown>;
  onBeforeCommit?: (session: ClientSession, team: ITeam) => Promise<void>;
}

export interface ReserveSeatResult {
  team: ITeam;
  membership: IMembership;
  responsePayload: {
    membershipId: string;
    teamId: string;
    userId: string;
    role: string;
    status: string;
    currentMemberCount: number;
    maxCapacity: number;
    joinedAt: string;
  };
}

export class SeatReservationService {
  /**
   * Central, race-proof atomic seat reservation and membership creation service.
   *
   * All entry paths (direct join, join-request approval, invitation acceptance)
   * MUST use this shared service.
   */
  static async reserveSeatAndJoin(params: ReserveSeatParams): Promise<ReserveSeatResult> {
    const { teamId, userId, action, idempotency, metadata = {}, onBeforeCommit } = params;

    if (!Types.ObjectId.isValid(teamId)) {
      throw AppError.validation("Invalid team ID format");
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw AppError.validation("Invalid user ID format");
    }

    try {
      return await withTransactionRetry(async (session: ClientSession) => {
        // Step 1: Pre-validation of Team & Hackathon within session
        const team = await Team.findById(teamId).session(session);
        if (!team) {
          throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
        }

        if (team.status === "DISBANDED") {
          throw AppError.conflict(ERROR_CODES.TEAM_DISBANDED, "Cannot join a disbanded team");
        }

        if (!team.isOpen) {
          throw AppError.conflict(
            ERROR_CODES.TEAM_CLOSED,
            "The team is not currently accepting new members"
          );
        }

        if (team.memberCount >= team.maxCapacity) {
          throw AppError.conflict(
            ERROR_CODES.TEAM_FULL,
            `The team has reached maximum capacity (${team.memberCount}/${team.maxCapacity}).`
          );
        }

        const hackathon = await Hackathon.findById(team.hackathonId).session(session);
        if (!hackathon) {
          throw AppError.notFound("Hackathon not found", ERROR_CODES.HACKATHON_NOT_FOUND);
        }

        if (hackathon.status === "COMPLETED") {
          throw AppError.badRequest(
            "Hackathon has completed and is no longer accepting team members",
            ERROR_CODES.HACKATHON_NOT_ACTIVE
          );
        }

        // Step 2: Invariant Check - Single active team per hackathon per user
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

        // Step 3: Database-enforced atomic conditional seat reservation
        const updatedTeam = await Team.findOneAndUpdate(
          {
            _id: team._id,
            status: "ACTIVE",
            isOpen: true,
            $expr: { $lt: ["$memberCount", "$maxCapacity"] },
          },
          { $inc: { memberCount: 1 } },
          { session, new: true }
        );

        if (!updatedTeam) {
          // Determine the exact reason the reservation condition failed
          const currentTeamState = await Team.findById(teamId).session(session);
          if (!currentTeamState) {
            throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
          }
          if (currentTeamState.status === "DISBANDED") {
            throw AppError.conflict(ERROR_CODES.TEAM_DISBANDED, "Cannot join a disbanded team");
          }
          if (!currentTeamState.isOpen) {
            throw AppError.conflict(
              ERROR_CODES.TEAM_CLOSED,
              "The team is not currently accepting new members"
            );
          }
          if (currentTeamState.memberCount >= currentTeamState.maxCapacity) {
            throw AppError.conflict(
              ERROR_CODES.TEAM_FULL,
              `The team has reached maximum capacity (${currentTeamState.memberCount}/${currentTeamState.maxCapacity}).`
            );
          }
          throw AppError.conflict(
            ERROR_CODES.CONCURRENCY_CONFLICT,
            "Operation failed due to concurrent write contention. Please retry."
          );
        }

        // Step 4: Insert active Membership (guarded by unique compound index { hackathonId, userId })
        let newMembership: IMembership;
        try {
          const [membershipDoc] = await Membership.create(
            [
              {
                hackathonId: updatedTeam.hackathonId,
                teamId: updatedTeam._id,
                userId: new Types.ObjectId(userId),
                role: "MEMBER",
                status: "ACTIVE",
                joinedAt: new Date(),
              },
            ],
            { session }
          );
          newMembership = membershipDoc;
        } catch (memErr: unknown) {
          const mongoErr = memErr as { code?: number };
          if (mongoErr?.code === 11000) {
            throw AppError.conflict(
              ERROR_CODES.ALREADY_IN_TEAM,
              "User is already an active member of a team in this hackathon"
            );
          }
          throw memErr;
        }

        // Step 5: Execute domain callback (e.g. resolve join-request or consume invitation)
        if (onBeforeCommit) {
          await onBeforeCommit(session, updatedTeam);
        }

        // Step 6: Atomic Audit Event insertion
        await AuditLog.create(
          [
            {
              hackathonId: updatedTeam.hackathonId,
              teamId: updatedTeam._id,
              actorId: new Types.ObjectId(userId),
              action,
              metadata: {
                userId,
                role: "MEMBER",
                currentMemberCount: updatedTeam.memberCount,
                maxCapacity: updatedTeam.maxCapacity,
                remainingSeats: updatedTeam.maxCapacity - updatedTeam.memberCount,
                ...metadata,
              },
              timestamp: new Date(),
            },
          ],
          { session }
        );

        // Step 7: Build standardized response payload
        const responsePayload = {
          membershipId: String(newMembership._id),
          teamId: String(updatedTeam._id),
          userId: String(userId),
          role: newMembership.role,
          status: newMembership.status,
          currentMemberCount: updatedTeam.memberCount,
          maxCapacity: updatedTeam.maxCapacity,
          joinedAt: newMembership.joinedAt.toISOString(),
        };

        // Step 8: Complete idempotency record inside transaction with owner-token fencing
        if (idempotency) {
          await IdempotencyService.completeLeaseInTransaction(
            idempotency.recordId,
            idempotency.ownerToken,
            idempotency.payloadHash,
            201,
            responsePayload,
            session
          );
        }

        return {
          team: updatedTeam,
          membership: newMembership,
          responsePayload,
        };
      });
    } catch (error: unknown) {
      // Post-retry inspection: if retries were exhausted on write conflict contention,
      // re-check the team state outside the aborted transaction.
      if (error instanceof AppError && error.code === ERROR_CODES.CONCURRENCY_CONFLICT) {
        const latestTeam = await Team.findById(teamId);
        if (latestTeam && latestTeam.memberCount >= latestTeam.maxCapacity) {
          // Clean up idempotency lease before throwing TEAM_FULL
          if (idempotency) {
            await IdempotencyService.releaseLease(idempotency.recordId, idempotency.ownerToken);
          }
          throw AppError.conflict(
            ERROR_CODES.TEAM_FULL,
            `The team has reached maximum capacity (${latestTeam.memberCount}/${latestTeam.maxCapacity}).`
          );
        }
      }

      // CRITICAL: Preserve TRANSACTION_COMMIT_UNCERTAIN semantics (do NOT release lease or convert to TEAM_FULL)
      if (error instanceof AppError && error.code === ERROR_CODES.TRANSACTION_COMMIT_UNCERTAIN) {
        throw error;
      }

      // For all other known domain failures, safely release the idempotency lease
      if (idempotency) {
        await IdempotencyService.releaseLease(idempotency.recordId, idempotency.ownerToken);
      }

      throw error;
    }
  }
}
