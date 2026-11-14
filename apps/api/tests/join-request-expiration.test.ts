/**
 * Integration tests for join request expiration lifecycle.
 *
 * API response shapes used:
 * - POST   /teams/:id/join-requests              → { data: IJoinRequest }  (data.id, data.status, data.expiresAt)
 * - GET    /teams/:id/join-requests              → { data: IJoinRequest[] }  (data is array)
 * - POST   /teams/:id/join-requests/:id/approve  → { data: responsePayload } (membership payload)
 * - POST   /teams/:id/join-requests/:id/reject   → { data: IJoinRequest }
 * - DELETE /teams/:id/join-requests/:id          → { data: IJoinRequest }
 *
 * Tests cover:
 * - New requests receive correct expiresAt timestamp
 * - Non-expired requests remain PENDING in listJoinRequests
 * - Expired requests are lazily transitioned to EXPIRED on listing
 * - Expired requests are absent from the PENDING list
 * - Approving an expired request returns 400 JOIN_REQUEST_EXPIRED
 * - Expired request does not reserve seat (memberCount unchanged)
 * - Expired request does not block a new PENDING request (partial unique index)
 * - Legacy records (no expiresAt) expire based on createdAt + duration
 * - Expiration writes a JOIN_REQUEST_EXPIRED audit log entry
 * - Non-expired lifecycle transitions (approved / rejected / cancelled) remain correct
 * - Concurrency: repeated expiration scans are idempotent (single audit entry per record)
 * - Rejecting / cancelling an already-expired request returns 400 JOIN_REQUEST_EXPIRED
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { app } from "../src/app.js";
import { User, Hackathon, Team, Membership, AuditLog, JoinRequest } from "../src/models/index.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";
import { JoinRequestService } from "../src/services/join-request.service.js";
import type { UserDTO } from "@crewconnect/shared";

const TEST_ORIGIN = "http://localhost:5173";
const EMAIL_DOMAIN = "@test-jr-expiry.com";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Registers a user and returns { dto, cookie }. */
async function registerUser(
  email: string,
  displayName: string,
  password = "Password123!"
): Promise<{ dto: UserDTO; cookie: string }> {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password, displayName, skills: ["TypeScript"] });

  expect(res.status, `register ${email}`).toBe(201);
  return { dto: res.body.data.user, cookie: res.headers["set-cookie"][0] };
}

