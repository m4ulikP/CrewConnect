import { Types } from "mongoose";
import {
  Team,
  Membership,
  Hackathon,
  AuditLog,
  User,
  type ITeam,
  type IMembership,
} from "../models/index.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES, type CreateTeamInput, type UpdateTeamInput } from "@crewconnect/shared";
import { withTransactionRetry } from "../db/transaction.js";
import { EventDispatcher } from "../realtime/index.js";

export interface TeamWithLeader {
  id: string;
  hackathonId: string;
  name: string;
  tagline?: string;
  description?: string;
  skillsNeeded: string[];
  memberCount: number;
  maxCapacity: number;
  isOpen: boolean;
  status: string;
  leaderId: string;
  leader?: {
    id: string;
    displayName: string;
    email?: string;
    skills?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export class TeamService {
  /**
   * Atomically creates a team and its initial leader membership within a single MongoDB transaction.
   */
  static async createTeam(
    hackathonId: string,
    userId: string,
    input: CreateTeamInput
  ): Promise<{ team: ITeam; membership: IMembership }> {
    if (!Types.ObjectId.isValid(hackathonId)) {
      throw AppError.validation("Invalid hackathon ID format");
    }

    const hackathon = await Hackathon.findById(hackathonId);
    if (!hackathon) {
      throw AppError.notFound("Hackathon not found", ERROR_CODES.HACKATHON_NOT_FOUND);
    }

    if (hackathon.status === "COMPLETED") {
      throw AppError.badRequest(
        "Hackathon has completed and is no longer accepting team formation",
        ERROR_CODES.HACKATHON_NOT_ACTIVE
      );
    }

    // Capacity bound validation against Hackathon constraints
    let maxCapacity = hackathon.maxTeamSize;
    if (input.maxCapacity !== undefined) {
      if (input.maxCapacity < hackathon.minTeamSize || input.maxCapacity > hackathon.maxTeamSize) {
        throw AppError.badRequest(
          `Team max capacity must be between ${hackathon.minTeamSize} and ${hackathon.maxTeamSize}`,
          ERROR_CODES.TEAM_CAPACITY_INVALID
        );
      }
      maxCapacity = input.maxCapacity;
    }

    // Pre-check for existing active membership in this hackathon
    const existingMembership = await Membership.findOne({
      hackathonId,
      userId,
      status: "ACTIVE",
    });
    if (existingMembership) {
      throw AppError.conflict(
        ERROR_CODES.ALREADY_IN_TEAM,
        "User is already an active member of a team in this hackathon"
      );
    }

    // Pre-check for unique team name within hackathon
    const existingTeam = await Team.findOne({
      hackathonId,
      name: { $regex: new RegExp(`^${input.name.trim()}$`, "i") },
    });
    if (existingTeam) {
      throw AppError.conflict(
        ERROR_CODES.TEAM_NAME_TAKEN,
        "A team with this name already exists in this hackathon"
      );
    }

    // Unified ACID Transaction with retry
    return await withTransactionRetry(async (session) => {
      // 1. Create Team document
      const [newTeam] = await Team.create(
        [
          {
            hackathonId: new Types.ObjectId(hackathonId),
            leaderId: new Types.ObjectId(userId),
            name: input.name.trim(),
            tagline: input.tagline?.trim() || "",
            description: input.description?.trim() || "",
            skillsNeeded: input.skillsNeeded || [],
            memberCount: 1,
            maxCapacity,
            isOpen: true,
            status: "ACTIVE",
          },
        ],
        { session }
      );

      // 2. Create Leader Membership document
      const [leaderMembership] = await Membership.create(
        [
          {
            hackathonId: new Types.ObjectId(hackathonId),
            teamId: newTeam._id,
            userId: new Types.ObjectId(userId),
            role: "LEADER",
            status: "ACTIVE",
            joinedAt: new Date(),
          },
        ],
        { session }
      );

      // 3. Create AuditLog inside transaction
      await AuditLog.create(
        [
          {
            hackathonId: new Types.ObjectId(hackathonId),
            teamId: newTeam._id,
            actorId: new Types.ObjectId(userId),
            action: "TEAM_CREATED",
            metadata: {
              teamName: newTeam.name,
              maxCapacity: newTeam.maxCapacity,
            },
            timestamp: new Date(),
          },
        ],
        { session }
      );

      return { team: newTeam, membership: leaderMembership };
    })
      .then((res) => {
        try {
          EventDispatcher.dispatchCapacityUpdated({
            teamId: res.team._id.toString(),
            hackathonId: res.team.hackathonId.toString(),
            memberCount: res.team.memberCount,
            maxCapacity: res.team.maxCapacity,
            isOpen: res.team.isOpen,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          console.warn("Real-time event dispatch warning:", err);
        }
        return res;
      })
      .catch((error: unknown) => {
        const mongoErr = error as {
          code?: number;
          keyPattern?: Record<string, number>;
          message?: string;
        };
        if (mongoErr.code === 11000) {
          if (mongoErr.keyPattern?.name || mongoErr.message?.includes("name_1")) {
            throw AppError.conflict(
              ERROR_CODES.TEAM_NAME_TAKEN,
              "A team with this name already exists in this hackathon"
            );
          }
          if (mongoErr.keyPattern?.userId || mongoErr.message?.includes("userId_1")) {
            throw AppError.conflict(
              ERROR_CODES.ALREADY_IN_TEAM,
              "User is already an active member of a team in this hackathon"
            );
          }
        }
        throw error;
      });
  }

  /**
   * Retrieves team details with populated leader info.
   */
  static async getTeamById(teamId: string): Promise<ITeam> {
    if (!Types.ObjectId.isValid(teamId)) {
      throw AppError.validation("Invalid team ID format");
    }

    const team = await Team.findById(teamId).populate(
      "leaderId",
      "displayName email skills bio githubUrl"
    );
    if (!team) {
      throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
    }
    return team;
  }

  /**
   * Retrieves active member roster with populated user profiles.
   */
  static async getTeamRoster(teamId: string): Promise<IMembership[]> {
    if (!Types.ObjectId.isValid(teamId)) {
      throw AppError.validation("Invalid team ID format");
    }

    const team = await Team.findById(teamId);
    if (!team) {
      throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
    }

    const members = await Membership.find({
      teamId,
      status: "ACTIVE",
    })
      .populate("userId", "displayName email skills bio githubUrl experienceLevel")
      .sort({ role: 1, joinedAt: 1 });

    return members;
  }

  /**
   * List teams for a hackathon with optional search and vacancy filtering.
   */
  static async listTeams(
    hackathonId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      hasVacancies?: boolean;
      skills?: string[];
    } = {}
  ): Promise<{ teams: Record<string, unknown>[]; total: number; page: number; limit: number }> {
    if (!Types.ObjectId.isValid(hackathonId)) {
      throw AppError.validation("Invalid hackathon ID format");
    }

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      hackathonId: new Types.ObjectId(hackathonId),
      status: "ACTIVE",
    };

    if (options.hasVacancies) {
      query.isOpen = true;
    }

    if (options.search) {
      const term = options.search.trim();
      query.$or = [
        { name: { $regex: term, $options: "i" } },
        { tagline: { $regex: term, $options: "i" } },
      ];
    }

    if (options.skills && options.skills.length > 0) {
      query.skillsNeeded = { $in: options.skills };
    }

    const findQuery: Record<string, unknown> = { ...query };
    if (options.hasVacancies) {
      findQuery.$expr = { $lt: ["$memberCount", "$maxCapacity"] };
    }

    const [teams, total] = await Promise.all([
      Team.collection
        .aggregate([
          { $match: findQuery },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "users",
              localField: "leaderId",
              foreignField: "_id",
              pipeline: [
                {
                  $project: {
                    _id: 0,
                    id: { $toString: "$_id" },
                    displayName: 1,
                    email: 1,
                    skills: 1,
                  },
                },
              ],
              as: "leaderArr",
            },
          },
          {
            $addFields: {
              id: { $toString: "$_id" },
              hackathonId: { $toString: "$hackathonId" },
              leaderId: {
                $ifNull: [{ $arrayElemAt: ["$leaderArr", 0] }, { $toString: "$leaderId" }],
              },
            },
          },
          { $project: { _id: 0, __v: 0, leaderArr: 0 } },
        ])
        .toArray(),
      Team.collection.countDocuments(query),
    ]);

    return { teams: teams as Record<string, unknown>[], total, page, limit };
  }

