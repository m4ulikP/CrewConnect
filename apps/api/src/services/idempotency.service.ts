import crypto from "node:crypto";
import { Types, type ClientSession } from "mongoose";
import { IdempotencyRecord, type IIdempotencyRecord } from "../models/IdempotencyRecord.js";
import { AppError } from "../errors/AppError.js";
import {
  ERROR_CODES,
  IDEMPOTENCY_LEASE_TIMEOUT_MS,
  IDEMPOTENCY_TTL_SECONDS,
} from "@crewconnect/shared";

export interface CachedResponse {
  statusCode: number;
  body: unknown;
}

export type LeaseAcquisitionResult =
  | {
      acquired: true;
      record: IIdempotencyRecord;
      ownerToken: string;
      cachedResponse?: never;
    }
  | {
      acquired: false;
      cachedResponse: CachedResponse;
      record?: never;
      ownerToken?: never;
    };

/**
 * Deterministically stringifies an object by recursively sorting its keys.
 */
export function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = canonicalize(obj[key]);
  }
  return sorted;
}

export class IdempotencyService {
  /**
   * Validates the format and length of an Idempotency-Key.
   */
  static validateKey(key: unknown): string {
    if (!key || typeof key !== "string" || key.trim().length === 0) {
      throw AppError.badRequest(
        "Idempotency-Key header is required for this operation",
        ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED
      );
    }

    const trimmed = key.trim();
    if (trimmed.length > 128) {
      throw AppError.badRequest(
        "Idempotency-Key must not exceed 128 characters",
        ERROR_CODES.IDEMPOTENCY_KEY_INVALID
      );
    }

    if (!/^[A-Za-z0-9_\-.:]{1,128}$/.test(trimmed)) {
      throw AppError.badRequest(
        "Idempotency-Key contains invalid characters. Use alphanumeric, dash, underscore, colon, or dot.",
        ERROR_CODES.IDEMPOTENCY_KEY_INVALID
      );
    }

    return trimmed;
  }

  /**
   * Generates a deterministic SHA-256 fingerprint from the endpoint, route parameters, and request payload.
   */
  static generatePayloadHash(
    endpoint: string,
    params: Record<string, unknown> = {},
    body: unknown = {}
  ): string {
    const canonicalPayload = {
      endpoint: endpoint.trim(),
      params: canonicalize(params),
      body: canonicalize(body),
    };
    const jsonStr = JSON.stringify(canonicalPayload);
    return crypto.createHash("sha256").update(jsonStr).digest("hex");
  }

  /**
   * Atomically acquires an idempotency lease outside of the business transaction.
   *
   * 1. Generates a secure ownerToken.
   * 2. Attempts to insert a PROCESSING record.
   * 3. On collision:
   *    - Checks payloadHash. If mismatch -> throws IDEMPOTENCY_KEY_PAYLOAD_MISMATCH (409).
   *    - If COMPLETED -> returns cached response (replay).
   *    - If FAILED -> returns cached failure response (replay).
   *    - If PROCESSING and lease valid -> throws REQUEST_IN_PROGRESS (409).
   *    - If PROCESSING and lease expired -> atomically reclaims lease with new ownerToken.
   */
  static async acquireLease(
    key: string,
    userId: string,
    endpoint: string,
    payloadHash: string
  ): Promise<LeaseAcquisitionResult> {
    const ownerToken = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000);

    try {
      const record = await IdempotencyRecord.create({
        key,
        userId: new Types.ObjectId(userId),
        endpoint,
        payloadHash,
        ownerToken,
        status: "PROCESSING",
        lockedAt: now,
        expiresAt,
      });

      return {
        acquired: true,
        record,
        ownerToken,
      };
    } catch (error: unknown) {
      const mongoErr = error as { code?: number };
      if (mongoErr.code !== 11000) {
        throw error;
      }
    }

