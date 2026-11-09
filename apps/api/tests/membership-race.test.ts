import { describe, it, expect, beforeEach, afterAll } from "vitest";
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
  });
});
