import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import type { TeammateRecommendationDTO } from "@crewconnect/shared";
import { app } from "../src/app.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";
import { User } from "../src/models/User.js";
import { Team } from "../src/models/Team.js";
import { Hackathon, type IHackathon } from "../src/models/Hackathon.js";
import { Membership } from "../src/models/Membership.js";
import { AuthService } from "../src/services/auth.service.js";
import { RecommendationService } from "../src/services/recommendation.service.js";

const TEST_ORIGIN = "http://localhost:5173";

describe("Teammate Recommendations Integration Tests (GET /api/v1/teams/:id/recommendations)", () => {
  let testHackathon: IHackathon;

  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();

    testHackathon = await Hackathon.create({
      slug: `recommendations-hackathon-${Date.now()}`,
      title: "Recommendations Grand Prix 2026",
      description: "Testing deterministic explainable teammate recommendations",
      minTeamSize: 1,
      maxTeamSize: 4,
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  });

  async function cleanDatabase() {
    await User.deleteMany({});
    await Team.deleteMany({});
    await Hackathon.deleteMany({});
    await Membership.deleteMany({});
  }

  async function createTestUser(
    handle: string,
    displayName: string,
    skills: string[],
    experienceLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" = "INTERMEDIATE",
    timeZone = "UTC",
    status: "ACTIVE" | "SUSPENDED" = "ACTIVE"
  ) {
    const passwordHash = await User.hashPassword("SecurePassword123!");
    const user = await User.create({
      email: `${handle}@test-recs.com`,
      displayName,
      skills,
      experienceLevel,
      timeZone,
      status,
      passwordHash,
      githubUrl: `https://github.com/${handle}`,
      linkedinUrl: `https://linkedin.com/in/${handle}`,
    });

    const token = AuthService.generateToken(user);
    const cookie = `token=${token}; Path=/; HttpOnly`;
    return { user, cookie, token };
  }

  it("rejects unauthenticated requests with 401 Unauthorized", async () => {
    const fakeTeamId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/v1/teams/${fakeTeamId}/recommendations`)
      .set("Origin", TEST_ORIGIN);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 422 for malformed team ID format", async () => {
    const { cookie } = await createTestUser("anyuser", "Any User", ["TypeScript"]);

    const res = await request(app)
      .get("/api/v1/teams/invalid-not-an-oid/recommendations")
      .set("Cookie", cookie)
      .set("Origin", TEST_ORIGIN);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it("returns 404 if the team does not exist", async () => {
    const { cookie } = await createTestUser("anyuser", "Any User", ["TypeScript"]);
    const nonExistentTeamId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .get(`/api/v1/teams/${nonExistentTeamId}/recommendations`)
      .set("Cookie", cookie)
      .set("Origin", TEST_ORIGIN);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("rejects non-members with 403 Forbidden", async () => {
    const leader = await createTestUser("leader1", "Leader One", ["Rust"]);
    const outsider = await createTestUser("outsider", "Outsider User", ["React"]);

    const team = await Team.create({
      hackathonId: testHackathon._id,
      leaderId: leader.user._id,
      name: "Recs Alpha Squad",
      skillsNeeded: ["Go", "Docker"],
      maxCapacity: 4,
      memberCount: 1,
      isOpen: true,
      status: "ACTIVE",
    });

    await Membership.create({
      hackathonId: testHackathon._id,
      teamId: team._id,
      userId: leader.user._id,
      role: "LEADER",
      status: "ACTIVE",
    });

    const res = await request(app)
      .get(`/api/v1/teams/${team._id}/recommendations`)
      .set("Cookie", outsider.cookie)
      .set("Origin", TEST_ORIGIN);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/active member/i);
  });

  it("returns 0 recommendations when squad has zero vacancies (memberCount >= maxCapacity)", async () => {
    const leader = await createTestUser("fullleader", "Full Squad Leader", ["Go"]);

    const team = await Team.create({
      hackathonId: testHackathon._id,
      leaderId: leader.user._id,
      name: "Recs Full Squad",
      skillsNeeded: ["Rust"],
      maxCapacity: 2,
      memberCount: 2, // Full!
      isOpen: true,
      status: "ACTIVE",
    });

    await Membership.create({
      hackathonId: testHackathon._id,
      teamId: team._id,
      userId: leader.user._id,
      role: "LEADER",
      status: "ACTIVE",
    });

    // Create an eligible candidate
    await createTestUser("candidate1", "Candidate One", ["Rust"]);

    const res = await request(app)
      .get(`/api/v1/teams/${team._id}/recommendations`)
      .set("Cookie", leader.cookie)
      .set("Origin", TEST_ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vacancies).toBe(0);
    expect(res.body.data.recommendations).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it("strictly enforces candidate eligibility: excludes self, squad members, members of other teams in hackathon, and suspended users", async () => {
    // 1. Leader and confirmed co-member
    const leader = await createTestUser(
      "squadleader",
      "Squad Leader",
      ["TypeScript"],
      "BEGINNER",
      "UTC"
    );
    const coMember = await createTestUser("comember", "Co Member", ["React"], "BEGINNER", "UTC");

    const team = await Team.create({
      hackathonId: testHackathon._id,
      leaderId: leader.user._id,
      name: "Recs Target Squad",
      skillsNeeded: ["Rust", "Kubernetes"],
      maxCapacity: 4,
      memberCount: 2,
      isOpen: true,
      status: "ACTIVE",
    });

    await Membership.create([
      {
        hackathonId: testHackathon._id,
        teamId: team._id,
        userId: leader.user._id,
        role: "LEADER",
        status: "ACTIVE",
      },
      {
        hackathonId: testHackathon._id,
        teamId: team._id,
        userId: coMember.user._id,
        role: "MEMBER",
        status: "ACTIVE",
      },
    ]);

    // 2. User active in ANOTHER team in the same hackathon (ineligible per single-hackathon rule)
    const otherTeamLeader = await createTestUser("otherleader", "Other Leader", [
      "Rust",
      "Kubernetes",
    ]);
    const otherTeam = await Team.create({
      hackathonId: testHackathon._id,
      leaderId: otherTeamLeader.user._id,
      name: "Recs Other Squad",
      maxCapacity: 4,
      memberCount: 1,
      isOpen: true,
      status: "ACTIVE",
    });

    await Membership.create({
      hackathonId: testHackathon._id,
      teamId: otherTeam._id,
      userId: otherTeamLeader.user._id,
      role: "LEADER",
      status: "ACTIVE",
    });

    // 3. Suspended user (ineligible)
    await createTestUser(
      "suspendeduser",
      "Suspended User",
      ["Rust", "Kubernetes"],
      "ADVANCED",
      "UTC",
      "SUSPENDED"
    );

    // 4. Truly ELIGIBLE candidates
    const eligibleTop = await createTestUser(
      "topcandidate",
      "Top Candidate",
      ["Rust", "Kubernetes", "TypeScript"],
      "ADVANCED",
      "UTC"
    );

    const eligibleMid = await createTestUser(
      "midcandidate",
      "Mid Candidate",
      ["Python", "Django"],
      "INTERMEDIATE",
      "Asia/Tokyo"
    );

    // Call recommendations endpoint as team leader
    const res = await request(app)
      .get(`/api/v1/teams/${team._id}/recommendations`)
      .set("Cookie", leader.cookie)
      .set("Origin", TEST_ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const recs: TeammateRecommendationDTO[] = res.body.data.recommendations;
    const candidateIds = recs.map((r) => r.candidate.id);

    // Verifications:
    // Excludes self (leader)
    expect(candidateIds).not.toContain(leader.user._id.toString());
    // Excludes current squad co-member
    expect(candidateIds).not.toContain(coMember.user._id.toString());
    // Excludes member of another squad in this hackathon
    expect(candidateIds).not.toContain(otherTeamLeader.user._id.toString());
    // Excludes suspended user
    expect(candidateIds).not.toContain("suspendeduser");

    // Contains eligible candidates
    expect(candidateIds).toContain(eligibleTop.user._id.toString());
    expect(candidateIds).toContain(eligibleMid.user._id.toString());

    // Top candidate has higher compatibility score than mid candidate
    const topRec = recs.find((r) => r.candidate.id === eligibleTop.user._id.toString());
    const midRec = recs.find((r) => r.candidate.id === eligibleMid.user._id.toString());

    expect(topRec).toBeDefined();
    expect(midRec).toBeDefined();
    expect(topRec!.compatibilityScore).toBeGreaterThan(midRec!.compatibilityScore);
    expect(topRec!.explanations.complementarySkills).toContain("Rust");
    expect(topRec!.explanations.complementarySkills).toContain("Kubernetes");
    expect(topRec!.explanations.overlappingSkills).toContain("TypeScript");
    expect(topRec!.dimensionScores.skillScore).toBeGreaterThanOrEqual(80);
    expect(topRec!.dimensionScores.experienceScore).toBe(100); // Advanced candidate for beginner squad
    expect(topRec!.dimensionScores.timezoneScore).toBe(100); // UTC vs UTC
  });

  it("strictly sanitizes candidate DTOs: never leaks email, passwordHash, or tokenVersion", async () => {
    const leader = await createTestUser("privacyleader", "Privacy Leader", ["Go"]);
    const team = await Team.create({
      hackathonId: testHackathon._id,
      leaderId: leader.user._id,
      name: "Recs Privacy Squad",
      skillsNeeded: ["Python"],
      maxCapacity: 3,
      memberCount: 1,
      isOpen: true,
      status: "ACTIVE",
    });

    await Membership.create({
      hackathonId: testHackathon._id,
      teamId: team._id,
      userId: leader.user._id,
      role: "LEADER",
      status: "ACTIVE",
    });

    await createTestUser("candidate-privacy", "Privacy Candidate", ["Python"]);

    const res = await request(app)
      .get(`/api/v1/teams/${team._id}/recommendations`)
      .set("Cookie", leader.cookie)
      .set("Origin", TEST_ORIGIN);

    expect(res.status).toBe(200);
    const recs = res.body.data.recommendations;
    expect(recs.length).toBeGreaterThan(0);

    const firstCand = recs[0].candidate;
    expect(firstCand.displayName).toBe("Privacy Candidate");
    expect(firstCand.skills).toEqual(["Python"]);

    // Security invariants:
    expect(firstCand.email).toBeUndefined();
    expect(firstCand.passwordHash).toBeUndefined();
    expect(firstCand.tokenVersion).toBeUndefined();
    expect(firstCand.__v).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("candidate-privacy@test-recs.com");
  });

  it("supports pagination with page and limit query parameters", async () => {
    const leader = await createTestUser("pageleader", "Page Leader", ["TypeScript"]);
    const team = await Team.create({
      hackathonId: testHackathon._id,
      leaderId: leader.user._id,
      name: "Recs Pagination Squad",
      skillsNeeded: ["Docker"],
      maxCapacity: 10,
      memberCount: 1,
      isOpen: true,
      status: "ACTIVE",
    });

    await Membership.create({
      hackathonId: testHackathon._id,
      teamId: team._id,
      userId: leader.user._id,
      role: "LEADER",
      status: "ACTIVE",
    });

    // Create 5 candidates
    for (let i = 1; i <= 5; i++) {
      await createTestUser(`pagecand${i}`, `Page Cand ${i}`, [`Skill-${i}`]);
    }

    // Page 1 with limit 2
    const resPage1 = await request(app)
      .get(`/api/v1/teams/${team._id}/recommendations?page=1&limit=2`)
      .set("Cookie", leader.cookie)
      .set("Origin", TEST_ORIGIN);

    expect(resPage1.status).toBe(200);
    expect(resPage1.body.data.recommendations.length).toBe(2);
    expect(resPage1.body.meta.page).toBe(1);
    expect(resPage1.body.meta.limit).toBe(2);
    expect(resPage1.body.meta.total).toBe(5);

    // Page 2 with limit 2
    const resPage2 = await request(app)
      .get(`/api/v1/teams/${team._id}/recommendations?page=2&limit=2`)
      .set("Cookie", leader.cookie)
      .set("Origin", TEST_ORIGIN);

    expect(resPage2.status).toBe(200);
    expect(resPage2.body.data.recommendations.length).toBe(2);
    expect(resPage2.body.meta.page).toBe(2);

    // Verify disjoint sets across pages
    const page1Ids = (resPage1.body.data.recommendations as TeammateRecommendationDTO[]).map(
      (r) => r.candidate.id
    );
    const page2Ids = (resPage2.body.data.recommendations as TeammateRecommendationDTO[]).map(
      (r) => r.candidate.id
    );

    expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);
  });

  describe("Lifecycle & Permission Hardening Tests", () => {
    it("rejects recommendations request with 409 when squad is DISBANDED", async () => {
      const leader = await createTestUser("disbandleader", "Disband Leader", ["Go"]);
      const team = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leader.user._id,
        name: "Disbanded Team",
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "DISBANDED",
      });

      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: team._id,
        userId: leader.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      const res = await request(app)
        .get(`/api/v1/teams/${team._id}/recommendations`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("TEAM_DISBANDED");
    });

    it("rejects recommendations request with 409 when squad is ARCHIVED", async () => {
      const leader = await createTestUser("archiveleader", "Archive Leader", ["Go"]);
      const team = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leader.user._id,
        name: "Archived Team",
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "ARCHIVED",
      });

      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: team._id,
        userId: leader.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      const res = await request(app)
        .get(`/api/v1/teams/${team._id}/recommendations`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("TEAM_ARCHIVED");
    });

    it("returns zero recommendations cleanly when squad is closed (isOpen: false)", async () => {
      const leader = await createTestUser("closedleader", "Closed Leader", ["Go"]);
      const team = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leader.user._id,
        name: "Closed Team",
        maxCapacity: 4,
        memberCount: 1,
        isOpen: false,
        status: "ACTIVE",
      });

      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: team._id,
        userId: leader.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      // Eligible candidate in pool
      await createTestUser("closedcand", "Closed Cand", ["Python"]);

      const res = await request(app)
        .get(`/api/v1/teams/${team._id}/recommendations`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recommendations).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it("returns zero recommendations cleanly when squad is full (memberCount >= maxCapacity)", async () => {
      const leader = await createTestUser("fullleader", "Full Leader", ["Go"]);
      const team = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leader.user._id,
        name: "Full Team",
        maxCapacity: 2,
        memberCount: 2,
        isOpen: true,
        status: "ACTIVE",
      });

      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: team._id,
        userId: leader.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      await createTestUser("fullcand", "Full Cand", ["Python"]);

      const res = await request(app)
        .get(`/api/v1/teams/${team._id}/recommendations`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vacancies).toBe(0);
      expect(res.body.data.recommendations).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it("rejects recommendations request with 403 when caller is not an active member", async () => {
      const leader = await createTestUser("realteamleader", "Real Team Leader", ["Go"]);
      const outsider = await createTestUser("outsideruser", "Outsider User", ["Python"]);

      const team = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leader.user._id,
        name: "Restricted Team",
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });

      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: team._id,
        userId: leader.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      const res = await request(app)
        .get(`/api/v1/teams/${team._id}/recommendations`)
        .set("Cookie", outsider.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/active member/i);
    });
  });

  describe("Phase 4 Recommendation Engine Optimization Regression Tests", () => {
    it("handles candidates with zero skill overlap and ranks them deterministically", async () => {
      const leader = await createTestUser("zero-skill-lead", "Zero Skill Leader", ["TypeScript"]);
      const team = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leader.user._id,
        name: "Zero Skill Test Squad",
        skillsNeeded: ["Rust", "Kubernetes"],
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: team._id,
        userId: leader.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      // Candidate 1: Has skills needed (Rust, Kubernetes)
      const candA = await createTestUser(
        "cand-match",
        "Match Candidate",
        ["Rust", "Kubernetes"],
        "INTERMEDIATE",
        "UTC"
      );
      // Candidate 2: Zero skill overlap with skillsNeeded and zero overlap with coveredSkills
      const candB = await createTestUser(
        "cand-nomatch",
        "No Match Candidate",
        ["Elixir", "Haskell"],
        "INTERMEDIATE",
        "UTC"
      );
      // Candidate 3: Zero skills listed at all
      const candC = await createTestUser(
        "cand-zeroskills",
        "Zero Skills Candidate",
        [],
        "INTERMEDIATE",
        "UTC"
      );

      const res = await request(app)
        .get(`/api/v1/teams/${team._id}/recommendations`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.data.recommendations).toHaveLength(3);
      expect(res.body.meta.total).toBe(3);

      const recs = res.body.data.recommendations as TeammateRecommendationDTO[];
      // candA has declared skills needed -> highest compatibility
      expect(recs[0].candidate.id).toBe(candA.user._id.toString());
      expect(recs[0].dimensionScores.skillScore).toBeGreaterThan(
        recs[1].dimensionScores.skillScore
      );

      // Both candB and candC are eligible and present in recommendations
      const recB = recs.find((r) => r.candidate.id === candB.user._id.toString());
      const recC = recs.find((r) => r.candidate.id === candC.user._id.toString());
      expect(recB).toBeDefined();
      expect(recC).toBeDefined();
      expect(recB!.compatibilityScore).toBeGreaterThan(0);
      expect(recC!.compatibilityScore).toBeGreaterThan(0);
    });

    it("evaluates DST-sensitive timezone calculations accurately across seasons", async () => {
      const { getTimezoneOffsetMinutes, calculateTimezoneOverlap } =
        await import("../src/services/recommendation-engine.js");

      // America/New_York is UTC-4 in July (EDT) and UTC-5 in January (EST)
      const summerDate = new Date("2026-07-15T12:00:00Z");
      const winterDate = new Date("2026-01-15T12:00:00Z");

      const nySummerOffset = getTimezoneOffsetMinutes("America/New_York", summerDate);
      const nyWinterOffset = getTimezoneOffsetMinutes("America/New_York", winterDate);

      expect(nySummerOffset).toBe(-240); // -4 hours
      expect(nyWinterOffset).toBe(-300); // -5 hours

      // Overlap with UTC (0 offset):
      // Summer: diff = 4h -> overlap = 9 - 4 = 5.0h
      // Winter: diff = 5h -> overlap = 9 - 5 = 4.0h
      const summerOverlap = calculateTimezoneOverlap("America/New_York", ["UTC"], summerDate);
      const winterOverlap = calculateTimezoneOverlap("America/New_York", ["UTC"], winterDate);

      expect(summerOverlap.overlapHours).toBe(5);
      expect(summerOverlap.label).toBe("MODERATE");
      expect(summerOverlap.score).toBe(75);

      expect(winterOverlap.overlapHours).toBe(4);
      expect(winterOverlap.label).toBe("MODERATE");
      expect(winterOverlap.score).toBe(75);
    });

    it("strictly enforces candidate tie-breaking by candidate.id ASC on identical scores", async () => {
      const leader = await createTestUser(
        "tie-lead",
        "Tie Leader",
        ["TypeScript"],
        "INTERMEDIATE",
        "UTC"
      );
      const team = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leader.user._id,
        name: "Tie Break Test Squad",
        skillsNeeded: ["Python"],
        maxCapacity: 5,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: team._id,
        userId: leader.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      // Create two candidates with 100% identical attributes (skills, experience, timezone)
      const cand1 = await createTestUser(
        "tie-user-1",
        "User One",
        ["Python"],
        "INTERMEDIATE",
        "UTC"
      );
      const cand2 = await createTestUser(
        "tie-user-2",
        "User Two",
        ["Python"],
        "INTERMEDIATE",
        "UTC"
      );

      const res = await request(app)
        .get(`/api/v1/teams/${team._id}/recommendations`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(200);
      const recs = res.body.data.recommendations as TeammateRecommendationDTO[];
      expect(recs).toHaveLength(2);

      expect(recs[0].compatibilityScore).toBe(recs[1].compatibilityScore);
      expect(recs[0].dimensionScores).toEqual(recs[1].dimensionScores);

      // Tie breaker is candidate.id ASC
      const id0 = recs[0].candidate.id;
      const id1 = recs[1].candidate.id;
      const expectedFirstId =
        cand1.user._id.toString() < cand2.user._id.toString()
          ? cand1.user._id.toString()
          : cand2.user._id.toString();
      expect(id0).toBe(expectedFirstId);
      expect(id0.localeCompare(id1)).toBeLessThan(0);
    });

    it("returns clean empty recommendations set when no eligible non-member candidates exist", async () => {
      const leader = await createTestUser("lonely-lead", "Lonely Leader", ["Go"]);
      const team = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leader.user._id,
        name: "Lonely Squad",
        skillsNeeded: ["Go"],
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: team._id,
        userId: leader.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      // No other users created in database -> candidate pool is completely empty
      const res = await request(app)
        .get(`/api/v1/teams/${team._id}/recommendations`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.data.recommendations).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it("returns strictly deterministic results on repeated consecutive requests", async () => {
      const leader = await createTestUser("repeat-lead", "Repeat Leader", ["Python"]);
      const team = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leader.user._id,
        name: "Repeat Squad",
        skillsNeeded: ["Docker", "Kubernetes"],
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: team._id,
        userId: leader.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      await createTestUser("cand-alpha", "Alpha", ["Docker"], "ADVANCED", "UTC");
      await createTestUser("cand-beta", "Beta", ["Kubernetes"], "INTERMEDIATE", "America/New_York");
      await createTestUser("cand-gamma", "Gamma", ["React"], "BEGINNER", "Asia/Tokyo");

      const res1 = await request(app)
        .get(`/api/v1/teams/${team._id}/recommendations`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      const res2 = await request(app)
        .get(`/api/v1/teams/${team._id}/recommendations`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(res1.body.data.recommendations).toEqual(res2.body.data.recommendations);
      expect(res1.body.meta).toEqual(res2.body.meta);
    });
  });

  describe("Phase 6 In-Flight Coalescing & Covered Query Tests", () => {
    beforeEach(() => {
      RecommendationService.clearInFlightPools();
      vi.restoreAllMocks();
    });

    it("coalesces concurrent requests for the same hackathon into a single candidate-pool retrieval", async () => {
      const leader1 = await createTestUser("coal-lead-1", "Lead One", ["Node.js"]);
      const leader2 = await createTestUser("coal-lead-2", "Lead Two", ["TypeScript"]);
      const leader3 = await createTestUser("coal-lead-3", "Lead Three", ["React"]);

      const team1 = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leader1.user._id,
        name: "Coalesce Team 1",
        skillsNeeded: ["Python"],
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: team1._id,
        userId: leader1.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      const team2 = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leader2.user._id,
        name: "Coalesce Team 2",
        skillsNeeded: ["Go"],
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: team2._id,
        userId: leader2.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      const team3 = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leader3.user._id,
        name: "Coalesce Team 3",
        skillsNeeded: ["Rust"],
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: team3._id,
        userId: leader3.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      await createTestUser("pool-cand-1", "Candidate One", ["Python", "Rust"]);
      await createTestUser("pool-cand-2", "Candidate Two", ["Go", "React"]);

      const fetchSpy = vi.spyOn(RecommendationService, "fetchHackathonCandidatePool");

      // Fire 3 requests concurrently
      const [res1, res2, res3] = await Promise.all([
        request(app)
          .get(`/api/v1/teams/${team1._id}/recommendations`)
          .set("Cookie", leader1.cookie)
          .set("Origin", TEST_ORIGIN),
        request(app)
          .get(`/api/v1/teams/${team2._id}/recommendations`)
          .set("Cookie", leader2.cookie)
          .set("Origin", TEST_ORIGIN),
        request(app)
          .get(`/api/v1/teams/${team3._id}/recommendations`)
          .set("Cookie", leader3.cookie)
          .set("Origin", TEST_ORIGIN),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);

      // Verify coalescing: database retrieval executed EXACTLY once for the 3 concurrent requests
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(RecommendationService.getInFlightCount()).toBe(0);
    });

    it("ensures requests for different hackathons do not share retrievals", async () => {
      const otherHackathon = await Hackathon.create({
        slug: `other-hackathon-${Date.now()}`,
        title: "Other Hackathon 2026",
        description: "Testing hackathon isolation",
        minTeamSize: 1,
        maxTeamSize: 4,
        status: "ACTIVE",
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const leaderA = await createTestUser("diff-lead-a", "Lead A", ["Go"]);
      const leaderB = await createTestUser("diff-lead-b", "Lead B", ["Python"]);

      const teamA = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leaderA.user._id,
        name: "Hackathon 1 Team",
        skillsNeeded: ["Go"],
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: teamA._id,
        userId: leaderA.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      const teamB = await Team.create({
        hackathonId: otherHackathon._id,
        leaderId: leaderB.user._id,
        name: "Hackathon 2 Team",
        skillsNeeded: ["Python"],
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: otherHackathon._id,
        teamId: teamB._id,
        userId: leaderB.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      const fetchSpy = vi.spyOn(RecommendationService, "fetchHackathonCandidatePool");

      const [resA, resB] = await Promise.all([
        request(app)
          .get(`/api/v1/teams/${teamA._id}/recommendations`)
          .set("Cookie", leaderA.cookie)
          .set("Origin", TEST_ORIGIN),
        request(app)
          .get(`/api/v1/teams/${teamB._id}/recommendations`)
          .set("Cookie", leaderB.cookie)
          .set("Origin", TEST_ORIGIN),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      // Distinct hackathons must each trigger their own candidate pool retrieval
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(RecommendationService.getInFlightCount()).toBe(0);
    });

    it("removes failed retrievals from the in-flight map and allows subsequent retries", async () => {
      const leader = await createTestUser("fail-lead", "Fail Leader", ["Python"]);
      const team = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leader.user._id,
        name: "Retry Test Squad",
        skillsNeeded: ["Python"],
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: team._id,
        userId: leader.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      const fetchSpy = vi
        .spyOn(RecommendationService, "fetchHackathonCandidatePool")
        .mockRejectedValueOnce(new Error("Simulated Transient DB Failure"));

      const failRes = await request(app)
        .get(`/api/v1/teams/${team._id}/recommendations`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(failRes.status).toBe(500);
      // Failed promise must NOT remain in the in-flight map
      expect(RecommendationService.getInFlightCount()).toBe(0);

      // Second attempt succeeds cleanly
      fetchSpy.mockRestore();
      const retryRes = await request(app)
        .get(`/api/v1/teams/${team._id}/recommendations`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(retryRes.status).toBe(200);
      expect(RecommendationService.getInFlightCount()).toBe(0);
    });

    it("does not reuse completed results for later requests (no persistent caching)", async () => {
      const leader = await createTestUser("nocache-lead", "No Cache Leader", ["Python"]);
      const team = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leader.user._id,
        name: "No Cache Squad",
        skillsNeeded: ["Python"],
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: team._id,
        userId: leader.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      const fetchSpy = vi.spyOn(RecommendationService, "fetchHackathonCandidatePool");

      const res1 = await request(app)
        .get(`/api/v1/teams/${team._id}/recommendations`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);
      expect(res1.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(RecommendationService.getInFlightCount()).toBe(0);

      // Sequential subsequent request must fetch fresh data from database, proving zero persistent cache
      const res2 = await request(app)
        .get(`/api/v1/teams/${team._id}/recommendations`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);
      expect(res2.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(RecommendationService.getInFlightCount()).toBe(0);
    });

    it("maintains strict isolation of request-specific team context and scoring despite coalescing", async () => {
      const leaderRust = await createTestUser("iso-lead-rust", "Rust Lead", ["Rust"]);
      const leaderUi = await createTestUser("iso-lead-ui", "UI Lead", ["Figma"]);

      const teamRust = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leaderRust.user._id,
        name: "Rust Core Team",
        skillsNeeded: ["Rust", "Tokio"],
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: teamRust._id,
        userId: leaderRust.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      const teamUi = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leaderUi.user._id,
        name: "Design Studio Team",
        skillsNeeded: ["Figma", "CSS"],
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: teamUi._id,
        userId: leaderUi.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      const candRust = await createTestUser(
        "cand-rust-dev",
        "Rust Dev",
        ["Rust", "Tokio"],
        "ADVANCED",
        "UTC"
      );
      const candUi = await createTestUser(
        "cand-ui-des",
        "UI Designer",
        ["Figma", "CSS"],
        "ADVANCED",
        "UTC"
      );

      // Concurrent request across both teams in the same hackathon
      const [resRust, resUi] = await Promise.all([
        request(app)
          .get(`/api/v1/teams/${teamRust._id}/recommendations`)
          .set("Cookie", leaderRust.cookie)
          .set("Origin", TEST_ORIGIN),
        request(app)
          .get(`/api/v1/teams/${teamUi._id}/recommendations`)
          .set("Cookie", leaderUi.cookie)
          .set("Origin", TEST_ORIGIN),
      ]);

      expect(resRust.status).toBe(200);
      expect(resUi.status).toBe(200);

      const recsRust = resRust.body.data.recommendations as TeammateRecommendationDTO[];
      const recsUi = resUi.body.data.recommendations as TeammateRecommendationDTO[];

      // Team Rust's top recommendation is candRust
      expect(recsRust[0].candidate.id).toBe(candRust.user._id.toString());
      expect(recsRust[0].dimensionScores.skillScore).toBe(85);
      expect(recsRust[0].dimensionScores.skillScore).toBeGreaterThan(
        recsRust[1].dimensionScores.skillScore
      );

      // Team UI's top recommendation is candUi
      expect(recsUi[0].candidate.id).toBe(candUi.user._id.toString());
      expect(recsUi[0].dimensionScores.skillScore).toBe(85);
      expect(recsUi[0].dimensionScores.skillScore).toBeGreaterThan(
        recsUi[1].dimensionScores.skillScore
      );
    });

    it("ensures membership changes immediately reflect in subsequent requests without persistent stale results", async () => {
      const leader = await createTestUser("fresh-lead", "Fresh Lead", ["Python"]);
      const team1 = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: leader.user._id,
        name: "Fresh Squad 1",
        skillsNeeded: ["Docker"],
        maxCapacity: 4,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: team1._id,
        userId: leader.user._id,
        role: "LEADER",
        status: "ACTIVE",
      });

      const freeAgent = await createTestUser("free-agent", "Free Agent", ["Docker"]);

      // First request: free agent is available and recommended
      const res1 = await request(app)
        .get(`/api/v1/teams/${team1._id}/recommendations`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(res1.status).toBe(200);
      const recs1 = res1.body.data.recommendations as TeammateRecommendationDTO[];
      expect(recs1.some((r) => r.candidate.id === freeAgent.user._id.toString())).toBe(true);

      // Free agent joins team 2 in the same hackathon
      const otherTeam = await Team.create({
        hackathonId: testHackathon._id,
        leaderId: new mongoose.Types.ObjectId(),
        name: "Fresh Squad 2",
        maxCapacity: 4,
        memberCount: 2,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: testHackathon._id,
        teamId: otherTeam._id,
        userId: freeAgent.user._id,
        role: "MEMBER",
        status: "ACTIVE",
      });

      // Subsequent request: free agent is now active in another team and MUST NOT be recommended
      const res2 = await request(app)
        .get(`/api/v1/teams/${team1._id}/recommendations`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(res2.status).toBe(200);
      const recs2 = res2.body.data.recommendations as TeammateRecommendationDTO[];
      expect(recs2.some((r) => r.candidate.id === freeAgent.user._id.toString())).toBe(false);
    });

    it("executes the active hackathon membership query as a covered index query with zero docs examined", async () => {
      const explain = await Membership.collection
        .find(
          { hackathonId: testHackathon._id, status: "ACTIVE" },
          { projection: { userId: 1, _id: 0 } }
        )
        .explain("executionStats");

      const stats = (
        explain as unknown as {
          executionStats: { totalDocsExamined: number; executionStages: { stage: string } };
        }
      ).executionStats;
      expect(stats.totalDocsExamined).toBe(0);
      expect(stats.executionStages.stage).toBe("PROJECTION_COVERED");
    });
  });
});
