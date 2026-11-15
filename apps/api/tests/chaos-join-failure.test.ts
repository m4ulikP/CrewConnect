import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import mongoose, { Types } from "mongoose";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import {
  User,
  Hackathon,
  Team,
  Membership,
  AuditLog,
  ensureAllIndexes,
  type IUser,
  type IHackathon,
  type ITeam,
} from "../src/models/index.js";
import { AuthService } from "../src/services/auth.service.js";
import { closeSocketServer } from "../src/realtime/socket.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";
import { env } from "../src/config/env.js";

// ==============================================================================
// 1. ISOLATED CHILD PROCESS RUNNER SCRIPT
// ==============================================================================
const CHAOS_DB_NAME = "crewconnect_chaos_test";
const CHAOS_DB_URI = `mongodb://localhost:27017/${CHAOS_DB_NAME}?replicaSet=rs0`;

const previousDbName = env.MONGODB_DB_NAME;
(env as any).MONGODB_DB_NAME = CHAOS_DB_NAME;
process.env.MONGODB_DB_NAME = CHAOS_DB_NAME;

const CHILD_RUNNER_CODE = `
import http from "node:http";
import mongoose from "mongoose";
import { app } from "./src/app.js";
import { initSocketServer } from "./src/realtime/socket.js";
import { connectToDatabase } from "./src/db/connection.js";
import { SeatReservationService } from "./src/services/seat-reservation.service.js";
import { Membership } from "./src/models/index.js";

const CHAOS_DB_NAME = "crewconnect_chaos_test";
const CHAOS_DB_URI = "mongodb://localhost:27017/crewconnect_chaos_test?replicaSet=rs0";

async function runChildProcessServer() {
  const isKillMode = process.env.CHAOS_INJECT_KILL === "1";

  if (!CHAOS_DB_URI.includes("crewconnect_chaos_test")) {
    console.error("FATAL: Child process safety violation - invalid database URI");
    process.exit(1);
  }

  await connectToDatabase(CHAOS_DB_URI);

  if (isKillMode) {
    const originalReserve = SeatReservationService.reserveSeatAndJoin;
    SeatReservationService.reserveSeatAndJoin = async function (params) {
      return originalReserve.call(this, {
        ...params,
        onBeforeCommit: async (session, updatedTeam) => {
          if (params.onBeforeCommit) {
            await params.onBeforeCommit(session, updatedTeam);
          }

          // Invariant Check inside the active transaction:
          // The team's memberCount has been incremented from 1 to 2 in the uncommitted buffer,
          // and the candidate's membership has been inserted into the session.
          const stagedMembers = await Membership.find({ teamId: updatedTeam._id }).session(session);

          const lsidB64 = session.id?.id ? session.id.id.toString("base64") : "";

          // Emit deterministic stdout sentinel confirming writes are staged in the active transaction
          process.stdout.write(
            "CHAOS_TRANSACTION_STAGED:teamCount=" +
              updatedTeam.memberCount +
              ":membersCount=" +
              stagedMembers.length +
              ":lsid=" +
              lsidB64 +
              "\\n"
          );

          // Flush stdout buffer before abrupt process termination
          await new Promise((r) => setImmediate(r));

          // ABRUPT PROCESS TERMINATION:
          // process.kill with SIGKILL immediately terminates the runtime.
          // No 'finally' blocks, no graceful shutdown, no Mongoose session cleanup, and no WebSocket dispatch.
          process.kill(process.pid, "SIGKILL");
        },
      });
    };
  } else {
    const originalReserve = SeatReservationService.reserveSeatAndJoin;
    SeatReservationService.reserveSeatAndJoin = async function (params) {
      try {
        return await originalReserve.call(this, params);
      } catch (err) {
        console.error("RECOVERY_RESERVE_ERROR:", err);
        throw err;
      }
    };
  }

  const server = http.createServer(app);
  initSocketServer(server);

  server.listen(0, "127.0.0.1", () => {
    const addr = server.address();
    process.stdout.write("CHAOS_SERVER_READY=" + addr.port + "\\n");
  });
}

runChildProcessServer().catch((err) => {
  console.error("Child server startup error:", err);
  process.exit(1);
});
`;

