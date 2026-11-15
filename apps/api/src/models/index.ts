import type { Model } from "mongoose";
import { User, type IUser } from "./User.js";
import { Hackathon, type IHackathon } from "./Hackathon.js";
import { Team, type ITeam } from "./Team.js";
import { Membership, type IMembership } from "./Membership.js";
import { JoinRequest, type IJoinRequest } from "./JoinRequest.js";
import { Invitation, type IInvitation } from "./Invitation.js";
import { AuditLog, type IAuditLog } from "./AuditLog.js";
import { IdempotencyRecord, type IIdempotencyRecord } from "./IdempotencyRecord.js";

export {
  User,
  Hackathon,
  Team,
  Membership,
  JoinRequest,
  Invitation,
  AuditLog,
  IdempotencyRecord,
  type IUser,
  type IHackathon,
  type ITeam,
  type IMembership,
  type IJoinRequest,
  type IInvitation,
  type IAuditLog,
  type IIdempotencyRecord,
};

export interface CriticalIndexSpec {
  modelName: string;
  description: string;
  key: Record<string, number | string>;
  unique?: boolean;
  sparse?: boolean;
  partialFilterExpression?: Record<string, unknown>;
  expireAfterSeconds?: number;
}

export interface PerformanceIndexSpec {
  modelName: string;
  description: string;
  impactedQuery: string;
  key: Record<string, number | string>;
}

export interface IndexVerificationResult {
  ok: boolean;
  criticalChecked: number;
  performanceChecked: number;
  warnings: string[];
}

/**
 * The nine critical schema integrity invariants that MUST exist and match
 * their exact key order and constraints. Failure of any of these invariants
 * causes production startup to abort immediately.
 */
export const CRITICAL_INDEX_SPECS: ReadonlyArray<CriticalIndexSpec> = [
  {
    modelName: "User",
    description: "User email uniqueness",
    key: { email: 1 },
    unique: true,
  },
  {
    modelName: "User",
    description: "Google OAuth sparse uniqueness",
    key: { googleId: 1 },
    unique: true,
    sparse: true,
  },
  {
    modelName: "Hackathon",
    description: "Hackathon slug uniqueness",
    key: { slug: 1 },
    unique: true,
  },
  {
    modelName: "Team",
    description: "Team name uniqueness per hackathon",
    key: { hackathonId: 1, name: 1 },
    unique: true,
  },
  {
    modelName: "Membership",
    description: "Active membership uniqueness per user per hackathon",
    key: { hackathonId: 1, userId: 1 },
    unique: true,
    partialFilterExpression: { status: "ACTIVE" },
  },
  {
    modelName: "JoinRequest",
    description: "Pending join request uniqueness per team per user",
    key: { teamId: 1, userId: 1 },
    unique: true,
    partialFilterExpression: { status: "PENDING" },
  },
  {
    modelName: "Invitation",
    description: "Invitation tokenHash uniqueness",
    key: { tokenHash: 1 },
    unique: true,
  },
  {
    modelName: "IdempotencyRecord",
    description: "Idempotency record scoped uniqueness",
    key: { key: 1, userId: 1, endpoint: 1 },
    unique: true,
  },
  {
    modelName: "IdempotencyRecord",
    description: "Idempotency record TTL automatic expiration",
    key: { expiresAt: 1 },
    expireAfterSeconds: 0,
  },
];

/**
 * Performance-only indexes. Missing performance indexes produce warnings
 * identifying the impacted query, but do NOT abort startup.
 */
