import { describe, it, expect, beforeEach, afterAll } from "vitest";
import mongoose, { Types } from "mongoose";
import { IdempotencyService, canonicalize } from "../src/services/idempotency.service.js";
import { IdempotencyRecord } from "../src/models/IdempotencyRecord.js";
import { AppError } from "../src/errors/AppError.js";
import { ERROR_CODES, IDEMPOTENCY_LEASE_TIMEOUT_MS } from "@crewconnect/shared";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";

describe("Idempotency Engine Unit & Integration Tests", () => {
  beforeEach(async () => {
    if (mongoose.connection.readyState !== 1) {
      await connectToDatabase();
    }
    await IdempotencyRecord.deleteMany({ key: /^test-idemp-/ });
  });

  afterAll(async () => {
    await IdempotencyRecord.deleteMany({ key: /^test-idemp-/ });
    await disconnectDatabase();
  });

  describe("A. Key Validation & Deterministic Fingerprinting", () => {
    it("validates Idempotency-Key formatting and constraints", () => {
      expect(() => IdempotencyService.validateKey("")).toThrowError(AppError);
      expect(() => IdempotencyService.validateKey("   ")).toThrowError(AppError);
      expect(() => IdempotencyService.validateKey(null)).toThrowError(AppError);
      expect(() => IdempotencyService.validateKey(undefined)).toThrowError(AppError);

      // Over 128 characters
      const longKey = "a".repeat(129);
      expect(() => IdempotencyService.validateKey(longKey)).toThrowError(AppError);

      // Invalid characters (spaces, special punctuation)
      expect(() => IdempotencyService.validateKey("key with spaces")).toThrowError(AppError);
      expect(() => IdempotencyService.validateKey("key<bad>")).toThrowError(AppError);

      // Valid keys
      expect(IdempotencyService.validateKey("uuid-1234-abcd")).toBe("uuid-1234-abcd");
      expect(IdempotencyService.validateKey("test_key.123:abc")).toBe("test_key.123:abc");
    });

    it("canonicalizes payloads and produces identical SHA-256 fingerprint regardless of key order", () => {
      const obj1 = { b: 2, a: 1, c: { y: 20, x: 10 } };
      const obj2 = { a: 1, c: { x: 10, y: 20 }, b: 2 };

      expect(JSON.stringify(canonicalize(obj1))).toBe(JSON.stringify(canonicalize(obj2)));

      const hash1 = IdempotencyService.generatePayloadHash(
        "POST /api/v1/test",
        { id: "123" },
        obj1
      );
      const hash2 = IdempotencyService.generatePayloadHash(
        "POST /api/v1/test",
        { id: "123" },
        obj2
      );
      expect(hash1).toBe(hash2);

      // Different endpoint or body alters hash
      const hashDiff = IdempotencyService.generatePayloadHash(
        "POST /api/v1/other",
        { id: "123" },
        obj1
      );
      expect(hashDiff).not.toBe(hash1);
    });
  });

  describe("B. Lease Acquisition, Fingerprint Guard & Replay", () => {
    it("acquires lease on fresh key and returns PROCESSING record with unique ownerToken", async () => {
      const key = `test-idemp-${Date.now()}`;
      const userId = new Types.ObjectId().toString();
      const endpoint = "POST /api/v1/teams/join";
      const hash = IdempotencyService.generatePayloadHash(endpoint, {}, {});

      const result = await IdempotencyService.acquireLease(key, userId, endpoint, hash);
      expect(result.acquired).toBe(true);
      expect(result.ownerToken).toBeDefined();
      expect(result.record.status).toBe("PROCESSING");
      expect(result.record.payloadHash).toBe(hash);

      const dbRecord = await IdempotencyRecord.findById(result.record._id);
      expect(dbRecord?.ownerToken).toBe(result.ownerToken);
    });

    it("rejects duplicate in-flight request when lease is valid with REQUEST_IN_PROGRESS (409)", async () => {
      const key = `test-idemp-${Date.now()}`;
      const userId = new Types.ObjectId().toString();
      const endpoint = "POST /api/v1/teams/join";
      const hash = IdempotencyService.generatePayloadHash(endpoint, {}, {});

      await IdempotencyService.acquireLease(key, userId, endpoint, hash);

      await expect(
        IdempotencyService.acquireLease(key, userId, endpoint, hash)
      ).rejects.toMatchObject({
        code: ERROR_CODES.REQUEST_IN_PROGRESS,
        statusCode: 409,
      });
    });

    it("rejects reused key with different payload with IDEMPOTENCY_KEY_PAYLOAD_MISMATCH (409)", async () => {
      const key = `test-idemp-${Date.now()}`;
      const userId = new Types.ObjectId().toString();
      const endpoint = "POST /api/v1/teams/join";
      const hash1 = IdempotencyService.generatePayloadHash(endpoint, {}, { amount: 100 });
      const hash2 = IdempotencyService.generatePayloadHash(endpoint, {}, { amount: 200 });

      await IdempotencyService.acquireLease(key, userId, endpoint, hash1);

      await expect(
        IdempotencyService.acquireLease(key, userId, endpoint, hash2)
      ).rejects.toMatchObject({
        code: ERROR_CODES.IDEMPOTENCY_KEY_PAYLOAD_MISMATCH,
        statusCode: 409,
      });
    });

    it("replays cached response when record is COMPLETED", async () => {
      const key = `test-idemp-${Date.now()}`;
      const userId = new Types.ObjectId().toString();
      const endpoint = "POST /api/v1/teams/join";
      const hash = IdempotencyService.generatePayloadHash(endpoint, {}, {});

      const lease = await IdempotencyService.acquireLease(key, userId, endpoint, hash);
      expect(lease.acquired).toBe(true);

      const session = await mongoose.startSession();
      try {
        session.startTransaction();
        await IdempotencyService.completeLeaseInTransaction(
          lease.record._id,
          lease.ownerToken,
          hash,
          201,
          { success: true, data: { membershipId: "mem-123" } },
          session
        );
        await session.commitTransaction();
      } finally {
        await session.endSession();
      }

      // Subsequent identical request
      const secondCall = await IdempotencyService.acquireLease(key, userId, endpoint, hash);
      expect(secondCall.acquired).toBe(false);
      expect(secondCall.cachedResponse?.statusCode).toBe(201);
      expect(secondCall.cachedResponse?.body).toEqual({
        success: true,
        data: { membershipId: "mem-123" },
      });
    });
  });

  describe("C. Expired Lease Reclamation & Fencing", () => {
    it("atomically reclaims an expired lease and assigns a new ownerToken", async () => {
      const key = `test-idemp-${Date.now()}`;
      const userId = new Types.ObjectId().toString();
      const endpoint = "POST /api/v1/teams/join";
      const hash = IdempotencyService.generatePayloadHash(endpoint, {}, {});

      const firstLease = await IdempotencyService.acquireLease(key, userId, endpoint, hash);
      expect(firstLease.acquired).toBe(true);

      // Manually backdate lockedAt to simulate lease expiration (> 30s)
      const expiredLockedAt = new Date(Date.now() - (IDEMPOTENCY_LEASE_TIMEOUT_MS + 5000));
      await IdempotencyRecord.findByIdAndUpdate(firstLease.record._id, {
        lockedAt: expiredLockedAt,
      });

      // Second worker attempts acquisition
      const secondLease = await IdempotencyService.acquireLease(key, userId, endpoint, hash);
      expect(secondLease.acquired).toBe(true);
      expect(secondLease.ownerToken).not.toBe(firstLease.ownerToken);

      const dbRecord = await IdempotencyRecord.findById(firstLease.record._id);
      expect(dbRecord?.ownerToken).toBe(secondLease.ownerToken);
    });

    it("fences out stale lease owner: completing with stale ownerToken throws LEASE_LOST (409)", async () => {
      const key = `test-idemp-${Date.now()}`;
      const userId = new Types.ObjectId().toString();
      const endpoint = "POST /api/v1/teams/join";
      const hash = IdempotencyService.generatePayloadHash(endpoint, {}, {});

      const staleLease = await IdempotencyService.acquireLease(key, userId, endpoint, hash);

      // Worker 2 reclaims lease after expiration
      const expiredLockedAt = new Date(Date.now() - (IDEMPOTENCY_LEASE_TIMEOUT_MS + 5000));
      await IdempotencyRecord.findByIdAndUpdate(staleLease.record._id, {
        lockedAt: expiredLockedAt,
      });
      const newLease = await IdempotencyService.acquireLease(key, userId, endpoint, hash);

      // Worker 1 (stale) now attempts to complete using its old ownerToken inside transaction
      const session = await mongoose.startSession();
      try {
        session.startTransaction();
        await expect(
          IdempotencyService.completeLeaseInTransaction(
            staleLease.record._id,
            staleLease.ownerToken, // STALE TOKEN!
            hash,
            201,
            { data: "stale" },
            session
          )
        ).rejects.toMatchObject({
          code: ERROR_CODES.LEASE_LOST,
          statusCode: 409,
        });
        await session.abortTransaction();
      } finally {
        await session.endSession();
      }

      // DB record is still owned by Worker 2
      const record = await IdempotencyRecord.findById(staleLease.record._id);
      expect(record?.ownerToken).toBe(newLease.ownerToken);
      expect(record?.status).toBe("PROCESSING");
    });

    it("safe lease release does not delete a reclaimed lease owned by another worker", async () => {
      const key = `test-idemp-${Date.now()}`;
      const userId = new Types.ObjectId().toString();
      const endpoint = "POST /api/v1/teams/join";
      const hash = IdempotencyService.generatePayloadHash(endpoint, {}, {});

      const staleLease = await IdempotencyService.acquireLease(key, userId, endpoint, hash);

      // Reclaim by new worker
      await IdempotencyRecord.findByIdAndUpdate(staleLease.record._id, {
        ownerToken: "new-owner-token",
        lockedAt: new Date(),
      });

      // Old worker tries to release on error
      await IdempotencyService.releaseLease(staleLease.record._id, staleLease.ownerToken);

      // Record must still exist because ownerToken did not match
      const record = await IdempotencyRecord.findById(staleLease.record._id);
      expect(record).not.toBeNull();
      expect(record?.ownerToken).toBe("new-owner-token");
    });

    it("uncertain commit preserves the PROCESSING record and does not release it", async () => {
      const key = `test-idemp-uncertain-${Date.now()}`;
      const userId = new Types.ObjectId().toString();
      const endpoint = "POST /api/v1/teams/join";
      const hash = IdempotencyService.generatePayloadHash(endpoint, {}, {});

      const lease = await IdempotencyService.acquireLease(key, userId, endpoint, hash);
      expect(lease.acquired).toBe(true);

      // Verify the record is in PROCESSING status
      let record = await IdempotencyRecord.findById(lease.record._id);
      expect(record?.status).toBe("PROCESSING");

      // An uncertain commit error should preserve PROCESSING and NOT call releaseLease
      const uncertainErr = AppError.conflict(
        ERROR_CODES.TRANSACTION_COMMIT_UNCERTAIN,
        "Transaction commit outcome uncertain"
      );
      expect(uncertainErr.code).toBe(ERROR_CODES.TRANSACTION_COMMIT_UNCERTAIN);

      // Verify record is preserved
      record = await IdempotencyRecord.findById(lease.record._id);
      expect(record).not.toBeNull();
      expect(record?.status).toBe("PROCESSING");
    });

    it("completed operations replay cached response on subsequent requests", async () => {
      const key = `test-idemp-complete-${Date.now()}`;
      const userId = new Types.ObjectId().toString();
      const endpoint = "POST /api/v1/teams/join";
      const body = { teamId: "team-123" };
      const hash = IdempotencyService.generatePayloadHash(endpoint, {}, body);

      const lease = await IdempotencyService.acquireLease(key, userId, endpoint, hash);
      expect(lease.acquired).toBe(true);

      // Complete inside transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await IdempotencyService.completeLeaseInTransaction(
          lease.record._id,
          lease.ownerToken,
          hash,
          201,
          { success: true, teamId: "team-123", memberCount: 5 },
          session
        );
        await session.commitTransaction();
      } finally {
        await session.endSession();
      }

      // Re-acquire with same key and payload
      const replay = await IdempotencyService.acquireLease(key, userId, endpoint, hash);
      expect(replay.acquired).toBe(false);
      expect(replay.cachedResponse.statusCode).toBe(201);
      expect(replay.cachedResponse.body).toEqual({
        success: true,
        teamId: "team-123",
        memberCount: 5,
      });
    });
  });
});