// ==============================================================================
// 2. PERSISTENT STDOUT STREAM PARSER & SESSION RECONSTRUCTION
// ==============================================================================
export class StreamLineParser {
  private buffer = "";

  public push(chunk: string): string[] {
    this.buffer += chunk;
    const lines: string[] = [];
    let newlineIndex: number;

    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).replace(/\r$/, "");
      this.buffer = this.buffer.slice(newlineIndex + 1);
      lines.push(line);
    }

    return lines;
  }

  public flush(): string[] {
    if (this.buffer.length > 0) {
      const line = this.buffer.replace(/\r$/, "");
      this.buffer = "";
      return [line];
    }
    return [];
  }

  public getBuffered(): string {
    return this.buffer;
  }
}

export interface ParsedSentinelRecord {
  teamCount: number;
  membersCount: number;
  lsidBase64: string;
}

export function parseTransactionStagedLine(line: string): ParsedSentinelRecord | null {
  const match =
    /^CHAOS_TRANSACTION_STAGED:teamCount=(\d+):membersCount=(\d+):lsid=([A-Za-z0-9+/=]+)/.exec(
      line.trim()
    );
  if (!match) return null;
  return {
    teamCount: Number(match[1]),
    membersCount: Number(match[2]),
    lsidBase64: match[3],
  };
}

export function reconstructSessionBinary(lsidBase64: string): mongoose.mongo.Binary | null {
  if (!lsidBase64 || typeof lsidBase64 !== "string") return null;

  let base64Val = lsidBase64.trim();
  try {
    const decoded = JSON.parse(Buffer.from(base64Val, "base64").toString("utf-8"));
    if (decoded && typeof decoded.id === "string") {
      base64Val = decoded.id.trim();
    }
  } catch {
    // Raw base64 string
  }

  try {
    const buf = Buffer.from(base64Val, "base64");
    // Standard MongoDB Logical Session ID is a 16-byte UUID binary subtype 4
    if (buf.length !== 16) {
      return null;
    }
    return new mongoose.mongo.Binary(buf, 4);
  } catch {
    return null;
  }
}