export const PERFORMANCE_INDEX_SPECS: ReadonlyArray<PerformanceIndexSpec> = [
  // User
  {
    modelName: "User",
    description: "Multikey skills index",
    impactedQuery: "Recommendation candidate search / skill diversity scoring",
    key: { skills: 1 },
  },
  {
    modelName: "User",
    description: "Account status filter index",
    impactedQuery: "Active user directory lookups",
    key: { status: 1 },
  },
  // Hackathon
  {
    modelName: "Hackathon",
    description: "Hackathon status index",
    impactedQuery: "Hackathon listing by status",
    key: { status: 1 },
  },
  {
    modelName: "Hackathon",
    description: "Hackathon status and start date compound index",
    impactedQuery: "Upcoming/active hackathon chronologically sorted queries",
    key: { status: 1, startDate: 1 },
  },
  // Team
  {
    modelName: "Team",
    description: "Hackathon foreign key index",
    impactedQuery: "Hackathon team listing",
    key: { hackathonId: 1 },
  },
  {
    modelName: "Team",
    description: "Leader foreign key index",
    impactedQuery: "User led-squad lookup",
    key: { leaderId: 1 },
  },
  {
    modelName: "Team",
    description: "Discovery board filter with member count",
    impactedQuery: "Team discovery board with member count filter",
    key: { hackathonId: 1, status: 1, isOpen: 1, memberCount: 1 },
  },
  {
    modelName: "Team",
    description: "Discovery board prefix sort (open teams)",
    impactedQuery: "Team discovery board sorted by createdAt descending (open teams)",
    key: { hackathonId: 1, status: 1, isOpen: 1, createdAt: -1 },
  },
  {
    modelName: "Team",
    description: "Discovery board prefix sort (all teams)",
    impactedQuery: "Team discovery board sorted by createdAt descending (all teams)",
    key: { hackathonId: 1, status: 1, createdAt: -1 },
  },
  {
    modelName: "Team",
    description: "Discovery cursor pagination (open teams)",
    impactedQuery: "Optimized keyset/cursor pagination for open teams (Phase 1/2)",
    key: { hackathonId: 1, status: 1, isOpen: 1, createdAt: -1, _id: -1 },
  },
  {
    modelName: "Team",
    description: "Discovery cursor pagination (all teams)",
    impactedQuery: "Optimized keyset/cursor pagination for all teams (Phase 1/2)",
    key: { hackathonId: 1, status: 1, createdAt: -1, _id: -1 },
  },
  {
    modelName: "Team",
    description: "Skills needed multikey index",
    impactedQuery: "Team recommendation engine candidate matching",
    key: { hackathonId: 1, skillsNeeded: 1 },
  },
  // Membership
  {
    modelName: "Membership",
    description: "Team foreign key index",
    impactedQuery: "Team membership listing",
    key: { teamId: 1 },
  },
  {
    modelName: "Membership",
    description: "User foreign key index",
    impactedQuery: "User membership listing",
    key: { userId: 1 },
  },
  {
    modelName: "Membership",
    description: "Team and status compound index",
    impactedQuery: "Team active members count / roster retrieval",
    key: { teamId: 1, status: 1 },
  },
  {
    modelName: "Membership",
    description: "User and status compound index",
    impactedQuery: "Recommendation candidate exclusion / user active squad lookup",
    key: { userId: 1, status: 1 },
  },
  // JoinRequest
  {
    modelName: "JoinRequest",
    description: "Team and status compound index",
    impactedQuery: "Team pending join requests lookup",
    key: { teamId: 1, status: 1 },
  },
  {
    modelName: "JoinRequest",
    description: "Hackathon, user, status compound index",
    impactedQuery: "User active requests limit per hackathon",
    key: { hackathonId: 1, userId: 1, status: 1 },
  },
  {
    modelName: "JoinRequest",
    description: "Status and expiration TTL cleanup index",
    impactedQuery: "Background join-request expiration sweeping",
    key: { status: 1, expiresAt: 1 },
  },
  // Invitation
  {
    modelName: "Invitation",
    description: "Team and status compound index",
    impactedQuery: "Team pending invitations listing",
    key: { teamId: 1, status: 1 },
  },
  {
    modelName: "Invitation",
    description: "Invitee and status compound index",
    impactedQuery: "User pending invitations inbox",
    key: { inviteeId: 1, status: 1 },
  },
  // AuditLog
  {
    modelName: "AuditLog",
    description: "Team timeline index",
    impactedQuery: "Team audit log timeline retrieval",
    key: { teamId: 1, timestamp: -1 },
  },
  {
    modelName: "AuditLog",
    description: "Actor timeline index",
    impactedQuery: "User audit log timeline retrieval",
    key: { actorId: 1, timestamp: -1 },
  },
  {
    modelName: "AuditLog",
    description: "Hackathon timeline index",
    impactedQuery: "Hackathon audit log timeline retrieval",
    key: { hackathonId: 1, timestamp: -1 },
  },
];

