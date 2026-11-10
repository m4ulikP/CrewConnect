import http from "node:http";
import type { AddressInfo } from "node:net";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { app } from "../apps/api/src/app.js";
import { connectToDatabase, disconnectDatabase } from "../apps/api/src/db/connection.js";
import { initSocketServer, closeSocketServer } from "../apps/api/src/realtime/index.js";
import {
  syncAllIndexes,
  Team,
  Membership,
  User,
  type IUser,
} from "../apps/api/src/models/index.js";
import { AuthService } from "../apps/api/src/services/auth.service.js";
import {
  REALTIME_EVENTS,
  type TeamCapacityUpdatedPayload,
  type TeamMemberJoinedPayload,
} from "@crewconnect/shared";
import {
  seedLoadData,
  cleanupLoadData,
  LOAD_BENCH_SLUG,
  DEFAULT_TEAM_COUNT,
  DEFAULT_PARTICIPANT_COUNT,
} from "./seed-load-data.js";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function runDiscoveryBenchmark(
  baseUrl: string,
  hackathonId: string,
  concurrency: number,
  totalRequests: number
) {
  console.log(
    `\n[Benchmark 1] Discovery API Load Test: ${concurrency} concurrent clients, ${totalRequests} total requests`
  );

  const latencies: number[] = [];
  let failures = 0;
  let completed = 0;

  const targetUrl = `${baseUrl}/api/v1/hackathons/${hackathonId}/teams?hasVacancies=true&limit=20`;

  // Warm up connection pool & query plan (50 requests)
  await Promise.all(
    Array.from({ length: 50 }, () => fetch(targetUrl).then((r) => r.arrayBuffer()))
  );

  const startWall = performance.now();

  async function worker() {
    while (completed < totalRequests) {
      const idx = completed++;
      if (idx >= totalRequests) break;
      const t0 = performance.now();
      try {
        const res = await fetch(targetUrl);
        if (!res.ok) {
          failures += 1;
        } else {
          await res.arrayBuffer();
        }
      } catch {
        failures += 1;
      } finally {
        latencies.push(performance.now() - t0);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const wallMs = performance.now() - startWall;

  latencies.sort((a, b) => a - b);
  const mean = latencies.reduce((acc, v) => acc + v, 0) / latencies.length;
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const rps = (totalRequests / (wallMs / 1000)).toFixed(1);

  const errorRate = ((failures / totalRequests) * 100).toFixed(2);

  console.log(`  Concurrency      : ${concurrency} concurrent clients`);
  console.log(`  Request Count    : ${totalRequests}`);
  console.log(`  Total Duration   : ${wallMs.toFixed(0)} ms`);
  console.log(`  Throughput       : ${rps} req/sec`);
  console.log(`  Failed Requests  : ${failures} (Error Rate: ${errorRate}%)`);
  console.log(
    `  Latency (ms)     : min=${latencies[0].toFixed(1)}  p50=${p50.toFixed(1)}  mean=${mean.toFixed(1)}  p95=${p95.toFixed(1)}  p99=${p99.toFixed(1)}  max=${latencies[latencies.length - 1].toFixed(1)}`
  );

  if (failures > 0) {
    throw new Error(`Discovery benchmark had ${failures} failed HTTP requests!`);
  }
  if (p95 >= 200) {
    console.warn(
      `  [WARN] Discovery API p95 latency (${p95.toFixed(1)}ms) exceeded 200ms SLA target!`
    );
  } else {
    console.log(`  [PASS] Discovery API p95 = ${p95.toFixed(1)} ms (< 200 ms target)`);
  }
}

async function runLastSeatRaceBenchmark(
  baseUrl: string,
  hackathonId: string,
  arenaTeamId: string,
  leaderId: string,
  contenders: IUser[]
) {
  const raceCount = 50;
  console.log(
    `\n[Benchmark 2] ${raceCount}-Way Last-Seat Race Under Live Socket.IO Listeners (4/5 -> 5/5)`
  );

  // 1. Connect 5 authenticated spectator Socket.IO clients to hackathon room + 1 leader client to team room
  const leaderUser = await User.findById(leaderId);
  if (!leaderUser) throw new Error("Arena leader not found");
  const leaderToken = AuthService.generateToken(leaderUser);

  const socketClients: ClientSocket[] = [];
  const capacityEventsReceived: Array<{ receivedAt: number; payload: TeamCapacityUpdatedPayload }> =
    [];
  const memberJoinedEventsReceived: Array<{
    receivedAt: number;
    payload: TeamMemberJoinedPayload;
  }> = [];

  async function connectSocket(token: string): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const client = ioClient(baseUrl, {
        auth: { token },
        transports: ["websocket"],
        reconnection: false,
      });
      socketClients.push(client);
      client.on("connect", () => resolve(client));
      client.on("connect_error", reject);
    });
  }

  try {
    const leaderSocket = await connectSocket(leaderToken);
    await new Promise<void>((resolve, reject) => {
      leaderSocket.emit(
        "join:team",
        { teamId: arenaTeamId },
        (ack: { success: boolean; error?: string }) => {
          if (ack?.success) resolve();
          else reject(new Error(`Leader failed to join team room: ${ack?.error}`));
        }
      );
    });
    leaderSocket.on(REALTIME_EVENTS.TEAM_MEMBER_JOINED, (payload: TeamMemberJoinedPayload) => {
      memberJoinedEventsReceived.push({ receivedAt: performance.now(), payload });
    });

    const spectatorSockets = await Promise.all(
      contenders.slice(0, 5).map(async (c) => {
        const tok = AuthService.generateToken(c);
        const sock = await connectSocket(tok);
        await new Promise<void>((resolve, reject) => {
          sock.emit(
            "join:hackathon",
            { hackathonId },
            (ack: { success: boolean; error?: string }) => {
              if (ack?.success) resolve();
              else reject(new Error(`Spectator failed to join hackathon room: ${ack?.error}`));
            }
          );
        });
        sock.on(REALTIME_EVENTS.TEAM_CAPACITY_UPDATED, (payload: TeamCapacityUpdatedPayload) => {
          if (payload.teamId === arenaTeamId) {
            capacityEventsReceived.push({ receivedAt: performance.now(), payload });
          }
        });
        return sock;
      })
    );

    // Prepare 50 concurrent contender requests with valid JWTs and unique Idempotency-Keys
    const racers = contenders.slice(0, raceCount).map((user) => ({
      userId: user._id.toString(),
      token: AuthService.generateToken(user),
      idempotencyKey: crypto.randomUUID(),
    }));

    const raceStart = performance.now();
    let commitCompletedAt = 0;

    const results = await Promise.all(
      racers.map(async (racer) => {
        const t0 = performance.now();
        const res = await fetch(`${baseUrl}/api/v1/teams/${arenaTeamId}/join`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${racer.token}`,
            "Idempotency-Key": racer.idempotencyKey,
          },
          body: JSON.stringify({}),
        });
        const elapsed = performance.now() - t0;
        const body = await res.json().catch(() => null);
        if (res.status === 201) {
          commitCompletedAt = performance.now();
        }
        return { status: res.status, elapsed, body };
      })
    );
    const raceWallMs = performance.now() - raceStart;

    const winners = results.filter((r) => r.status === 201);
    const conflicts = results.filter((r) => r.status === 409);
    const serverErrors = results.filter((r) => r.status >= 500);
    const otherStatus = results.filter(
      (r) => r.status !== 201 && r.status !== 409 && r.status < 500
    );

    // Allow up to 500ms for WebSocket frames to arrive on all listeners
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Verify DB invariants directly
    const finalTeam = await Team.findById(arenaTeamId);
    const activeMemberships = await Membership.countDocuments({
      teamId: arenaTeamId,
      status: "ACTIVE",
    });

    console.log(`  Race Duration          : ${raceWallMs.toFixed(1)} ms`);
    console.log(`  201 Created (Winners)  : ${winners.length} (expected: 1)`);
    console.log(`  409 Conflict (Rejects) : ${conflicts.length} (expected: 49)`);
    console.log(
      `  5xx / Other Errors     : ${serverErrors.length + otherStatus.length} (expected: 0)`
    );
    console.log(
      `  DB Team Capacity       : ${finalTeam?.memberCount}/${finalTeam?.maxCapacity}, isOpen=${finalTeam?.isOpen}, Active Memberships=${activeMemberships}`
    );
    console.log(
      `  Socket team:member_joined  (leader)     : ${memberJoinedEventsReceived.length} event(s)`
    );
    console.log(
      `  Socket team:capacity_updated (5 clients): ${capacityEventsReceived.length} event(s) (expected: 5)`
    );

    if (memberJoinedEventsReceived.length > 0 && commitCompletedAt > 0) {
      const fanoutDelta = Math.max(0, memberJoinedEventsReceived[0].receivedAt - commitCompletedAt);
      console.log(`  Commit-to-Socket Fanout: ~${fanoutDelta.toFixed(1)} ms`);
    }

    if (winners.length !== 1) {
      throw new Error(`Expected exactly 1 race winner, got ${winners.length}`);
    }
    if (conflicts.length !== raceCount - 1) {
      throw new Error(`Expected ${raceCount - 1} conflicts, got ${conflicts.length}`);
    }
    if (serverErrors.length > 0 || otherStatus.length > 0) {
      throw new Error(`Unexpected errors during race!`);
    }
    if (finalTeam?.memberCount !== 5 || activeMemberships !== 5) {
      throw new Error(`Database capacity invariant violated!`);
    }
    if (memberJoinedEventsReceived.length !== 1) {
      throw new Error(
        `Expected exactly 1 team:member_joined socket event, got ${memberJoinedEventsReceived.length}`
      );
    }
    if (capacityEventsReceived.length !== spectatorSockets.length) {
      throw new Error(
        `Expected ${spectatorSockets.length} spectator capacity events, got ${capacityEventsReceived.length}`
      );
    }

    console.log(
      "  [PASS] Zero over-allocation, exact 1 winner / 49 conflicts, exact 1 post-commit socket dispatch."
    );
  } finally {
    for (const sock of socketClients) {
      if (sock.connected) sock.disconnect();
    }
  }
}

async function runChildServer(): Promise<void> {
  process.env.NODE_ENV = "test";
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/crewconnect?replicaSet=rs0";
  await connectToDatabase(uri);

  const server = http.createServer(app);
  initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;

  console.log(`BENCH_LISTENING=http://127.0.0.1:${port}`);

  const shutdown = async () => {
    await closeSocketServer();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDatabase();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

async function spawnServerProcess(): Promise<{ baseUrl: string; stop: () => Promise<void> }> {
  const scriptPath = fileURLToPath(import.meta.url);
  const child = spawn(process.execPath, ["--import", "tsx", scriptPath], {
    env: { ...process.env, BENCH_SERVER_ONLY: "1", NODE_ENV: "test" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const baseUrl = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for child server")), 15000);
    let stderrBuf = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      const match = /BENCH_LISTENING=(http:\/\/[^\s]+)/.exec(text);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server child exited early with code ${code}: ${stderrBuf}`));
    });
  });

  return {
    baseUrl,
    stop: async () => {
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        child.once("exit", () => resolve());
        setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 2000).unref();
      });
    },
  };
}

async function main() {
  if (process.env.BENCH_SERVER_ONLY === "1") {
    await runChildServer();
    return;
  }

  process.env.NODE_ENV = "test";
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/crewconnect?replicaSet=rs0";
  const keepData = process.argv.includes("--keep");

  console.log("=== CrewConnect Phase 6 Reproducible Load & Concurrency Benchmark ===");
  await connectToDatabase(uri);
  await syncAllIndexes();

  const teamCount = Number(process.env.SEED_TEAM_COUNT || DEFAULT_TEAM_COUNT);
  const participantCount = Number(process.env.SEED_PARTICIPANT_COUNT || DEFAULT_PARTICIPANT_COUNT);
  const concurrency = Number(process.env.BENCH_CONCURRENCY || "100");
  const requestCount = Number(process.env.BENCH_REQUESTS || "500");

  console.log(
    `Seeding challenge-scale benchmark dataset (${teamCount} teams, ${participantCount} participants)...`
  );
  const tSeed = performance.now();
  const seeded = await seedLoadData({
    teamCount,
    participantCount,
    benchmarkSlug: LOAD_BENCH_SLUG,
  });
  console.log(
    `Seeded ${seeded.participantCount} participants, ${seeded.teamCount} teams, ${seeded.membershipCount} active memberships in ${(performance.now() - tSeed).toFixed(0)} ms.`
  );

  const serverProc = await spawnServerProcess();
  console.log(`Isolated benchmark API server listening on ${serverProc.baseUrl}`);

  try {
    // Run 100 concurrent clients performing Discovery API queries
    await runDiscoveryBenchmark(
      serverProc.baseUrl,
      seeded.hackathon._id.toString(),
      concurrency,
      requestCount
    );

    // Run 50-way last-seat race with live WebSocket listeners
    await runLastSeatRaceBenchmark(
      serverProc.baseUrl,
      seeded.hackathon._id.toString(),
      seeded.arenaTeam._id.toString(),
      seeded.arenaTeam.leaderId.toString(),
      seeded.contenders as unknown as IUser[]
    );

    console.log("\n=== BENCHMARK SUITE COMPLETE ===");
  } finally {
    await serverProc.stop();
    if (!keepData) {
      console.log(`Cleaning up synthetic benchmark records (slug: ${LOAD_BENCH_SLUG})...`);
      await cleanupLoadData(LOAD_BENCH_SLUG);
    }
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error("\n[BENCHMARK FAILED]:", err);
  process.exit(1);
});