// ==============================================================================
// 3. PARENT TEST SUITE (Executed by Vitest test runner)
// ==============================================================================
describe("Bonus Feature 4: Process-Level Join Chaos Test", () => {
  let leaderUser: IUser;
  let leaderToken: string;
  let candidateUser: IUser;
  let candidateToken: string;
  let testHackathon: IHackathon;
  let testTeam: ITeam;

  const spawnedProcesses: ChildProcess[] = [];
  const activeSockets: ClientSocket[] = [];
  const trackedSessionIds: Array<{ id: mongoose.mongo.Binary }> = [];

  function addTrackedSession(bin: mongoose.mongo.Binary): boolean {
    const hex = Buffer.from(bin.buffer).toString("hex");
    const exists = trackedSessionIds.some((s) => Buffer.from(s.id.buffer).toString("hex") === hex);
    if (!exists) {
      trackedSessionIds.push({ id: bin });
      return true;
    }
    return false;
  }

  // Helper to await server room-join acknowledgment with bounded timeout
  async function joinHackathonRoom(socket: ClientSocket, hackathonId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out awaiting server acknowledgment for join:hackathon"));
      }, 5000);

      socket.emit(
        "join:hackathon",
        { hackathonId },
        (response: { success?: boolean; error?: string }) => {
          clearTimeout(timeout);
          if (response?.success) {
            resolve();
          } else {
            reject(
              new Error(
                `Failed to join hackathon room: ${response?.error || "Unknown server error"}`
              )
            );
          }
        }
      );
    });
  }

  // Helper to spawn an isolated child API process and wait for ready sentinel
  async function spawnChildApi(injectKill: boolean): Promise<{
    child: ChildProcess;
    port: number;
    stdoutLogs: string[];
    stderrLogs: string[];
  }> {
    const scriptPath = fileURLToPath(import.meta.url);
    const apiDir = path.resolve(path.dirname(scriptPath), "..");
    const stdoutLogs: string[] = [];
    const stderrLogs: string[] = [];
    const lineParser = new StreamLineParser();

    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", CHILD_RUNNER_CODE],
      {
        cwd: apiDir,
        env: {
          ...process.env,
          CHAOS_INJECT_KILL: injectKill ? "1" : "0",
          MONGODB_URI: CHAOS_DB_URI,
          MONGODB_DB_NAME: CHAOS_DB_NAME,
          NODE_ENV: "test",
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    spawnedProcesses.push(child);

    let serverPort: number | null = null;
    let readyResolve: ((port: number) => void) | null = null;

    const processLine = (line: string) => {
      // Check for server-ready sentinel
      const match = /CHAOS_SERVER_READY=(\d+)/.exec(line);
      if (match && serverPort === null) {
        serverPort = Number(match[1]);
        if (readyResolve) {
          readyResolve(serverPort);
        }
      }

      // Check for transaction-staged sentinel
      const parsed = parseTransactionStagedLine(line);
      if (parsed) {
        const bin = reconstructSessionBinary(parsed.lsidBase64);
        if (bin) {
          addTrackedSession(bin);
        }
      }
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdoutLogs.push(text);

      const lines = lineParser.push(text);
      for (const line of lines) {
        processLine(line);
      }
    });

    child.stdout?.on("end", () => {
      const remaining = lineParser.flush();
      for (const line of remaining) {
        processLine(line);
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderrLogs.push(chunk.toString());
    });

    const port = await new Promise<number>((resolve, reject) => {
      if (serverPort !== null) {
        resolve(serverPort);
        return;
      }

      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`Timed out waiting for child server startup: ${stderrLogs.join("")}`));
      }, 15000);

      readyResolve = (p: number) => {
        clearTimeout(timeout);
        resolve(p);
      };

      child.on("exit", (code, signal) => {
        clearTimeout(timeout);
        if (serverPort === null) {
          reject(
            new Error(
              `Child exited prematurely with code ${code} (${signal}): ${stderrLogs.join("")}`
            )
          );
        }
      });
    });

    return { child, port, stdoutLogs, stderrLogs };
  }

  beforeAll(async () => {
    // Ensure any previous connection is closed so we connect cleanly to the chaos database
    await disconnectDatabase();

    // Connect directly to the dedicated chaos database from parent to seed fixtures and verify invariants
    await connectToDatabase(CHAOS_DB_URI);

    // Hard safety check: refuse to operate on anything other than the dedicated chaos database
    if (mongoose.connection.name !== CHAOS_DB_NAME) {
      throw new Error(
        `SAFETY BLOCK: Refusing to seed non-chaos database '${mongoose.connection.name}'`
      );
    }

    // Drop any prior residue and establish clean indexes
    await mongoose.connection.db?.dropDatabase();
    await ensureAllIndexes();

    const passwordHash = await User.hashPassword("ChaosPassword123!");

    // Seed test hackathon with team capacity of 2
    testHackathon = await Hackathon.create({
      slug: `chaos-hackathon-${Date.now()}`,
      title: "Chaos Test Hackathon 2026",
      description: "Verifying process crash consistency during transactional membership joins",
      minTeamSize: 1,
      maxTeamSize: 2,
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Seed leader
    leaderUser = await User.create({
      email: `leader-${Date.now()}@chaos-test.com`,
      passwordHash,
      displayName: "Squad Leader",
      skills: ["Rust", "Distributed Systems"],
      status: "ACTIVE",
    });
    leaderToken = AuthService.generateToken(leaderUser);

    // Seed squad with capacity 2 and 1 current member (the leader)
    testTeam = await Team.create({
      hackathonId: testHackathon._id,
      leaderId: leaderUser._id,
      name: `Chaos Squad ${Date.now()}`,
      tagline: "Crash proof systems",
      description: "Testing process termination mid-transaction",
      skillsNeeded: ["TypeScript"],
      memberCount: 1,
      maxCapacity: 2,
      isOpen: true,
      status: "ACTIVE",
    });

    // Seed leader's active membership
    await Membership.create({
      hackathonId: testHackathon._id,
      teamId: testTeam._id,
      userId: leaderUser._id,
      role: "LEADER",
      status: "ACTIVE",
      joinedAt: new Date(),
    });

    // Seed candidate user who will attempt to claim the second (and final) seat
    candidateUser = await User.create({
      email: `candidate-${Date.now()}@chaos-test.com`,
      passwordHash,
      displayName: "Candidate User",
      skills: ["TypeScript", "MongoDB"],
      status: "ACTIVE",
    });
    candidateToken = AuthService.generateToken(candidateUser);
  });

  afterAll(async () => {
    // 1. Terminate all spawned child processes
    for (const proc of spawnedProcesses) {
      try {
        proc.kill("SIGKILL");
      } catch {
        // Ignored
      }
    }

    // 2. Disconnect all active spectator sockets
    for (const socket of activeSockets) {
      try {
        if (socket.connected) {
          socket.disconnect();
        }
      } catch {
        // Ignored
      }
    }

    // 3. Best-effort killSessions cleanup strictly scoped to this test's tracked sessions
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === CHAOS_DB_NAME) {
      try {
        const adminDb = mongoose.connection.db?.admin();
        if (adminDb && trackedSessionIds.length > 0) {
          await adminDb.command({ killSessions: trackedSessionIds });
        }
      } catch (err) {
        console.warn("Teardown killSessions warning:", err);
      }
    }

    // 4. Drop disposable chaos database safely
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === CHAOS_DB_NAME) {
      try {
        await mongoose.connection.db?.dropDatabase();
      } catch (err) {
        console.warn("Teardown dropDatabase warning:", err);
      }
    }

    // 5. Disconnect and restore environment
    await disconnectDatabase();
    (env as any).MONGODB_DB_NAME = previousDbName;
    process.env.MONGODB_DB_NAME = previousDbName;
    await closeSocketServer();
  }, 30000);

  it("terminates API process mid-transaction, proves MongoDB aborts uncommitted writes, and recovers cleanly on restart", async () => {
    // -------------------------------------------------------------------------
    // Phase 1: Baseline Verification
    // -------------------------------------------------------------------------
    const initialTeam = await Team.findById(testTeam._id);
    expect(initialTeam?.memberCount).toBe(1);
    expect(initialTeam?.isOpen).toBe(true);

    const initialMemberships = await Membership.find({ teamId: testTeam._id });
    expect(initialMemberships).toHaveLength(1);
    expect(initialMemberships[0].userId.toString()).toBe(leaderUser._id.toString());

    // -------------------------------------------------------------------------
    // Phase 2: Start Child API Server with Deterministic Crash Hook
    // -------------------------------------------------------------------------
    const { child: crashingChild, port: crashingPort, stdoutLogs } = await spawnChildApi(true);

    // Connect a spectator WebSocket client to the crashing server
    const spectatorSocket: ClientSocket = ioClient(`http://127.0.0.1:${crashingPort}`, {
      auth: { token: leaderToken },
      transports: ["websocket"],
      reconnection: false,
    });
    activeSockets.push(spectatorSocket);

    const realtimeEventsReceived: any[] = [];
    await new Promise<void>((resolve) => {
      spectatorSocket.on("connect", () => resolve());
    });

    spectatorSocket.onAny((eventName, payload) => {
      realtimeEventsReceived.push({ eventName, payload });
    });

    // Synchronously await server acknowledgment that spectator joined the hackathon room
    await joinHackathonRoom(spectatorSocket, testHackathon._id.toString());

    // -------------------------------------------------------------------------
    // Phase 3: Initiate Direct Join & Witness Deterministic SIGKILL Crash
    // -------------------------------------------------------------------------
    const idempotencyKey = new Types.ObjectId().toString();

    // Trigger HTTP join request. This is expected to terminate abruptly when the server dies.
    let httpRequestFailed = false;
    try {
      await fetch(`http://127.0.0.1:${crashingPort}/api/v1/teams/${testTeam._id}/join`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${candidateToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
      });
    } catch {
      httpRequestFailed = true;
    }
    expect(httpRequestFailed).toBe(true);

    // Await child process exit
    const childExitResult = await new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
    }>((resolve) => {
      if (crashingChild.killed || crashingChild.exitCode !== null) {
        resolve({ code: crashingChild.exitCode, signal: crashingChild.signalCode });
      } else {
        crashingChild.once("exit", (code, signal) => resolve({ code, signal }));
      }
    });

    // Verify process termination
    expect(childExitResult.code !== 0 || childExitResult.signal === "SIGKILL").toBe(true);

    // Verify the stdout sentinel confirming writes were staged in the uncommitted transaction buffer
    const allStdout = stdoutLogs.join("");
    expect(allStdout).toContain("CHAOS_TRANSACTION_STAGED:teamCount=2:membersCount=2");

    spectatorSocket.disconnect();

    // -------------------------------------------------------------------------
    // Phase 4: Database Consistency & Rollback Invariant Assertions
    // -------------------------------------------------------------------------
    // Abort the orphaned session left behind on MongoDB by the killed child process
    const adminDb = mongoose.connection.db?.admin();
    if (adminDb && trackedSessionIds.length > 0) {
      try {
        await adminDb.command({ killSessions: trackedSessionIds });
      } catch (err) {
        console.warn("Phase 4 killSessions warning:", err);
      }
    }

    // Poll the isolated database to allow WiredTiger to process the session abort
    const pollDeadline = Date.now() + 5000;
    let freshTeamState = await Team.findById(testTeam._id);
    let candidateMembership = await Membership.findOne({
      teamId: testTeam._id,
      userId: candidateUser._id,
    });

    while (Date.now() < pollDeadline) {
      freshTeamState = await Team.findById(testTeam._id);
      candidateMembership = await Membership.findOne({
        teamId: testTeam._id,
        userId: candidateUser._id,
      });

      if (freshTeamState?.memberCount === 1 && candidateMembership === null) {
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    // Invariant 1: Team member count rolled back to 1 (NOT 2)
    expect(freshTeamState?.memberCount).toBe(1);

    // Invariant 2: Candidate has NO active membership record (no phantom participant)
    expect(candidateMembership).toBeNull();

    // Invariant 3: Total memberships for the team remains exactly 1 (leader only)
    const postCrashMemberships = await Membership.find({ teamId: testTeam._id });
    expect(postCrashMemberships).toHaveLength(1);
    expect(postCrashMemberships[0].userId.toString()).toBe(leaderUser._id.toString());

    // Invariant 4: Team capacity and open status remain valid for future applications
    expect(freshTeamState?.isOpen).toBe(true);
    expect(freshTeamState?.memberCount).toBeLessThan(freshTeamState?.maxCapacity || 0);

    // Invariant 5: No MEMBER_JOINED audit log was committed
    const auditLogs = await AuditLog.find({
      teamId: testTeam._id,
      action: "MEMBER_JOINED",
    });
    expect(auditLogs).toHaveLength(0);

    // Invariant 6: Realtime events: spectator received ZERO member-joined events before the crash
    const memberJoinedEvents = realtimeEventsReceived.filter(
      (e) => e.eventName === "member:joined" || e.eventName === "team:capacity_updated"
    );
    expect(memberJoinedEvents).toHaveLength(0);

    // -------------------------------------------------------------------------
    // Phase 5: Server Restart & Successful Recovery Execution
    // -------------------------------------------------------------------------
    // Allow MongoDB replica set to complete connection reaper and abort the killed session
    await new Promise((r) => setTimeout(r, 1000));

    // Spawn fresh recovery child API process against the same database (clean mode)
    const {
      child: recoveryChild,
      port: recoveryPort,
      stderrLogs: recoveryStderrLogs,
    } = await spawnChildApi(false);

    // Connect a fresh spectator client to the recovered server
    const recoverySpectator: ClientSocket = ioClient(`http://127.0.0.1:${recoveryPort}`, {
      auth: { token: leaderToken },
      transports: ["websocket"],
      reconnection: false,
    });
    activeSockets.push(recoverySpectator);

    const recoveryEvents: any[] = [];
    await new Promise<void>((resolve) => {
      recoverySpectator.on("connect", () => resolve());
    });

    recoverySpectator.on("team:capacity_updated", (payload) => {
      recoveryEvents.push(payload);
    });

    // Synchronously await server acknowledgment that spectator joined the hackathon room
    await joinHackathonRoom(recoverySpectator, testHackathon._id.toString());

    // Candidate retries direct join through the recovered server with resilient retry on CONCURRENCY_CONFLICT
    let retryRes!: Response;
    let retryBody: any;
    const retryDeadline = Date.now() + 10000;

    while (Date.now() < retryDeadline) {
      const retryIdempotencyKey = new Types.ObjectId().toString();
      retryRes = await fetch(`http://127.0.0.1:${recoveryPort}/api/v1/teams/${testTeam._id}/join`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${candidateToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": retryIdempotencyKey,
        },
      });

      if (retryRes.status === 201) {
        retryBody = await retryRes.json();
        break;
      }

      if (retryRes.status === 409) {
        // WiredTiger transaction locks from killed process are still being finalized; brief backoff
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      break;
    }

    if (retryRes.status !== 201) {
      console.error(
        "RETRY_FAILED_BODY:",
        retryRes.status,
        await retryRes.text(),
        "STDERR:",
        recoveryStderrLogs.join("")
      );
    }

    expect(retryRes.status).toBe(201);
    expect(retryBody.success).toBe(true);
    expect(retryBody.data.currentMemberCount).toBe(2);
    expect(retryBody.data.role).toBe("MEMBER");

    // -------------------------------------------------------------------------
    // Phase 6: Post-Recovery Integrity Assertions
    // -------------------------------------------------------------------------
    const finalTeam = await Team.findById(testTeam._id);
    expect(finalTeam?.memberCount).toBe(2);

    const finalMemberships = await Membership.find({ teamId: testTeam._id });
    expect(finalMemberships).toHaveLength(2);

    const candidateDoc = await Membership.findOne({
      teamId: testTeam._id,
      userId: candidateUser._id,
    });
    expect(candidateDoc).not.toBeNull();
    expect(candidateDoc?.role).toBe("MEMBER");
    expect(candidateDoc?.status).toBe("ACTIVE");

    // Audit log was legitimately created on successful commit
    const finalAuditLogs = await AuditLog.find({
      teamId: testTeam._id,
      action: "MEMBER_JOINED",
    });
    expect(finalAuditLogs).toHaveLength(1);

    // Await realtime event on the spectator socket
    await new Promise((r) => setTimeout(r, 200));
    expect(recoveryEvents.length).toBeGreaterThanOrEqual(1);
    expect(recoveryEvents[0].memberCount).toBe(2);

    recoverySpectator.disconnect();
    recoveryChild.kill("SIGKILL");
  }, 60000);

  // ---------------------------------------------------------------------------
  // Unit Verification: Persistent Stream Buffer & Chunk-Boundary Parser
  // ---------------------------------------------------------------------------
  describe("Persistent stdout buffer and chunk-boundary parser unit tests", () => {
    it("parses a sentinel arriving in a single complete chunk", () => {
      const parser = new StreamLineParser();
      const mockUuid = Buffer.from("0123456789abcdef", "utf-8"); // 16 bytes
      const b64 = mockUuid.toString("base64");
      const line = `CHAOS_TRANSACTION_STAGED:teamCount=2:membersCount=2:lsid=${b64}\n`;

      const lines = parser.push(line);
      expect(lines).toHaveLength(1);

      const parsed = parseTransactionStagedLine(lines[0]);
      expect(parsed).not.toBeNull();
      expect(parsed?.teamCount).toBe(2);
      expect(parsed?.membersCount).toBe(2);

      const bin = reconstructSessionBinary(parsed!.lsidBase64);
      expect(bin).not.toBeNull();
      expect(bin?.sub_type).toBe(4);
      expect(Buffer.from(bin!.buffer).toString("hex")).toBe(mockUuid.toString("hex"));
    });

    it("reassembles a sentinel split across multiple chunk boundaries", () => {
      const parser = new StreamLineParser();
      const mockUuid = Buffer.from("abcdef0123456789", "utf-8"); // 16 bytes
      const b64 = mockUuid.toString("base64");
      const fullLine = `CHAOS_TRANSACTION_STAGED:teamCount=2:membersCount=2:lsid=${b64}\n`;

      // Split across 3 arbitrary chunk slices
      const part1 = fullLine.slice(0, 15);
      const part2 = fullLine.slice(15, 35);
      const part3 = fullLine.slice(35);

      expect(parser.push(part1)).toHaveLength(0);
      expect(parser.push(part2)).toHaveLength(0);
      const finalLines = parser.push(part3);

      expect(finalLines).toHaveLength(1);
      const parsed = parseTransactionStagedLine(finalLines[0]);
      expect(parsed).not.toBeNull();
      expect(parsed?.teamCount).toBe(2);

      const bin = reconstructSessionBinary(parsed!.lsidBase64);
      expect(bin).not.toBeNull();
      expect(Buffer.from(bin!.buffer).toString("hex")).toBe(mockUuid.toString("hex"));
    });

    it("extracts multiple sentinels arriving in a single chunk", () => {
      const parser = new StreamLineParser();
      const uuid1 = Buffer.from("1111222233334444", "utf-8");
      const uuid2 = Buffer.from("5555666677778888", "utf-8");
      const b64_1 = uuid1.toString("base64");
      const b64_2 = uuid2.toString("base64");

      const chunk =
        `CHAOS_SERVER_READY=55432\n` +
        `CHAOS_TRANSACTION_STAGED:teamCount=2:membersCount=2:lsid=${b64_1}\n` +
        `CHAOS_TRANSACTION_STAGED:teamCount=2:membersCount=2:lsid=${b64_2}\n`;

      const lines = parser.push(chunk);
      expect(lines).toHaveLength(3);

      const parsed1 = parseTransactionStagedLine(lines[1]);
      const parsed2 = parseTransactionStagedLine(lines[2]);
      expect(parsed1).not.toBeNull();
      expect(parsed2).not.toBeNull();

      const bin1 = reconstructSessionBinary(parsed1!.lsidBase64);
      const bin2 = reconstructSessionBinary(parsed2!.lsidBase64);
      expect(bin1).not.toBeNull();
      expect(bin2).not.toBeNull();
      expect(Buffer.from(bin1!.buffer).toString("hex")).toBe(uuid1.toString("hex"));
      expect(Buffer.from(bin2!.buffer).toString("hex")).toBe(uuid2.toString("hex"));
    });

    it("flushes and processes an incomplete trailing chunk on stream close", () => {
      const parser = new StreamLineParser();
      const mockUuid = Buffer.from("9999888877776666", "utf-8");
      const b64 = mockUuid.toString("base64");
      const lineWithoutNewline = `CHAOS_TRANSACTION_STAGED:teamCount=2:membersCount=2:lsid=${b64}`;

      const lines1 = parser.push(lineWithoutNewline);
      expect(lines1).toHaveLength(0);
      expect(parser.getBuffered()).toBe(lineWithoutNewline);

      const flushed = parser.flush();
      expect(flushed).toHaveLength(1);
      expect(parser.getBuffered()).toBe("");

      const parsed = parseTransactionStagedLine(flushed[0]);
      expect(parsed).not.toBeNull();
      const bin = reconstructSessionBinary(parsed!.lsidBase64);
      expect(bin).not.toBeNull();
      expect(Buffer.from(bin!.buffer).toString("hex")).toBe(mockUuid.toString("hex"));
    });

    it("validates session ID length and avoids duplicate tracking", () => {
      const testTracker: Array<{ id: mongoose.mongo.Binary }> = [];
      const addTestSession = (bin: mongoose.mongo.Binary) => {
        const hex = Buffer.from(bin.buffer).toString("hex");
        if (!testTracker.some((s) => Buffer.from(s.id.buffer).toString("hex") === hex)) {
          testTracker.push({ id: bin });
          return true;
        }
        return false;
      };

      const validUuid = Buffer.from("1234567812345678", "utf-8"); // 16 bytes
      const bin1 = reconstructSessionBinary(validUuid.toString("base64"));
      const bin2 = reconstructSessionBinary(validUuid.toString("base64"));
      expect(bin1).not.toBeNull();
      expect(bin2).not.toBeNull();

      expect(addTestSession(bin1!)).toBe(true);
      expect(addTestSession(bin2!)).toBe(false); // Duplicate rejected
      expect(testTracker).toHaveLength(1);

      // Invalid lengths rejected
      const invalidShort = Buffer.from("short", "utf-8"); // 5 bytes
      const invalidLong = Buffer.from("this_is_too_long_for_uuid", "utf-8"); // 25 bytes
      expect(reconstructSessionBinary(invalidShort.toString("base64"))).toBeNull();
      expect(reconstructSessionBinary(invalidLong.toString("base64"))).toBeNull();
      expect(reconstructSessionBinary("")).toBeNull();
      expect(reconstructSessionBinary("invalid_base64!@#$")).toBeNull();
    });
  });
});
