import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
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
});
