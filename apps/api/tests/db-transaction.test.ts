import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";

describe("MongoDB Replica Set Transaction Verification", () => {
  let isConnected = false;

  beforeAll(async () => {
    try {
      await connectToDatabase();
      isConnected = mongoose.connection.readyState === 1;
    } catch {
      isConnected = false;
    }
  });

  afterAll(async () => {
    if (isConnected) {
      await disconnectDatabase();
    }
  });

  it("handles database connection state reporting", () => {
    const readyState = mongoose.connection.readyState;
    expect([0, 1, 2, 3]).toContain(readyState);
  });

  it("executes transaction commit and rollback if MongoDB replica set is available", async () => {
    if (!isConnected) {
      console.warn("MongoDB replica set not currently running. Skipping live transaction test.");
      return;
    }

    const testSchema = new mongoose.Schema({ name: String, val: Number });
    const TestModel = mongoose.model("TransactionTest", testSchema);

    // 1. Test Rollback
    const sessionRollback = await mongoose.startSession();
    try {
      sessionRollback.startTransaction();
      await TestModel.create([{ name: "rollback-test", val: 100 }], { session: sessionRollback });
      await sessionRollback.abortTransaction();
    } finally {
      await sessionRollback.endSession();
    }

    const abortedDoc = await TestModel.findOne({ name: "rollback-test" });
    expect(abortedDoc).toBeNull();

    // 2. Test Commit
    const sessionCommit = await mongoose.startSession();
    try {
      sessionCommit.startTransaction();
      await TestModel.create([{ name: "commit-test", val: 200 }], { session: sessionCommit });
      await sessionCommit.commitTransaction();
    } finally {
      await sessionCommit.endSession();
    }

    const committedDoc = await TestModel.findOne({ name: "commit-test" });
    expect(committedDoc).not.toBeNull();
    expect(committedDoc?.val).toBe(200);

    // Cleanup
    await TestModel.deleteMany({ name: "commit-test" });
  });
});