  /**
   * Updates non-protected team details (leader only).
   */
  static async updateTeamDetails(
    teamId: string,
    userId: string,
    input: UpdateTeamInput
  ): Promise<ITeam> {
    if (!Types.ObjectId.isValid(teamId)) {
      throw AppError.validation("Invalid team ID format");
    }

    const team = await Team.findById(teamId);
    if (!team) {
      throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
    }

    if (team.status === "DISBANDED") {
      throw AppError.conflict(ERROR_CODES.TEAM_DISBANDED, "Cannot update a disbanded team");
    }

    if (team.leaderId.toString() !== userId.toString()) {
      throw AppError.forbidden(
        "Only the team leader can update team details",
        ERROR_CODES.NOT_TEAM_LEADER
      );
    }

    const updateFields: Record<string, unknown> = {};

    // Name update with uniqueness check
    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (trimmedName.toLowerCase() !== team.name.toLowerCase()) {
        const existingName = await Team.findOne({
          hackathonId: team.hackathonId,
          _id: { $ne: team._id },
          name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
        });
        if (existingName) {
          throw AppError.conflict(
            ERROR_CODES.TEAM_NAME_TAKEN,
            "A team with this name already exists in this hackathon"
          );
        }
      }
      updateFields.name = trimmedName;
    }

