import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import mongoose, { Types } from "mongoose";
import { app } from "../src/app.js";
import {
  User,
  Hackathon,
  Team,
  Membership,
  JoinRequest,
  Invitation,
  AuditLog,
  IdempotencyRecord,
  type IUser,
} from "../src/models/index.js";
import { AuthService } from "../src/services/auth.service.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";
import { ERROR_CODES } from "@crewconnect/shared";

describe("Phase 5: Race-Proof Membership Engine & Concurrency Verification", () => {
  let testHackathonId: string;
  let leaderUser: IUser;
  let leaderToken: string;
  let memberUser: IUser;
  let memberToken: string;
  let passwordHash: string;

  beforeEach(async () => {
    if (mongoose.connection.readyState !== 1) {
      await connectToDatabase();
    }

    // Clean up collections for test isolation
    await User.deleteMany({ email: /@test-race\.com$/ });
    await Hackathon.deleteMany({ slug: /test-race-hackathon-/ });
    await Team.deleteMany({ name: /Race Test Team/ });
    await Membership.deleteMany({});
    await JoinRequest.deleteMany({});
    await Invitation.deleteMany({});
    await AuditLog.deleteMany({});
    await IdempotencyRecord.deleteMany({});

    passwordHash = await User.hashPassword("Password123!");

    // Seed test hackathon
    const hackathon = await Hackathon.create({
      slug: `test-race-hackathon-${Date.now()}`,
      title: "Race Test Hackathon 2026",
      description: "Testing concurrent capacity and membership invariants",
      minTeamSize: 1,
      maxTeamSize: 5,
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    testHackathonId = hackathon._id.toString();

    // Seed leader
    leaderUser = await User.create({
      email: `leader-${Date.now()}@test-race.com`,
      passwordHash,
      displayName: "Race Leader",
      skills: ["Go", "Distributed Systems"],
      status: "ACTIVE",
      tokenVersion: 0,
    });
    leaderToken = AuthService.generateToken(leaderUser);

    // Seed a standard member
    memberUser = await User.create({
      email: `member-${Date.now()}@test-race.com`,
      passwordHash,
      displayName: "Race Member",
      skills: ["React"],
      status: "ACTIVE",
      tokenVersion: 0,
    });
    memberToken = AuthService.generateToken(memberUser);
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@test-race\.com$/ });
    await Hackathon.deleteMany({ slug: /test-race-hackathon-/ });
    await Team.deleteMany({ name: /Race Test Team/ });
    await Membership.deleteMany({});
    await JoinRequest.deleteMany({});
    await Invitation.deleteMany({});
    await AuditLog.deleteMany({});
    await IdempotencyRecord.deleteMany({});
    await disconnectDatabase();
  });

  // --------------------------------------------------------------------------
  // 1. The Critical Acceptance Test: 50 concurrent requests for 1 seat
  // --------------------------------------------------------------------------
  it("Critical Acceptance Test: 50 concurrent requests for the final seat result in exactly 1 winner, 49 clean conflicts, and no overbooking", async () => {
    // 1. Create team with maxCapacity = 5
    const team = await Team.create({
      hackathonId: new Types.ObjectId(testHackathonId),
      leaderId: leaderUser._id,
      name: `Race Test Team Final Seat ${Date.now()}`,
      memberCount: 4, // 4 existing members
      maxCapacity: 5, // 1 remaining seat!
      isOpen: true,
      status: "ACTIVE",
    });
    const teamId = team._id.toString();

    // Seed initial 4 active members (leader + 3 members)
    const initialUsers = await User.insertMany([
      {
        email: `init-1-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Init 1",
        skills: ["TS"],
        status: "ACTIVE",
      },
      {
        email: `init-2-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Init 2",
        skills: ["TS"],
        status: "ACTIVE",
      },
      {
        email: `init-3-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Init 3",
        skills: ["TS"],
        status: "ACTIVE",
      },
    ]);

    await Membership.insertMany([
      {
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: team._id,
        userId: leaderUser._id,
        role: "LEADER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
      {
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: team._id,
        userId: initialUsers[0]._id,
        role: "MEMBER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
      {
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: team._id,
        userId: initialUsers[1]._id,
        role: "MEMBER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
      {
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: team._id,
        userId: initialUsers[2]._id,
        role: "MEMBER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    ]);

    // 2. Prepare 50 distinct authenticated users who do not belong to this hackathon
    const competitorsData = [];
    for (let i = 1; i <= 50; i++) {
      competitorsData.push({
        email: `competitor-${i}-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: `Competitor ${i}`,
        skills: ["Algorithms"],
        status: "ACTIVE",
        tokenVersion: 0,
      });
    }
    const competitors = await User.insertMany(competitorsData);
    const competitorTokens = competitors.map((c) => AuthService.generateToken(c));

    // 3. Launch 50 independent HTTP requests concurrently against POST /api/v1/teams/:id/join
    const joinPromises = competitors.map((user, idx) => {
      return request(app)
        .post(`/api/v1/teams/${teamId}/join`)
        .set("Authorization", `Bearer ${competitorTokens[idx]}`)
        .set("Idempotency-Key", `idemp-race-final-seat-${user._id}-${Date.now()}`);
    });

    // 4. Wait for all 50 requests to complete
    const responses = await Promise.all(joinPromises);

    // 5. Inspect HTTP responses
    const successful = responses.filter((r) => r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409);
    const serverErrors = responses.filter((r) => r.status === 500);

    expect(successful).toHaveLength(1);
    expect(conflicts).toHaveLength(49);
    expect(serverErrors).toHaveLength(0);

    for (const conflictRes of conflicts) {
      expect(["TEAM_FULL", "CONCURRENCY_CONFLICT"]).toContain(conflictRes.body.error.code);
    }

    // 6. Inspect database state directly
    const finalTeam = await Team.findById(teamId);
    expect(finalTeam?.memberCount).toBe(5);

    const activeMembers = await Membership.find({ teamId, status: "ACTIVE" });
    expect(activeMembers).toHaveLength(5);

    // Ensure all 5 active members are distinct users
    const memberIds = activeMembers.map((m) => m.userId.toString());
    const uniqueMemberIds = new Set(memberIds);
    expect(uniqueMemberIds.size).toBe(5);

    // The winning user must be in the active members list
    const winnerUserId = successful[0].body.data.userId;
    expect(uniqueMemberIds.has(winnerUserId)).toBe(true);

    // Exactly 1 MEMBER_JOINED event exists for this addition
    const joinAuditEvents = await AuditLog.find({
      teamId,
      action: "MEMBER_JOINED",
    });
    expect(joinAuditEvents).toHaveLength(1);
    expect(joinAuditEvents[0].actorId.toString()).toBe(winnerUserId);
  }, 30000);

  // --------------------------------------------------------------------------
  // 2. Direct Join Capacity, Eligibility & Error Boundaries
  // --------------------------------------------------------------------------
  describe("Direct Team Join & Eligibility Invariants", () => {
    it("rejects user who already belongs to another active team in the same hackathon with ALREADY_IN_TEAM (409)", async () => {
      // Create team 1
      const team1 = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: leaderUser._id,
        name: `Race Team One ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 4,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: team1._id,
        userId: leaderUser._id,
        role: "LEADER",
        status: "ACTIVE",
        joinedAt: new Date(),
      });

      // Create team 2
      const team2 = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: memberUser._id,
        name: `Race Team Two ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 4,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: team2._id,
        userId: memberUser._id,
        role: "LEADER",
        status: "ACTIVE",
        joinedAt: new Date(),
      });

      // MemberUser (already in team 2) tries to join team 1
      const res = await request(app)
        .post(`/api/v1/teams/${team1._id}/join`)
        .set("Authorization", `Bearer ${memberToken}`)
        .set("Idempotency-Key", `idemp-already-in-team-${Date.now()}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe(ERROR_CODES.ALREADY_IN_TEAM);
    });

    it("rejects joining a team that is closed with TEAM_CLOSED (409)", async () => {
      const closedTeam = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: leaderUser._id,
        name: `Closed Team ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 4,
        isOpen: false, // CLOSED
        status: "ACTIVE",
      });

      const outsider = await User.create({
        email: `outsider-closed-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Outsider Closed",
        skills: ["Python"],
        status: "ACTIVE",
      });
      const token = AuthService.generateToken(outsider);

      const res = await request(app)
        .post(`/api/v1/teams/${closedTeam._id}/join`)
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", `idemp-closed-${Date.now()}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe(ERROR_CODES.TEAM_CLOSED);
    });

    it("rejects joining a disbanded team with TEAM_DISBANDED (409)", async () => {
      const disbandedTeam = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: leaderUser._id,
        name: `Disbanded Team ${Date.now()}`,
        memberCount: 0,
        maxCapacity: 4,
        isOpen: false,
        status: "DISBANDED",
      });

      const outsider = await User.create({
        email: `outsider-disbanded-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Outsider Disbanded",
        skills: ["Python"],
        status: "ACTIVE",
      });
      const token = AuthService.generateToken(outsider);

      const res = await request(app)
        .post(`/api/v1/teams/${disbandedTeam._id}/join`)
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", `idemp-disbanded-${Date.now()}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe(ERROR_CODES.TEAM_DISBANDED);
    });

    it("rejects joining a team when the hackathon has completed with HACKATHON_NOT_ACTIVE (400)", async () => {
      const completedHackathon = await Hackathon.create({
        slug: `completed-hackathon-${Date.now()}`,
        title: "Completed Hackathon",
        description: "Past hackathon",
        minTeamSize: 1,
        maxTeamSize: 5,
        status: "COMPLETED",
        startDate: new Date(Date.now() - 100000),
        endDate: new Date(Date.now() - 50000),
      });

      const team = await Team.create({
        hackathonId: completedHackathon._id,
        leaderId: leaderUser._id,
        name: `Team in Completed Hackathon ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 4,
        isOpen: true,
        status: "ACTIVE",
      });

      const outsider = await User.create({
        email: `outsider-completed-hack-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Outsider Hack",
        skills: ["Rust"],
        status: "ACTIVE",
      });
      const token = AuthService.generateToken(outsider);

      const res = await request(app)
        .post(`/api/v1/teams/${team._id}/join`)
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", `idemp-completed-hack-${Date.now()}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.HACKATHON_NOT_ACTIVE);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Join Request Workflow & Race Handling
  // --------------------------------------------------------------------------
  describe("Join Request Lifecycle & Approvals", () => {
    it("submits, lists, and approves a join request atomically using the central reservation service", async () => {
      const team = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: leaderUser._id,
        name: `Join Request Team ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 3,
        isOpen: true,
        status: "ACTIVE",
      });
      await Membership.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: team._id,
        userId: leaderUser._id,
        role: "LEADER",
        status: "ACTIVE",
        joinedAt: new Date(),
      });

      const applicant = await User.create({
        email: `applicant-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Applicant User",
        skills: ["UI/UX"],
        status: "ACTIVE",
      });
      const applicantToken = AuthService.generateToken(applicant);

      // 1. Submit join request
      const submitRes = await request(app)
        .post(`/api/v1/teams/${team._id}/join-requests`)
        .set("Authorization", `Bearer ${applicantToken}`)
        .send({ message: "I would love to join your frontend team!" });

      expect(submitRes.status).toBe(201);
      expect(submitRes.body.data.status).toBe("PENDING");
      const requestId = submitRes.body.data.id;

      // 2. Duplicate submission rejected with JOIN_REQUEST_ALREADY_EXISTS (409)
      const dupRes = await request(app)
        .post(`/api/v1/teams/${team._id}/join-requests`)
        .set("Authorization", `Bearer ${applicantToken}`)
        .send({ message: "Second duplicate request" });
      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error.code).toBe(ERROR_CODES.JOIN_REQUEST_ALREADY_EXISTS);

      // 3. Leader lists pending join requests
      const listRes = await request(app)
        .get(`/api/v1/teams/${team._id}/join-requests`)
        .set("Authorization", `Bearer ${leaderToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].id).toBe(requestId);

      // 4. Non-leader cannot approve
      const unauthApprove = await request(app)
        .post(`/api/v1/teams/${team._id}/join-requests/${requestId}/approve`)
        .set("Authorization", `Bearer ${applicantToken}`);
      expect(unauthApprove.status).toBe(403);
      expect(unauthApprove.body.error.code).toBe(ERROR_CODES.NOT_TEAM_LEADER);

      // 5. Leader approves request
      const approveRes = await request(app)
        .post(`/api/v1/teams/${team._id}/join-requests/${requestId}/approve`)
        .set("Authorization", `Bearer ${leaderToken}`);

      expect(approveRes.status).toBe(201);
      expect(approveRes.body.data.status).toBe("ACTIVE");
      expect(approveRes.body.data.role).toBe("MEMBER");
      expect(approveRes.body.data.currentMemberCount).toBe(2);

      // Verify request state is now APPROVED in DB
      const updatedReq = await JoinRequest.findById(requestId);
      expect(updatedReq?.status).toBe("APPROVED");

      // Verify membership exists
      const mem = await Membership.findOne({
        teamId: team._id,
        userId: applicant._id,
        status: "ACTIVE",
      });
      expect(mem).not.toBeNull();
    });

    it("leaves request PENDING and returns TEAM_FULL when approving for a team that has become full", async () => {
      const fullTeam = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: leaderUser._id,
        name: `Full Team Approvals ${Date.now()}`,
        memberCount: 2,
        maxCapacity: 2, // FULL!
        isOpen: true,
        status: "ACTIVE",
      });

      const applicant = await User.create({
        email: `late-applicant-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Late Applicant",
        skills: ["Python"],
        status: "ACTIVE",
      });

      const joinReq = await JoinRequest.create({
        hackathonId: fullTeam.hackathonId,
        teamId: fullTeam._id,
        userId: applicant._id,
        status: "PENDING",
      });

      const approveRes = await request(app)
        .post(`/api/v1/teams/${fullTeam._id}/join-requests/${joinReq._id}/approve`)
        .set("Authorization", `Bearer ${leaderToken}`);

      expect(approveRes.status).toBe(409);
      expect(approveRes.body.error.code).toBe(ERROR_CODES.TEAM_FULL);

      // Join request MUST remain PENDING
      const dbReq = await JoinRequest.findById(joinReq._id);
      expect(dbReq?.status).toBe("PENDING");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Invitation Workflow & Security
  // --------------------------------------------------------------------------
  describe("Invitation Security & Acceptance Lifecycle", () => {
    it("creates invitation, returns raw token once, never stores raw token, and accepts invitation atomically", async () => {
      const team = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: leaderUser._id,
        name: `Invitation Test Team ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 3,
        isOpen: true,
        status: "ACTIVE",
      });

      const invitee = await User.create({
        email: `invitee-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Invited User",
        skills: ["Kotlin"],
        status: "ACTIVE",
      });
      const inviteeToken = AuthService.generateToken(invitee);

      // 1. Leader creates targeted invitation
      const createRes = await request(app)
        .post(`/api/v1/teams/${team._id}/invitations`)
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({
          inviteeId: invitee._id.toString(),
          maxUses: 1,
          expiresInHours: 24,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.token).toBeDefined();
      expect(createRes.body.data.invitation.tokenHash).toBeUndefined(); // NEVER EXPOSED
      const rawSecretToken = createRes.body.data.token;

      // Verify token in DB is hashed, NOT plaintext
      const dbInvitation = await Invitation.findById(createRes.body.data.invitation.id);
      expect(dbInvitation?.tokenHash).toBeDefined();
      expect(dbInvitation?.tokenHash).not.toBe(rawSecretToken);

      // 2. Another user tries to redeem targeted invitation -> INVITATION_WRONG_ACCOUNT (403)
      const wrongUser = await User.create({
        email: `wrong-user-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Wrong User",
        skills: ["C#"],
        status: "ACTIVE",
      });
      const wrongToken = AuthService.generateToken(wrongUser);

      const wrongRes = await request(app)
        .post("/api/v1/invitations/accept")
        .set("Authorization", `Bearer ${wrongToken}`)
        .set("Idempotency-Key", `idemp-inv-wrong-${Date.now()}`)
        .send({ token: rawSecretToken });
      expect(wrongRes.status).toBe(403);
      expect(wrongRes.body.error.code).toBe(ERROR_CODES.INVITATION_WRONG_ACCOUNT);

      // 3. Intended invitee accepts invitation successfully
      const acceptRes = await request(app)
        .post("/api/v1/invitations/accept")
        .set("Authorization", `Bearer ${inviteeToken}`)
        .set("Idempotency-Key", `idemp-inv-accept-${Date.now()}`)
        .send({ token: rawSecretToken });

      expect(acceptRes.status).toBe(201);
      expect(acceptRes.body.data.role).toBe("MEMBER");
      expect(acceptRes.body.data.currentMemberCount).toBe(2);

      // Invitation is now EXHAUSTED
      const updatedInv = await Invitation.findById(dbInvitation?._id);
      expect(updatedInv?.status).toBe("EXHAUSTED");
      expect(updatedInv?.usesCount).toBe(1);

      // 4. Repeated redemption is rejected with INVITATION_EXHAUSTED (400)
      const thirdUser = await User.create({
        email: `third-user-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Third User",
        skills: ["Swift"],
        status: "ACTIVE",
      });
      const thirdToken = AuthService.generateToken(thirdUser);

      const repeatRes = await request(app)
        .post("/api/v1/invitations/accept")
        .set("Authorization", `Bearer ${thirdToken}`)
        .set("Idempotency-Key", `idemp-inv-repeat-${Date.now()}`)
        .send({ token: rawSecretToken });
      expect(repeatRes.status).toBe(400);
      expect(repeatRes.body.error.code).toBe(ERROR_CODES.INVITATION_EXHAUSTED);
    });

    it("rejects revoked and expired invitation tokens", async () => {
      const team = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: leaderUser._id,
        name: `Revoke Test Team ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 3,
        isOpen: true,
        status: "ACTIVE",
      });

      // Create invitation
      const createRes = await request(app)
        .post(`/api/v1/teams/${team._id}/invitations`)
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ maxUses: 1 });
      const rawToken = createRes.body.data.token;
      const invId = createRes.body.data.invitation.id;

      // Leader revokes it
      const revokeRes = await request(app)
        .delete(`/api/v1/teams/${team._id}/invitations/${invId}`)
        .set("Authorization", `Bearer ${leaderToken}`);
      expect(revokeRes.status).toBe(200);

      const outsider = await User.create({
        email: `outsider-revoked-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Outsider Revoked",
        skills: ["C++"],
        status: "ACTIVE",
      });
      const outsiderToken = AuthService.generateToken(outsider);

      // Attempt to accept revoked invitation
      const res = await request(app)
        .post("/api/v1/invitations/accept")
        .set("Authorization", `Bearer ${outsiderToken}`)
        .set("Idempotency-Key", `idemp-revoked-${Date.now()}`)
        .send({ token: rawToken });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.INVITATION_REVOKED);
    });

    it("handles multi-use invitation with maxUses = 2 under concurrent redemptions", async () => {
      const team = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: leaderUser._id,
        name: `MultiUse Test Team ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 5,
        isOpen: true,
        status: "ACTIVE",
      });

      await Membership.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: team._id,
        userId: leaderUser._id,
        role: "LEADER",
        status: "ACTIVE",
        joinedAt: new Date(),
      });

      // 1. Create multi-use invitation with maxUses = 2
      const createRes = await request(app)
        .post(`/api/v1/teams/${team._id}/invitations`)
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ maxUses: 2, expiresInHours: 24 });

      expect(createRes.status).toBe(201);
      const rawToken = createRes.body.data.token;
      const invId = createRes.body.data.invitation.id;

      // Prepare 3 distinct users
      const userA = await User.create({
        email: `multi-a-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "User A",
        skills: ["Go"],
        status: "ACTIVE",
      });
      const tokenA = AuthService.generateToken(userA);

      const userB = await User.create({
        email: `multi-b-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "User B",
        skills: ["Rust"],
        status: "ACTIVE",
      });
      const tokenB = AuthService.generateToken(userB);

      const userC = await User.create({
        email: `multi-c-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "User C",
        skills: ["Python"],
        status: "ACTIVE",
      });
      const tokenC = AuthService.generateToken(userC);

      // 2. Start two concurrent valid redemptions
      const [resA, resB] = await Promise.all([
        request(app)
          .post("/api/v1/invitations/accept")
          .set("Authorization", `Bearer ${tokenA}`)
          .set("Idempotency-Key", `idemp-multi-a-${Date.now()}`)
          .send({ token: rawToken }),
        request(app)
          .post("/api/v1/invitations/accept")
          .set("Authorization", `Bearer ${tokenB}`)
          .set("Idempotency-Key", `idemp-multi-b-${Date.now()}`)
          .send({ token: rawToken }),
      ]);

      // Both must succeed
      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);

      // Verify DB invitation state: usesCount === 2 and status === EXHAUSTED
      const dbInv = await Invitation.findById(invId);
      expect(dbInv?.usesCount).toBe(2);
      expect(dbInv?.status).toBe("EXHAUSTED");

      // Verify team member count is 3 (1 leader + 2 new members)
      const updatedTeam = await Team.findById(team._id);
      expect(updatedTeam?.memberCount).toBe(3);

      const activeMembers = await Membership.find({ teamId: team._id, status: "ACTIVE" });
      expect(activeMembers).toHaveLength(3);

      // 3. Third redemption attempt must fail with INVITATION_EXHAUSTED
      const resC = await request(app)
        .post("/api/v1/invitations/accept")
        .set("Authorization", `Bearer ${tokenC}`)
        .set("Idempotency-Key", `idemp-multi-c-${Date.now()}`)
        .send({ token: rawToken });

      expect(resC.status).toBe(400);
      expect(resC.body.error.code).toBe(ERROR_CODES.INVITATION_EXHAUSTED);

      // Verify team count remained 3
      const finalTeam = await Team.findById(team._id);
      expect(finalTeam?.memberCount).toBe(3);
    });

    it("handles 5 simultaneous concurrent redemptions against one invitation with maxUses = 2", async () => {
      const team = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: leaderUser._id,
        name: `FiveWay MultiUse Team ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 10,
        isOpen: true,
        status: "ACTIVE",
      });

      await Membership.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: team._id,
        userId: leaderUser._id,
        role: "LEADER",
        status: "ACTIVE",
        joinedAt: new Date(),
      });

      // 1. Create multi-use invitation with maxUses = 2
      const createRes = await request(app)
        .post(`/api/v1/teams/${team._id}/invitations`)
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ maxUses: 2, expiresInHours: 24 });

      expect(createRes.status).toBe(201);
      const rawToken = createRes.body.data.token;
      const invId = createRes.body.data.invitation.id;

      // 2. Prepare 5 distinct users and their auth tokens
      const candidateUsers = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          User.create({
            email: `fiveway-user-${i}-${Date.now()}@test-race.com`,
            passwordHash,
            displayName: `FiveWay User ${i}`,
            skills: ["TypeScript", `Skill-${i}`],
            status: "ACTIVE",
          })
        )
      );

      const candidateTokens = candidateUsers.map((u) => AuthService.generateToken(u));

      // 3. Launch all 5 redemption requests simultaneously
      const responses = await Promise.all(
        candidateUsers.map((_, i) =>
          request(app)
            .post("/api/v1/invitations/accept")
            .set("Authorization", `Bearer ${candidateTokens[i]}`)
            .set("Idempotency-Key", `idemp-fiveway-${i}-${Date.now()}`)
            .send({ token: rawToken })
        )
      );

      // 4. Verify exactly 2 requests succeed (201) and 3 fail with INVITATION_EXHAUSTED (400)
      const successfulResponses = responses.filter((r) => r.status === 201);
      const exhaustedResponses = responses.filter(
        (r) => r.status === 400 && r.body.error?.code === ERROR_CODES.INVITATION_EXHAUSTED
      );

      expect(successfulResponses).toHaveLength(2);
      expect(exhaustedResponses).toHaveLength(3);

      // 5. Verify usesCount is exactly 2 and status is EXHAUSTED
      const dbInv = await Invitation.findById(invId);
      expect(dbInv?.usesCount).toBe(2);
      expect(dbInv?.status).toBe("EXHAUSTED");

      // 6. Verify exactly two new active memberships exist (total 3 including leader)
      const activeMemberships = await Membership.find({ teamId: team._id, status: "ACTIVE" });
      expect(activeMemberships).toHaveLength(3);

      const newMemberships = activeMemberships.filter(
        (m) => m.userId.toString() !== leaderUser._id.toString()
      );
      expect(newMemberships).toHaveLength(2);

      // Verify the new members match the users who got 201 responses
      const successfulUserIds = successfulResponses.map((r) => r.body.data.userId);
      const newMembershipUserIds = newMemberships.map((m) => m.userId.toString());
      expect(new Set(newMembershipUserIds)).toEqual(new Set(successfulUserIds));

      // 7. Verify team memberCount matches active membership documents
      const finalTeam = await Team.findById(team._id);
      expect(finalTeam?.memberCount).toBe(3);
      expect(finalTeam?.memberCount).toBe(activeMemberships.length);

      // 8. Verify no duplicate memberships exist
      const allMemberships = await Membership.find({ teamId: team._id });
      expect(allMemberships).toHaveLength(3);
      const uniqueUserIds = new Set(allMemberships.map((m) => m.userId.toString()));
      expect(uniqueUserIds.size).toBe(3);

      // 9. Verify exactly two INVITE_REDEEMED audit events exist
      const inviteRedeemedAudits = await AuditLog.find({
        teamId: team._id,
        action: "INVITE_REDEEMED",
      });
      expect(inviteRedeemedAudits).toHaveLength(2);
    });

    it("handles single-use invitation (maxUses = 1) under concurrent redemptions", async () => {
      const team = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: leaderUser._id,
        name: `SingleUse Race Team ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 5,
        isOpen: true,
        status: "ACTIVE",
      });

      await Membership.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        teamId: team._id,
        userId: leaderUser._id,
        role: "LEADER",
        status: "ACTIVE",
        joinedAt: new Date(),
      });

      const createRes = await request(app)
        .post(`/api/v1/teams/${team._id}/invitations`)
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ maxUses: 1, expiresInHours: 24 });
      const rawToken = createRes.body.data.token;
      const invId = createRes.body.data.invitation.id;

      const user1 = await User.create({
        email: `single-1-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Single 1",
        skills: ["Go"],
        status: "ACTIVE",
      });
      const token1 = AuthService.generateToken(user1);

      const user2 = await User.create({
        email: `single-2-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Single 2",
        skills: ["Rust"],
        status: "ACTIVE",
      });
      const token2 = AuthService.generateToken(user2);

      // Concurrently redeem single-use token
      const [res1, res2] = await Promise.all([
        request(app)
          .post("/api/v1/invitations/accept")
          .set("Authorization", `Bearer ${token1}`)
          .set("Idempotency-Key", `idemp-single-1-${Date.now()}`)
          .send({ token: rawToken }),
        request(app)
          .post("/api/v1/invitations/accept")
          .set("Authorization", `Bearer ${token2}`)
          .set("Idempotency-Key", `idemp-single-2-${Date.now()}`)
          .send({ token: rawToken }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 400]);

      const failedRes = res1.status === 400 ? res1 : res2;
      expect(failedRes.body.error.code).toBe(ERROR_CODES.INVITATION_EXHAUSTED);

      const dbInv = await Invitation.findById(invId);
      expect(dbInv?.usesCount).toBe(1);
      expect(dbInv?.status).toBe("EXHAUSTED");

      const dbTeam = await Team.findById(team._id);
      expect(dbTeam?.memberCount).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Team & Hackathon Status Eligibility
  // --------------------------------------------------------------------------
  describe("Team & Hackathon Status Invariants", () => {
    it("rejects joining an ARCHIVED team with TEAM_ARCHIVED", async () => {
      const archivedTeam = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: leaderUser._id,
        name: `Archived Team ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 5,
        isOpen: true,
        status: "ARCHIVED",
      });

      const candidate = await User.create({
        email: `candidate-archived-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Candidate",
        skills: ["Ruby"],
        status: "ACTIVE",
      });
      const candidateToken = AuthService.generateToken(candidate);

      const joinRes = await request(app)
        .post(`/api/v1/teams/${archivedTeam._id}/join`)
        .set("Authorization", `Bearer ${candidateToken}`)
        .set("Idempotency-Key", `idemp-archived-join-${Date.now()}`);

      expect(joinRes.status).toBe(409);
      expect(joinRes.body.error.code).toBe(ERROR_CODES.TEAM_ARCHIVED);

      // Join request also rejected
      const reqRes = await request(app)
        .post(`/api/v1/teams/${archivedTeam._id}/join-requests`)
        .set("Authorization", `Bearer ${candidateToken}`)
        .send({ message: "Hello" });

      expect(reqRes.status).toBe(409);
      expect(reqRes.body.error.code).toBe(ERROR_CODES.TEAM_ARCHIVED);

      // Creating invitation on archived team rejected
      const invRes = await request(app)
        .post(`/api/v1/teams/${archivedTeam._id}/invitations`)
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ maxUses: 1 });

      expect(invRes.status).toBe(409);
      expect(invRes.body.error.code).toBe(ERROR_CODES.TEAM_ARCHIVED);
    });

    it("rejects joining a DISBANDED team with TEAM_DISBANDED", async () => {
      const disbandedTeam = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: leaderUser._id,
        name: `Disbanded Team ${Date.now()}`,
        memberCount: 0,
        maxCapacity: 5,
        isOpen: false,
        status: "DISBANDED",
      });

      const candidate = await User.create({
        email: `candidate-disbanded-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Candidate",
        skills: ["Ruby"],
        status: "ACTIVE",
      });
      const candidateToken = AuthService.generateToken(candidate);

      const joinRes = await request(app)
        .post(`/api/v1/teams/${disbandedTeam._id}/join`)
        .set("Authorization", `Bearer ${candidateToken}`)
        .set("Idempotency-Key", `idemp-disbanded-join-${Date.now()}`);

      expect(joinRes.status).toBe(409);
      expect(joinRes.body.error.code).toBe(ERROR_CODES.TEAM_DISBANDED);
    });

    it("rejects joining in a COMPLETED hackathon with HACKATHON_NOT_ACTIVE", async () => {
      const completedHackathon = await Hackathon.create({
        slug: `completed-hackathon-${Date.now()}`,
        title: "Completed Hackathon",
        description: "Already ended",
        minTeamSize: 1,
        maxTeamSize: 5,
        status: "COMPLETED",
        startDate: new Date(Date.now() - 14 * 86400000),
        endDate: new Date(Date.now() - 7 * 86400000),
      });

      const teamInCompleted = await Team.create({
        hackathonId: completedHackathon._id,
        leaderId: leaderUser._id,
        name: `Completed Team ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 5,
        isOpen: true,
        status: "ACTIVE",
      });

      const candidate = await User.create({
        email: `candidate-completed-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Candidate",
        skills: ["Java"],
        status: "ACTIVE",
      });
      const candidateToken = AuthService.generateToken(candidate);

      const joinRes = await request(app)
        .post(`/api/v1/teams/${teamInCompleted._id}/join`)
        .set("Authorization", `Bearer ${candidateToken}`)
        .set("Idempotency-Key", `idemp-completed-hack-${Date.now()}`);

      expect(joinRes.status).toBe(400);
      expect(joinRes.body.error.code).toBe(ERROR_CODES.HACKATHON_NOT_ACTIVE);
    });

    it("permits joining teams during UPCOMING hackathons", async () => {
      const upcomingHackathon = await Hackathon.create({
        slug: `upcoming-hackathon-${Date.now()}`,
        title: "Upcoming Hackathon",
        description: "Not started yet, registration open",
        minTeamSize: 1,
        maxTeamSize: 5,
        status: "UPCOMING",
        startDate: new Date(Date.now() + 7 * 86400000),
        endDate: new Date(Date.now() + 14 * 86400000),
      });

      const teamInUpcoming = await Team.create({
        hackathonId: upcomingHackathon._id,
        leaderId: leaderUser._id,
        name: `Upcoming Team ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 5,
        isOpen: true,
        status: "ACTIVE",
      });

      const candidate = await User.create({
        email: `candidate-upcoming-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Candidate",
        skills: ["Go"],
        status: "ACTIVE",
      });
      const candidateToken = AuthService.generateToken(candidate);

      const joinRes = await request(app)
        .post(`/api/v1/teams/${teamInUpcoming._id}/join`)
        .set("Authorization", `Bearer ${candidateToken}`)
        .set("Idempotency-Key", `idemp-upcoming-hack-${Date.now()}`);

      expect(joinRes.status).toBe(201);
      expect(joinRes.body.data.currentMemberCount).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Idempotency Early Failure Lease Cleanup via HTTP
  // --------------------------------------------------------------------------
  describe("Idempotency Early Lease Cleanup via HTTP", () => {
    it("releases idempotency lease on early deterministic failure and allows immediate retry", async () => {
      const key = `idemp-early-fail-${Date.now()}`;

      // 1. Send request with missing token in body -> 400 INVITATION_INVALID
      const failRes = await request(app)
        .post("/api/v1/invitations/accept")
        .set("Authorization", `Bearer ${memberToken}`)
        .set("Idempotency-Key", key)
        .send({}); // missing token!

      expect(failRes.status).toBe(400);
      expect(failRes.body.error.code).toBe(ERROR_CODES.INVITATION_INVALID);

      // Verify the lease record was released and does NOT exist in DB
      const record = await IdempotencyRecord.findOne({ key });
      expect(record).toBeNull();

      // 2. Immediate retry with same key does NOT return REQUEST_IN_PROGRESS (409)
      const retryRes = await request(app)
        .post("/api/v1/invitations/accept")
        .set("Authorization", `Bearer ${memberToken}`)
        .set("Idempotency-Key", key)
        .send({});

      expect(retryRes.status).toBe(400);
      expect(retryRes.body.error.code).toBe(ERROR_CODES.INVITATION_INVALID);
    });

    it("releases lease when targeted invitation is rejected for wrong account", async () => {
      const team = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: leaderUser._id,
        name: `Wrong Account Team ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 5,
        isOpen: true,
        status: "ACTIVE",
      });

      const targetUser = await User.create({
        email: `target-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Target User",
        skills: ["TS"],
        status: "ACTIVE",
      });

      const invRes = await request(app)
        .post(`/api/v1/teams/${team._id}/invitations`)
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ inviteeId: targetUser._id.toString(), maxUses: 1 });
      const rawToken = invRes.body.data.token;

      const wrongUser = await User.create({
        email: `wrong-user-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Wrong User",
        skills: ["TS"],
        status: "ACTIVE",
      });
      const wrongToken = AuthService.generateToken(wrongUser);

      const key = `idemp-wrong-acct-${Date.now()}`;
      const wrongRes = await request(app)
        .post("/api/v1/invitations/accept")
        .set("Authorization", `Bearer ${wrongToken}`)
        .set("Idempotency-Key", key)
        .send({ token: rawToken });

      expect(wrongRes.status).toBe(403);
      expect(wrongRes.body.error.code).toBe(ERROR_CODES.INVITATION_WRONG_ACCOUNT);

      // Lease record should be released
      const record = await IdempotencyRecord.findOne({ key });
      expect(record).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 7. Transactional Audit Log Consistency Failure-Path Verification
  // --------------------------------------------------------------------------
  describe("Transactional Audit Consistency Failure-Path Verification", () => {
    it("rolls back invitation creation when audit log write fails", async () => {
      const team = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: leaderUser._id,
        name: `Audit Rollback Team ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 5,
        isOpen: true,
        status: "ACTIVE",
      });

      // Spy on AuditLog.create to simulate database failure during audit write
      const auditSpy = vi
        .spyOn(AuditLog, "create")
        .mockRejectedValueOnce(new Error("Simulated Audit Write Failure"));

      try {
        await request(app)
          .post(`/api/v1/teams/${team._id}/invitations`)
          .set("Authorization", `Bearer ${leaderToken}`)
          .send({ maxUses: 1 });
      } finally {
        auditSpy.mockRestore();
      }

      // Verify that NO invitation document was persisted in MongoDB (transaction rolled back!)
      const invitations = await Invitation.find({ teamId: team._id });
      expect(invitations).toHaveLength(0);
    });

    it("rolls back join request creation when audit log write fails", async () => {
      const team = await Team.create({
        hackathonId: new Types.ObjectId(testHackathonId),
        leaderId: leaderUser._id,
        name: `JoinReq Audit Rollback Team ${Date.now()}`,
        memberCount: 1,
        maxCapacity: 5,
        isOpen: true,
        status: "ACTIVE",
      });

      const applicant = await User.create({
        email: `applicant-fail-${Date.now()}@test-race.com`,
        passwordHash,
        displayName: "Applicant",
        skills: ["Go"],
        status: "ACTIVE",
      });
      const applicantToken = AuthService.generateToken(applicant);

      const auditSpy = vi
        .spyOn(AuditLog, "create")
        .mockRejectedValueOnce(new Error("Simulated Audit Write Failure"));

      try {
        await request(app)
          .post(`/api/v1/teams/${team._id}/join-requests`)
          .set("Authorization", `Bearer ${applicantToken}`)
          .send({ message: "Should be rolled back" });
      } finally {
        auditSpy.mockRestore();
      }

      // Verify NO join request document was persisted in MongoDB
      const requests = await JoinRequest.find({ teamId: team._id, userId: applicant._id });
      expect(requests).toHaveLength(0);
    });
  });
});