export class IndexIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndexIntegrityError";
  }
}

/**
 * Deep equality check for partialFilterExpression and nested option objects.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!keysB.includes(k) || !deepEqual(objA[k], objB[k])) return false;
  }
  return true;
}

/**
 * Compares exact key order and direction between an actual MongoDB index and expected spec.
 */
export function compareIndexKeys(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>
): boolean {
  const actualEntries = Object.entries(actual);
  const expectedEntries = Object.entries(expected);
  if (actualEntries.length !== expectedEntries.length) return false;
  for (let i = 0; i < expectedEntries.length; i++) {
    if (
      actualEntries[i][0] !== expectedEntries[i][0] ||
      actualEntries[i][1] !== expectedEntries[i][1]
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Validates relevant options (unique, sparse, partialFilterExpression, expireAfterSeconds)
 * against a critical index spec.
 */
export function validateIndexOptions(
  actual: Record<string, unknown>,
  expected: CriticalIndexSpec
): { valid: boolean; reason?: string } {
  if (expected.unique) {
    if (!actual.unique) {
      return { valid: false, reason: "expected unique: true, but index is not unique" };
    }
  } else if (actual.unique) {
    return { valid: false, reason: "expected unique: false/undefined, but index is unique" };
  }

  if (expected.sparse) {
    if (!actual.sparse) {
      return { valid: false, reason: "expected sparse: true, but index is not sparse" };
    }
  } else if (actual.sparse) {
    return { valid: false, reason: "expected sparse: false/undefined, but index is sparse" };
  }

  if (expected.partialFilterExpression) {
    if (
      !actual.partialFilterExpression ||
      !deepEqual(actual.partialFilterExpression, expected.partialFilterExpression)
    ) {
      return {
        valid: false,
        reason: `expected partialFilterExpression ${JSON.stringify(
          expected.partialFilterExpression
        )}, but found ${JSON.stringify(actual.partialFilterExpression)}`,
      };
    }
  } else if (actual.partialFilterExpression) {
    return {
      valid: false,
      reason: `expected no partialFilterExpression, but found ${JSON.stringify(
        actual.partialFilterExpression
      )}`,
    };
  }

  if (expected.expireAfterSeconds !== undefined) {
    if (actual.expireAfterSeconds !== expected.expireAfterSeconds) {
      return {
        valid: false,
        reason: `expected expireAfterSeconds: ${expected.expireAfterSeconds}, but found ${actual.expireAfterSeconds}`,
      };
    }
  } else if (actual.expireAfterSeconds !== undefined) {
    return {
      valid: false,
      reason: `expected no expireAfterSeconds, but found ${actual.expireAfterSeconds}`,
    };
  }

  return { valid: true };
}

export const ALL_MODELS: Array<{ name: string; model: Model<unknown> }> = [
  { name: "User", model: User as unknown as Model<unknown> },
  { name: "Hackathon", model: Hackathon as unknown as Model<unknown> },
  { name: "Team", model: Team as unknown as Model<unknown> },
  { name: "Membership", model: Membership as unknown as Model<unknown> },
  { name: "JoinRequest", model: JoinRequest as unknown as Model<unknown> },
  { name: "Invitation", model: Invitation as unknown as Model<unknown> },
  { name: "AuditLog", model: AuditLog as unknown as Model<unknown> },
  { name: "IdempotencyRecord", model: IdempotencyRecord as unknown as Model<unknown> },
];

/**
 * Production startup read-only verification.
 * Inspects actual collection indexes without modifying, dropping, or creating anything.
 * Aborts with IndexIntegrityError if any critical integrity invariant is missing or misconfigured.
 * Collects warnings for any missing performance indexes.
 */
export async function verifyDatabaseIndexes(): Promise<IndexVerificationResult> {
  // Cache existing collection indexes per model to avoid duplicate round-trips
  const indexCache = new Map<string, Array<Record<string, unknown>>>();

  for (const { name, model } of ALL_MODELS) {
    try {
      const indexes = (await model.collection.indexes()) as Array<Record<string, unknown>>;
      indexCache.set(name, indexes);
    } catch (err: unknown) {
      const mongoErr = err as { codeName?: string; code?: number; message?: string };
      // If collection does not exist yet (NamespaceNotFound), treat as empty
      if (mongoErr.codeName === "NamespaceNotFound" || mongoErr.code === 26) {
        indexCache.set(name, []);
      } else {
        throw new IndexIntegrityError(
          `Failed to read indexes for model '${name}': ${mongoErr.message || String(err)}`
        );
      }
    }
  }

  // 1. Verify all 9 critical integrity invariants
  for (const spec of CRITICAL_INDEX_SPECS) {
    const indexes = indexCache.get(spec.modelName) || [];
    const matchingIdx = indexes.find((idx) =>
      compareIndexKeys(idx.key as Record<string, unknown>, spec.key)
    );

    if (!matchingIdx) {
      throw new IndexIntegrityError(
        `Critical index missing: [${spec.modelName}] ${spec.description} requires key pattern ${JSON.stringify(
          spec.key
        )}, but no matching index was found.`
      );
    }

    const validation = validateIndexOptions(matchingIdx, spec);
    if (!validation.valid) {
      throw new IndexIntegrityError(
        `Critical index misconfigured: [${spec.modelName}] ${spec.description} with key ${JSON.stringify(
          spec.key
        )} failed validation: ${validation.reason}.`
      );
    }
  }

  // 2. Check performance-only indexes (report warnings, do not throw)
  const warnings: string[] = [];
  for (const spec of PERFORMANCE_INDEX_SPECS) {
    const indexes = indexCache.get(spec.modelName) || [];
    const matchingIdx = indexes.find((idx) =>
      compareIndexKeys(idx.key as Record<string, unknown>, spec.key)
    );

    if (!matchingIdx) {
      warnings.push(
        `Missing performance index on [${spec.modelName}] for key ${JSON.stringify(
          spec.key
        )}. Impacted query: "${spec.impactedQuery}". Run 'npm run db:migrate:team-indexes' or migrations to add.`
      );
    }
  }

  return {
    ok: true,
    criticalChecked: CRITICAL_INDEX_SPECS.length,
    performanceChecked: PERFORMANCE_INDEX_SPECS.length,
    warnings,
  };
}

/**
 * Development and test additive index creation.
 * Uses Model.createIndexes() to ensure schema indexes exist without dropping
 * unmanaged indexes or altering existing index structures.
 */
export async function ensureAllIndexes(): Promise<Record<string, string[]>> {
  const results: Record<string, string[]> = {};

  for (const { name, model } of ALL_MODELS) {
    await model.createIndexes();
    const indexes = await model.collection.indexes();
    results[name] = indexes.map((idx) => Object.keys(idx.key).join("+"));
  }

  return results;
}

/**
 * @deprecated Use ensureAllIndexes(). syncAllIndexes() is preserved for backward-compatibility
 * and delegates to the non-destructive, additive ensureAllIndexes().
 */
export async function syncAllIndexes(): Promise<Record<string, string[]>> {
  return ensureAllIndexes();
}
