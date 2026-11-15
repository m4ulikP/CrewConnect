import mongoose from "mongoose";
import { verifyDatabaseIndexes, CRITICAL_INDEX_SPECS } from "../apps/api/src/models/index.js";
import { sanitizeMongoUriForLog } from "../apps/api/src/db/connection.js";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/crewconnect?replicaSet=rs0";

/**
 * Strictly read-only verification of database indexes.
 * Connects to MongoDB, reads collection indexes without mutating the database,
 * and asserts that all critical data integrity and constraint indexes are present
 * and correctly configured.
 */
async function verifyIndexes(): Promise<void> {
  const sanitizedUri = sanitizeMongoUriForLog(uri);
  console.log(`Connecting to MongoDB at: ${sanitizedUri}`);
  await mongoose.connect(uri);
  console.log("Connected. Executing read-only index verification against MongoDB collections...\n");

  try {
    const result = await verifyDatabaseIndexes();

    console.log("================================================================================");
    console.log("                    CRITICAL DATA INTEGRITY INDEX AUDIT                        ");
    console.log("================================================================================");
    for (const spec of CRITICAL_INDEX_SPECS) {
      console.log(` [PASS] ${spec.modelName.padEnd(18)} : ${spec.description}`);
    }
    console.log(`\nAll ${result.criticalChecked} critical schema integrity invariants verified.`);

    console.log(
      "\n================================================================================"
    );
    console.log("                    PERFORMANCE INDEX AUDIT                                     ");
    console.log("================================================================================");
    if (result.warnings.length > 0) {
      console.warn(
        `WARNING: ${result.warnings.length} performance index(es) not currently present:`
      );
      for (const warning of result.warnings) {
        console.warn(` - ${warning}`);
      }
    } else {
      console.log(`All ${result.performanceChecked} performance indexes are verified present.`);
    }

    console.log(
      "\n================================================================================"
    );
    console.log("VERIFICATION RESULT: SUCCESS (Database is strictly validated and unmutated)");
    console.log("================================================================================");
  } finally {
    await mongoose.disconnect();
  }
}

verifyIndexes().catch((err) => {
  console.error(
    "\n================================================================================"
  );
  console.error("VERIFICATION FAILED: Critical database invariant check error:");
  console.error(err.message);
  console.error("================================================================================");
  process.exit(1);
});
