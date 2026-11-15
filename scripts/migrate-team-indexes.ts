import mongoose from "mongoose";
import { sanitizeMongoUriForLog } from "../apps/api/src/db/connection.js";
import { compareIndexKeys } from "../apps/api/src/models/index.js";

export const TEAM_INDEX_MIGRATION_METADATA = {
  id: "20261115_team_discovery_indexes",
  name: "team_discovery_cursor_indexes",
  version: 1,
  collectionName: "teams",
  targetIndexes: [
    {
      name: "hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1",
      key: { hackathonId: 1, status: 1, isOpen: 1, createdAt: -1, _id: -1 },
      options: { name: "hackathonId_1_status_1_isOpen_1_createdAt_-1__id_-1" },
    },
    {
      name: "hackathonId_1_status_1_createdAt_-1__id_-1",
      key: { hackathonId: 1, status: 1, createdAt: -1, _id: -1 },
      options: { name: "hackathonId_1_status_1_createdAt_-1__id_-1" },
    },
  ],
  protectedPrefixIndexes: [
    { hackathonId: 1, status: 1, isOpen: 1, createdAt: -1 },
    { hackathonId: 1, status: 1, createdAt: -1 },
  ],
};

export interface ManagedIndexState {
  name: string;
  key: Record<string, unknown>;
  ownership: "migration_created" | "pre_existing" | "ambiguous";
  status: "pending" | "created" | "present" | "dropped" | "ambiguous";
  createdAt?: Date;
  droppedAt?: Date;
}

export interface MigrationDocument {
  id: string;
  name: string;
  version: number;
  status: "in_progress" | "completed" | "failed" | "rolled_back" | "rollback_failed";
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  rolledBackAt?: Date;
  lastError?: string;
  managedIndexes: ManagedIndexState[];
}

export interface MigrationOptions {
  uri?: string;
  confirm?: boolean;
  rollback?: boolean;
  connection?: mongoose.Connection;
  reconcileOwnership?: "assume-owned" | "assume-pre-existing";
  // Interruption points for crash recovery testing
  simulateFailureBeforeInitialRecord?: boolean;
  simulateFailureAfterInitialRecordBeforeIndexCreate?: boolean;
  simulateFailureImmediatelyAfterFirstIndexCreateBeforeRecord?: boolean;
  simulateFailureOnSecondIndex?: boolean;
  simulateFailureAfterBothIndexesBeforeCompletion?: boolean;
  simulateFailureOnSecondDrop?: boolean;
  simulateFailureAfterRollbackBeforeFinalMetadata?: boolean;
}

export interface MigrationResult {
  status: "dry-run" | "applied" | "rolled-back" | "already-applied";
  migrationId: string;
  appliedIndexes: string[];
  skippedIndexes: string[];
  droppedIndexes?: string[];
  dryRunActions?: string[];
}

export class MigrationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationConflictError";
  }
}

export class RollbackSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RollbackSafetyError";
  }
}

/**
 * Executes or inspects the Team compound indexes migration with strict ownership tracking.
 */
