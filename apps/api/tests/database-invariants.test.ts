import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Types } from "mongoose";
import { Membership } from "../src/models/Membership.js";
import { Team } from "../src/models/Team.js";
import { Invitation } from "../src/models/Invitation.js";
import { IdempotencyRecord } from "../src/models/IdempotencyRecord.js";
import { syncAllIndexes } from "../src/models/index.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";

describe("Database Indexes & Invariant Enforcement Tests", () => {
  beforeAll(async () => {
    await connectToDatabase();
    await syncAllIndexes();
  });

  afterAll(async () => {
    await Membership.deleteMany({});
    await Team.deleteMany({});
    await Invitation.deleteMany({});
    await IdempotencyRecord.deleteMany({});
    await disconnectDatabase();
  });

  describe("Membership Invariant: One Active Team Per User Per Hackathon", () => {
    it("enforces partial compound unique index for active memberships in the same hackathon", async () => {
      const hackathonId = new Types.ObjectId();
      const userId = new Types.ObjectId();
      const teamId1 = new Types.ObjectId();
      const teamId2 = new Types.ObjectId();

      // 1. First active membership in Hackathon 1
      const m1 = await Membership.create({
        hackathonId,
        teamId: teamId1,
        userId,
        role: "MEMBER",
        status: "ACTIVE",
      });
      expect(m1._id).toBeDefined();

      // 2. Attempting second active membership in Team 2 in the same hackathon must fail with duplicate key
      await expect(
        Membership.create({
          hackathonId,
          teamId: teamId2,
          userId,
          role: "MEMBER",
          status: "ACTIVE",
        })
      ).rejects.toThrow();

      // 3. User can be an active member in a DIFFERENT hackathon
      const differentHackathonId = new Types.ObjectId();
      const mDifferentHackathon = await Membership.create({
        hackathonId: differentHackathonId,
        teamId: teamId2,
        userId,
        role: "MEMBER",
        status: "ACTIVE",
      });
      expect(mDifferentHackathon._id).toBeDefined();

      // 4. If first membership transitions to 'LEFT', user can now join Team 2 as ACTIVE
      m1.status = "LEFT";
      m1.leftAt = new Date();
      await m1.save();

      const m2 = await Membership.create({
        hackathonId,
        teamId: teamId2,
        userId,
        role: "MEMBER",
        status: "ACTIVE",
      });
      expect(m2._id).toBeDefined();
    });
  });

  describe("Team Invariant: Unique Team Name Per Hackathon", () => {
    it("rejects duplicate team names in the same hackathon but allows same name in different hackathons", async () => {
      const hackathon1 = new Types.ObjectId();
      const hackathon2 = new Types.ObjectId();
      const leader1 = new Types.ObjectId();
      const leader2 = new Types.ObjectId();

      // Team 1 in Hackathon 1
      await Team.create({
        hackathonId: hackathon1,
        leaderId: leader1,
        name: "CyberNinjas",
        memberCount: 1,
        maxCapacity: 5,
        isOpen: true,
        status: "ACTIVE",
      });

      // Duplicate team name in Hackathon 1 must be rejected
      await expect(
        Team.create({
          hackathonId: hackathon1,
          leaderId: leader2,
          name: "CyberNinjas",
          memberCount: 1,
          maxCapacity: 5,
          isOpen: true,
          status: "ACTIVE",
        })
      ).rejects.toThrow();

      // Same team name in Hackathon 2 must succeed
      const teamInH2 = await Team.create({
        hackathonId: hackathon2,
        leaderId: leader2,
        name: "CyberNinjas",
        memberCount: 1,
        maxCapacity: 5,
        isOpen: true,
        status: "ACTIVE",
      });
      expect(teamInH2._id).toBeDefined();
    });
  });

  describe("Invitation Invariant: Unique Token Hash", () => {
    it("rejects duplicate invitation token hashes", async () => {
      const hackathonId = new Types.ObjectId();
      const teamId = new Types.ObjectId();
      const inviterId = new Types.ObjectId();
      const tokenHash = "mock_sha256_hash_1234567890abcdef";

      await Invitation.create({
        hackathonId,
        teamId,
        inviterId,
        tokenHash,
        status: "ACTIVE",
        usesCount: 0,
        maxUses: 1,
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(
        Invitation.create({
          hackathonId,
          teamId,
          inviterId,
          tokenHash,
          status: "ACTIVE",
          usesCount: 0,
          maxUses: 1,
          expiresAt: new Date(Date.now() + 86400000),
        })
      ).rejects.toThrow();
    });
  });

  describe("Idempotency Record Invariant: Scoped Unique Key", () => {
    it("enforces uniqueness scoped to { key, userId, endpoint }", async () => {
      const userId = new Types.ObjectId();
      const key = "550e8400-e29b-41d4-a716-446655440000";
      const endpoint = "POST /api/v1/teams/join";

      await IdempotencyRecord.create({
        key,
        userId,
        endpoint,
        payloadHash: "mock_hash_1",
        ownerToken: "token_1",
        status: "PROCESSING",
        expiresAt: new Date(Date.now() + 86400000),
      });

      // Duplicate for same user, key, and endpoint fails
      await expect(
        IdempotencyRecord.create({
          key,
          userId,
          endpoint,
          payloadHash: "mock_hash_2",
          ownerToken: "token_2",
          status: "PROCESSING",
          expiresAt: new Date(Date.now() + 86400000),
        })
      ).rejects.toThrow();

      // Same key but for DIFFERENT user succeeds (cross-tenant isolation)
      const differentUserId = new Types.ObjectId();
      const differentUserRecord = await IdempotencyRecord.create({
        key,
        userId: differentUserId,
        endpoint,
        payloadHash: "mock_hash_1",
        ownerToken: "token_3",
        status: "PROCESSING",
        expiresAt: new Date(Date.now() + 86400000),
      });
      expect(differentUserRecord._id).toBeDefined();
    });
  });
});