    if (input.tagline !== undefined) {
      updateFields.tagline = input.tagline.trim();
    }

    if (input.description !== undefined) {
      updateFields.description = input.description.trim();
    }

    if (input.skillsNeeded !== undefined) {
      updateFields.skillsNeeded = input.skillsNeeded;
    }

    // Max capacity update validation
    if (input.maxCapacity !== undefined) {
      const hackathon = await Hackathon.findById(team.hackathonId);
      if (!hackathon) {
        throw AppError.notFound("Hackathon not found", ERROR_CODES.HACKATHON_NOT_FOUND);
      }
      if (hackathon.status === "COMPLETED") {
        throw AppError.badRequest(
          "Hackathon has completed and team cannot be updated",
          ERROR_CODES.HACKATHON_NOT_ACTIVE
        );
      }
      if (input.maxCapacity < hackathon.minTeamSize || input.maxCapacity > hackathon.maxTeamSize) {
        throw AppError.badRequest(
          `Max capacity must be between ${hackathon.minTeamSize} and ${hackathon.maxTeamSize}`,
          ERROR_CODES.TEAM_CAPACITY_INVALID
        );
      }

      if (input.maxCapacity < team.memberCount) {
        throw AppError.badRequest(
          `Cannot reduce maximum capacity (${input.maxCapacity}) below current member count (${team.memberCount})`,
          ERROR_CODES.TEAM_CAPACITY_INVALID
        );
      }
      updateFields.maxCapacity = input.maxCapacity;
    }

    // Open/Closed visibility update
    if (input.isOpen !== undefined) {
      const effectiveMax = input.maxCapacity ?? team.maxCapacity;
      if (input.isOpen && team.memberCount >= effectiveMax) {
        throw AppError.badRequest(
          "Cannot open a team that is at maximum capacity",
          ERROR_CODES.CANNOT_REOPEN_TEAM
        );
      }
      updateFields.isOpen = input.isOpen;
    }