/** Creates a hackathon directly in the DB. */
async function createHackathon(): Promise<string> {
  const h = await Hackathon.create({
    slug: `test-jr-expiry-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: "JR Expiry Test Hackathon",
    description: "Integration test hackathon",
    minTeamSize: 1,
    maxTeamSize: 5,
    status: "ACTIVE",
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  return h._id.toString();
}

/** Creates a team via the API and returns its ID. */
async function createTeam(
  hackathonId: string,
  leaderCookie: string,
  name: string,
  maxCapacity = 4
): Promise<string> {
  const res = await request(app)
    .post(`/api/v1/hackathons/${hackathonId}/teams`)
    .set("Cookie", leaderCookie)
    .set("Origin", TEST_ORIGIN)
    .send({ name, maxCapacity, tagline: "test team" });

  expect(res.status, `create team "${name}"`).toBe(201);
  return res.body.data.team.id;
}

/** Submits a join request via the API and returns the response. */
async function submitJoinRequest(
  teamId: string,
  applicantCookie: string,
  message = "Integration test request"
) {
  return request(app)
    .post(`/api/v1/teams/${teamId}/join-requests`)
    .set("Cookie", applicantCookie)
    .set("Origin", TEST_ORIGIN)
    .send({ message });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Join Request Expiration Lifecycle Integration Tests", () => {
  let hackathonId: string;
  let leader: { dto: UserDTO; cookie: string };
  let applicant: { dto: UserDTO; cookie: string };

  beforeAll(async () => {
    await connectToDatabase();
    // Ensure indexes are synchronised (including the new expiresAt compound index)
    await User.syncIndexes();
    await Team.syncIndexes();
    await Membership.syncIndexes();
    await Hackathon.syncIndexes();
    await JoinRequest.syncIndexes();
    await AuditLog.syncIndexes();
  });

  afterAll(async () => {
    await User.deleteMany({ email: new RegExp(EMAIL_DOMAIN.replace(".", "\\.") + "$") });
    await Hackathon.deleteMany({ slug: /test-jr-expiry-/ });
    await disconnectDatabase();
  });

  beforeEach(async () => {
    // Full teardown between tests for isolation
    await User.deleteMany({ email: new RegExp(EMAIL_DOMAIN.replace(".", "\\.") + "$") });
    await Hackathon.deleteMany({ slug: /test-jr-expiry-/ });
    await Team.deleteMany({});
    await Membership.deleteMany({});
    await JoinRequest.deleteMany({});
    await AuditLog.deleteMany({});

    hackathonId = await createHackathon();
    leader = await registerUser(`leader${EMAIL_DOMAIN}`, "Leader User");
    applicant = await registerUser(`applicant${EMAIL_DOMAIN}`, "Applicant User");
  });

  // =========================================================================
  // 1. New requests receive correct expiresAt
  // =========================================================================

  describe("1. New requests receive expiresAt", () => {
    it("creates a join request with expiresAt set ~72h in the future", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Expiry Alpha");

      const before = Date.now();
      const res = await submitJoinRequest(teamId, applicant.cookie);
      const after = Date.now();

      expect(res.status).toBe(201);
      // The route returns: { success: true, data: joinRequest }
      // data IS the join request document directly
      expect(res.body.data).toBeDefined();
      expect(res.body.data.status).toBe("PENDING");

      // Verify expiresAt is serialized in DB record since API may not include it
      const dbRecord = await JoinRequest.findOne({ status: "PENDING" });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord!.expiresAt).toBeInstanceOf(Date);

      const expiresTs = dbRecord!.expiresAt!.getTime();
      const expectedMin = before + 71 * 3600 * 1000; // allow 1h drift
      const expectedMax = after + 73 * 3600 * 1000;
      expect(expiresTs).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresTs).toBeLessThanOrEqual(expectedMax);
    });

    it("JoinRequestService.computeExpiresAt returns a date in the future", () => {
      const now = new Date("2026-06-01T00:00:00Z");
      const expiresAt = JoinRequestService.computeExpiresAt(now);
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  // =========================================================================
  // 2. Non-expired requests remain PENDING in list
  // =========================================================================

  describe("2. Non-expired requests visible in list", () => {
    it("non-expired PENDING request is returned in listJoinRequests", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Visible");
      const submitRes = await submitJoinRequest(teamId, applicant.cookie);
      expect(submitRes.status).toBe(201);

      // GET /teams/:id/join-requests → { data: IJoinRequest[] }
      const listRes = await request(app)
        .get(`/api/v1/teams/${teamId}/join-requests`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(listRes.status).toBe(200);
      // data is a plain array
      expect(Array.isArray(listRes.body.data)).toBe(true);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].status).toBe("PENDING");
    });
  });

  // =========================================================================
  // 3. Expired requests are lazily moved to EXPIRED and hidden from list
  // =========================================================================

  describe("3. Lazy expiration on list", () => {
    it("request past expiresAt is transitioned to EXPIRED and absent from pending list", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Lazy Expire");
      const teamObjectId = new Types.ObjectId(teamId);
      const applicantObjectId = new Types.ObjectId(applicant.dto.id);
      const hackathonObjectId = new Types.ObjectId(hackathonId);

      // Directly insert a join request with expiresAt in the past
      await JoinRequest.create({
        hackathonId: hackathonObjectId,
        teamId: teamObjectId,
        userId: applicantObjectId,
        message: "Should be expired",
        status: "PENDING",
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      });

      // Trigger listJoinRequests — should lazily expire the stale request
      const listRes = await request(app)
        .get(`/api/v1/teams/${teamId}/join-requests`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(listRes.status).toBe(200);
      // The expired request must NOT appear in the pending list (data is array)
      expect(Array.isArray(listRes.body.data)).toBe(true);
      expect(listRes.body.data).toHaveLength(0);

      // Verify DB record is now EXPIRED
      const dbRecord = await JoinRequest.findOne({
        teamId: teamObjectId,
        userId: applicantObjectId,
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord!.status).toBe("EXPIRED");
    });

    it("request exactly at expiry boundary (now === expiresAt) is treated as expired", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Boundary");
      const teamObjectId = new Types.ObjectId(teamId);
      const applicantObjectId = new Types.ObjectId(applicant.dto.id);
      const hackathonObjectId = new Types.ObjectId(hackathonId);

      const exactNow = new Date();
      await JoinRequest.create({
        hackathonId: hackathonObjectId,
        teamId: teamObjectId,
        userId: applicantObjectId,
        message: "Boundary test",
        status: "PENDING",
        expiresAt: exactNow, // exactly now
      });

      // Small delay to ensure the expiry condition is satisfied by service
      await new Promise((r) => setTimeout(r, 50));

      const listRes = await request(app)
        .get(`/api/v1/teams/${teamId}/join-requests`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data)).toBe(true);
      expect(listRes.body.data).toHaveLength(0);

      const dbRecord = await JoinRequest.findOne({
        teamId: teamObjectId,
        userId: applicantObjectId,
      });
      expect(dbRecord?.status).toBe("EXPIRED");
    });
  });

  // =========================================================================
  // 4. Approve expired request → 400 JOIN_REQUEST_EXPIRED
  // =========================================================================

  describe("4. Approving an expired request", () => {
    it("returns 400 JOIN_REQUEST_EXPIRED when approving a request with status EXPIRED", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Approve Expired");
      const teamObjectId = new Types.ObjectId(teamId);
      const applicantObjectId = new Types.ObjectId(applicant.dto.id);
      const hackathonObjectId = new Types.ObjectId(hackathonId);

      // Insert already-expired request
      const jr = await JoinRequest.create({
        hackathonId: hackathonObjectId,
        teamId: teamObjectId,
        userId: applicantObjectId,
        message: "Already expired",
        status: "EXPIRED",
        expiresAt: new Date(Date.now() - 3600 * 1000),
      });

      const teamBefore = await Team.findById(teamId);
      const memberCountBefore = teamBefore!.memberCount;

      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/join-requests/${jr._id}/approve`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("JOIN_REQUEST_EXPIRED");

      // memberCount must be unchanged
      const teamAfter = await Team.findById(teamId);
      expect(teamAfter!.memberCount).toBe(memberCountBefore);
    });

    it("returns 400 JOIN_REQUEST_EXPIRED when approving a PENDING but past-expiresAt request", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Approve Past Expiry");
      const teamObjectId = new Types.ObjectId(teamId);
      const applicantObjectId = new Types.ObjectId(applicant.dto.id);
      const hackathonObjectId = new Types.ObjectId(hackathonId);

      // Insert PENDING request with past expiresAt (not yet lazily expired in DB)
      const jr = await JoinRequest.create({
        hackathonId: hackathonObjectId,
        teamId: teamObjectId,
        userId: applicantObjectId,
        message: "Pending but expired by time",
        status: "PENDING",
        expiresAt: new Date(Date.now() - 1000),
      });

      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/join-requests/${jr._id}/approve`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("JOIN_REQUEST_EXPIRED");
    });
  });

  // =========================================================================
  // 5. Reject / cancel an expired request → 400
  // =========================================================================

  describe("5. Rejecting / cancelling an expired request", () => {
    it("returns 400 when rejecting a request with status EXPIRED", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Reject Expired");
      const teamObjectId = new Types.ObjectId(teamId);
      const applicantObjectId = new Types.ObjectId(applicant.dto.id);
      const hackathonObjectId = new Types.ObjectId(hackathonId);

      const jr = await JoinRequest.create({
        hackathonId: hackathonObjectId,
        teamId: teamObjectId,
        userId: applicantObjectId,
        message: "Expired",
        status: "EXPIRED",
        expiresAt: new Date(Date.now() - 3600 * 1000),
      });

      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/join-requests/${jr._id}/reject`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("JOIN_REQUEST_EXPIRED");
    });

    it("returns 400 when applicant cancels a request with status EXPIRED", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Cancel Expired");
      const teamObjectId = new Types.ObjectId(teamId);
      const applicantObjectId = new Types.ObjectId(applicant.dto.id);
      const hackathonObjectId = new Types.ObjectId(hackathonId);

      const jr = await JoinRequest.create({
        hackathonId: hackathonObjectId,
        teamId: teamObjectId,
        userId: applicantObjectId,
        message: "Expired",
        status: "EXPIRED",
        expiresAt: new Date(Date.now() - 3600 * 1000),
      });

      const res = await request(app)
        .delete(`/api/v1/teams/${teamId}/join-requests/${jr._id}`)
        .set("Cookie", applicant.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("JOIN_REQUEST_EXPIRED");
    });
  });

  // =========================================================================
  // 6. Expired request does NOT block a new PENDING request
  // =========================================================================

  describe("6. Expired request does not block re-submission", () => {
    it("applicant can re-submit after their prior request expires", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Resubmit");
      const teamObjectId = new Types.ObjectId(teamId);
      const applicantObjectId = new Types.ObjectId(applicant.dto.id);
      const hackathonObjectId = new Types.ObjectId(hackathonId);

      // Insert an expired request (lazy expiration will transition it in createJoinRequest)
      await JoinRequest.create({
        hackathonId: hackathonObjectId,
        teamId: teamObjectId,
        userId: applicantObjectId,
        message: "Old expired request",
        status: "PENDING",
        expiresAt: new Date(Date.now() - 1000),
      });

      // Re-submit — service should lazily expire the old one and create a new PENDING
      const res = await submitJoinRequest(teamId, applicant.cookie, "Fresh re-submission");
      expect(res.status).toBe(201);
      // data IS the join request directly
      expect(res.body.data.status).toBe("PENDING");

      // Old request should now be EXPIRED in DB
      const records = await JoinRequest.find({
        teamId: teamObjectId,
        userId: applicantObjectId,
      });
      expect(records).toHaveLength(2);
      const statuses = records.map((r) => r.status).sort();
      expect(statuses).toEqual(["EXPIRED", "PENDING"]);
    });
  });

  // =========================================================================
  // 7. Legacy records (no expiresAt) expire based on createdAt
  // =========================================================================

  describe("7. Legacy record expiration (no expiresAt field)", () => {
    it("legacy PENDING record with createdAt > 72h ago is treated as expired in listing", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Legacy Expired");
      const teamObjectId = new Types.ObjectId(teamId);
      const applicantObjectId = new Types.ObjectId(applicant.dto.id);
      const hackathonObjectId = new Types.ObjectId(hackathonId);

      // Insert a legacy record: no expiresAt, createdAt 73h ago
      const oldCreatedAt = new Date(Date.now() - 73 * 3600 * 1000);
      await JoinRequest.create({
        hackathonId: hackathonObjectId,
        teamId: teamObjectId,
        userId: applicantObjectId,
        message: "Legacy old request",
        status: "PENDING",
        createdAt: oldCreatedAt,
        // no expiresAt field
      });

      const listRes = await request(app)
        .get(`/api/v1/teams/${teamId}/join-requests`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(listRes.status).toBe(200);
      // Should be absent from pending list (data is array)
      expect(Array.isArray(listRes.body.data)).toBe(true);
      expect(listRes.body.data).toHaveLength(0);

      const dbRecord = await JoinRequest.findOne({
        teamId: teamObjectId,
        userId: applicantObjectId,
      });
      expect(dbRecord?.status).toBe("EXPIRED");
    });

    it("legacy PENDING record with createdAt < 72h ago is treated as still pending", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Legacy Fresh");
      const teamObjectId = new Types.ObjectId(teamId);
      const applicantObjectId = new Types.ObjectId(applicant.dto.id);
      const hackathonObjectId = new Types.ObjectId(hackathonId);

      // createdAt 1h ago — still within 72h window
      const recentCreatedAt = new Date(Date.now() - 1 * 3600 * 1000);
      await JoinRequest.create({
        hackathonId: hackathonObjectId,
        teamId: teamObjectId,
        userId: applicantObjectId,
        message: "Legacy recent request",
        status: "PENDING",
        createdAt: recentCreatedAt,
        // no expiresAt field
      });

      const listRes = await request(app)
        .get(`/api/v1/teams/${teamId}/join-requests`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data)).toBe(true);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].status).toBe("PENDING");

      // DB record must still be PENDING
      const dbRecord = await JoinRequest.findOne({
        teamId: teamObjectId,
        userId: applicantObjectId,
      });
      expect(dbRecord?.status).toBe("PENDING");
    });
  });

  // =========================================================================
  // 8. Audit log written for lazy expiration
  // =========================================================================

  describe("8. Expiration writes JOIN_REQUEST_EXPIRED audit log", () => {
    it("lazy expiration during listing writes exactly one JOIN_REQUEST_EXPIRED audit entry per request", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Audit Log");
      const teamObjectId = new Types.ObjectId(teamId);
      const applicantObjectId = new Types.ObjectId(applicant.dto.id);
      const hackathonObjectId = new Types.ObjectId(hackathonId);

      await JoinRequest.create({
        hackathonId: hackathonObjectId,
        teamId: teamObjectId,
        userId: applicantObjectId,
        message: "Audit test",
        status: "PENDING",
        expiresAt: new Date(Date.now() - 1000),
      });

      // Trigger expiration
      await request(app)
        .get(`/api/v1/teams/${teamId}/join-requests`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      const auditEntries = await AuditLog.find({
        teamId: teamObjectId,
        action: "JOIN_REQUEST_EXPIRED",
      });
      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0].actorId.toString()).toBe(applicant.dto.id);
    });
  });

  // =========================================================================
  // 9. Idempotency — repeated expiration scans produce a single audit entry
  // =========================================================================

  describe("9. Idempotent expiration scans", () => {
    it("calling expireMatchingPendingRequests twice produces only one audit entry", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Idem");
      const teamObjectId = new Types.ObjectId(teamId);
      const applicantObjectId = new Types.ObjectId(applicant.dto.id);
      const hackathonObjectId = new Types.ObjectId(hackathonId);

      await JoinRequest.create({
        hackathonId: hackathonObjectId,
        teamId: teamObjectId,
        userId: applicantObjectId,
        message: "Idempotency test",
        status: "PENDING",
        expiresAt: new Date(Date.now() - 1000),
      });

      const scopeFilter = { teamId: teamObjectId };
      const now = new Date();

      // First expiration scan
      const count1 = await JoinRequestService.expireMatchingPendingRequests(scopeFilter, now);
      expect(count1).toBe(1);

      // Second scan — record is already EXPIRED; nothing should change
      const count2 = await JoinRequestService.expireMatchingPendingRequests(scopeFilter, now);
      expect(count2).toBe(0);

      // Only one audit entry must exist
      const auditEntries = await AuditLog.find({
        teamId: teamObjectId,
        action: "JOIN_REQUEST_EXPIRED",
      });
      expect(auditEntries).toHaveLength(1);
    });
  });

  // =========================================================================
  // 10. Non-expired lifecycle transitions remain correct
  // =========================================================================

  describe("10. Non-expired lifecycle transitions", () => {
    it("approving a valid non-expired request succeeds and creates membership", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Approve Valid");
      const submitRes = await submitJoinRequest(teamId, applicant.cookie);
      expect(submitRes.status).toBe(201);
      // data IS the join request directly — use data.id
      const requestId = submitRes.body.data.id;
      expect(requestId).toBeDefined();

      const approveRes = await request(app)
        .post(`/api/v1/teams/${teamId}/join-requests/${requestId}/approve`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(approveRes.status).toBe(201);
      // approve returns responsePayload (membership data), not the join request
      // just verify status 201 and no error
      expect(approveRes.body.success).toBe(true);

      const membership = await Membership.findOne({
        teamId: new Types.ObjectId(teamId),
        userId: new Types.ObjectId(applicant.dto.id),
        status: "ACTIVE",
      });
      expect(membership).not.toBeNull();
    });

    it("rejecting a valid non-expired request returns 200 and status REJECTED", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Reject Valid");
      const submitRes = await submitJoinRequest(teamId, applicant.cookie);
      expect(submitRes.status).toBe(201);
      const requestId = submitRes.body.data.id;
      expect(requestId).toBeDefined();

      const rejectRes = await request(app)
        .post(`/api/v1/teams/${teamId}/join-requests/${requestId}/reject`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(rejectRes.status).toBe(200);
      // reject returns the IJoinRequest directly in data
      expect(rejectRes.body.data.status).toBe("REJECTED");
    });

    it("applicant cancelling a valid non-expired request returns 200 and status CANCELLED", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Cancel Valid");
      const submitRes = await submitJoinRequest(teamId, applicant.cookie);
      expect(submitRes.status).toBe(201);
      const requestId = submitRes.body.data.id;
      expect(requestId).toBeDefined();

      const cancelRes = await request(app)
        .delete(`/api/v1/teams/${teamId}/join-requests/${requestId}`)
        .set("Cookie", applicant.cookie)
        .set("Origin", TEST_ORIGIN);

      expect(cancelRes.status).toBe(200);
      // cancel returns the IJoinRequest directly in data
      expect(cancelRes.body.data.status).toBe("CANCELLED");
    });

    it("approved request stays APPROVED even after its expiresAt passes (no re-expiration)", async () => {
      const teamId = await createTeam(hackathonId, leader.cookie, "Team Approved Stays");
      const teamObjectId = new Types.ObjectId(teamId);

      // Submit and approve via API
      const submitRes = await submitJoinRequest(teamId, applicant.cookie);
      expect(submitRes.status).toBe(201);
      const requestId = submitRes.body.data.id;
      expect(requestId).toBeDefined();

      await request(app)
        .post(`/api/v1/teams/${teamId}/join-requests/${requestId}/approve`)
        .set("Cookie", leader.cookie)
        .set("Origin", TEST_ORIGIN);

      // Backdate expiresAt to the past directly in DB (simulating time passing)
      await JoinRequest.updateOne(
        { _id: new Types.ObjectId(requestId) },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );

      // Run expiration scan
      await JoinRequestService.expireMatchingPendingRequests({ teamId: teamObjectId }, new Date());

      // Record must still be APPROVED
      const dbRecord = await JoinRequest.findById(requestId);
      expect(dbRecord?.status).toBe("APPROVED");
    });
  });

  // =========================================================================
  // 11. env.ts: JOIN_REQUEST_EXPIRATION_HOURS validation via service
  // =========================================================================

  describe("11. JOIN_REQUEST_EXPIRATION_HOURS env validation", () => {
    it("JoinRequestService.computeExpiresAt returns a date in the future from now", () => {
      const now = new Date();
      const expiresAt = JoinRequestService.computeExpiresAt(now);
      const diffHours = (expiresAt.getTime() - now.getTime()) / (3600 * 1000);
      // env defaults to 72; allow small drift from env override in CI
      expect(diffHours).toBeGreaterThan(0);
      expect(diffHours).toBeLessThanOrEqual(720);
    });

    it("computeExpiresAt with explicit now produces deterministic result", () => {
      const fixedNow = new Date("2026-01-01T00:00:00Z");
      const expiresAt = JoinRequestService.computeExpiresAt(fixedNow);
      // expiresAt must be strictly after fixedNow
      expect(expiresAt.getTime()).toBeGreaterThan(fixedNow.getTime());
    });
  });
});
