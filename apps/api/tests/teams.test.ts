import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose, { Types } from "mongoose";
import { app } from "../src/app.js";
import { User, Hackathon, Team, Membership, AuditLog } from "../src/models/index.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";
import type { UserDTO } from "@crewconnect/shared";

const TEST_ORIGIN = "http://localhost:5173";

describe("Team Lifecycle & Management Integration Tests", () => {
  let testHackathonId: string;
  let leaderUser: UserDTO;
  let leaderCookie: string;
  let memberUser: UserDTO;
  let memberCookie: string;
  let outsiderUser: UserDTO;
  let outsiderCookie: string;

  beforeAll(async () => {
    await connectToDatabase();
    await User.syncIndexes();
    await Team.syncIndexes();
    await Membership.syncIndexes();
    await Hackathon.syncIndexes();
    await AuditLog.syncIndexes();
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@test-teams-suite\.com$/ });
    await Hackathon.deleteMany({ slug: /test-hackathon-/ });
    if (testHackathonId) {
      await Team.deleteMany({ hackathonId: testHackathonId });
      await Membership.deleteMany({ hackathonId: testHackathonId });
      await AuditLog.deleteMany({ hackathonId: testHackathonId });
    }
    await disconnectDatabase();
  });

  beforeEach(async () => {
    // Clean up collections for test isolation
    await User.deleteMany({ email: /@test-teams-suite\.com$/ });
    await Hackathon.deleteMany({ slug: /test-hackathon-/ });
    await Team.deleteMany({ name: /Test Team/ });
    await Membership.deleteMany({});
    await AuditLog.deleteMany({});

    // Seed test hackathon
    const hackathon = await Hackathon.create({
      slug: `test-hackathon-${Date.now()}`,
      title: "Test Hackathon 2026",
      description: "A test hackathon environment",
      minTeamSize: 1,
      maxTeamSize: 5,
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    testHackathonId = hackathon._id.toString();

    // Register Leader
    const leaderRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "leader@test-teams-suite.com",
        password: "LeaderPassword123!",
        displayName: "Leader User",
        skills: ["TypeScript", "React"],
      });
    leaderUser = leaderRes.body.data.user;
    leaderCookie = leaderRes.headers["set-cookie"][0];

    // Register Member
    const memberRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "member@test-teams-suite.com",
        password: "MemberPassword123!",
        displayName: "Member User",
        skills: ["Node.js", "Docker"],
      });
    memberUser = memberRes.body.data.user;
    memberCookie = memberRes.headers["set-cookie"][0];

    // Register Outsider
    const outsiderRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "outsider@test-teams-suite.com",
        password: "OutsiderPassword123!",
        displayName: "Outsider User",
        skills: ["Design", "CSS"],
      });
    outsiderUser = outsiderRes.body.data.user;
    outsiderCookie = outsiderRes.headers["set-cookie"][0];
  });

  // -------------------------------------------------------------
  // 1. Team Creation
  // -------------------------------------------------------------
  describe("POST /api/v1/hackathons/:hackathonId/teams", () => {
    it("successfully creates a team and leader membership atomically in a MongoDB transaction", async () => {
      const res = await request(app)
        .post(`/api/v1/hackathons/${testHackathonId}/teams`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({
          name: "Test Team Alpha",
          tagline: "We build race-proof platforms",
          description: "Full-stack hackathon team",
          skillsNeeded: ["TypeScript", "MongoDB"],
          maxCapacity: 4,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.team).toBeDefined();
      expect(res.body.data.team.name).toBe("Test Team Alpha");
      expect(res.body.data.team.memberCount).toBe(1);
      expect(res.body.data.team.maxCapacity).toBe(4);
      expect(res.body.data.team.isOpen).toBe(true);
      expect(res.body.data.team.status).toBe("ACTIVE");
      expect(res.body.data.membership).toBeDefined();
      expect(res.body.data.membership.role).toBe("LEADER");
      expect(res.body.data.membership.status).toBe("ACTIVE");

      const teamId = res.body.data.team.id;

      // Invariant Check 1: Exactly 1 active membership exists
      const activeMemberships = await Membership.find({ teamId, status: "ACTIVE" });
      expect(activeMemberships).toHaveLength(1);
      expect(activeMemberships[0].userId.toString()).toBe(leaderUser.id);
      expect(activeMemberships[0].role).toBe("LEADER");

      // Invariant Check 2: Audit log was created in the transaction
      const auditLog = await AuditLog.findOne({ teamId, action: "TEAM_CREATED" });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.actorId.toString()).toBe(leaderUser.id);
    });

    it("rejects duplicate team name in the same hackathon (409 Conflict)", async () => {
      // Create first team
      await request(app)
        .post(`/api/v1/hackathons/${testHackathonId}/teams`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ name: "Test Team Duplicate" });

      // Outsider tries to create a team with the exact same name
      const res = await request(app)
        .post(`/api/v1/hackathons/${testHackathonId}/teams`)
        .set("Cookie", outsiderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ name: "Test Team Duplicate" });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("TEAM_NAME_TAKEN");
    });

    it("rejects user creating a second team in the same hackathon (409 Conflict)", async () => {
      // First team creation
      await request(app)
        .post(`/api/v1/hackathons/${testHackathonId}/teams`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ name: "Test Team One" });

      // Same user tries to create another team
      const res = await request(app)
        .post(`/api/v1/hackathons/${testHackathonId}/teams`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ name: "Test Team Two" });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("ALREADY_IN_TEAM");
    });

    it("rolls back team creation completely if transaction is aborted", async () => {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();

        const [tempTeam] = await Team.create(
          [
            {
              hackathonId: new Types.ObjectId(testHackathonId),
              leaderId: new Types.ObjectId(outsiderUser.id),
              name: "Rollback Team Test",
              skillsNeeded: ["Go"],
              memberCount: 1,
              maxCapacity: 5,
              isOpen: true,
              status: "ACTIVE",
            },
          ],
          { session }
        );

        // Abort transaction deliberately
        await session.abortTransaction();

        // Verify team was not persisted
        const found = await Team.findById(tempTeam._id);
        expect(found).toBeNull();
      } finally {
        await session.endSession();
      }
    });
  });

  // -------------------------------------------------------------
  // 2. Team Detail Updates & Validation
  // -------------------------------------------------------------
  describe("PATCH /api/v1/teams/:id", () => {
    let teamId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/v1/hackathons/${testHackathonId}/teams`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({
          name: "Test Team Editable",
          tagline: "Original Tagline",
          maxCapacity: 5,
        });
      teamId = res.body.data.team.id;
    });

    it("allows team leader to update name, tagline, description, and skills", async () => {
      const res = await request(app)
        .patch(`/api/v1/teams/${teamId}`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({
          name: "Test Team Renamed",
          tagline: "Updated Tagline",
          description: "New description",
          skillsNeeded: ["Python", "PyTorch"],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Test Team Renamed");
      expect(res.body.data.tagline).toBe("Updated Tagline");

      // Verify audit log
      const audit = await AuditLog.findOne({ teamId, action: "TEAM_UPDATED" });
      expect(audit).not.toBeNull();
    });

    it("rejects unauthorized updates from non-leaders (403 Forbidden)", async () => {
      const res = await request(app)
        .patch(`/api/v1/teams/${teamId}`)
        .set("Cookie", outsiderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ name: "Hacked Team" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_TEAM_LEADER");
    });

    it("rejects capacity reduction below current active member count (400 Bad Request)", async () => {
      // Add a member directly into the team to make count = 2
      await Membership.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: new Types.ObjectId(teamId),
        userId: new Types.ObjectId(memberUser.id),
        role: "MEMBER",
        status: "ACTIVE",
      });
      await Team.findByIdAndUpdate(teamId, { memberCount: 2 });

      // Try reducing maxCapacity to 1
      const res = await request(app)
        .patch(`/api/v1/teams/${teamId}`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ maxCapacity: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("TEAM_CAPACITY_INVALID");
    });
  });

  // -------------------------------------------------------------
  // 3. Open / Close Team Management
  // -------------------------------------------------------------
  describe("POST /api/v1/teams/:id/open and /close", () => {
    let teamId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/v1/hackathons/${testHackathonId}/teams`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ name: "Test Team Visibility", maxCapacity: 3 });
      teamId = res.body.data.team.id;
    });

    it("leader can close and reopen team with audit logging", async () => {
      // Close
      const closeRes = await request(app)
        .post(`/api/v1/teams/${teamId}/close`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN);

      expect(closeRes.status).toBe(200);
      expect(closeRes.body.data.isOpen).toBe(false);

      const closeAudit = await AuditLog.findOne({ teamId, action: "TEAM_CLOSED" });
      expect(closeAudit).not.toBeNull();

      // Open
      const openRes = await request(app)
        .post(`/api/v1/teams/${teamId}/open`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN);

      expect(openRes.status).toBe(200);
      expect(openRes.body.data.isOpen).toBe(true);

      const openAudit = await AuditLog.findOne({ teamId, action: "TEAM_OPENED" });
      expect(openAudit).not.toBeNull();
    });

    it("rejects reopening if team is at maximum capacity (400 Bad Request)", async () => {
      // Set memberCount = maxCapacity
      await Team.findByIdAndUpdate(teamId, { memberCount: 3, maxCapacity: 3, isOpen: false });

      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/open`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CANNOT_REOPEN_TEAM");
    });
  });

  // -------------------------------------------------------------
  // 4. Leadership Transfer
  // -------------------------------------------------------------
  describe("POST /api/v1/teams/:id/transfer-leadership", () => {
    let teamId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/v1/hackathons/${testHackathonId}/teams`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ name: "Test Team Transfer" });
      teamId = res.body.data.team.id;

      // Add memberUser as active member
      await Membership.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: new Types.ObjectId(teamId),
        userId: new Types.ObjectId(memberUser.id),
        role: "MEMBER",
        status: "ACTIVE",
      });
      await Team.findByIdAndUpdate(teamId, { memberCount: 2 });
    });

    it("atomically transfers leadership to an active member", async () => {
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/transfer-leadership`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ newLeaderId: memberUser.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.leaderId).toBe(memberUser.id);

      // Verify database state: exactly 1 leader, exactly 1 active member
      const previousLeaderMem = await Membership.findOne({
        teamId,
        userId: leaderUser.id,
        status: "ACTIVE",
      });
      expect(previousLeaderMem?.role).toBe("MEMBER");

      const newLeaderMem = await Membership.findOne({
        teamId,
        userId: memberUser.id,
        status: "ACTIVE",
      });
      expect(newLeaderMem?.role).toBe("LEADER");

      const activeLeaders = await Membership.find({ teamId, role: "LEADER", status: "ACTIVE" });
      expect(activeLeaders).toHaveLength(1);

      // Verify audit log
      const audit = await AuditLog.findOne({ teamId, action: "LEADERSHIP_TRANSFERRED" });
      expect(audit).not.toBeNull();
      expect(audit?.actorId.toString()).toBe(leaderUser.id);
      expect(audit?.targetUserId?.toString()).toBe(memberUser.id);
    });

    it("rejects transfer to a non-member (400 Bad Request)", async () => {
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/transfer-leadership`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ newLeaderId: outsiderUser.id });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("TARGET_USER_NOT_ACTIVE_MEMBER");
    });

    it("rejects transfer initiated by non-leader (403 Forbidden)", async () => {
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/transfer-leadership`)
        .set("Cookie", memberCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ newLeaderId: memberUser.id });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_TEAM_LEADER");
    });

    it("rejects repeated transfer attempt by demoted former leader", async () => {
      // First transfer: leader -> member
      await request(app)
        .post(`/api/v1/teams/${teamId}/transfer-leadership`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ newLeaderId: memberUser.id });

      // Immediate second transfer by former leader must fail
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/transfer-leadership`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ newLeaderId: leaderUser.id });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("NOT_TEAM_LEADER");
    });
  });

  // -------------------------------------------------------------
  // 5. Member Leave & Disband Workflows
  // -------------------------------------------------------------
  describe("POST /api/v1/teams/:id/leave", () => {
    let teamId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/v1/hackathons/${testHackathonId}/teams`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ name: "Test Team Leave" });
      teamId = res.body.data.team.id;
    });

    it("allows a regular member to leave voluntarily, decrementing memberCount", async () => {
      // Add memberUser
      await Membership.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: new Types.ObjectId(teamId),
        userId: new Types.ObjectId(memberUser.id),
        role: "MEMBER",
        status: "ACTIVE",
      });
      await Team.findByIdAndUpdate(teamId, { memberCount: 2 });

      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/leave`)
        .set("Cookie", memberCookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.disbanded).toBe(false);
      expect(res.body.data.team.memberCount).toBe(1);

      // Verify membership status is LEFT
      const mem = await Membership.findOne({ teamId, userId: memberUser.id });
      expect(mem?.status).toBe("LEFT");
      expect(mem?.leftAt).toBeDefined();

      // Invariant: count matches
      const activeCount = await Membership.countDocuments({ teamId, status: "ACTIVE" });
      expect(activeCount).toBe(1);
    });

    it("blocks leader from leaving multi-member team without transfer (400 Bad Request)", async () => {
      // Add memberUser
      await Membership.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: new Types.ObjectId(teamId),
        userId: new Types.ObjectId(memberUser.id),
        role: "MEMBER",
        status: "ACTIVE",
      });
      await Team.findByIdAndUpdate(teamId, { memberCount: 2 });

      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/leave`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("LEADER_CANNOT_LEAVE");
    });

    it("disbands team atomically when sole remaining member (leader) leaves", async () => {
      // Team has only 1 member (leader)
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/leave`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.data.disbanded).toBe(true);
      expect(res.body.data.team.status).toBe("DISBANDED");
      expect(res.body.data.team.isOpen).toBe(false);
      expect(res.body.data.team.memberCount).toBe(0);

      // Verify leader membership is LEFT
      const mem = await Membership.findOne({ teamId, userId: leaderUser.id });
      expect(mem?.status).toBe("LEFT");

      // Verify audit logs for both leave and disband
      const leaveAudit = await AuditLog.findOne({ teamId, action: "MEMBER_LEFT" });
      const disbandAudit = await AuditLog.findOne({ teamId, action: "TEAM_DISBANDED" });
      expect(leaveAudit).not.toBeNull();
      expect(disbandAudit).not.toBeNull();
    });
  });

  // -------------------------------------------------------------
  // 6. Member Removal by Leader
  // -------------------------------------------------------------
  describe("DELETE /api/v1/teams/:id/members/:userId", () => {
    let teamId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/v1/hackathons/${testHackathonId}/teams`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ name: "Test Team Removal" });
      teamId = res.body.data.team.id;

      await Membership.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: new Types.ObjectId(teamId),
        userId: new Types.ObjectId(memberUser.id),
        role: "MEMBER",
        status: "ACTIVE",
      });
      await Team.findByIdAndUpdate(teamId, { memberCount: 2 });
    });

    it("allows leader to remove an active member", async () => {
      const res = await request(app)
        .delete(`/api/v1/teams/${teamId}/members/${memberUser.id}`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.memberCount).toBe(1);

      const mem = await Membership.findOne({ teamId, userId: memberUser.id });
      expect(mem?.status).toBe("REMOVED");

      const audit = await AuditLog.findOne({ teamId, action: "MEMBER_REMOVED" });
      expect(audit).not.toBeNull();
      expect(audit?.targetUserId?.toString()).toBe(memberUser.id);
    });

    it("prevents leader from removing themselves via removal endpoint (400 Bad Request)", async () => {
      const res = await request(app)
        .delete(`/api/v1/teams/${teamId}/members/${leaderUser.id}`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CANNOT_REMOVE_SELF");
    });

    it("rejects unauthorized removal from non-leader (403 Forbidden)", async () => {
      const res = await request(app)
        .delete(`/api/v1/teams/${teamId}/members/${memberUser.id}`)
        .set("Cookie", outsiderCookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("NOT_TEAM_LEADER");
    });
  });

  // -------------------------------------------------------------
  // 7. Team Disbanding
  // -------------------------------------------------------------
  describe("POST /api/v1/teams/:id/disband", () => {
    let teamId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/v1/hackathons/${testHackathonId}/teams`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ name: "Test Team Disband" });
      teamId = res.body.data.team.id;

      await Membership.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: new Types.ObjectId(teamId),
        userId: new Types.ObjectId(memberUser.id),
        role: "MEMBER",
        status: "ACTIVE",
      });
      await Team.findByIdAndUpdate(teamId, { memberCount: 2 });
    });

    it("leader disbands team: marks DISBANDED, isOpen false, memberCount 0, active members LEFT", async () => {
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/disband`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("DISBANDED");
      expect(res.body.data.isOpen).toBe(false);
      expect(res.body.data.memberCount).toBe(0);

      // Verify all memberships are LEFT
      const activeMembers = await Membership.find({ teamId, status: "ACTIVE" });
      expect(activeMembers).toHaveLength(0);

      const allMembers = await Membership.find({ teamId });
      expect(allMembers.every((m) => m.status === "LEFT")).toBe(true);

      const audit = await AuditLog.findOne({ teamId, action: "TEAM_DISBANDED" });
      expect(audit).not.toBeNull();
    });

    it("returns 409 Conflict on repeated disband attempts", async () => {
      // First disband
      await request(app)
        .post(`/api/v1/teams/${teamId}/disband`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN);

      // Repeated disband
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/disband`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("TEAM_DISBANDED");
    });
  });

  // -------------------------------------------------------------
  // 8. Roster & Audit Retrieval
  // -------------------------------------------------------------
  describe("Roster & Audit Log Endpoints", () => {
    let teamId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/v1/hackathons/${testHackathonId}/teams`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .send({ name: "Test Team Roster" });
      teamId = res.body.data.team.id;
    });

    it("retrieves team roster with populated user profiles", async () => {
      const res = await request(app).get(`/api/v1/teams/${teamId}/members`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].role).toBe("LEADER");
      expect(res.body.data[0].userId.displayName).toBe("Leader User");
    });

    it("retrieves team audit logs for authenticated member", async () => {
      const res = await request(app)
        .get(`/api/v1/teams/${teamId}/audit-logs`)
        .set("Cookie", leaderCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].action).toBe("TEAM_CREATED");
    });

    it("rejects audit log retrieval from non-member outsider (403 Forbidden)", async () => {
      const res = await request(app)
        .get(`/api/v1/teams/${teamId}/audit-logs`)
        .set("Cookie", outsiderCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
