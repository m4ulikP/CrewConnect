import { Types } from "mongoose";
import { connectToDatabase, disconnectDatabase } from "../apps/api/src/db/connection.js";
import {
  User,
  Hackathon,
  Team,
  Membership,
  AuditLog,
  IdempotencyRecord,
} from "../apps/api/src/models/index.js";

export const LOAD_BENCH_SLUG = "hack4hack-load-bench-2026";
export const LOAD_BENCH_EMAIL_REGEX = /\.load-bench\.crewconnect\.test$/i;

export function validateBenchmarkSlug(benchmarkSlug: string): string {
  const normalizedSlug = benchmarkSlug?.trim().toLowerCase();
  if (!normalizedSlug || !/^[a-z0-9-]+$/i.test(normalizedSlug)) {
    throw new Error(
      `Invalid benchmark identifier "${benchmarkSlug}". Explicit alphanumeric/hyphen slug required.`
    );
  }
  return normalizedSlug;
}

export function getBenchmarkEmailDomain(benchmarkSlug: string): string {
  const normalized = validateBenchmarkSlug(benchmarkSlug);
  return `${normalized}.load-bench.crewconnect.test`;
}

export function getBenchmarkEmailRegex(benchmarkSlug: string): RegExp {
  const domain = getBenchmarkEmailDomain(benchmarkSlug).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`@${domain}$`, "i");
}

export const DEFAULT_TEAM_COUNT = Number(process.env.SEED_TEAM_COUNT || "2000");
export const DEFAULT_PARTICIPANT_COUNT = Number(process.env.SEED_PARTICIPANT_COUNT || "10000");
const CHUNK_SIZE = 2000;

export interface SeedLoadOptions {
  teamCount?: number;
  participantCount?: number;
  minFreeContenders?: number;
  benchmarkSlug?: string;
}

async function insertInChunks<T>(
  model: { insertMany: (docs: T[], opts?: { ordered?: boolean }) => Promise<unknown> },
  docs: T[],
  chunkSize = CHUNK_SIZE
): Promise<void> {
  for (let i = 0; i < docs.length; i += chunkSize) {
    await model.insertMany(docs.slice(i, i + chunkSize), { ordered: false });
  }
}

/**
 * Idempotently cleans up ONLY synthetic benchmark data identified by an explicit benchmark slug
 * and the slug-scoped synthetic email domain `@<slug>.load-bench.crewconnect.test`.
 * Ordinary development records AND other independent benchmark datasets are strictly preserved.
 */
export async function cleanupLoadData(benchmarkSlug: string = LOAD_BENCH_SLUG): Promise<void> {
  const normalizedSlug = validateBenchmarkSlug(benchmarkSlug);
  const emailRegex = getBenchmarkEmailRegex(normalizedSlug);

  const syntheticUserIds = await User.find({ email: emailRegex }).distinct("_id");
  const existingHackathon = await Hackathon.findOne({ slug: normalizedSlug });

  let benchmarkTeamEndpoints: string[] = [];
  if (existingHackathon) {
    const benchmarkTeamIds = await Team.find({ hackathonId: existingHackathon._id }).distinct(
      "_id"
    );
    benchmarkTeamEndpoints = benchmarkTeamIds.map((id) => `/api/v1/teams/${String(id)}/join`);

    await Promise.all([
      Team.deleteMany({ hackathonId: existingHackathon._id }),
      Membership.deleteMany({ hackathonId: existingHackathon._id }),
      AuditLog.deleteMany({ hackathonId: existingHackathon._id }),
      Hackathon.deleteOne({ _id: existingHackathon._id }),
    ]);
  }

  if (syntheticUserIds.length > 0) {
    const idempotencyFilter: Record<string, unknown> = {
      userId: { $in: syntheticUserIds },
    };

    if (benchmarkTeamEndpoints.length > 0) {
      idempotencyFilter.endpoint = { $in: benchmarkTeamEndpoints };
    } else {
      idempotencyFilter.endpoint = /^\/api\/v1\/teams\/[a-f0-9]{24}\/join$/i;
    }

    await IdempotencyRecord.deleteMany(idempotencyFilter);
    await User.deleteMany({ _id: { $in: syntheticUserIds }, email: emailRegex });
  }
}

