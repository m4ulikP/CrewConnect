import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Types } from "mongoose";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";
import { User, Hackathon, Team, Membership, IdempotencyRecord } from "../src/models/index.js";
import { seedLoadData, cleanupLoadData, LOAD_BENCH_SLUG } from "../../../scripts/seed-load-data.js";

describe("Phase 6.1: Benchmark Seeding & Scoped Cleanup Safety", () => {
  beforeAll(async () => {
    await connectToDatabase();
    await User.syncIndexes();
    await Hackathon.syncIndexes();
    await Team.syncIndexes();
    await Membership.syncIndexes();
    await IdempotencyRecord.syncIndexes();
  });

  afterAll(async () => {
    await cleanupLoadData(LOAD_BENCH_SLUG);
    await User.deleteMany({ email: /@ordinary-dev-survival\.test$/ });
    await Hackathon.deleteMany({ slug: /ordinary-dev-survival-/ });
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await cleanupLoadData(LOAD_BENCH_SLUG);
    await User.deleteMany({ email: /@ordinary-dev-survival\.test$/ });
    await Hackathon.deleteMany({ slug: /ordinary-dev-survival-/ });
  });

  it("rejects empty or wildcard benchmark identifiers", async () => {
    await expect(cleanupLoadData("")).rejects.toThrow(/Invalid benchmark identifier/);
    await expect(cleanupLoadData("   ")).rejects.toThrow(/Invalid benchmark identifier/);
    await expect(cleanupLoadData("hack4hack-*")).rejects.toThrow(/Invalid benchmark identifier/);
  });

  it("maintains strict membership and capacity invariants during configurable bulk seeding", async () => {
    const res = await seedLoadData({
      teamCount: 25,
      participantCount: 150,
      benchmarkSlug: LOAD_BENCH_SLUG,
    });

    expect(res.teamCount).toBe(25);
    expect(res.participantCount).toBe(150);
    expect(res.arenaTeam.memberCount).toBe(4);
    expect(res.arenaTeam.maxCapacity).toBe(5);
    expect(res.arenaTeam.isOpen).toBe(true);

    const arenaActiveCount = await Membership.countDocuments({
      teamId: res.arenaTeam._id,
      status: "ACTIVE",
    });
    expect(arenaActiveCount).toBe(4);
  });

  it("deletes all synthetic benchmark data idempotently while preserving ordinary users, teams, and idempotency records", async () => {
    // 1. Seed ordinary unrelated development data
    const ordinaryUser = await User.create({
      email: `dev-${Date.now()}@ordinary-dev-survival.test`,
      displayName: "Ordinary Developer",
      passwordHash: "hash",
      skills: ["TypeScript"],
      status: "ACTIVE",
      tokenVersion: 0,
    });

    const ordinaryHackathon = await Hackathon.create({
      slug: `ordinary-dev-survival-${Date.now()}`,
      title: "Ordinary Hackathon",
      description: "Must not be touched by benchmark cleanup",
      minTeamSize: 1,
      maxTeamSize: 5,
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
    });

    const ordinaryTeamId = new Types.ObjectId();
    await Team.create({
      _id: ordinaryTeamId,
      hackathonId: ordinaryHackathon._id,
      leaderId: ordinaryUser._id,
      name: `Ordinary Team ${Date.now()}`,
      tagline: "Survives cleanup",
      memberCount: 1,
      maxCapacity: 5,
      isOpen: true,
      status: "ACTIVE",
    });

    const ordinaryIdempEndpoint = `/api/v1/teams/${ordinaryTeamId.toString()}/join`;
    const ordinaryIdemp = await IdempotencyRecord.create({
      key: `ordinary-key-${Date.now()}`,
      userId: ordinaryUser._id,
      endpoint: ordinaryIdempEndpoint,
      payloadHash: "abc123",
      ownerToken: "owner-1",
      status: "COMPLETED",
      statusCode: 201,
      responseBody: { ok: true },
      expiresAt: new Date(Date.now() + 86400000),
    });

    // 2. Seed synthetic benchmark dataset and attach synthetic idempotency record
    const bench = await seedLoadData({
      teamCount: 10,
      participantCount: 120,
      benchmarkSlug: LOAD_BENCH_SLUG,
    });

    const benchContender = bench.contenders[0];
    const benchEndpoint = `/api/v1/teams/${bench.arenaTeam._id.toString()}/join`;
    await IdempotencyRecord.create({
      key: `bench-key-${Date.now()}`,
      userId: benchContender._id,
      endpoint: benchEndpoint,
      payloadHash: "benchhash",
      ownerToken: "bench-owner",
      status: "COMPLETED",
      statusCode: 201,
      responseBody: { ok: true },
      expiresAt: new Date(Date.now() + 86400000),
    });

    // 3. Run scoped cleanup twice to confirm idempotency
    await cleanupLoadData(LOAD_BENCH_SLUG);
    await cleanupLoadData(LOAD_BENCH_SLUG);

    // 4. Verify synthetic benchmark records are gone
    expect(await Hackathon.findOne({ slug: LOAD_BENCH_SLUG })).toBeNull();
    expect(await User.countDocuments({ email: /@load-bench\.crewconnect\.test$/ })).toBe(0);
    expect(await IdempotencyRecord.findOne({ userId: benchContender._id })).toBeNull();

    // 5. Verify ordinary unrelated data survived completely intact
    expect(await User.findById(ordinaryUser._id)).not.toBeNull();
    expect(await Hackathon.findById(ordinaryHackathon._id)).not.toBeNull();
    expect(await Team.findById(ordinaryTeamId)).not.toBeNull();
    const survivingIdemp = await IdempotencyRecord.findById(ordinaryIdemp._id);
    expect(survivingIdemp).not.toBeNull();
    expect(survivingIdemp?.endpoint).toBe(ordinaryIdempEndpoint);

    // Clean up ordinary test fixtures explicitly
    await IdempotencyRecord.deleteOne({ _id: ordinaryIdemp._id });
    await Team.deleteOne({ _id: ordinaryTeamId });
    await Hackathon.deleteOne({ _id: ordinaryHackathon._id });
    await User.deleteOne({ _id: ordinaryUser._id });
  });
});