export async function runTeamIndexMigration(
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const uri =
    options.uri ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/crewconnect?replicaSet=rs0";
  const shouldConfirm = options.confirm === true;
  const isRollback = options.rollback === true;

  let ownConnection = false;
  let conn: mongoose.Connection;

  if (options.connection) {
    conn = options.connection;
  } else {
    const sanitized = sanitizeMongoUriForLog(uri);
    console.log(`[Migration] Connecting to MongoDB: ${sanitized}`);
    await mongoose.connect(uri);
    conn = mongoose.connection;
    ownConnection = true;
  }

  try {
    const db = conn.db;
    if (!db) {
      throw new Error("MongoDB database instance is not available on connection.");
    }

    const collection = db.collection(TEAM_INDEX_MIGRATION_METADATA.collectionName);
    const migrationsCollection = db.collection<MigrationDocument>("_migrations");

    // Retrieve existing collection indexes
    let existingIndexes: Array<Record<string, unknown>> = [];
    try {
      existingIndexes = (await collection.indexes()) as Array<Record<string, unknown>>;
    } catch (err: unknown) {
      const mongoErr = err as { codeName?: string; code?: number };
      if (mongoErr.codeName === "NamespaceNotFound" || mongoErr.code === 26) {
        existingIndexes = [];
      } else {
        throw err;
      }
    }

    // Check migration history
    const existingMigrationRecord = (await migrationsCollection.findOne({
      id: TEAM_INDEX_MIGRATION_METADATA.id,
    })) as MigrationDocument | null;

    // -------------------------------------------------------------------------
    // ROLLBACK WORKFLOW
    // -------------------------------------------------------------------------
    if (isRollback) {
      console.log(
        `[Migration Rollback] Initiating rollback for migration '${TEAM_INDEX_MIGRATION_METADATA.id}'...`
      );

      // Ownership enforcement: refuse rollback if no migration tracking record exists
      if (!existingMigrationRecord) {
        throw new RollbackSafetyError(
          `Refusing rollback: No migration record found in '_migrations' for '${TEAM_INDEX_MIGRATION_METADATA.id}'. ` +
            `Migration ownership of indexes cannot be proven. Existing indexes will not be dropped.`
        );
      }

      const dryRunActions: string[] = [];
      const toDrop: Array<{ name: string; key: Record<string, unknown> }> = [];

      for (const target of TEAM_INDEX_MIGRATION_METADATA.targetIndexes) {
        const recordEntry = (existingMigrationRecord.managedIndexes || []).find(
          (m) => m.name === target.name
        );

        const foundByName = existingIndexes.find((idx) => idx.name === target.name);
        const foundByKey = existingIndexes.find((idx) =>
          compareIndexKeys(idx.key as Record<string, unknown>, target.key)
        );

        if (!foundByName && !foundByKey) {
          dryRunActions.push(`Index '${target.name}' is already absent from collection. (Skip)`);
          continue;
        }

        // Ambiguity refusal: if an index physically exists in the collection,
        // but its tracking record was left in 'pending' or 'ambiguous' state,
        // we cannot prove whether this migration created it or if it was external.
        if (
          recordEntry &&
          (recordEntry.ownership === "ambiguous" ||
            recordEntry.status === "pending" ||
            recordEntry.status === "ambiguous")
        ) {
          throw new RollbackSafetyError(
            `Refusing rollback: Index '${target.name}' exists in collection but has ambiguous ownership (record state: ${recordEntry.status}/${recordEntry.ownership}). ` +
              `Unproven indexes must never be dropped. Operator reconciliation is required.`
          );
        }

        if (!foundByName) {
          if (foundByKey) {
            throw new RollbackSafetyError(
              `Refusing rollback: Index with matching keys exists under unexpected name '${foundByKey.name}'. Ambiguous ownership.`
            );
          }
          dryRunActions.push(`Index '${target.name}' is already absent from collection. (Skip)`);
          continue;
        }

        // Safety Rule: Only indexes proven created by this migration can be dropped
        if (
          !recordEntry ||
          recordEntry.ownership !== "migration_created" ||
          recordEntry.status !== "created"
        ) {
          dryRunActions.push(
            `Index '${target.name}' was NOT proven created by this migration (pre-existing, ambiguous, or already dropped). Preserving.`
          );
          continue;
        }

        // Safety check 1: Exact key match
        if (!compareIndexKeys(foundByName.key as Record<string, unknown>, target.key)) {
          throw new RollbackSafetyError(
            `Refusing rollback: Index with name '${target.name}' exists but has unexpected key signature ${JSON.stringify(
              foundByName.key
            )} (expected ${JSON.stringify(target.key)}). Ambiguous ownership.`
          );
        }

        // Safety check 2: Never drop protected prefix indexes
        for (const prefix of TEAM_INDEX_MIGRATION_METADATA.protectedPrefixIndexes) {
          if (compareIndexKeys(foundByName.key as Record<string, unknown>, prefix)) {
            throw new RollbackSafetyError(
              `CRITICAL: Attempted to drop protected prefix index ${JSON.stringify(
                prefix
              )}. Rollback aborted immediately.`
            );
          }
        }

        toDrop.push(target);
        dryRunActions.push(
          `Drop migration-owned index '${target.name}' on collection '${collection.collectionName}'`
        );
      }

      if (!shouldConfirm) {
        console.log("\n[DRY RUN ROLLBACK REPORT]");
        for (const action of dryRunActions) {
          console.log(` - ${action}`);
        }
        console.log(
          "\nDRY RUN ONLY. No indexes were modified. To execute rollback, pass: --rollback --confirm\n" +
            "NOTE: Do not execute rollback if deployed application code depends on these indexes for keyset cursor pagination."
        );
        return {
          status: "dry-run",
          migrationId: TEAM_INDEX_MIGRATION_METADATA.id,
          appliedIndexes: [],
          skippedIndexes: [],
          droppedIndexes: [],
          dryRunActions,
        };
      }

      // Execute verified drops progressively
      const droppedIndexes: string[] = [];
      try {
        for (let i = 0; i < toDrop.length; i++) {
          const target = toDrop[i];

          if (options.simulateFailureOnSecondDrop && i === 1) {
            throw new Error(
              "Simulated failure during second index drop for partial rollback testing."
            );
          }

          console.log(`[Migration Rollback] Dropping index '${target.name}'...`);
          await collection.dropIndex(target.name);
          droppedIndexes.push(target.name);

          // Update record for this specific dropped index immediately
          await migrationsCollection.updateOne(
            { id: TEAM_INDEX_MIGRATION_METADATA.id, "managedIndexes.name": target.name },
            {
              $set: {
                "managedIndexes.$.status": "dropped",
                "managedIndexes.$.droppedAt": new Date(),
                updatedAt: new Date(),
              },
            }
          );
        }

        if (options.simulateFailureAfterRollbackBeforeFinalMetadata) {
          throw new Error("Simulated failure after rollback before final metadata persistence.");
        }

        // Mark entire migration status as rolled_back
        await migrationsCollection.updateOne(
          { id: TEAM_INDEX_MIGRATION_METADATA.id },
          {
            $set: {
              status: "rolled_back",
              rolledBackAt: new Date(),
              updatedAt: new Date(),
            },
          }
        );

        console.log(
          `[Migration Rollback] Migration '${TEAM_INDEX_MIGRATION_METADATA.id}' successfully rolled back (${droppedIndexes.length} index(es) dropped).`
        );

        return {
          status: "rolled-back",
          migrationId: TEAM_INDEX_MIGRATION_METADATA.id,
          appliedIndexes: [],
          skippedIndexes: [],
          droppedIndexes,
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await migrationsCollection.updateOne(
          { id: TEAM_INDEX_MIGRATION_METADATA.id },
          {
            $set: {
              status: "rollback_failed",
              lastError: errorMsg,
              updatedAt: new Date(),
            },
          }
        );
        throw err;
      }
    }

    // -------------------------------------------------------------------------
    // FORWARD MIGRATION WORKFLOW
    // -------------------------------------------------------------------------
    console.log(
      `[Migration] Evaluating migration '${TEAM_INDEX_MIGRATION_METADATA.id}' (v${TEAM_INDEX_MIGRATION_METADATA.version})...`
    );

    const toCreate: Array<(typeof TEAM_INDEX_MIGRATION_METADATA.targetIndexes)[number]> = [];
    const skipped: string[] = [];
    const dryRunActions: string[] = [];
    const initialManagedState: ManagedIndexState[] = [];

    for (const target of TEAM_INDEX_MIGRATION_METADATA.targetIndexes) {
      const foundByName = existingIndexes.find((idx) => idx.name === target.name);
      const foundByKey = existingIndexes.find((idx) =>
        compareIndexKeys(idx.key as Record<string, unknown>, target.key)
      );

      // Same-name conflict check
      if (
        foundByName &&
        !compareIndexKeys(foundByName.key as Record<string, unknown>, target.key)
      ) {
        throw new MigrationConflictError(
          `Conflict detected: Index name '${target.name}' already exists on collection '${collection.collectionName}', ` +
            `but has differing key pattern ${JSON.stringify(foundByName.key)} (expected ${JSON.stringify(
              target.key
            )}). Migration halted.`
        );
      }

      // Same-key conflict check (differing options or differing name)
      if (foundByKey) {
        if (foundByKey.name !== target.name) {
          throw new MigrationConflictError(
            `Conflict detected: Index with keys ${JSON.stringify(
              target.key
            )} already exists under differing name '${foundByKey.name}' (expected '${target.name}'). Migration halted.`
          );
        }

        // Validate that unexpected constraints like unique or partial filters are not set
        if (foundByKey.unique || foundByKey.partialFilterExpression || foundByKey.sparse) {
          throw new MigrationConflictError(
            `Conflict detected: Index '${target.name}' exists with conflicting constraint options: ${JSON.stringify(
              foundByKey
            )}. Migration halted.`
          );
        }

        // Provenance & Ownership Check:
        const prevEntry = existingMigrationRecord?.managedIndexes?.find(
          (m) => m.name === target.name
        );

        let ownership: "migration_created" | "pre_existing" | "ambiguous";
        let status: "created" | "present" | "ambiguous";

        if (prevEntry) {
          if (prevEntry.status === "created" && prevEntry.ownership === "migration_created") {
            // Proven ownership confirmed by prior completed step
            ownership = "migration_created";
            status = "created";
          } else if (prevEntry.ownership === "pre_existing") {
            ownership = "pre_existing";
            status = "present";
          } else if (prevEntry.status === "pending" || prevEntry.ownership === "ambiguous") {
            // CRASH WINDOW: index exists, but tracking record was left in 'pending' state
            if (options.reconcileOwnership === "assume-owned") {
              console.log(
                `[Migration Reconciliation] Operator reconciled ambiguous index '${target.name}' as OWNED by this migration.`
              );
              ownership = "migration_created";
              status = "created";
            } else if (options.reconcileOwnership === "assume-pre-existing") {
              console.log(
                `[Migration Reconciliation] Operator reconciled ambiguous index '${target.name}' as PRE-EXISTING.`
              );
              ownership = "pre_existing";
              status = "present";
            } else {
              ownership = "ambiguous";
              status = "ambiguous";
            }
          } else {
            ownership = "pre_existing";
            status = "present";
          }
        } else {
          // Existed in database before this migration ever wrote any record
          ownership = "pre_existing";
          status = "present";
        }

        if (ownership === "ambiguous") {
          throw new MigrationConflictError(
            `Ambiguous index ownership detected for '${target.name}'. Index exists in database, but migration tracking was interrupted in 'pending' state.\n` +
              `To resolve, run with explicit operator reconciliation:\n` +
              `  --reconcile-ownership=assume-owned          (if created by previous migration attempt)\n` +
              `  --reconcile-ownership=assume-pre-existing   (if index was pre-existing or external)\n` +
              `Migration halted to protect index safety.`
          );
        }

        initialManagedState.push({
          name: target.name,
          key: target.key,
          ownership,
          status,
          createdAt: prevEntry?.createdAt || new Date(),
        });

        skipped.push(target.name);
        dryRunActions.push(
          `Index '${target.name}' already exists with matching specification (proven ownership: ${ownership}). (Skip/No-op)`
        );
        continue;
      }

      toCreate.push(target);
      initialManagedState.push({
        name: target.name,
        key: target.key,
        ownership: "migration_created",
        status: "pending",
      });
      dryRunActions.push(
        `Create compound index '${target.name}' with keys ${JSON.stringify(target.key)}`
      );
    }

    if (!shouldConfirm) {
      console.log("\n[DRY RUN MIGRATION REPORT]");
      console.log(`Target Collection: ${collection.collectionName}`);
      console.log(
        `Migration Record: ${existingMigrationRecord ? `Status: ${existingMigrationRecord.status}` : "Not yet recorded"}`
      );
      for (const action of dryRunActions) {
        console.log(` - ${action}`);
      }
      console.log(
        "\nDRY RUN ONLY. No indexes were created. To apply this migration, re-run with: --confirm\n"
      );
      return {
        status: "dry-run",
        migrationId: TEAM_INDEX_MIGRATION_METADATA.id,
        appliedIndexes: [],
        skippedIndexes: skipped,
        dryRunActions,
      };
    }

    // Interruption simulation 1: failure before initial record
    if (options.simulateFailureBeforeInitialRecord) {
      throw new Error("Simulated failure before initial migration record write.");
    }

    // Record in-progress state BEFORE creating indexes
    await migrationsCollection.updateOne(
      { id: TEAM_INDEX_MIGRATION_METADATA.id },
      {
        $set: {
          id: TEAM_INDEX_MIGRATION_METADATA.id,
          name: TEAM_INDEX_MIGRATION_METADATA.name,
          version: TEAM_INDEX_MIGRATION_METADATA.version,
          status: "in_progress",
          startedAt: existingMigrationRecord?.startedAt || new Date(),
          updatedAt: new Date(),
          managedIndexes: initialManagedState,
        },
        $unset: { lastError: "" as const },
      },
      { upsert: true }
    );

    // Interruption simulation 2: failure after initial record but before index creation
    if (options.simulateFailureAfterInitialRecordBeforeIndexCreate) {
      throw new Error("Simulated failure after initial record before index creation.");
    }

    // If all target indexes are already present with matching specs and migration was completed:
    if (
      toCreate.length === 0 &&
      existingMigrationRecord &&
      existingMigrationRecord.status === "completed"
    ) {
      console.log(
        `[Migration] Migration '${TEAM_INDEX_MIGRATION_METADATA.id}' is already fully completed.`
      );
      return {
        status: "already-applied",
        migrationId: TEAM_INDEX_MIGRATION_METADATA.id,
        appliedIndexes: [],
        skippedIndexes: skipped,
      };
    }

    // Apply creation one by one, recording state on each success
    const appliedIndexes: string[] = [];
    try {
      for (let i = 0; i < toCreate.length; i++) {
        const target = toCreate[i];

        if (options.simulateFailureOnSecondIndex && i === 1) {
          throw new Error("Simulated failure during second index creation for retry-testing.");
        }

        console.log(
          `[Migration] Creating index '${target.name}' (non-blocking hybrid build in MongoDB 4.2+)...`
        );
        await collection.createIndex(target.key, target.options);
        console.log(`[Migration] Index '${target.name}' successfully created.`);
        appliedIndexes.push(target.name);

        // Interruption simulation 3: failure immediately after index create, before persisting confirmed state
        if (options.simulateFailureImmediatelyAfterFirstIndexCreateBeforeRecord && i === 0) {
          throw new Error(
            "Simulated failure immediately after first index creation before persisting state."
          );
        }

        // Update tracking record immediately for this created index
        await migrationsCollection.updateOne(
          { id: TEAM_INDEX_MIGRATION_METADATA.id, "managedIndexes.name": target.name },
          {
            $set: {
              "managedIndexes.$.ownership": "migration_created",
              "managedIndexes.$.status": "created",
              "managedIndexes.$.createdAt": new Date(),
              updatedAt: new Date(),
            },
          }
        );
      }

      // Interruption simulation 4: failure after both indexes created, before completion metadata
      if (options.simulateFailureAfterBothIndexesBeforeCompletion) {
        throw new Error(
          "Simulated failure after both indexes created before completion metadata persistence."
        );
      }

      // Mark migration as completed
      await migrationsCollection.updateOne(
        { id: TEAM_INDEX_MIGRATION_METADATA.id },
        {
          $set: {
            status: "completed",
            completedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );
      console.log(
        `[Migration] Successfully completed migration '${TEAM_INDEX_MIGRATION_METADATA.id}'.`
      );

      return {
        status: appliedIndexes.length > 0 ? "applied" : "already-applied",
        migrationId: TEAM_INDEX_MIGRATION_METADATA.id,
        appliedIndexes,
        skippedIndexes: skipped,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await migrationsCollection.updateOne(
        { id: TEAM_INDEX_MIGRATION_METADATA.id },
        {
          $set: {
            status: "failed",
            lastError: errorMsg,
            updatedAt: new Date(),
          },
        }
      );
      throw err;
    }
  } finally {
    if (ownConnection) {
      await mongoose.disconnect();
    }
  }
}

// CLI Execution Handler
if (
  process.argv[1] &&
  (process.argv[1].endsWith("migrate-team-indexes.ts") ||
    process.argv[1].endsWith("migrate-team-indexes.js"))
) {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const rollback = args.includes("--rollback");
  const uri = process.env.MONGODB_URI;

  let reconcileOwnership: "assume-owned" | "assume-pre-existing" | undefined;
  if (args.includes("--reconcile-ownership=assume-owned")) {
    reconcileOwnership = "assume-owned";
  } else if (args.includes("--reconcile-ownership=assume-pre-existing")) {
    reconcileOwnership = "assume-pre-existing";
  }

  console.log("================================================================================");
  console.log("             CREWCONNECT DATABASE INDEX MIGRATION RUNNER                        ");
  console.log("================================================================================");
  console.log(
    `Target MongoDB URI: ${sanitizeMongoUriForLog(uri || "mongodb://localhost:27017/crewconnect?replicaSet=rs0")}`
  );
  console.log(`Action            : ${rollback ? "ROLLBACK" : "APPLY MIGRATION"}`);
  console.log(`Mode              : ${confirm ? "EXECUTION (CONFIRMED)" : "DRY RUN (READ-ONLY)"}`);
  if (reconcileOwnership) {
    console.log(`Reconcile Ambiguity: ${reconcileOwnership}`);
  }
  console.log("================================================================================\n");

  runTeamIndexMigration({ confirm, rollback, uri, reconcileOwnership })
    .then((result) => {
      console.log("\nMigration completed with status:", result.status);
      process.exit(0);
    })
    .catch((err) => {
      console.error("\nMigration failed with error:", err.message);
      process.exit(1);
    });
}