/**
 * Seeds a configurable synthetic benchmark hackathon (`2,000` teams and `10,000` participants
 * by default) while enforcing exact `Team.memberCount === activeMemberships` and single-team
 * hackathon invariants. Team 0 is reserved as the 4/5 Last-Seat Race Arena Team.
 */
export async function seedLoadData(options: SeedLoadOptions = {}) {
  const benchmarkSlug = validateBenchmarkSlug(options.benchmarkSlug || LOAD_BENCH_SLUG);
  const emailDomain = getBenchmarkEmailDomain(benchmarkSlug);
  const teamCount = Math.max(1, options.teamCount ?? DEFAULT_TEAM_COUNT);
  const minRequiredUsers = teamCount + 3 + (options.minFreeContenders ?? 100);
  const participantCount = Math.max(
    minRequiredUsers,
    options.participantCount ?? DEFAULT_PARTICIPANT_COUNT
  );

  await cleanupLoadData(benchmarkSlug);

  const hackathon = await Hackathon.create({
    slug: benchmarkSlug,
    title: "Hack4Hack 2026 Load Benchmark Arena",
    description: "Isolated challenge-scale load & concurrency benchmark dataset",
    minTeamSize: 1,
    maxTeamSize: 5,
    status: "ACTIVE",
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const skillsPool = [
    ["TypeScript", "React", "Node.js"],
    ["Python", "PyTorch", "FastAPI"],
    ["Rust", "WebAssembly", "Docker"],
    ["Go", "Kubernetes", "PostgreSQL"],
    ["Next.js", "Tailwind", "MongoDB"],
  ];

  // Partition total participants deterministically:
  // - `teamCount` team leaders (1 per team)
  // - Remaining participants split between active teammates (capped cleanly at team capacity)
  //   and guaranteed `freeContenders` (at least `minFreeContenders`, e.g., 100+ for races).
  const freeContenderTarget = Math.min(
    participantCount - teamCount - 3,
    Math.max(options.minFreeContenders ?? 100, Math.floor(participantCount * 0.1))
  );

  const availableTeammatesBudget = Math.max(3, participantCount - teamCount - freeContenderTarget);

  // Assign teammate counts per team strictly honoring `1 + extra <= maxCapacity (5)`
  const extraMembersPerTeam = new Array<number>(teamCount).fill(0);
  // Arena Team 0 gets exactly 3 extra members -> total 4/5 seats occupied
  extraMembersPerTeam[0] = 3;
  let assignedTeammates = 3;

  // Fill up to 3 extra members across teams 1..N-1 in round-robin passes so capacities stay balanced
  for (let pass = 0; pass < 3 && assignedTeammates < availableTeammatesBudget; pass++) {
    for (let i = 1; i < teamCount && assignedTeammates < availableTeammatesBudget; i++) {
      // Leave some open ~80% open teams + varied capacities (1..4 members)
      if (pass === 0 || i % 4 !== 0) {
        extraMembersPerTeam[i] += 1;
        assignedTeammates += 1;
      }
    }
  }

  const totalContenders = participantCount - teamCount - assignedTeammates;

  // Generate all User docs in chunks (Leaders + Teammates + Free Contenders = exact `participantCount`)
  const leaderDocs = Array.from({ length: teamCount }, (_, i) => ({
    _id: new Types.ObjectId(),
    email: `leader-${i}@${emailDomain}`,
    displayName: `Bench Leader ${i}`,
    passwordHash: "synthetic-bench-hash-not-for-login",
    skills: skillsPool[i % skillsPool.length],
    status: "ACTIVE" as const,
    tokenVersion: 0,
  }));

  const teamDocs = leaderDocs.map((leader, i) => ({
    _id: new Types.ObjectId(),
    hackathonId: hackathon._id,
    leaderId: leader._id,
    name: `Bench Crew ${String(i).padStart(4, "0")}`,
    tagline: `High-concurrency engineered team #${i}`,
    description: `Load benchmark team ${i} operating on MongoDB replica set.`,
    skillsNeeded: skillsPool[(i + 1) % skillsPool.length],
    memberCount: 1 + extraMembersPerTeam[i],
    maxCapacity: 5,
    isOpen: i === 0 || i % 5 !== 0, // Arena Team 0 strictly open; ~80% teams open
    status: "ACTIVE" as const,
  }));

  const teammateUserDocs: Array<{
    _id: Types.ObjectId;
    email: string;
    displayName: string;
    passwordHash: string;
    skills: string[];
    status: "ACTIVE";
    tokenVersion: number;
  }> = [];

  const membershipDocs: Array<{
    hackathonId: Types.ObjectId;
    teamId: Types.ObjectId;
    userId: Types.ObjectId;
    role: "LEADER" | "MEMBER";
    status: "ACTIVE";
    joinedAt: Date;
  }> = [];

  const now = new Date();
  for (let i = 0; i < teamCount; i++) {
    membershipDocs.push({
      hackathonId: hackathon._id as Types.ObjectId,
      teamId: teamDocs[i]._id,
      userId: leaderDocs[i]._id,
      role: "LEADER",
      status: "ACTIVE",
      joinedAt: now,
    });

    for (let k = 0; k < extraMembersPerTeam[i]; k++) {
      const uid = new Types.ObjectId();
      const idx = teammateUserDocs.length;
      teammateUserDocs.push({
        _id: uid,
        email: `teammate-${idx}@${emailDomain}`,
        displayName: `Bench Teammate ${idx}`,
        passwordHash: "synthetic-bench-hash-not-for-login",
        skills: skillsPool[idx % skillsPool.length],
        status: "ACTIVE",
        tokenVersion: 0,
      });
      membershipDocs.push({
        hackathonId: hackathon._id as Types.ObjectId,
        teamId: teamDocs[i]._id,
        userId: uid,
        role: "MEMBER",
        status: "ACTIVE",
        joinedAt: now,
      });
    }
  }

  const contenderDocs = Array.from({ length: totalContenders }, (_, i) => ({
    _id: new Types.ObjectId(),
    email: `contender-${i}@${emailDomain}`,
    displayName: `Race Contender ${i}`,
    passwordHash: "synthetic-bench-hash-not-for-login",
    skills: skillsPool[i % skillsPool.length],
    status: "ACTIVE" as const,
    tokenVersion: 0,
  }));

  // Bulk insert in chunks
  await insertInChunks(User, [...leaderDocs, ...teammateUserDocs, ...contenderDocs]);
  await insertInChunks(Team, teamDocs);
  await insertInChunks(Membership, membershipDocs);

  return {
    hackathon,
    arenaTeam: teamDocs[0],
    teamCount: teamDocs.length,
    participantCount: leaderDocs.length + teammateUserDocs.length + contenderDocs.length,
    membershipCount: membershipDocs.length,
    contenders: contenderDocs,
  };
}

// CLI execution entrypoint
if (process.argv[1] && process.argv[1].endsWith("seed-load-data.ts")) {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/crewconnect?replicaSet=rs0";
  const isCleanup = process.argv.includes("--cleanup");

  (async () => {
    try {
      await connectToDatabase(uri);
      if (isCleanup) {
        console.log(`Cleaning up synthetic load benchmark data (slug: ${LOAD_BENCH_SLUG})...`);
        await cleanupLoadData(LOAD_BENCH_SLUG);
        console.log("Cleanup complete. Ordinary dev records untouched.");
      } else {
        console.log(
          `Seeding ${DEFAULT_TEAM_COUNT} teams and ${DEFAULT_PARTICIPANT_COUNT} participants into ${uri}...`
        );
        const start = performance.now();
        const result = await seedLoadData({
          teamCount: DEFAULT_TEAM_COUNT,
          participantCount: DEFAULT_PARTICIPANT_COUNT,
        });
        const elapsed = (performance.now() - start).toFixed(0);
        console.log(
          `Seed complete in ${elapsed}ms! Participants: ${result.participantCount}, Teams: ${result.teamCount}, Memberships: ${result.membershipCount}, Contenders: ${result.contenders.length}, Arena Team ID: ${result.arenaTeam._id} (4/5)`
        );
      }
      await disconnectDatabase();
      process.exit(0);
    } catch (err) {
      console.error("Seed failed:", err);
      await disconnectDatabase();
      process.exit(1);
    }
  })();
}