    // Execute update and audit log in a single transaction with retry
    const updatedTeam = await withTransactionRetry(async (session) => {
      const updateFilter: Record<string, unknown> = {
        _id: teamId,
        leaderId: new Types.ObjectId(userId),
        status: "ACTIVE",
      };
      if (input.maxCapacity !== undefined) {
        updateFilter.memberCount = { $lte: input.maxCapacity };
      }

      const teamDoc = await Team.findOneAndUpdate(
        updateFilter,
        { $set: updateFields },
        { session, new: true }
      );

      if (!teamDoc) {
        throw AppError.conflict(
          ERROR_CODES.CONCURRENCY_CONFLICT,
          "Failed to update team: state conflict or team is no longer active"
        );
      }

      await AuditLog.create(
        [
          {
            hackathonId: team.hackathonId,
            teamId: team._id,
            actorId: new Types.ObjectId(userId),
            action: "TEAM_UPDATED",
            metadata: updateFields,
            timestamp: new Date(),
          },
        ],
        { session }
      );

      return teamDoc;
    });

    try {
      EventDispatcher.dispatchTeamUpdated({
        teamId: updatedTeam._id.toString(),
        hackathonId: updatedTeam.hackathonId.toString(),
        name: updatedTeam.name,
        tagline: updatedTeam.tagline,
        description: updatedTeam.description,
        skillsNeeded: updatedTeam.skillsNeeded,
        isOpen: updatedTeam.isOpen,
        maxCapacity: updatedTeam.maxCapacity,
        memberCount: updatedTeam.memberCount,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Real-time event dispatch warning:", err);
    }

    return updatedTeam;
  }

  /**
   * Explicitly sets whether a team is open to new members (leader only).
   */
  static async setTeamOpenStatus(teamId: string, userId: string, isOpen: boolean): Promise<ITeam> {
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
        "Cannot modify visibility of a disbanded team"
      );
    }

    if (team.leaderId.toString() !== userId.toString()) {
      throw AppError.forbidden(
        "Only the team leader can modify team visibility",
        ERROR_CODES.NOT_TEAM_LEADER
      );
    }

    if (isOpen) {
      if (team.memberCount >= team.maxCapacity) {
        throw AppError.badRequest(
          "Cannot open a team that is at maximum capacity",
          ERROR_CODES.CANNOT_REOPEN_TEAM
        );
      }

      const hackathon = await Hackathon.findById(team.hackathonId);
      if (hackathon && hackathon.status === "COMPLETED") {
        throw AppError.badRequest(
          "Cannot open a team in a completed hackathon",
          ERROR_CODES.HACKATHON_NOT_ACTIVE
        );
      }
    }

    const updatedTeam = await withTransactionRetry(async (session) => {
      const openFilter: Record<string, unknown> = {
        _id: teamId,
        leaderId: new Types.ObjectId(userId),
        status: "ACTIVE",
      };
      if (isOpen) {
        openFilter.$expr = { $lt: ["$memberCount", "$maxCapacity"] };
      }

      const teamDoc = await Team.findOneAndUpdate(
        openFilter,
        { $set: { isOpen } },
        { session, new: true }
      );

      if (!teamDoc) {
        throw AppError.conflict(
          ERROR_CODES.CONCURRENCY_CONFLICT,
          "Failed to update team visibility: team is not active, user is not leader, or team is full"
        );
      }

      await AuditLog.create(
        [
          {
            hackathonId: team.hackathonId,
            teamId: team._id,
            actorId: new Types.ObjectId(userId),
            action: isOpen ? "TEAM_OPENED" : "TEAM_CLOSED",
            metadata: { isOpen },
            timestamp: new Date(),
          },
        ],
        { session }
      );

      return teamDoc;
    });

