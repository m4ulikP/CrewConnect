import mongoose from "mongoose";
import { Team } from "../models/Team.js";
import { Membership } from "../models/Membership.js";
import { User } from "../models/User.js";
import { AppError } from "../errors/AppError.js";
import {
  ERROR_CODES,
  type ExperienceLevel,
  type RecommendationQueryInput,
  type TeamRecommendationsResponseData,
  type TeammateRecommendationDTO,
} from "@crewconnect/shared";
import {
  scoreCandidate,
  type TeamScoringContext,
  type CandidateScoringInput,
} from "./recommendation-engine.js";

export class RecommendationService {
  /**
   * Retrieves deterministic, explainable teammate recommendations for an active team.
   *
   * Eligibility Invariants Enforced:
   * 1. Requesting user must have an ACTIVE membership in the squad.
   * 2. Excludes requesting user.
   * 3. Excludes existing team members.
   * 4. Excludes users with an ACTIVE membership in any team in the same hackathon.
   * 5. Excludes suspended or deleted accounts.
   * 6. Team must be active and open with available capacity (otherwise returns 0 vacancies cleanly).
   */
  static async getRecommendations(
    teamId: string,
    requestingUserId: string,
    query: RecommendationQueryInput
  ): Promise<{
    data: TeamRecommendationsResponseData;
    meta: { page: number; limit: number; total: number };
  }> {
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      throw AppError.validation("Invalid team ID format");
    }

    const team = await Team.findById(teamId);
    if (!team) {
      throw AppError.notFound("Team not found");
    }

    // Authorization: User must be an active member or leader of this squad
    const callerMembership = await Membership.findOne({
      teamId: team._id,
      userId: requestingUserId,
      status: "ACTIVE",
    });

    if (!callerMembership) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        "You must be an active member of the team to view teammate recommendations",
        403
      );
    }

    // Team lifecycle state checks
    if (team.status === "DISBANDED") {
      throw AppError.conflict(
        ERROR_CODES.TEAM_DISBANDED,
        "Cannot get recommendations for a disbanded team"
      );
    }

    if (team.status === "ARCHIVED") {
      throw AppError.conflict(
        ERROR_CODES.TEAM_ARCHIVED,
        "Cannot get recommendations for an archived team"
      );
    }

    const vacancies = Math.max(0, team.maxCapacity - team.memberCount);

    // If squad is closed or at max capacity, return zero recommendations cleanly
    if (!team.isOpen || vacancies === 0) {
      return {
        data: {
          teamId: team._id.toString(),
          teamName: team.name,
          hackathonId: team.hackathonId.toString(),
          vacancies,
          recommendations: [],
        },
        meta: {
          page: query.page,
          limit: query.limit,
          total: 0,
        },
      };
    }

    // 1. Fetch current active team members and populate user profiles
    const teamMemberships = await Membership.find({
      teamId: team._id,
      status: "ACTIVE",
    }).populate<{
      userId: {
        _id: mongoose.Types.ObjectId;
        skills?: string[];
        experienceLevel?: ExperienceLevel;
        timeZone?: string;
      };
    }>("userId", "displayName skills experienceLevel timeZone");

    const teamMembers = teamMemberships
      .filter((m) => m.userId && typeof m.userId === "object")
      .map((m) => ({
        id: m.userId._id.toString(),
        skills: m.userId.skills || [],
        experienceLevel: m.userId.experienceLevel,
        timeZone: m.userId.timeZone,
      }));

    const teamCtx: TeamScoringContext = {
      teamId: team._id.toString(),
      skillsNeeded: team.skillsNeeded || [],
      members: teamMembers,
    };

    // 2. Determine all ineligible user IDs:
    // - All users who have an ACTIVE membership in this hackathon (includes this team + other teams)
    const activeHackathonMemberships = await Membership.find(
      {
        hackathonId: team.hackathonId,
        status: "ACTIVE",
      },
      { userId: 1 }
    );

    const excludedUserIds = new Set<string>();
    for (const m of activeHackathonMemberships) {
      if (m.userId) {
        excludedUserIds.add(m.userId.toString());
      }
    }
    // Explicitly guarantee caller & existing team members are excluded
    excludedUserIds.add(requestingUserId);
    for (const m of teamMembers) {
      excludedUserIds.add(m.id);
    }

    // 3. Query all candidate users in the pool who are ACTIVE and not in excludedUserIds
    // Project only necessary public attributes, strictly omitting passwordHash, tokenVersion, email, etc.
    const candidateDocs = await User.find(
      {
        _id: { $nin: Array.from(excludedUserIds) },
        status: "ACTIVE",
      },
      {
        displayName: 1,
        avatarUrl: 1,
        bio: 1,
        skills: 1,
        experienceLevel: 1,
        timeZone: 1,
        githubUrl: 1,
        linkedinUrl: 1,
        portfolioUrl: 1,
      }
    ).lean();

    // 4. Score all eligible candidates using the deterministic engine
    const scoredRecommendations: TeammateRecommendationDTO[] = candidateDocs.map((doc) => {
      const candidateInput: CandidateScoringInput = {
        id: String(doc._id),
        displayName: doc.displayName,
        avatarUrl: doc.avatarUrl,
        bio: doc.bio,
        skills: doc.skills || [],
        experienceLevel: doc.experienceLevel,
        timeZone: doc.timeZone,
        githubUrl: doc.githubUrl,
        linkedinUrl: doc.linkedinUrl,
        portfolioUrl: doc.portfolioUrl,
      };

      return scoreCandidate(candidateInput, teamCtx);
    });

    // 5. Deterministic multi-tier sort:
    // Primary: compatibilityScore DESC
    // Secondary: skillScore DESC
    // Tertiary: timezoneScore DESC
    // Tie-breaker: candidate.id ASC (guarantees absolute stability across page requests)
    scoredRecommendations.sort((a, b) => {
      if (b.compatibilityScore !== a.compatibilityScore) {
        return b.compatibilityScore - a.compatibilityScore;
      }
      if (b.dimensionScores.skillScore !== a.dimensionScores.skillScore) {
        return b.dimensionScores.skillScore - a.dimensionScores.skillScore;
      }
      if (b.dimensionScores.timezoneScore !== a.dimensionScores.timezoneScore) {
        return b.dimensionScores.timezoneScore - a.dimensionScores.timezoneScore;
      }
      return a.candidate.id.localeCompare(b.candidate.id);
    });

    const total = scoredRecommendations.length;
    const startIndex = (query.page - 1) * query.limit;
    const paginated = scoredRecommendations.slice(startIndex, startIndex + query.limit);

    return {
      data: {
        teamId: team._id.toString(),
        teamName: team.name,
        hackathonId: team.hackathonId.toString(),
        vacancies,
        recommendations: paginated,
      },
      meta: {
        page: query.page,
        limit: query.limit,
        total,
      },
    };
  }
}