    // Key exists for this (key, userId, endpoint) tuple
    const existing = await IdempotencyRecord.findOne({
      key,
      userId: new Types.ObjectId(userId),
      endpoint,
    });

    if (!existing) {
      // Race condition: deleted between attempt and find. Retry acquisition recursively.
      return this.acquireLease(key, userId, endpoint, payloadHash);
    }

    // Step A: Fingerprint verification MUST occur before any status or reclamation logic
    if (existing.payloadHash !== payloadHash) {
      throw AppError.conflict(
        ERROR_CODES.IDEMPOTENCY_KEY_PAYLOAD_MISMATCH,
        "Idempotency key reused with different request payload"
      );
    }

    // Step B: Replay completed response
    if (existing.status === "COMPLETED") {
      return {
        acquired: false,
        cachedResponse: {
          statusCode: existing.statusCode || 200,
          body: existing.responseBody,
        },
      };
    }

    // Step C: Replay failed response
    if (existing.status === "FAILED") {
      return {
        acquired: false,
        cachedResponse: {
          statusCode: existing.statusCode || 400,
          body: existing.responseBody,
        },
      };
    }

    // Step D: Lease active vs expired evaluation
    const lockedAtMs = existing.lockedAt ? existing.lockedAt.getTime() : 0;
    const isExpired = Date.now() - lockedAtMs >= IDEMPOTENCY_LEASE_TIMEOUT_MS;

    if (!isExpired) {
      throw AppError.conflict(
        ERROR_CODES.REQUEST_IN_PROGRESS,
        "A request with this idempotency key is currently being processed. Please retry shortly."
      );
    }

    // Step E: Atomically reclaim expired lease with fencing guard (lockedAt match)
    const reclaimed = await IdempotencyRecord.findOneAndUpdate(
      {
        _id: existing._id,
        status: "PROCESSING",
        lockedAt: existing.lockedAt,
      },
      {
        $set: {
          ownerToken,
          lockedAt: new Date(),
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000),
        },
      },
      { new: true }
    );

    if (!reclaimed) {
      // Another worker reclaimed it first during the race
      throw AppError.conflict(
        ERROR_CODES.REQUEST_IN_PROGRESS,
        "A request with this idempotency key is currently being processed. Please retry shortly."
      );
    }

    return {
      acquired: true,
      record: reclaimed,
      ownerToken,
    };
  }

  /**
   * Completes the idempotency record atomically within the business transaction.
   * Matches _id, ownerToken, payloadHash, and PROCESSING status to guarantee lease fencing.
   */
  static async completeLeaseInTransaction(
    recordId: Types.ObjectId | string,
    ownerToken: string,
    payloadHash: string,
    statusCode: number,
    responseBody: unknown,
    session: ClientSession
  ): Promise<IIdempotencyRecord> {
    const completed = await IdempotencyRecord.findOneAndUpdate(
      {
        _id: new Types.ObjectId(recordId),
        ownerToken,
        payloadHash,
        status: "PROCESSING",
      },
      {
        $set: {
          status: "COMPLETED",
          statusCode,
          responseBody,
          completedAt: new Date(),
        },
        $unset: { lockedAt: 1 },
      },
      { session, new: true }
    );

    if (!completed) {
      throw AppError.conflict(
        ERROR_CODES.LEASE_LOST,
        "Idempotency lease was lost or reclaimed by another process. Transaction aborted."
      );
    }

    return completed;
  }

  /**
   * Safely releases an acquired lease on non-uncertain failure using an owner-token guard.
   * Will never delete another worker's reclaimed lease.
   */
  static async releaseLease(recordId: Types.ObjectId | string, ownerToken: string): Promise<void> {
    try {
      if (!Types.ObjectId.isValid(recordId)) return;
      await IdempotencyRecord.deleteOne({
        _id: new Types.ObjectId(recordId),
        ownerToken,
        status: "PROCESSING",
      });
    } catch {
      // Ignore cleanup errors
    }
  }
}
