import mongoose from "mongoose";
import {
  syncAllIndexes,
  User,
  Membership,
  Team,
  Invitation,
  IdempotencyRecord,
} from "../apps/api/src/models/index.js";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/crewconnect?replicaSet=rs0";

async function verifyIndexes() {
  console.log(`Connecting to MongoDB at: ${uri}`);
  await mongoose.connect(uri);
  console.log("Connected. Synchronizing and validating indexes for all models...");

  const indexMap = await syncAllIndexes();
  console.log("Synchronized model indexes:\n", JSON.stringify(indexMap, null, 2));

  // Verify User unique email index
  const userIndexes = await User.collection.indexes();
  const emailIdx = userIndexes.find((idx) => idx.key.email === 1);
  if (!emailIdx || !emailIdx.unique) {
    throw new Error("FAIL: User unique email index is missing or not unique!");
  }
  console.log("PASS: User unique email index verified.");

  // Verify Membership partial compound index: { hackathonId: 1, userId: 1 } where status: 'ACTIVE'
  const membershipIndexes = await Membership.collection.indexes();
  const membershipUniqueIdx = membershipIndexes.find(
    (idx) => idx.key.hackathonId === 1 && idx.key.userId === 1
  );
  if (
    !membershipUniqueIdx ||
    !membershipUniqueIdx.unique ||
    !membershipUniqueIdx.partialFilterExpression
  ) {
    throw new Error("FAIL: Membership partial compound unique index is missing or misconfigured!");
  }
  console.log("PASS: Membership partial compound unique index verified:", membershipUniqueIdx);

  // Verify Team discovery compound index: { hackathonId: 1, status: 1, isOpen: 1, memberCount: 1 }
  const teamIndexes = await Team.collection.indexes();
  const teamDiscoveryIdx = teamIndexes.find(
    (idx) =>
      idx.key.hackathonId === 1 &&
      idx.key.status === 1 &&
      idx.key.isOpen === 1 &&
      idx.key.memberCount === 1
  );
  if (!teamDiscoveryIdx) {
    throw new Error("FAIL: Team discovery compound index is missing!");
  }
  console.log("PASS: Team discovery index verified.");

  // Verify Invitation tokenHash unique index
  const inviteIndexes = await Invitation.collection.indexes();
  const inviteTokenIdx = inviteIndexes.find((idx) => idx.key.tokenHash === 1);
  if (!inviteTokenIdx || !inviteTokenIdx.unique) {
    throw new Error("FAIL: Invitation tokenHash unique index is missing!");
  }
  console.log("PASS: Invitation tokenHash unique index verified.");

  // Verify IdempotencyRecord scoped unique index and TTL index
  const idempIndexes = await IdempotencyRecord.collection.indexes();
  const idempUniqueIdx = idempIndexes.find(
    (idx) => idx.key.key === 1 && idx.key.userId === 1 && idx.key.endpoint === 1
  );
  if (!idempUniqueIdx || !idempUniqueIdx.unique) {
    throw new Error("FAIL: Idempotency scoped unique index is missing!");
  }
  const ttlIdx = idempIndexes.find((idx) => idx.key.expiresAt === 1);
  if (!ttlIdx || ttlIdx.expireAfterSeconds !== 0) {
    throw new Error("FAIL: Idempotency TTL index is missing or misconfigured!");
  }
  console.log("PASS: Idempotency scoped unique and TTL indexes verified.");

  await mongoose.disconnect();
  console.log("\nALL DATABASE INDEXES AND INVARIANTS GENUINELY VERIFIED!");
}

verifyIndexes().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
