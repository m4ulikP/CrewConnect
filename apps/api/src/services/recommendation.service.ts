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
  precomputeTeamContext,
  type TeamScoringContext,
  type CandidateScoringInput,
} from "./recommendation-engine.js";

export interface CandidateUserRecord {
  readonly _id: mongoose.Types.ObjectId;
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly bio?: string;
  readonly skills?: string[];
  readonly experienceLevel?: ExperienceLevel;
  readonly timeZone?: string;
  readonly githubUrl?: string;
  readonly linkedinUrl?: string;
  readonly portfolioUrl?: string;
}

export interface HackathonCandidatePool {
  readonly activeHackathonUserIds: ReadonlySet<string>;
  readonly candidates: readonly CandidateUserRecord[];
}

export class RecommendationService {
  /**
   * In-flight promise map for deduplicating concurrent candidate-pool retrievals
   * for the same hackathon. Keyed by hackathon ID string.
   *
   * Crucial invariants:
   * - Entries exist ONLY while an asynchronous retrieval is actively pending.
   * - Once the promise settles (either successfully resolved or rejected), it is
   *   immediately removed in a `finally` block.
   * - Rejections do NOT poison subsequent requests; subsequent requests initiate a fresh fetch.
   * - Completed results are NEVER cached; no TTL or persistent memory state is retained.
   */
  private static inFlightCandidatePools = new Map<string, Promise<HackathonCandidatePool>>();

  /**
   * Returns current count of in-flight candidate pool promises (used for test assertions).
   */
  static getInFlightCount(): number {
    return this.inFlightCandidatePools.size;
  }

  /**
   * Clears all in-flight candidate pool promises (used for test teardown).
   */
  static clearInFlightPools(): void {
    this.inFlightCandidatePools.clear();
  }

  /**
   * Retrieves the candidate pool for a given hackathon, coalescing concurrent in-flight
   * requests for the same hackathon ID onto a single shared database retrieval.
   */
  static async getHackathonCandidatePool(
    hackathonId: mongoose.Types.ObjectId
  ): Promise<HackathonCandidatePool> {
    const key = hackathonId.toString();
    const existing = this.inFlightCandidatePools.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        return await this.fetchHackathonCandidatePool(hackathonId);
      } finally {
        this.inFlightCandidatePools.delete(key);
      }
    })();

    this.inFlightCandidatePools.set(key, promise);
    return promise;
  }

  /**
   * Performs the actual database queries to retrieve active hackathon memberships
   * and eligible candidate user records.
   */
  static async fetchHackathonCandidatePool(
    hackathonId: mongoose.Types.ObjectId
  ): Promise<HackathonCandidatePool> {
    // 1. Covered query: fetch all user IDs with ACTIVE membership in this hackathon.
    // Explicitly suppressing _id allows MongoDB to satisfy this query entirely from the
    // partial unique index { hackathonId: 1, userId: 1 }, examining 0 documents.
    const activeHackathonMemberships = await Membership.find(
      {
        hackathonId,
        status: "ACTIVE",
      },
      { userId: 1, _id: 0 }
    ).lean();

    const activeHackathonUserIds = new Set<string>();
    for (const m of activeHackathonMemberships) {
      if (m.userId) {
        activeHackathonUserIds.add(m.userId.toString());
      }
    }

    // 2. Query all candidate users in the pool who are ACTIVE and not in activeHackathonUserIds.
    // Project only necessary public attributes, strictly omitting passwordHash, tokenVersion, email, etc.
    const candidateDocs = await User.find(
      {
        _id: { $nin: Array.from(activeHackathonUserIds) },
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

    return {
      activeHackathonUserIds,
      candidates: candidateDocs as unknown as CandidateUserRecord[],
    };
  }

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
        displayName: string;
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

    // 2. Retrieve candidate pool for this hackathon (coalescing concurrent in-flight requests)
    const pool = await this.getHackathonCandidatePool(team.hackathonId);

    // 3. Build request-specific exclusion set:
    // Clone hackathon-wide excluded user IDs into a fresh request-local Set,
    // then add caller and team members. This ensures mutations are strictly isolated to this request.
    const excludedUserIds = new Set<string>(pool.activeHackathonUserIds);
    excludedUserIds.add(requestingUserId);
    for (const m of teamMembers) {
      excludedUserIds.add(m.id);
    }

    // Filter candidate documents for this request:
    // Exclude any candidate in request-specific excludedUserIds (e.g., caller or squad members).
    // Creates a new request-local array so no shared arrays are mutated.
    const candidateDocs = pool.candidates.filter((doc) => !excludedUserIds.has(String(doc._id)));

    // 4. Precompute reusable squad context and request-scoped timezone offset cache
    const refDate = new Date();
    const offsetCache = new Map<string, number | null>();
    const precomputed = precomputeTeamContext(teamCtx, refDate, offsetCache);

    // Score all eligible candidates using the deterministic engine
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

      return scoreCandidate(candidateInput, teamCtx, refDate, precomputed, offsetCache);
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
