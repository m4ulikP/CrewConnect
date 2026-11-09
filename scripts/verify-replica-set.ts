import mongoose from "mongoose";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/crewconnect?replicaSet=rs0";

async function verifyReplicaSetAndTransactions(): Promise<void> {
  console.log(`Connecting to MongoDB at: ${uri}`);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("Connected to MongoDB successfully.");

    const admin = mongoose.connection.db?.admin();
    if (!admin) {
      throw new Error("Cannot access admin database");
    }

    const serverStatus = await admin.serverStatus();
    if (!serverStatus.repl) {
      console.error("FAIL: Connected instance is a standalone server, NOT a replica set!");
      process.exit(1);
    }

    console.log(`PASS: Confirmed Replica Set active: "${serverStatus.repl.setName}"`);

    // Define temporary schema for testing transaction
    const TestSchema = new mongoose.Schema({ name: String, counter: Number });
    const TestModel = mongoose.model("TxnVerificationTest", TestSchema);

    // Test 1: Transaction Rollback
    console.log("Testing ACID transaction ROLLBACK...");
    const sessionRollback = await mongoose.startSession();
    try {
      sessionRollback.startTransaction();
      await TestModel.create([{ name: "rollback-sample", counter: 1 }], {
        session: sessionRollback,
      });
      await sessionRollback.abortTransaction();
      console.log("Transaction successfully aborted.");
    } finally {
      await sessionRollback.endSession();
    }

    const docAfterRollback = await TestModel.findOne({ name: "rollback-sample" });
    if (docAfterRollback !== null) {
      throw new Error("FAIL: Document persisted despite transaction abort!");
    }
    console.log("PASS: Rollback verified. Document was not persisted.");

    // Test 2: Transaction Commit
    console.log("Testing ACID transaction COMMIT...");
    const sessionCommit = await mongoose.startSession();
    try {
      sessionCommit.startTransaction();
      await TestModel.create([{ name: "commit-sample", counter: 42 }], { session: sessionCommit });
      await sessionCommit.commitTransaction();
      console.log("Transaction successfully committed.");
    } finally {
      await sessionCommit.endSession();
    }

    const docAfterCommit = await TestModel.findOne({ name: "commit-sample" });
    if (!docAfterCommit || docAfterCommit.counter !== 42) {
      throw new Error("FAIL: Document not found after transaction commit!");
    }
    console.log("PASS: Commit verified. Document successfully retrieved with counter = 42.");

    // Clean up
    await TestModel.deleteMany({ name: "commit-sample" });
    await mongoose.disconnect();
    console.log("All MongoDB replica set and ACID transaction tests PASSED!");
    process.exit(0);
  } catch (error) {
    console.error("Verification failed:", (error as Error).message);
    process.exit(1);
  }
}

verifyReplicaSetAndTransactions();