    try {
      EventDispatcher.dispatchCapacityUpdated({
        teamId: updatedTeam._id.toString(),
        hackathonId: updatedTeam.hackathonId.toString(),
        memberCount: updatedTeam.memberCount,
        maxCapacity: updatedTeam.maxCapacity,
        isOpen: updatedTeam.isOpen,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Real-time event dispatch warning:", err);
    }

    return updatedTeam;
  }

  /**
   * Atomically transfers leadership to an active member of the same team.
   */
  static async transferLeadership(
    teamId: string,
    currentLeaderId: string,
    newLeaderId: string
  ): Promise<ITeam> {
    if (!Types.ObjectId.isValid(teamId)) {
      throw AppError.validation("Invalid team ID format");
    }
    if (!Types.ObjectId.isValid(newLeaderId)) {
      throw AppError.validation("Invalid new leader ID format");
    }

    const team = await Team.findById(teamId);
    if (!team) {
      throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
    }

    if (team.status === "DISBANDED") {
      throw AppError.conflict(
        ERROR_CODES.TEAM_DISBANDED,
        "Cannot transfer leadership of a disbanded team"
      );
    }

    if (team.leaderId.toString() !== currentLeaderId.toString()) {
      throw AppError.forbidden(
        "Only the current team leader can transfer leadership",
        ERROR_CODES.NOT_TEAM_LEADER
      );
    }

    if (currentLeaderId.toString() === newLeaderId.toString()) {
      throw AppError.badRequest(
        "Target user is already the team leader",
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Verify target user is an active member
    const targetMembership = await Membership.findOne({
      teamId,
      userId: new Types.ObjectId(newLeaderId),
      status: "ACTIVE",
    });
    if (!targetMembership) {
      throw AppError.badRequest(
        "Target user is not an active member of this team",
        ERROR_CODES.TARGET_USER_NOT_ACTIVE_MEMBER
      );
    }

    const updatedTeam = await withTransactionRetry(async (session) => {
      // 1. Demote current leader to MEMBER
      const demoted = await Membership.findOneAndUpdate(
        {
          teamId,
          userId: new Types.ObjectId(currentLeaderId),
          role: "LEADER",
          status: "ACTIVE",
        },
        { role: "MEMBER" },
        { session, new: true }
      );
      if (!demoted) {
        throw AppError.conflict(
          ERROR_CODES.CONCURRENCY_CONFLICT,
          "Current user is no longer the active leader of this team"
        );
      }

      // 2. Promote new leader to LEADER
      const promoted = await Membership.findOneAndUpdate(
        {
          teamId,
          userId: new Types.ObjectId(newLeaderId),
          role: "MEMBER",
          status: "ACTIVE",
        },
        { role: "LEADER" },
        { session, new: true }
      );
      if (!promoted) {
        throw AppError.badRequest(
          "Target user is no longer an active member of this team",
          ERROR_CODES.TARGET_USER_NOT_ACTIVE_MEMBER
        );
      }

      // 3. Update Team.leaderId
      const updatedTeam = await Team.findOneAndUpdate(
        {
          _id: teamId,
          leaderId: new Types.ObjectId(currentLeaderId),
          status: "ACTIVE",
        },
        { leaderId: new Types.ObjectId(newLeaderId) },
        { session, new: true }
      );
      if (!updatedTeam) {
        throw AppError.conflict(
          ERROR_CODES.CONCURRENCY_CONFLICT,
          "Concurrent update conflict during leadership transfer"
        );
      }

      // 4. AuditLog
      await AuditLog.create(
        [
          {
            hackathonId: team.hackathonId,
            teamId: team._id,
            actorId: new Types.ObjectId(currentLeaderId),
            targetUserId: new Types.ObjectId(newLeaderId),
            action: "LEADERSHIP_TRANSFERRED",
            metadata: {
              previousLeaderId: currentLeaderId,
              newLeaderId,
            },
            timestamp: new Date(),
          },
        ],
        { session }
      );

      return updatedTeam;
    });

    try {
      const newLeader = await User.findById(newLeaderId);
      EventDispatcher.dispatchLeadershipTransferred({
        teamId: updatedTeam._id.toString(),
        hackathonId: updatedTeam.hackathonId.toString(),
        previousLeaderId: currentLeaderId,
        newLeaderId,
        newLeaderDisplayName: newLeader?.displayName || "New Leader",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Real-time event dispatch warning:", err);
    }

    return updatedTeam;
  }

  /**
   * Voluntary departure from team.
   * If the departing user is the last remaining member, the team is atomically disbanded.
   * If the departing user is the leader and other members remain, departure is blocked until transfer.
   */
  static async leaveTeam(
    teamId: string,
    userId: string
  ): Promise<{ disbanded: boolean; team: ITeam }> {
    if (!Types.ObjectId.isValid(teamId)) {
      throw AppError.validation("Invalid team ID format");
    }

    const team = await Team.findById(teamId);
    if (!team) {
      throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
    }

    if (team.status === "DISBANDED") {
      throw AppError.conflict(ERROR_CODES.TEAM_DISBANDED, "Team is already disbanded");
    }

    const membership = await Membership.findOne({
      teamId,
      userId: new Types.ObjectId(userId),
      status: "ACTIVE",
    });
    if (!membership) {
      throw AppError.notFound("You are not an active member of this team", ERROR_CODES.NOT_FOUND);
    }

    // Leader departure rules
    if (membership.role === "LEADER") {
      if (team.memberCount > 1) {
        throw AppError.badRequest(
          "Leader cannot leave a multi-member team without transferring leadership first or disbanding",
          ERROR_CODES.LEADER_CANNOT_LEAVE
        );
      }

      // Sole remaining member leaves -> Disband team atomically
      const res = await withTransactionRetry(async (session) => {
        const updatedMembership = await Membership.findOneAndUpdate(
          { _id: membership._id, status: "ACTIVE" },
          { status: "LEFT", leftAt: new Date() },
          { session }
        );
        if (!updatedMembership) {
          throw AppError.conflict(ERROR_CODES.CONCURRENCY_CONFLICT, "Membership state conflict");
        }

        const disbandedTeam = await Team.findOneAndUpdate(
          {
            _id: teamId,
            status: "ACTIVE",
            leaderId: new Types.ObjectId(userId),
            memberCount: { $lte: 1 },
          },
          { status: "DISBANDED", isOpen: false, memberCount: 0 },
          { session, new: true }
        );

        if (!disbandedTeam) {
          throw AppError.badRequest(
            "Leader cannot leave a multi-member team without transferring leadership first or disbanding",
            ERROR_CODES.LEADER_CANNOT_LEAVE
          );
        }

        await AuditLog.create(
          [
            {
              hackathonId: team.hackathonId,
              teamId: team._id,
              actorId: new Types.ObjectId(userId),
              action: "MEMBER_LEFT",
              metadata: { role: "LEADER", wasLastMember: true },
              timestamp: new Date(),
            },
            {
              hackathonId: team.hackathonId,
              teamId: team._id,
              actorId: new Types.ObjectId(userId),
              action: "TEAM_DISBANDED",
              metadata: { reason: "LAST_MEMBER_DEPARTURE" },
              timestamp: new Date(),
            },
          ],
          { session, ordered: true }
        );

        return { disbanded: true, team: disbandedTeam };
      });

      try {
        EventDispatcher.dispatchTeamDisbanded({
          teamId: res.team._id.toString(),
          hackathonId: res.team.hackathonId.toString(),
          disbandedBy: userId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("Real-time event dispatch warning:", err);
      }

      return res;
    }

    // Regular non-leader member departure
    const res = await withTransactionRetry(async (session) => {
      const updatedMembership = await Membership.findOneAndUpdate(
        { _id: membership._id, status: "ACTIVE" },
        { status: "LEFT", leftAt: new Date() },
        { session, new: true }
      );
      if (!updatedMembership) {
        throw AppError.conflict(ERROR_CODES.CONCURRENCY_CONFLICT, "Membership state conflict");
      }

      const updatedTeam = await Team.findOneAndUpdate(
        { _id: teamId, status: "ACTIVE", memberCount: { $gt: 0 } },
        { $inc: { memberCount: -1 } },
        { session, new: true }
      );
      if (!updatedTeam) {
        throw AppError.conflict(
          ERROR_CODES.CONCURRENCY_CONFLICT,
          "Failed to decrement member count"
        );
      }

      await AuditLog.create(
        [
          {
            hackathonId: team.hackathonId,
            teamId: team._id,
            actorId: new Types.ObjectId(userId),
            action: "MEMBER_LEFT",
            metadata: {
              role: "MEMBER",
              remainingMemberCount: updatedTeam.memberCount,
            },
            timestamp: new Date(),
          },
        ],
        { session }
      );

      return { disbanded: false, team: updatedTeam };
    });

    try {
      EventDispatcher.dispatchMemberLeft({
        teamId: res.team._id.toString(),
        hackathonId: res.team.hackathonId.toString(),
        userId,
        reason: "LEFT",
        memberCount: res.team.memberCount,
        maxCapacity: res.team.maxCapacity,
        isOpen: res.team.isOpen,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Real-time event dispatch warning:", err);
    }

    return res;
  }

  /**
   * Leader removes an active member.
   */
  static async removeMember(
    teamId: string,
    callerUserId: string,
    targetUserId: string
  ): Promise<ITeam> {
    if (!Types.ObjectId.isValid(teamId)) {
      throw AppError.validation("Invalid team ID format");
    }
    if (!Types.ObjectId.isValid(targetUserId)) {
      throw AppError.validation("Invalid target user ID format");
    }

    if (callerUserId.toString() === targetUserId.toString()) {
      throw AppError.badRequest(
        "Team leader cannot remove themselves. Transfer leadership or disband the team.",
        ERROR_CODES.CANNOT_REMOVE_SELF
      );
    }

    const team = await Team.findById(teamId);
    if (!team) {
      throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
    }

    if (team.status === "DISBANDED") {
      throw AppError.conflict(
        ERROR_CODES.TEAM_DISBANDED,
        "Cannot remove members from a disbanded team"
      );
    }

    if (team.leaderId.toString() !== callerUserId.toString()) {
      throw AppError.forbidden(
        "Only the team leader can remove members",
        ERROR_CODES.NOT_TEAM_LEADER
      );
    }

    const targetMembership = await Membership.findOne({
      teamId,
      userId: new Types.ObjectId(targetUserId),
      status: "ACTIVE",
    });
    if (!targetMembership) {
      throw AppError.badRequest(
        "Target user is not an active member of this team",
        ERROR_CODES.TARGET_USER_NOT_ACTIVE_MEMBER
      );
    }

    if (targetMembership.role === "LEADER") {
      throw AppError.badRequest("Cannot remove the team leader", ERROR_CODES.CANNOT_REMOVE_SELF);
    }

    const updatedTeam = await withTransactionRetry(async (session) => {
      // 1. Mark target membership as REMOVED
      const removedMembership = await Membership.findOneAndUpdate(
        {
          teamId,
          userId: new Types.ObjectId(targetUserId),
          status: "ACTIVE",
        },
        { status: "REMOVED", leftAt: new Date() },
        { session, new: true }
      );
      if (!removedMembership) {
        throw AppError.badRequest(
          "Target user is no longer an active member of this team",
          ERROR_CODES.TARGET_USER_NOT_ACTIVE_MEMBER
        );
      }

      // 2. Decrement memberCount
      const teamDoc = await Team.findOneAndUpdate(
        {
          _id: teamId,
          status: "ACTIVE",
          leaderId: new Types.ObjectId(callerUserId),
          memberCount: { $gt: 0 },
        },
        { $inc: { memberCount: -1 } },
        { session, new: true }
      );
      if (!teamDoc) {
        throw AppError.conflict(
          ERROR_CODES.CONCURRENCY_CONFLICT,
          "Failed to decrement member count: caller is no longer leader or team is no longer active"
        );
      }

      // 3. AuditLog
      await AuditLog.create(
        [
          {
            hackathonId: team.hackathonId,
            teamId: team._id,
            actorId: new Types.ObjectId(callerUserId),
            targetUserId: new Types.ObjectId(targetUserId),
            action: "MEMBER_REMOVED",
            metadata: {
              removedBy: callerUserId,
              remainingMemberCount: teamDoc.memberCount,
            },
            timestamp: new Date(),
          },
        ],
        { session }
      );

      return teamDoc;
    });

    try {
      EventDispatcher.dispatchMemberLeft({
        teamId: updatedTeam._id.toString(),
        hackathonId: updatedTeam.hackathonId.toString(),
        userId: targetUserId,
        reason: "REMOVED",
        memberCount: updatedTeam.memberCount,
        maxCapacity: updatedTeam.maxCapacity,
        isOpen: updatedTeam.isOpen,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Real-time event dispatch warning:", err);
    }

    return updatedTeam;
  }

  /**
   * Leader disbands the team atomically.
   */
  static async disbandTeam(teamId: string, callerUserId: string): Promise<ITeam> {
    if (!Types.ObjectId.isValid(teamId)) {
      throw AppError.validation("Invalid team ID format");
    }

    const team = await Team.findById(teamId);
    if (!team) {
      throw AppError.notFound("Team not found", ERROR_CODES.TEAM_NOT_FOUND);
    }

    if (team.status === "DISBANDED") {
      throw AppError.conflict(ERROR_CODES.TEAM_DISBANDED, "Team is already disbanded");
    }

    if (team.leaderId.toString() !== callerUserId.toString()) {
      throw AppError.forbidden(
        "Only the team leader can disband the team",
        ERROR_CODES.NOT_TEAM_LEADER
      );
    }

    const disbandedTeam = await withTransactionRetry(async (session) => {
      // 1. Mark team DISBANDED conditionally
      const teamDoc = await Team.findOneAndUpdate(
        {
          _id: teamId,
          status: "ACTIVE",
          leaderId: new Types.ObjectId(callerUserId),
        },
        {
          status: "DISBANDED",
          isOpen: false,
          memberCount: 0,
        },
        { session, new: true }
      );

      if (!teamDoc) {
        throw AppError.conflict(
          ERROR_CODES.TEAM_DISBANDED,
          "Team is already disbanded or not active"
        );
      }

      // 2. Mark all active memberships as LEFT
      await Membership.updateMany(
        { teamId, status: "ACTIVE" },
        { status: "LEFT", leftAt: new Date() },
        { session }
      );

      // 3. AuditLog
      await AuditLog.create(
        [
          {
            hackathonId: team.hackathonId,
            teamId: team._id,
            actorId: new Types.ObjectId(callerUserId),
            action: "TEAM_DISBANDED",
            metadata: { disbandedBy: callerUserId },
            timestamp: new Date(),
          },
        ],
        { session }
      );

      return teamDoc;
    });

    try {
      EventDispatcher.dispatchTeamDisbanded({
        teamId: disbandedTeam._id.toString(),
        hackathonId: disbandedTeam.hackathonId.toString(),
        disbandedBy: callerUserId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Real-time event dispatch warning:", err);
    }

    return disbandedTeam;
  }

  /**
   * Retrieves active team for a user in a given hackathon.
   */
  static async getUserActiveTeamInHackathon(
    hackathonId: string,
    userId: string
  ): Promise<{ team: ITeam; role: string } | null> {
    if (!Types.ObjectId.isValid(hackathonId) || !Types.ObjectId.isValid(userId)) {
      return null;
    }

    const membership = await Membership.findOne({
      hackathonId,
      userId,
      status: "ACTIVE",
    });

    if (!membership) {
      return null;
    }

    const team = await Team.findById(membership.teamId).populate(
      "leaderId",
      "displayName email skills"
    );
    if (!team) {
      return null;
    }

    return { team, role: membership.role };
  }
}
