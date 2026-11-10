import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { Types } from "mongoose";
import { app } from "../src/app.js";
import { initSocketServer, closeSocketServer, EventDispatcher } from "../src/realtime/index.js";
import { AuthService } from "../src/services/auth.service.js";
import { SeatReservationService } from "../src/services/seat-reservation.service.js";
import { TeamService } from "../src/services/team.service.js";
import { User, Hackathon, Team, Membership, AuditLog, type IUser } from "../src/models/index.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";
import {
  REALTIME_EVENTS,
  type JoinRequestSubmittedPayload,
  type TeamMemberJoinedPayload,
  type TeamCapacityUpdatedPayload,
  type TeamDisbandedPayload,
} from "@crewconnect/shared";
import { AppError } from "../src/errors/AppError.js";

interface RoomAck {
  success: boolean;
  error?: string;
}

describe("Phase 6: Real-Time Event Dispatching & Socket Authorization Test Suite", () => {
  let server: http.Server;
  let serverUrl: string;
  let testHackathonId: string;

  let leaderUser: IUser;
  let leaderToken: string;

  let memberUser: IUser;

  let outsiderUser: IUser;
  let outsiderToken: string;

  const openClients: ClientSocket[] = [];

  function createClient(token?: string, extraOptions = {}): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const client = ioClient(serverUrl, {
        auth: token ? { token } : undefined,
        transports: ["websocket"],
        reconnection: false,
        timeout: 5000,
        ...extraOptions,
      });

      openClients.push(client);

      client.on("connect", () => resolve(client));
      client.on("connect_error", (err) => reject(err));
    });
  }

  beforeAll(async () => {
    await connectToDatabase();
    await User.syncIndexes();
    await Team.syncIndexes();
    await Membership.syncIndexes();
    await Hackathon.syncIndexes();
    await AuditLog.syncIndexes();

    server = http.createServer(app);
    initSocketServer(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    for (const client of openClients) {
      if (client.connected) {
        client.disconnect();
      }
    }
    await closeSocketServer();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    await User.deleteMany({ email: /@test-realtime\.com$/ });
    await Hackathon.deleteMany({ slug: /realtime-hackathon-/ });
    if (testHackathonId) {
      await Team.deleteMany({ hackathonId: testHackathonId });
      await Membership.deleteMany({ hackathonId: testHackathonId });
      await AuditLog.deleteMany({ hackathonId: testHackathonId });
    }
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await User.deleteMany({ email: /@test-realtime\.com$/ });
    await Hackathon.deleteMany({ slug: /realtime-hackathon-/ });
    await Team.deleteMany({ name: /Realtime Team/ });
    await Membership.deleteMany({});
    await AuditLog.deleteMany({});

    const hackathon = await Hackathon.create({
      slug: `realtime-hackathon-${Date.now()}`,
      title: "Realtime Testing Hackathon",
      description: "Realtime testing hackathon instance",
      minTeamSize: 1,
      maxTeamSize: 4,
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    testHackathonId = hackathon._id.toString();

    leaderUser = await User.create({
      email: `leader-${Date.now()}@test-realtime.com`,
      displayName: "Realtime Leader",
      passwordHash: "dummy-hash",
      status: "ACTIVE",
      tokenVersion: 0,
      skills: ["TypeScript", "React"],
    });
    leaderToken = AuthService.generateToken(leaderUser);

    memberUser = await User.create({
      email: `member-${Date.now()}@test-realtime.com`,
      displayName: "Realtime Member",
      passwordHash: "dummy-hash",
      status: "ACTIVE",
      tokenVersion: 0,
      skills: ["Node.js", "MongoDB"],
    });

    outsiderUser = await User.create({
      email: `outsider-${Date.now()}@test-realtime.com`,
      displayName: "Realtime Outsider",
      passwordHash: "dummy-hash",
      status: "ACTIVE",
      tokenVersion: 0,
      skills: ["Python", "Docker"],
    });
    outsiderToken = AuthService.generateToken(outsiderUser);
  });

  describe("1. Socket Authentication & Connection Verification", () => {
    it("rejects connection when no token is provided", async () => {
      await expect(createClient()).rejects.toThrow(/UNAUTHORIZED: Authentication token required/);
    });

    it("rejects connection when token is invalid or corrupted", async () => {
      await expect(createClient("invalid-corrupted-token")).rejects.toThrow(/UNAUTHORIZED/);
    });

    it("rejects connection if user token version does not match database (revoked session)", async () => {
      const revokedToken = AuthService.generateToken({
        ...leaderUser.toObject(),
        tokenVersion: 999,
      });
      await expect(createClient(revokedToken)).rejects.toThrow(/UNAUTHORIZED: Session revoked/);
    });

    it("successfully connects with valid JWT auth token and auto-joins user private room", async () => {
      const client = await createClient(leaderToken);
      expect(client.connected).toBe(true);

      const receivedDirectEvent = new Promise<JoinRequestSubmittedPayload>((resolve) => {
        client.on(REALTIME_EVENTS.JOIN_REQUEST_SUBMITTED, (data: JoinRequestSubmittedPayload) =>
          resolve(data)
        );
      });

      EventDispatcher.dispatchJoinRequestSubmitted(leaderUser._id.toString(), {
        requestId: new Types.ObjectId().toString(),
        teamId: new Types.ObjectId().toString(),
        hackathonId: testHackathonId,
        user: { id: outsiderUser._id.toString(), displayName: "Realtime Outsider", skills: [] },
        message: "Hello Leader",
        timestamp: new Date().toISOString(),
      });

      const payload = await receivedDirectEvent;
      expect(payload.message).toBe("Hello Leader");
      expect(payload.user.displayName).toBe("Realtime Outsider");
    });
  });

  describe("2. Room Authorization & Isolation (Least-Privilege)", () => {
    it("allows active team member to join team room", async () => {
      const { team } = await TeamService.createTeam(testHackathonId, leaderUser._id.toString(), {
        name: "Realtime Team Alpha",
        tagline: "Alpha Team",
        maxCapacity: 4,
      });

      const client = await createClient(leaderToken);

      const ackResponse = await new Promise<RoomAck>((resolve) => {
        client.emit("join:team", { teamId: team._id.toString() }, (res: RoomAck) => resolve(res));
      });

      expect(ackResponse.success).toBe(true);
    });

    it("rejects outsider attempting to join private team room (FORBIDDEN)", async () => {
      const { team } = await TeamService.createTeam(testHackathonId, leaderUser._id.toString(), {
        name: "Realtime Team Beta",
        tagline: "Beta Team",
        maxCapacity: 4,
      });

      const client = await createClient(outsiderToken);

      const ackResponse = await new Promise<RoomAck>((resolve) => {
        client.emit("join:team", { teamId: team._id.toString() }, (res: RoomAck) => resolve(res));
      });

      expect(ackResponse.success).toBe(false);
      expect(ackResponse.error).toContain("FORBIDDEN: Must be an active member");
    });

    it("allows any authenticated user to join valid hackathon room", async () => {
      const client = await createClient(outsiderToken);

      const ackResponse = await new Promise<RoomAck>((resolve) => {
        client.emit("join:hackathon", { hackathonId: testHackathonId }, (res: RoomAck) =>
          resolve(res)
        );
      });

      expect(ackResponse.success).toBe(true);
    });

    it("rejects joining non-existent hackathon room", async () => {
      const client = await createClient(outsiderToken);
      const fakeHackathonId = new Types.ObjectId().toString();

      const ackResponse = await new Promise<RoomAck>((resolve) => {
        client.emit("join:hackathon", { hackathonId: fakeHackathonId }, (res: RoomAck) =>
          resolve(res)
        );
      });

      expect(ackResponse.success).toBe(false);
      expect(ackResponse.error).toContain("NOT_FOUND");
    });
  });

  describe("3. Post-Commit Event Delivery Invariant", () => {
    it("emits TEAM_MEMBER_JOINED to team room and TEAM_CAPACITY_UPDATED to hackathon room strictly post-commit", async () => {
      const { team } = await TeamService.createTeam(testHackathonId, leaderUser._id.toString(), {
        name: "Realtime Team Gamma",
        tagline: "Gamma Team",
        maxCapacity: 3,
      });

      const leaderClient = await createClient(leaderToken);
      await new Promise<RoomAck>((resolve) => {
        leaderClient.emit("join:team", { teamId: team._id.toString() }, (res: RoomAck) =>
          resolve(res)
        );
      });

      const spectatorClient = await createClient(outsiderToken);
      await new Promise<RoomAck>((resolve) => {
        spectatorClient.emit("join:hackathon", { hackathonId: testHackathonId }, (res: RoomAck) =>
          resolve(res)
        );
      });

      const teamEventPromise = new Promise<TeamMemberJoinedPayload>((resolve) => {
        leaderClient.on(REALTIME_EVENTS.TEAM_MEMBER_JOINED, (data: TeamMemberJoinedPayload) =>
          resolve(data)
        );
      });

      const capacityEventPromise = new Promise<TeamCapacityUpdatedPayload>((resolve) => {
        spectatorClient.on(
          REALTIME_EVENTS.TEAM_CAPACITY_UPDATED,
          (data: TeamCapacityUpdatedPayload) => resolve(data)
        );
      });

      await SeatReservationService.reserveSeatAndJoin({
        teamId: team._id.toString(),
        userId: memberUser._id.toString(),
        action: "MEMBER_JOINED",
      });

      const [teamPayload, capacityPayload] = await Promise.all([
        teamEventPromise,
        capacityEventPromise,
      ]);

      expect(teamPayload.teamId).toBe(team._id.toString());
      expect(teamPayload.member.userId).toBe(memberUser._id.toString());
      expect(teamPayload.memberCount).toBe(2);
      expect(teamPayload.maxCapacity).toBe(3);

      expect(capacityPayload.teamId).toBe(team._id.toString());
      expect(capacityPayload.memberCount).toBe(2);
      expect(capacityPayload.maxCapacity).toBe(3);
      expect(capacityPayload.isOpen).toBe(true);
    });

    it("emits TEAM_DISBANDED and TEAM_CAPACITY_UPDATED post-commit when team is disbanded", async () => {
      const { team } = await TeamService.createTeam(testHackathonId, leaderUser._id.toString(), {
        name: "Realtime Team Delta",
        tagline: "Delta Team",
        maxCapacity: 3,
      });

      const leaderClient = await createClient(leaderToken);
      await new Promise<RoomAck>((resolve) => {
        leaderClient.emit("join:team", { teamId: team._id.toString() }, (res: RoomAck) =>
          resolve(res)
        );
      });

      const disbandedPromise = new Promise<TeamDisbandedPayload>((resolve) => {
        leaderClient.on(REALTIME_EVENTS.TEAM_DISBANDED, (data: TeamDisbandedPayload) =>
          resolve(data)
        );
      });

      await TeamService.disbandTeam(team._id.toString(), leaderUser._id.toString());

      const disbandedPayload = await disbandedPromise;
      expect(disbandedPayload.teamId).toBe(team._id.toString());
      expect(disbandedPayload.disbandedBy).toBe(leaderUser._id.toString());
    });
  });

  describe("4. Transaction Rollback & Uncertainty Isolation Invariant", () => {
    it("never emits a socket event when a database transaction is aborted / rolled back", async () => {
      const { team } = await TeamService.createTeam(testHackathonId, leaderUser._id.toString(), {
        name: "Realtime Team Epsilon",
        tagline: "Epsilon Team",
        maxCapacity: 2,
      });

      const leaderClient = await createClient(leaderToken);
      await new Promise<RoomAck>((resolve) => {
        leaderClient.emit("join:team", { teamId: team._id.toString() }, (res: RoomAck) =>
          resolve(res)
        );
      });

      let eventReceived = false;
      leaderClient.on(REALTIME_EVENTS.TEAM_MEMBER_JOINED, () => {
        eventReceived = true;
      });

      await expect(
        SeatReservationService.reserveSeatAndJoin({
          teamId: team._id.toString(),
          userId: memberUser._id.toString(),
          action: "MEMBER_JOINED",
          onBeforeCommit: async () => {
            throw new Error("Simulated transactional pre-commit failure");
          },
        })
      ).rejects.toThrow("Simulated transactional pre-commit failure");

      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(eventReceived).toBe(false);

      const freshTeam = await Team.findById(team._id);
      expect(freshTeam?.memberCount).toBe(1);
    });

    it("never emits a socket event when transaction commit is uncertain", async () => {
      const { team } = await TeamService.createTeam(testHackathonId, leaderUser._id.toString(), {
        name: "Realtime Team Zeta",
        tagline: "Zeta Team",
        maxCapacity: 2,
      });

      const leaderClient = await createClient(leaderToken);
      await new Promise<RoomAck>((resolve) => {
        leaderClient.emit("join:team", { teamId: team._id.toString() }, (res: RoomAck) =>
          resolve(res)
        );
      });

      let eventReceived = false;
      leaderClient.on(REALTIME_EVENTS.TEAM_MEMBER_JOINED, () => {
        eventReceived = true;
      });

      await expect(
        SeatReservationService.reserveSeatAndJoin({
          teamId: team._id.toString(),
          userId: memberUser._id.toString(),
          action: "MEMBER_JOINED",
          onBeforeCommit: async () => {
            throw AppError.commitUncertain("Commit outcome uncertain");
          },
        })
      ).rejects.toThrow("Commit outcome uncertain");

      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(eventReceived).toBe(false);
    });

    it("does not emit duplicate events when transaction retries transient write conflicts", async () => {
      const { team } = await TeamService.createTeam(testHackathonId, leaderUser._id.toString(), {
        name: "Realtime Team Eta",
        tagline: "Eta Team",
        maxCapacity: 3,
      });

      const leaderClient = await createClient(leaderToken);
      await new Promise<RoomAck>((resolve) => {
        leaderClient.emit("join:team", { teamId: team._id.toString() }, (res: RoomAck) =>
          resolve(res)
        );
      });

      let eventCount = 0;
      leaderClient.on(REALTIME_EVENTS.TEAM_MEMBER_JOINED, () => {
        eventCount += 1;
      });

      let attempts = 0;
      await SeatReservationService.reserveSeatAndJoin({
        teamId: team._id.toString(),
        userId: memberUser._id.toString(),
        action: "MEMBER_JOINED",
        onBeforeCommit: async () => {
          attempts += 1;
          if (attempts === 1) {
            const transientErr = new Error("WriteConflict in session") as Error & {
              errorLabels?: string[];
            };
            transientErr.errorLabels = ["TransientTransactionError"];
            throw transientErr;
          }
        },
      });

      expect(attempts).toBe(2);

      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(eventCount).toBe(1);
    });
  });
});
