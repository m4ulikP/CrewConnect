import mongoose, { Types } from "mongoose";
import {
  User,
  Hackathon,
  Team,
  Membership,
  AuditLog,
  IdempotencyRecord,
} from "../apps/api/src/models/index.js";

export const LOAD_BENCH_SLUG = "hack4hack-load-bench-2026";
export const LOAD_BENCH_EMAIL_REGEX = /@load-bench\.crewconnect\.test$/;

const DEFAULT_TEAM_COUNT = Number(process.env.SEED_TEAM_COUNT || "1000");
const DEFAULT_CONTENDER_COUNT = Number(process.env.SEED_CONTENDERS || "100");

export async function cleanupLoadData() {
  const existingHackathon = await Hackathon.findOne({ slug: LOAD_BENCH_SLUG });
  if (existingHackathon) {
    await Promise.all([
      Team.deleteMany({ hackathonId: existingHackathon._id }),
      Membership.deleteMany({ hackathonId: existingHackathon._id }),
      AuditLog.deleteMany({ hackathonId: existingHackathon._id }),
      Hackathon.deleteOne({ _id: existingHackathon._id }),
    ]);
  }
  await User.deleteMany({ email: LOAD_BENCH_EMAIL_REGEX });
  await IdempotencyRecord.deleteMany({ route: /teams/ });
}

export async function seedLoadData(
  teamCount = DEFAULT_TEAM_COUNT,
  contenderCount = DEFAULT_CONTENDER_COUNT
) {
  await cleanupLoadData();

  const hackathon = await Hackathon.create({
    slug: LOAD_BENCH_SLUG,
    title: "Hack4Hack 2026 Load Benchmark Arena",
    description: "Isolated load-testing hackathon dataset",
    minTeamSize: 1,
    maxTeamSize: 5,
    status: "ACTIVE",
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // 1. Seed Leader Users & Teams (using bulk insertMany for speed)
  const skillsPool = [
    ["TypeScript", "React", "Node.js"],
    ["Python", "PyTorch", "FastAPI"],
    ["Rust", "WebAssembly", "Docker"],
    ["Go", "Kubernetes", "PostgreSQL"],
    ["Next.js", "Tailwind", "MongoDB"],
  ];

  const leaderUsersPayload = Array.from({ length: teamCount }, (_, i) => ({
    _id: new Types.ObjectId(),
    email: `leader-${i}@load-bench.crewconnect.test`,
    displayName: `Bench Leader ${i}`,
    passwordHash: "synthetic-bench-hash-not-for-login",
    skills: skillsPool[i % skillsPool.length],
    status: "ACTIVE",
    tokenVersion: 0,
  }));

  await User.insertMany(leaderUsersPayload, { ordered: false });

  const teamsPayload = leaderUsersPayload.map((leader, i) => ({
    _id: new Types.ObjectId(),
    hackathonId: hackathon._id,
    leaderId: leader._id,
    name: `Bench Crew ${String(i).padStart(4, "0")}`,
    tagline: `High-concurrency engineered team #${i}`,
    description: `Load benchmark team ${i} operating on MongoDB replica set.`,
    skillsNeeded: skillsPool[(i + 1) % skillsPool.length],
    memberCount: i === 0 ? 4 : (i % 4) + 1, // Team 0 is the 4/5 Arena Team!
    maxCapacity: 5,
    isOpen: i % 5 !== 0 || i === 0, // ~80% open + Arena Team 0 strictly open
    status: "ACTIVE",
  }));

  await Team.insertMany(teamsPayload, { ordered: false });

  const membershipsPayload = teamsPayload.map((team, i) => ({
    hackathonId: hackathon._id,
    teamId: team._id,
    userId: leaderUsersPayload[i]._id,
    role: "LEADER",
    status: "ACTIVE",
    joinedAt: new Date(),
  }));

  await Membership.insertMany(membershipsPayload, { ordered: false });

  // For Arena Team 0 (memberCount: 4, maxCapacity: 5), seed 3 existing teammates so membership count == 4 cleanly
  const arenaTeammates = Array.from({ length: 3 }, (_, idx) => ({
    _id: new Types.ObjectId(),
    email: `arena-member-${idx}@load-bench.crewconnect.test`,
    displayName: `Arena Member ${idx}`,
    passwordHash: "synthetic-bench-hash-not-for-login",
    skills: ["TypeScript", "MongoDB"],
    status: "ACTIVE",
    tokenVersion: 0,
  }));
  await User.insertMany(arenaTeammates, { ordered: false });
  await Membership.insertMany(
    arenaTeammates.map((m) => ({
      hackathonId: hackathon._id,
      teamId: teamsPayload[0]._id,
      userId: m._id,
      role: "MEMBER",
      status: "ACTIVE",
      joinedAt: new Date(),
    }))
  );

  // 2. Seed Contender Users (free agents without any active membership)
  const contendersPayload = Array.from({ length: contenderCount }, (_, i) => ({
    _id: new Types.ObjectId(),
    email: `contender-${i}@load-bench.crewconnect.test`,
    displayName: `Race Contender ${i}`,
    passwordHash: "synthetic-bench-hash-not-for-login",
    skills: skillsPool[i % skillsPool.length],
    status: "ACTIVE",
    tokenVersion: 0,
  }));
  const contenders = await User.insertMany(contendersPayload, { ordered: false });

  return {
    hackathon,
    arenaTeam: teamsPayload[0],
    teamCount,
    contenders,
  };
}

// CLI execution entrypoint
if (process.argv[1] && process.argv[1].endsWith("seed-load-data.ts")) {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/crewconnect?replicaSet=rs0";
  const isCleanup = process.argv.includes("--cleanup");

  (async () => {
    try {
      await mongoose.connect(uri);
      if (isCleanup) {
        console.log("Cleaning up synthetic load benchmark data...");
        await cleanupLoadData();
        console.log("Cleanup complete.");
      } else {
        console.log(
          `Seeding ${DEFAULT_TEAM_COUNT} teams and ${DEFAULT_CONTENDER_COUNT} contender users into ${uri}...`
        );
        const start = performance.now();
        const result = await seedLoadData();
        const elapsed = (performance.now() - start).toFixed(0);
        console.log(
          `Seed complete in ${elapsed}ms! Hackathon ID: ${result.hackathon._id}, Arena Team ID: ${result.arenaTeam._id} (4/5 seats filled)`
        );
      }
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error("Seed failed:", err);
      await mongoose.disconnect();
      process.exit(1);
    }
  })();
}
