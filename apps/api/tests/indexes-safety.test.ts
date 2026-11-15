import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";
import {
  ensureAllIndexes,
  verifyDatabaseIndexes,
  IndexIntegrityError,
  Team,
  User,
  Hackathon,
  Membership,
  IdempotencyRecord,
  compareIndexKeys,
  validateIndexOptions,
} from "../src/models/index.js";
import { initializeDatabaseAndIndexes } from "../src/server.js";
import {
  runTeamIndexMigration,
  TEAM_INDEX_MIGRATION_METADATA,
  MigrationConflictError,
  RollbackSafetyError,
  type MigrationDocument,
} from "../../scripts/migrate-team-indexes.ts";

describe("Production-Safe Index Management Tests (Phase 8.1 & 8.2)", () => {
  beforeAll(async () => {
    await connectToDatabase();
    await ensureAllIndexes();
  });

  afterAll(async () => {
    // Restore clean state for other test suites
    await ensureAllIndexes();
    await runTeamIndexMigration({ confirm: true, connection: mongoose.connection }).catch(() => {});
    await disconnectDatabase();
  });

  // ---------------------------------------------------------------------------
  // 1. Production verification does not create or drop indexes
  // ---------------------------------------------------------------------------
  it("production verification does not create or drop indexes", async () => {
    const indexesBefore = await Team.collection.indexes();
    const result = await verifyDatabaseIndexes();

    expect(result.ok).toBe(true);
    expect(result.criticalChecked).toBe(9);

    const indexesAfter = await Team.collection.indexes();
    expect(indexesAfter.length).toBe(indexesBefore.length);
    expect(indexesAfter.map((i) => i.name).sort()).toEqual(indexesBefore.map((i) => i.name).sort());
  });

  // ---------------------------------------------------------------------------
  // 2. An unmanaged index remains present during verification and additive creation
  // ---------------------------------------------------------------------------
  it("an unmanaged index remains present during verification and additive creation", async () => {
    const unmanagedIndexName = "custom_unmanaged_test_idx_1";
    await Team.collection.createIndex({ unmanagedAuditField: 1 }, { name: unmanagedIndexName });

    try {
      // 1. Verify read-only check does not drop it
      await verifyDatabaseIndexes();
      let indexes = await Team.collection.indexes();
      expect(indexes.some((i) => i.name === unmanagedIndexName)).toBe(true);

      // 2. Verify ensureAllIndexes() (additive createIndexes) does not drop it
      await ensureAllIndexes();
      indexes = await Team.collection.indexes();
      expect(indexes.some((i) => i.name === unmanagedIndexName)).toBe(true);
    } finally {
      await Team.collection.dropIndex(unmanagedIndexName).catch(() => {});
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Missing critical unique indexes cause verification to fail
  // ---------------------------------------------------------------------------
  it("missing critical unique indexes cause verification to fail", async () => {
    const emailIndexName = "email_1";
    await User.collection.dropIndex(emailIndexName);

    try {
      await expect(verifyDatabaseIndexes()).rejects.toThrowError(IndexIntegrityError);
      await expect(verifyDatabaseIndexes()).rejects.toThrowError(
        /Critical index missing: \[User\] User email uniqueness/
      );
    } finally {
      // Restore email unique index
      await User.collection.createIndex({ email: 1 }, { unique: true, name: emailIndexName });
    }

    const restored = await verifyDatabaseIndexes();
    expect(restored.ok).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 4. Exact option mismatch detection: Unique, Sparse, Partial-Filter, TTL, Key-Order
  // ---------------------------------------------------------------------------
  it("exact option mismatch detection: unique flag mismatch is rejected", async () => {
    const slugIndexName = "slug_1";
    await Hackathon.collection.dropIndex(slugIndexName);

    try {
      // Create slug index without unique: true
      await Hackathon.collection.createIndex({ slug: 1 }, { unique: false, name: slugIndexName });
      await expect(verifyDatabaseIndexes()).rejects.toThrowError(IndexIntegrityError);
      await expect(verifyDatabaseIndexes()).rejects.toThrowError(
        /expected unique: true, but index is not unique/
      );
    } finally {
      await Hackathon.collection.dropIndex(slugIndexName).catch(() => {});
      await Hackathon.collection.createIndex({ slug: 1 }, { unique: true, name: slugIndexName });
    }
  });

  it("exact option mismatch detection: sparse flag mismatch is rejected", async () => {
    const spec = {
      modelName: "User",
      description: "Google OAuth sparse uniqueness",
      key: { googleId: 1 },
      unique: true,
      sparse: true,
    };

    // Actual index missing sparse: true
    const unsparseIndex = {
      key: { googleId: 1 },
      unique: true,
      sparse: false,
    };

    const validation = validateIndexOptions(unsparseIndex, spec);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain("expected sparse: true, but index is not sparse");
  });

  it("exact option mismatch detection: partial-filter mismatch is rejected", async () => {
    const membershipIndexName = "hackathonId_1_userId_1";
    await Membership.collection.dropIndex(membershipIndexName);

    try {
      // Create with incorrect partialFilterExpression (PENDING instead of ACTIVE)
      await Membership.collection.createIndex(
        { hackathonId: 1, userId: 1 },
        {
          unique: true,
          partialFilterExpression: { status: "PENDING" },
          name: membershipIndexName,
        }
      );

      await expect(verifyDatabaseIndexes()).rejects.toThrowError(IndexIntegrityError);
      await expect(verifyDatabaseIndexes()).rejects.toThrowError(
        /Critical index misconfigured: \[Membership\].*partialFilterExpression/
      );
    } finally {
      await Membership.collection.dropIndex(membershipIndexName).catch(() => {});
      await Membership.collection.createIndex(
        { hackathonId: 1, userId: 1 },
        {
          unique: true,
          partialFilterExpression: { status: "ACTIVE" },
          name: membershipIndexName,
        }
      );
    }
  });

  it("exact option mismatch detection: TTL expireAfterSeconds mismatch is rejected", async () => {
    const ttlIndexName = "expiresAt_1";
    await IdempotencyRecord.collection.dropIndex(ttlIndexName);

    try {
      // Create with incorrect expireAfterSeconds (300 instead of 0)
      await IdempotencyRecord.collection.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 300, name: ttlIndexName }
      );

      await expect(verifyDatabaseIndexes()).rejects.toThrowError(IndexIntegrityError);
      await expect(verifyDatabaseIndexes()).rejects.toThrowError(
        /Critical index misconfigured: \[IdempotencyRecord\].*expireAfterSeconds/
      );
    } finally {
      await IdempotencyRecord.collection.dropIndex(ttlIndexName).catch(() => {});
      await IdempotencyRecord.collection.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: ttlIndexName }
      );
    }
  });

  it("exact option mismatch detection: key order mismatch is rejected", async () => {
    expect(compareIndexKeys({ userId: 1, hackathonId: 1 }, { hackathonId: 1, userId: 1 })).toBe(
      false
    );
  });

  // ---------------------------------------------------------------------------
  // 5. Missing performance-only indexes produce warnings rather than integrity failures
  // ---------------------------------------------------------------------------
  it("missing performance-only indexes produce warnings rather than integrity failures", async () => {
    const perfIndexName = "hackathonId_1_skillsNeeded_1";
    await Team.collection.dropIndex(perfIndexName);

    try {
      const result = await verifyDatabaseIndexes();
      expect(result.ok).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes("skillsNeeded"))).toBe(true);
      expect(
        result.warnings.some((w) => w.includes("Team recommendation engine candidate matching"))
      ).toBe(true);
    } finally {
      await Team.collection.createIndex(
        { hackathonId: 1, skillsNeeded: 1 },
        { name: perfIndexName }
      );
    }

    const restored = await verifyDatabaseIndexes();
    expect(restored.ok).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 6. Startup failing for missing critical indexes but not missing performance indexes
  // ---------------------------------------------------------------------------
  it("startup fails for missing critical indexes but succeeds with warning for performance indexes", async () => {
    const emailIndexName = "email_1";
    await User.collection.dropIndex(emailIndexName);

    try {
      // In production verifyOnly mode, missing critical index aborts startup
      await expect(
        initializeDatabaseAndIndexes({ verifyOnly: true, listen: false, maxRetries: 1 })
      ).rejects.toThrowError(/Critical index missing: \[User\] User email uniqueness/);
    } finally {
      await User.collection.createIndex({ email: 1 }, { unique: true, name: emailIndexName });
    }

    // Now test missing performance index
    const perfIndexName = "hackathonId_1_skillsNeeded_1";
    await Team.collection.dropIndex(perfIndexName);

    try {
      // Missing performance index must NOT abort startup
      await expect(
        initializeDatabaseAndIndexes({ verifyOnly: true, listen: false, maxRetries: 1 })
      ).resolves.toBeUndefined();
    } finally {
      await Team.collection.createIndex(
        { hackathonId: 1, skillsNeeded: 1 },
        { name: perfIndexName }
      );
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Development/test createIndexes() preserves unmanaged indexes
  // ---------------------------------------------------------------------------
  it("development/test createIndexes() preserves unmanaged indexes", async () => {
    const unmanagedName = "test_unmanaged_preservation_idx";
    await User.collection.createIndex({ tempExternalTag: 1 }, { name: unmanagedName });

    try {
      await ensureAllIndexes();
      const indexes = await User.collection.indexes();
      expect(indexes.some((i) => i.name === unmanagedName)).toBe(true);
    } finally {
      await User.collection.dropIndex(unmanagedName).catch(() => {});
    }
  });

  // ---------------------------------------------------------------------------
  // 8. Migration creates both Team indexes and records completion with ownership
  // ---------------------------------------------------------------------------
  it("migration creates both Team indexes and records completion with ownership", async () => {
    // Ensure clean state before applying migration
    await Team.collection
      .dropIndex("hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1")
      .catch(() => {});
    await Team.collection.dropIndex("hackathonId_1_status_1_createdAt_-1__id_-1").catch(() => {});
    await mongoose.connection.db?.collection("_migrations").deleteMany({});

    const result = await runTeamIndexMigration({
      confirm: true,
      connection: mongoose.connection,
    });

    expect(result.status).toBe("applied");
    expect(result.appliedIndexes).toContain("hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1");
    expect(result.appliedIndexes).toContain("hackathonId_1_status_1_createdAt_-1__id_-1");

    const teamIndexes = await Team.collection.indexes();
    expect(
      teamIndexes.some((i) => i.name === "hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1")
    ).toBe(true);
    expect(teamIndexes.some((i) => i.name === "hackathonId_1_status_1_createdAt_-1__id_-1")).toBe(
      true
    );

    const migrationDoc = (await mongoose.connection.db
      ?.collection("_migrations")
      .findOne({ id: TEAM_INDEX_MIGRATION_METADATA.id })) as MigrationDocument | null;
    expect(migrationDoc).not.toBeNull();
    expect(migrationDoc?.status).toBe("completed");
    expect(migrationDoc?.version).toBe(1);
    expect(migrationDoc?.managedIndexes.length).toBe(2);
    expect(migrationDoc?.managedIndexes.every((m) => m.ownership === "migration_created")).toBe(
      true
    );
  });

  // ---------------------------------------------------------------------------
  // 9. Repeated migration runs are idempotent
  // ---------------------------------------------------------------------------
  it("repeated migration runs are idempotent", async () => {
    const result = await runTeamIndexMigration({
      confirm: true,
      connection: mongoose.connection,
    });

    expect(result.status).toBe("already-applied");
    expect(result.appliedIndexes.length).toBe(0);
    expect(result.skippedIndexes.length).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // 10. Rollback refuses an index without proven migration ownership
  // ---------------------------------------------------------------------------
  it("rollback refuses an index without proven migration ownership", async () => {
    // 1. Wipe _migrations tracking record
    await mongoose.connection.db?.collection("_migrations").deleteMany({});

    // 2. Ensure an index physically exists with matching name and keys
    await Team.collection
      .createIndex(
        { hackathonId: 1, status: 1, createdAt: -1, _id: -1 },
        { name: "hackathonId_1_status_1_createdAt_-1__id_-1" }
      )
      .catch(() => {});

    // 3. Rollback must REFUSE because ownership cannot be proven from _migrations
    await expect(
      runTeamIndexMigration({
        confirm: true,
        rollback: true,
        connection: mongoose.connection,
      })
    ).rejects.toThrowError(RollbackSafetyError);

    await expect(
      runTeamIndexMigration({
        confirm: true,
        rollback: true,
        connection: mongoose.connection,
      })
    ).rejects.toThrowError(/Migration ownership of indexes cannot be proven/);

    // Verify index was NOT dropped
    const indexes = await Team.collection.indexes();
    expect(indexes.some((i) => i.name === "hackathonId_1_status_1_createdAt_-1__id_-1")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 11. Rollback preserves pre-existing indexes that were not created by migration
  // ---------------------------------------------------------------------------
  it("rollback preserves pre-existing indexes that were not created by migration", async () => {
    // 1. Set up a pre-existing index (e.g. created by DBA before migration)
    await Team.collection
      .createIndex(
        { hackathonId: 1, status: 1, isOpen: 1, createdAt: -1, _id: -1 },
        { name: "hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1" }
      )
      .catch(() => {});
    await Team.collection.dropIndex("hackathonId_1_status_1_createdAt_-1__id_-1").catch(() => {});

    // Ensure _migrations is empty
    await mongoose.connection.db?.collection("_migrations").deleteMany({});

    // 2. Run migration: it discovers Index 1 is pre-existing and creates Index 2
    const applyResult = await runTeamIndexMigration({
      confirm: true,
      connection: mongoose.connection,
    });
    expect(applyResult.status).toBe("applied");
    expect(applyResult.skippedIndexes).toContain(
      "hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1"
    );
    expect(applyResult.appliedIndexes).toContain("hackathonId_1_status_1_createdAt_-1__id_-1");

    // Verify ownership tracking in _migrations
    const migrationDoc = (await mongoose.connection.db
      ?.collection("_migrations")
      .findOne({ id: TEAM_INDEX_MIGRATION_METADATA.id })) as MigrationDocument | null;
    const preExistingEntry = migrationDoc?.managedIndexes.find(
      (m) => m.name === "hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1"
    );
    expect(preExistingEntry?.ownership).toBe("pre_existing");

    // 3. Rollback: must drop only Index 2 and PRESERVE pre-existing Index 1
    const rollbackResult = await runTeamIndexMigration({
      confirm: true,
      rollback: true,
      connection: mongoose.connection,
    });
    expect(rollbackResult.status).toBe("rolled-back");
    expect(rollbackResult.droppedIndexes).toContain("hackathonId_1_status_1_createdAt_-1__id_-1");
    expect(rollbackResult.droppedIndexes).not.toContain(
      "hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1"
    );

    // Verify Index 1 is STILL physically present in the collection!
    const indexesAfter = await Team.collection.indexes();
    expect(
      indexesAfter.some((i) => i.name === "hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1")
    ).toBe(true);
    expect(indexesAfter.some((i) => i.name === "hackathonId_1_status_1_createdAt_-1__id_-1")).toBe(
      false
    );

    // Clean up
    await Team.collection
      .dropIndex("hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1")
      .catch(() => {});
  });

  // ---------------------------------------------------------------------------
  // 12. Rollback after partial migration failure correctly drops only created index
  // ---------------------------------------------------------------------------
  it("rollback after partial migration failure correctly drops only created index", async () => {
    await mongoose.connection.db?.collection("_migrations").deleteMany({});
    await Team.collection
      .dropIndex("hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1")
      .catch(() => {});
    await Team.collection.dropIndex("hackathonId_1_status_1_createdAt_-1__id_-1").catch(() => {});

    // Run with simulated failure on second index
    await expect(
      runTeamIndexMigration({
        confirm: true,
        connection: mongoose.connection,
        simulateFailureOnSecondIndex: true,
      })
    ).rejects.toThrowError("Simulated failure during second index creation");

    // Verify _migrations records failed state and Index 1 was created
    const migrationDoc = (await mongoose.connection.db
      ?.collection("_migrations")
      .findOne({ id: TEAM_INDEX_MIGRATION_METADATA.id })) as MigrationDocument | null;
    expect(migrationDoc?.status).toBe("failed");
    expect(migrationDoc?.managedIndexes[0].status).toBe("created");
    expect(migrationDoc?.managedIndexes[1].status).toBe("pending");

    // Rollback: must drop Index 1 that was created
    const rollbackResult = await runTeamIndexMigration({
      confirm: true,
      rollback: true,
      connection: mongoose.connection,
    });
    expect(rollbackResult.status).toBe("rolled-back");
    expect(rollbackResult.droppedIndexes).toContain(
      "hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1"
    );

    const indexes = await Team.collection.indexes();
    expect(
      indexes.some((i) => i.name === "hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1")
    ).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 13. Partial rollback failure updates state and retry completes rollback
  // ---------------------------------------------------------------------------
  it("partial rollback failure records status and retry completes rollback", async () => {
    // 1. Fully apply migration
    await runTeamIndexMigration({ confirm: true, connection: mongoose.connection });

    // 2. Trigger rollback with simulated failure on second drop
    await expect(
      runTeamIndexMigration({
        confirm: true,
        rollback: true,
        connection: mongoose.connection,
        simulateFailureOnSecondDrop: true,
      })
    ).rejects.toThrowError("Simulated failure during second index drop");

    // Verify _migrations records rollback_failed state with first index dropped
    const migrationDoc = (await mongoose.connection.db
      ?.collection("_migrations")
      .findOne({ id: TEAM_INDEX_MIGRATION_METADATA.id })) as MigrationDocument | null;
    expect(migrationDoc?.status).toBe("rollback_failed");
    expect(migrationDoc?.managedIndexes[0].status).toBe("dropped");
    expect(migrationDoc?.managedIndexes[1].status).toBe("created");

    // 3. Retry rollback without failure
    const retryRollback = await runTeamIndexMigration({
      confirm: true,
      rollback: true,
      connection: mongoose.connection,
    });
    expect(retryRollback.status).toBe("rolled-back");
    expect(retryRollback.droppedIndexes).toContain("hackathonId_1_status_1_createdAt_-1__id_-1");

    const finalMigrationDoc = (await mongoose.connection.db
      ?.collection("_migrations")
      .findOne({ id: TEAM_INDEX_MIGRATION_METADATA.id })) as MigrationDocument | null;
    expect(finalMigrationDoc?.status).toBe("rolled_back");
  });

  // ---------------------------------------------------------------------------
  // 14. Rollback followed by subsequent apply correctly recreates both indexes
  // ---------------------------------------------------------------------------
  it("rollback followed by subsequent apply correctly recreates both indexes", async () => {
    // Database is currently in rolled-back state from previous test
    const reapplyResult = await runTeamIndexMigration({
      confirm: true,
      connection: mongoose.connection,
    });
    expect(reapplyResult.status).toBe("applied");
    expect(reapplyResult.appliedIndexes.length).toBe(2);

    const teamIndexes = await Team.collection.indexes();
    expect(
      teamIndexes.some((i) => i.name === "hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1")
    ).toBe(true);
    expect(teamIndexes.some((i) => i.name === "hackathonId_1_status_1_createdAt_-1__id_-1")).toBe(
      true
    );

    const migrationDoc = (await mongoose.connection.db
      ?.collection("_migrations")
      .findOne({ id: TEAM_INDEX_MIGRATION_METADATA.id })) as MigrationDocument | null;
    expect(migrationDoc?.status).toBe("completed");
    expect(migrationDoc?.managedIndexes.every((m) => m.status === "created")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 15. Same-name/different-definition conflicts fail safely
  // ---------------------------------------------------------------------------
  it("same-name/different-definition conflicts fail safely", async () => {
    // Rollback valid migration first
    await runTeamIndexMigration({
      confirm: true,
      rollback: true,
      connection: mongoose.connection,
    });

    const targetName = "hackathonId_1_status_1_createdAt_-1__id_-1";
    // Create conflicting index with same name but different key
    await Team.collection.createIndex(
      { hackathonId: 1, conflictingField: 1 },
      { name: targetName }
    );

    try {
      await expect(
        runTeamIndexMigration({ confirm: true, connection: mongoose.connection })
      ).rejects.toThrowError(MigrationConflictError);
    } finally {
      await Team.collection.dropIndex(targetName).catch(() => {});
    }
  });

  // ---------------------------------------------------------------------------
  // 16. Same-key/different-options conflicts fail safely
  // ---------------------------------------------------------------------------
  it("same-key/different-options conflicts fail safely", async () => {
    await runTeamIndexMigration({
      confirm: true,
      rollback: true,
      connection: mongoose.connection,
    });

    // Create index with matching key but different name
    const conflictingKey = { hackathonId: 1, status: 1, createdAt: -1, _id: -1 };
    await Team.collection.createIndex(conflictingKey, {
      name: "differing_index_name_idx",
    });

    try {
      await expect(
        runTeamIndexMigration({ confirm: true, connection: mongoose.connection })
      ).rejects.toThrowError(MigrationConflictError);
    } finally {
      await Team.collection.dropIndex("differing_index_name_idx").catch(() => {});
    }
  });

  // ---------------------------------------------------------------------------
  // 17. Existing prefix indexes are never removed
  // ---------------------------------------------------------------------------
  it("existing prefix indexes are never removed during migration or rollback", async () => {
    await ensureAllIndexes();

    const prefix1 = { hackathonId: 1, status: 1, isOpen: 1, createdAt: -1 };
    const prefix2 = { hackathonId: 1, status: 1, createdAt: -1 };

    let indexes = await Team.collection.indexes();
    expect(indexes.some((i) => compareIndexKeys(i.key, prefix1))).toBe(true);
    expect(indexes.some((i) => compareIndexKeys(i.key, prefix2))).toBe(true);

    // Run migration
    await runTeamIndexMigration({ confirm: true, connection: mongoose.connection });
    indexes = await Team.collection.indexes();
    expect(indexes.some((i) => compareIndexKeys(i.key, prefix1))).toBe(true);
    expect(indexes.some((i) => compareIndexKeys(i.key, prefix2))).toBe(true);

    // Run rollback
    await runTeamIndexMigration({
      confirm: true,
      rollback: true,
      connection: mongoose.connection,
    });
    indexes = await Team.collection.indexes();
    expect(indexes.some((i) => compareIndexKeys(i.key, prefix1))).toBe(true);
    expect(indexes.some((i) => compareIndexKeys(i.key, prefix2))).toBe(true);

    // Re-apply migration so database is ready for application use
    await runTeamIndexMigration({ confirm: true, connection: mongoose.connection });
    indexes = await Team.collection.indexes();
    expect(indexes.some((i) => compareIndexKeys(i.key, prefix1))).toBe(true);
    expect(indexes.some((i) => compareIndexKeys(i.key, prefix2))).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 18. Crash Window Audit: Process fails immediately after first index creation
  // ---------------------------------------------------------------------------
  it("crash window audit: failure after first index creation leaves index ambiguous, preserving it on rollback until reconciled", async () => {
    // 1. Clean state
    await mongoose.connection.db?.collection("_migrations").deleteMany({});
    await Team.collection
      .dropIndex("hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1")
      .catch(() => {});
    await Team.collection.dropIndex("hackathonId_1_status_1_createdAt_-1__id_-1").catch(() => {});

    // 2. Run migration with simulated crash immediately after first index created before record update
    await expect(
      runTeamIndexMigration({
        confirm: true,
        connection: mongoose.connection,
        simulateFailureImmediatelyAfterFirstIndexCreateBeforeRecord: true,
      })
    ).rejects.toThrowError(
      "Simulated failure immediately after first index creation before persisting state"
    );

    // Verify Index 1 exists in DB, but its record in _migrations is in 'pending' state
    const teamIndexes = await Team.collection.indexes();
    expect(
      teamIndexes.some((i) => i.name === "hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1")
    ).toBe(true);

    const doc = (await mongoose.connection.db
      ?.collection("_migrations")
      .findOne({ id: TEAM_INDEX_MIGRATION_METADATA.id })) as MigrationDocument | null;
    expect(doc?.managedIndexes[0].status).toBe("pending");

    // 3. Rollback MUST refuse to drop Index 1 because ownership is unproven/ambiguous
    await expect(
      runTeamIndexMigration({
        confirm: true,
        rollback: true,
        connection: mongoose.connection,
      })
    ).rejects.toThrowError(RollbackSafetyError);

    await expect(
      runTeamIndexMigration({
        confirm: true,
        rollback: true,
        connection: mongoose.connection,
      })
    ).rejects.toThrowError(/ambiguous ownership/);

    // Verify Index 1 is STILL PRESERVED in the collection
    const indexesAfterRollbackAttempt = await Team.collection.indexes();
    expect(
      indexesAfterRollbackAttempt.some(
        (i) => i.name === "hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1"
      )
    ).toBe(true);

    // 4. Invoking migration again without reconciliation MUST halt on ambiguity
    await expect(
      runTeamIndexMigration({ confirm: true, connection: mongoose.connection })
    ).rejects.toThrowError(MigrationConflictError);

    await expect(
      runTeamIndexMigration({ confirm: true, connection: mongoose.connection })
    ).rejects.toThrowError(/Ambiguous index ownership detected/);

    // 5. Operator reconciles with explicit flag: --reconcile-ownership=assume-owned
    const reconciledResult = await runTeamIndexMigration({
      confirm: true,
      connection: mongoose.connection,
      reconcileOwnership: "assume-owned",
    });
    expect(reconciledResult.status).toBe("applied");
    expect(reconciledResult.appliedIndexes).toContain("hackathonId_1_status_1_createdAt_-1__id_-1");

    const reconciledDoc = (await mongoose.connection.db
      ?.collection("_migrations")
      .findOne({ id: TEAM_INDEX_MIGRATION_METADATA.id })) as MigrationDocument | null;
    expect(reconciledDoc?.status).toBe("completed");
    expect(reconciledDoc?.managedIndexes[0].ownership).toBe("migration_created");
    expect(reconciledDoc?.managedIndexes[0].status).toBe("created");

    // 6. Now that ownership is verified, rollback can safely drop both indexes
    const rollbackResult = await runTeamIndexMigration({
      confirm: true,
      rollback: true,
      connection: mongoose.connection,
    });
    expect(rollbackResult.status).toBe("rolled-back");
    expect(rollbackResult.droppedIndexes).toContain(
      "hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1"
    );
    expect(rollbackResult.droppedIndexes).toContain("hackathonId_1_status_1_createdAt_-1__id_-1");
  });

  // ---------------------------------------------------------------------------
  // 19. Interruption failure before initial migration record is written
  // ---------------------------------------------------------------------------
  it("interruption failure before initial migration record is written leaves state clean", async () => {
    await mongoose.connection.db?.collection("_migrations").deleteMany({});

    await expect(
      runTeamIndexMigration({
        confirm: true,
        connection: mongoose.connection,
        simulateFailureBeforeInitialRecord: true,
      })
    ).rejects.toThrowError("Simulated failure before initial migration record write");

    const doc = await mongoose.connection.db
      ?.collection("_migrations")
      .findOne({ id: TEAM_INDEX_MIGRATION_METADATA.id });
    expect(doc).toBeNull();

    // Clean retry succeeds
    const retry = await runTeamIndexMigration({
      confirm: true,
      connection: mongoose.connection,
    });
    expect(retry.status).toBe("applied");
  });

  // ---------------------------------------------------------------------------
  // 20. Interruption after initial record but before index creation
  // ---------------------------------------------------------------------------
  it("interruption after initial record but before index creation retries safely", async () => {
    // Rollback previous test
    await runTeamIndexMigration({
      confirm: true,
      rollback: true,
      connection: mongoose.connection,
    });

    await expect(
      runTeamIndexMigration({
        confirm: true,
        connection: mongoose.connection,
        simulateFailureAfterInitialRecordBeforeIndexCreate: true,
      })
    ).rejects.toThrowError("Simulated failure after initial record before index creation");

    // Retry creates both indexes safely
    const retry = await runTeamIndexMigration({
      confirm: true,
      connection: mongoose.connection,
    });
    expect(retry.status).toBe("applied");
    expect(retry.appliedIndexes.length).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // 21. Interruption after both indexes created before completion record
  // ---------------------------------------------------------------------------
  it("interruption after both indexes created before completion record retries and rolls back safely", async () => {
    await runTeamIndexMigration({
      confirm: true,
      rollback: true,
      connection: mongoose.connection,
    });

    await expect(
      runTeamIndexMigration({
        confirm: true,
        connection: mongoose.connection,
        simulateFailureAfterBothIndexesBeforeCompletion: true,
      })
    ).rejects.toThrowError(
      "Simulated failure after both indexes created before completion metadata persistence"
    );

    // Both indexes physically created and tagged as migration_created
    const doc = (await mongoose.connection.db
      ?.collection("_migrations")
      .findOne({ id: TEAM_INDEX_MIGRATION_METADATA.id })) as MigrationDocument | null;
    expect(doc?.managedIndexes.every((m) => m.status === "created")).toBe(true);

    // Retry safely marks migration completed without recreating
    const retry = await runTeamIndexMigration({
      confirm: true,
      connection: mongoose.connection,
    });
    expect(retry.status).toBe("already-applied");

    const completedDoc = (await mongoose.connection.db
      ?.collection("_migrations")
      .findOne({ id: TEAM_INDEX_MIGRATION_METADATA.id })) as MigrationDocument | null;
    expect(completedDoc?.status).toBe("completed");

    // Rollback safely drops both because ownership was confirmed for both
    const rollback = await runTeamIndexMigration({
      confirm: true,
      rollback: true,
      connection: mongoose.connection,
    });
    expect(rollback.status).toBe("rolled-back");
    expect(rollback.droppedIndexes?.length).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // 22. Interruption after rollback drops both indexes before final metadata
  // ---------------------------------------------------------------------------
  it("interruption after rollback drops both indexes before final metadata retries cleanly", async () => {
    // Apply migration
    await runTeamIndexMigration({ confirm: true, connection: mongoose.connection });

    // Rollback with simulated failure after drops before final metadata
    await expect(
      runTeamIndexMigration({
        confirm: true,
        rollback: true,
        connection: mongoose.connection,
        simulateFailureAfterRollbackBeforeFinalMetadata: true,
      })
    ).rejects.toThrowError("Simulated failure after rollback before final metadata persistence");

    // Verify both indexes are physically absent
    const teamIndexes = await Team.collection.indexes();
    expect(
      teamIndexes.some((i) => i.name === "hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1")
    ).toBe(false);
    expect(teamIndexes.some((i) => i.name === "hackathonId_1_status_1_createdAt_-1__id_-1")).toBe(
      false
    );

    // Retry rollback: completes and updates metadata to rolled_back
    const retryRollback = await runTeamIndexMigration({
      confirm: true,
      rollback: true,
      connection: mongoose.connection,
    });
    expect(retryRollback.status).toBe("rolled-back");

    const doc = (await mongoose.connection.db
      ?.collection("_migrations")
      .findOne({ id: TEAM_INDEX_MIGRATION_METADATA.id })) as MigrationDocument | null;
    expect(doc?.status).toBe("rolled_back");

    // Reapply migration for other test suites
    const finalApply = await runTeamIndexMigration({
      confirm: true,
      connection: mongoose.connection,
    });
    expect(finalApply.status).toBe("applied");
  });
});
