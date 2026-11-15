/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import type { UserDTO } from "@crewconnect/shared";
import { app } from "../src/app.js";
import { User, Hackathon, Team, Membership } from "../src/models/index.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";
import { resetRateLimitStores } from "../src/middleware/rateLimiter.js";
import { AuthService } from "../src/services/auth.service.js";
import { SeatReservationService } from "../src/services/seat-reservation.service.js";
import { IdempotencyService } from "../src/services/idempotency.service.js";
import { InvitationService } from "../src/services/invitation.service.js";
import { AppError } from "../src/errors/AppError.js";
import { ERROR_CODES } from "@crewconnect/shared";

const TEST_ORIGIN = "http://localhost:5173";

describe("Rate Limiter Security & Production Invariant Enforcement", () => {
  let leaderUser: UserDTO;
  let leaderCookie: string;
  let testHackathonId: string;
  let testTeamId: string;
  let isDbConnected = false;
  const inMemoryUsers = new Map<string, { email: string; password: string; displayName: string }>();

  beforeAll(async () => {
    try {
      await connectToDatabase();
      isDbConnected = true;
    } catch {
      isDbConnected = false;
      // Setup resilient mocks when MongoDB daemon is not running in test environment
      vi.spyOn(AuthService, "register").mockImplementation(async (input) => {
        const normalized = input.email.toLowerCase().trim();
        if (inMemoryUsers.has(normalized)) {
          throw new AppError(ERROR_CODES.EMAIL_ALREADY_EXISTS, "Email exists", 409);
        }
        inMemoryUsers.set(normalized, {
          email: normalized,
          password: input.password,
          displayName: input.displayName,
        });
        const fakeUser = {
          _id: "64b7f8e8a8d6e9f2a8d6e9f2",
          id: "64b7f8e8a8d6e9f2a8d6e9f2",
          email: normalized,
          displayName: input.displayName,
          tokenVersion: 0,
          toJSON: () => ({
            id: "64b7f8e8a8d6e9f2a8d6e9f2",
            email: normalized,
            displayName: input.displayName,
          }),
        } as any;
        return { user: fakeUser, token: "mock_token" };
      });

      vi.spyOn(AuthService, "login").mockImplementation(async (input) => {
        const normalized = input.email.toLowerCase().trim();
        const existing = inMemoryUsers.get(normalized);
        if (!existing || existing.password !== input.password) {
          throw new AppError(ERROR_CODES.INVALID_CREDENTIALS, "Invalid email or password", 401);
        }
        const fakeUser = {
          _id: "64b7f8e8a8d6e9f2a8d6e9f2",
          id: "64b7f8e8a8d6e9f2a8d6e9f2",
          email: normalized,
          displayName: existing.displayName,
          tokenVersion: 0,
          toJSON: () => ({
            id: "64b7f8e8a8d6e9f2a8d6e9f2",
            email: normalized,
            displayName: existing.displayName,
          }),
        } as any;
        return { user: fakeUser, token: "mock_token" };
      });

      vi.spyOn(AuthService, "verifyToken").mockImplementation(() => ({
        id: "64b7f8e8a8d6e9f2a8d6e9f2",
        email: "leader@test-ratelimit-suite.com",
        displayName: "Leader User",
        tokenVersion: 0,
      }));

      vi.spyOn(User, "findById").mockImplementation(() =>
        Promise.resolve({
          _id: "64b7f8e8a8d6e9f2a8d6e9f2",
          id: "64b7f8e8a8d6e9f2a8d6e9f2",
          email: "leader@test-ratelimit-suite.com",
          displayName: "Leader User",
          tokenVersion: 0,
          status: "ACTIVE",
          toJSON: () => ({ id: "64b7f8e8a8d6e9f2a8d6e9f2" }),
        } as any)
      );

      vi.spyOn(SeatReservationService, "reserveSeatAndJoin").mockImplementation(async () => {
        throw new AppError(ERROR_CODES.ALREADY_IN_TEAM, "User is already an active member", 409);
      });

      vi.spyOn(IdempotencyService, "acquireLease").mockResolvedValue({
        acquired: true,
        record: { _id: "64b7f8e8a8d6e9f2a8d6e9f3" } as any,
        ownerToken: "mock-token",
      });

      vi.spyOn(IdempotencyService, "releaseLease").mockResolvedValue(undefined as any);

      vi.spyOn(InvitationService, "acceptInvitation").mockImplementation(async () => {
        throw new AppError(ERROR_CODES.INVITATION_INVALID, "Invalid invitation token", 400);
      });

      vi.spyOn(Hackathon, "find").mockImplementation(
        () =>
          ({
            sort: () => Promise.resolve([]),
          }) as any
      );
    }
  });

  afterAll(async () => {
    process.env.NODE_ENV = "test";
    if (isDbConnected) {
      await User.deleteMany({ email: /@test-ratelimit-suite\.com$/ });
      await Hackathon.deleteMany({ slug: /test-ratelimit-hackathon-/ });
      if (testHackathonId) {
        await Team.deleteMany({ hackathonId: testHackathonId });
        await Membership.deleteMany({ hackathonId: testHackathonId });
      }
      await disconnectDatabase();
    }
  });

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    resetRateLimitStores();
    inMemoryUsers.clear();

    if (isDbConnected) {
      await User.deleteMany({ email: /@test-ratelimit-suite\.com$/ });
      await Hackathon.deleteMany({ slug: /test-ratelimit-hackathon-/ });

      const hackathon = await Hackathon.create({
        slug: `test-ratelimit-hackathon-${Date.now()}`,
        title: "Rate Limit Test Hackathon",
        description: "Testing rate limits",
        minTeamSize: 1,
        maxTeamSize: 5,
        status: "ACTIVE",
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      testHackathonId = hackathon._id.toString();

      const leaderRes = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "leader@test-ratelimit-suite.com",
          password: "Password123!",
          displayName: "Leader User",
          skills: ["TypeScript"],
        });
      leaderUser = leaderRes.body.data.user;
      leaderCookie = leaderRes.headers["set-cookie"][0];

      const team = await Team.create({
        hackathonId: testHackathonId,
        leaderId: leaderUser.id,
        name: `Rate Limit Arena Team ${Date.now()}`,
        maxCapacity: 5,
        memberCount: 1,
        isOpen: true,
        status: "ACTIVE",
      });
      testTeamId = team._id.toString();
    } else {
      testHackathonId = "64b7f8e8a8d6e9f2a8d6e9f0";
      testTeamId = "64b7f8e8a8d6e9f2a8d6e9f1";
      leaderUser = {
        id: "64b7f8e8a8d6e9f2a8d6e9f2",
        email: "leader@test-ratelimit-suite.com",
        displayName: "Leader User",
        skills: ["TypeScript"],
        timeZone: "UTC",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      leaderCookie = "token=mock_leader_token; Path=/; HttpOnly";
    }
  });

  it("1. The benchmark bypass header permits high-frequency requests in non-production", async () => {
    process.env.NODE_ENV = "test";

    // Issue 15 consecutive requests with the benchmark bypass header (limit is 10)
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post(`/api/v1/teams/${testTeamId}/join`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .set("Idempotency-Key", `bypass-key-${i}`)
        .set("x-benchmark-bypass", "crewconnect-load-test");

      // Request must NOT be throttled by rate limiter (returns 409 ALREADY_IN_TEAM rather than 429 RATE_LIMITED)
      expect(res.status).not.toBe(429);
      expect(res.body?.error?.code).not.toBe("RATE_LIMITED");
    }
  });

  it("2. The benchmark bypass header is STRICTLY IGNORED in production mode (NODE_ENV=production)", async () => {
    process.env.NODE_ENV = "production";

    try {
      // Send 10 join requests to reach the join limit (10 per minute)
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post(`/api/v1/teams/${testTeamId}/join`)
          .set("Cookie", leaderCookie)
          .set("Origin", TEST_ORIGIN)
          .set("Idempotency-Key", `prod-bypass-key-${i}`)
          .set("x-benchmark-bypass", "crewconnect-load-test");
      }

      // 11th request: even with x-benchmark-bypass, in production it MUST be rejected with 429
      const res = await request(app)
        .post(`/api/v1/teams/${testTeamId}/join`)
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .set("Idempotency-Key", "prod-bypass-key-11")
        .set("x-benchmark-bypass", "crewconnect-load-test");

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("RATE_LIMITED");
      expect(res.headers["retry-after"]).toBeDefined();
    } finally {
      process.env.NODE_ENV = "test";
    }
  });

  it("3. Sensitive join and invitation routes remain rate-limited and return Retry-After", async () => {
    process.env.NODE_ENV = "test";

    // Test invitation accept rate limiting with x-test-rate-limit
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post("/api/v1/invitations/accept")
        .set("Cookie", leaderCookie)
        .set("Origin", TEST_ORIGIN)
        .set("Idempotency-Key", `invite-key-${i}`)
        .set("x-test-rate-limit", "true")
        .send({ token: "crew_invalid_test_token" });
    }

    // 11th request must be rate limited
    const throttled = await request(app)
      .post("/api/v1/invitations/accept")
      .set("Cookie", leaderCookie)
      .set("Origin", TEST_ORIGIN)
      .set("Idempotency-Key", "invite-key-11")
      .set("x-test-rate-limit", "true")
      .send({ token: "crew_invalid_test_token" });

    expect(throttled.status).toBe(429);
    expect(throttled.body.success).toBe(false);
    expect(throttled.body.error.code).toBe("RATE_LIMITED");
    expect(throttled.headers["retry-after"]).toBeDefined();
    expect(Number(throttled.headers["retry-after"])).toBeGreaterThan(0);
  });

  describe("Authentication Abuse Protection & Independent Tiered Policies", () => {
    it("4. Normal successful login: legitimate user logging in multiple times is not blocked", async () => {
      // Create user
      const email = "legit@test-ratelimit-suite.com";
      const password = "ValidPassword123!";
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          email,
          password,
          displayName: "Legit User",
          skills: ["Go"],
        });

      // User logs in 8 consecutive times with correct credentials
      for (let i = 0; i < 8; i++) {
        const res = await request(app)
          .post("/api/v1/auth/login")
          .set("x-test-rate-limit", "true")
          .send({ email, password });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }
    });

    it("5. Incorrect-password attempts: 5 consecutive failed attempts trigger 429 with Retry-After", async () => {
      const email = "target@test-ratelimit-suite.com";
      const password = "TargetPassword123!";
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          email,
          password,
          displayName: "Target User",
          skills: ["Go"],
        });

      // 5 consecutive failed password attempts
      for (let i = 0; i < 5; i++) {
        const failRes = await request(app)
          .post("/api/v1/auth/login")
          .set("x-test-rate-limit", "true")
          .send({ email, password: "WrongPassword999!" });

        expect(failRes.status).toBe(401);
        expect(failRes.body.error.code).toBe("INVALID_CREDENTIALS");
      }

      // 6th attempt should be blocked with 429 RATE_LIMITED
      const blockedRes = await request(app)
        .post("/api/v1/auth/login")
        .set("x-test-rate-limit", "true")
        .send({ email, password: "WrongPassword999!" });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error.code).toBe("RATE_LIMITED");
      expect(blockedRes.body.error.message).toContain("Too many failed login attempts");
      expect(blockedRes.headers["retry-after"]).toBeDefined();
      expect(Number(blockedRes.headers["retry-after"])).toBeGreaterThan(0);
    });

    it("6. Successful authentication resets consecutive failed attempts", async () => {
      const email = "reset-tester@test-ratelimit-suite.com";
      const password = "ValidPassword123!";
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          email,
          password,
          displayName: "Reset Tester",
          skills: ["Rust"],
        });

      // 3 failed attempts
      for (let i = 0; i < 3; i++) {
        const failRes = await request(app)
          .post("/api/v1/auth/login")
          .set("x-test-rate-limit", "true")
          .send({ email, password: "IncorrectPassword!" });
        expect(failRes.status).toBe(401);
      }

      // Successful login on 4th attempt
      const successRes = await request(app)
        .post("/api/v1/auth/login")
        .set("x-test-rate-limit", "true")
        .send({ email, password });
      expect(successRes.status).toBe(200);

      // Now 3 more failed attempts should NOT trigger 429 because the counter was reset on success
      for (let i = 0; i < 3; i++) {
        const afterRes = await request(app)
          .post("/api/v1/auth/login")
          .set("x-test-rate-limit", "true")
          .send({ email, password: "IncorrectPassword!" });
        expect(afterRes.status).toBe(401); // 401, not 429
      }
    });

    it("7. Unregistered-email login: attempts on non-existent account are throttled without revealing user existence", async () => {
      const ghostEmail = "ghost-user-does-not-exist@test-ratelimit-suite.com";

      // 5 consecutive failed attempts on an unregistered email
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post("/api/v1/auth/login")
          .set("x-test-rate-limit", "true")
          .send({ email: ghostEmail, password: "AnyPassword123!" });
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
      }

      // 6th attempt must be rate-limited with 429
      const blockedRes = await request(app)
        .post("/api/v1/auth/login")
        .set("x-test-rate-limit", "true")
        .send({ email: ghostEmail, password: "AnyPassword123!" });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error.code).toBe("RATE_LIMITED");
    });

    it("8. Independent login and registration limits: exhausting registration quota does NOT block login", async () => {
      const email = "shared-ip-user@test-ratelimit-suite.com";
      const password = "ValidPassword123!";
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          email,
          password,
          displayName: "Existing User",
          skills: ["Node.js"],
        });

      // Send 10 registration requests from the same IP to hit registration limit
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post("/api/v1/auth/register")
          .set("x-test-rate-limit", "true")
          .send({
            email: `bulk-${i}@test-ratelimit-suite.com`,
            password: "SecurePassword123!",
            displayName: `Bulk User ${i}`,
            skills: ["Python"],
          });
      }

      // 11th registration is throttled
      const regBlocked = await request(app)
        .post("/api/v1/auth/register")
        .set("x-test-rate-limit", "true")
        .send({
          email: "bulk-11@test-ratelimit-suite.com",
          password: "SecurePassword123!",
          displayName: "Bulk User 11",
          skills: ["Python"],
        });
      expect(regBlocked.status).toBe(429);
      expect(regBlocked.body.error.code).toBe("RATE_LIMITED");

      // Login for the existing user from the same IP MUST STILL SUCCEED!
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .set("x-test-rate-limit", "true")
        .send({ email, password });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });

    it("9. Multiple distinct users sharing an IP: User A's failed attempts do NOT block User B", async () => {
      const userA = "alice@test-ratelimit-suite.com";
      const userB = "bob@test-ratelimit-suite.com";
      const passwordB = "BobPassword123!";

      await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: userB,
          password: passwordB,
          displayName: "Bob",
          skills: ["Docker"],
        });

      // Attacker exhausts failed attempts for User A on this IP
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/api/v1/auth/login")
          .set("x-test-rate-limit", "true")
          .send({ email: userA, password: "WrongAlicePassword!" });
      }

      // User A is now rate-limited on this IP
      const aliceBlocked = await request(app)
        .post("/api/v1/auth/login")
        .set("x-test-rate-limit", "true")
        .send({ email: userA, password: "WrongAlicePassword!" });
      expect(aliceBlocked.status).toBe(429);

      // User B on the SAME IP logging in with their correct password MUST NOT be blocked!
      const bobRes = await request(app)
        .post("/api/v1/auth/login")
        .set("x-test-rate-limit", "true")
        .send({ email: userB, password: passwordB });

      expect(bobRes.status).toBe(200);
      expect(bobRes.body.success).toBe(true);
    });

    it("10. An account targeted by repeated failed attempts can still authenticate legitimately (No global account lockout)", async () => {
      const targetEmail = "targeted-user@test-ratelimit-suite.com";
      const targetPassword = "StrongTargetPassword123!";

      await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: targetEmail,
          password: targetPassword,
          displayName: "Targeted User",
          skills: ["Security"],
        });

      app.set("trust proxy", 1);
      process.env.NODE_ENV = "production";

      try {
        // Attackers from 3 different botnet IPs (IP_1, IP_2, IP_3) fail 4 times each (12 failed attempts total globally against this account)
        for (let bot = 1; bot <= 3; bot++) {
          const botIp = `198.51.100.1${bot}`;
          for (let attempt = 0; attempt < 4; attempt++) {
            const failRes = await request(app)
              .post("/api/v1/auth/login")
              .set("X-Forwarded-For", botIp)
              .send({ email: targetEmail, password: "AttackerBotGuess!" });
            expect(failRes.status).toBe(401);
          }
        }

        // Now the legitimate user on home IP (203.0.113.100) enters their valid password:
        // MUST SUCCEED (200 OK) without being blocked by an account-wide hard lockout!
        const legitimateRes = await request(app)
          .post("/api/v1/auth/login")
          .set("X-Forwarded-For", "203.0.113.100")
          .send({ email: targetEmail, password: targetPassword });

        expect(legitimateRes.status).toBe(200);
        expect(legitimateRes.body.success).toBe(true);
      } finally {
        app.set("trust proxy", false);
        process.env.NODE_ENV = "test";
      }
    });

    it("11. Suspicious registration bursts are restricted without unnecessarily blocking ordinary users", async () => {
      // Rapid burst of 10 registrations
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post("/api/v1/auth/register")
          .set("x-test-rate-limit", "true")
          .send({
            email: `burst-${i}@test-ratelimit-suite.com`,
            password: "ValidPassword123!",
            displayName: `Burst User ${i}`,
            skills: ["React"],
          });
        expect(res.status).toBe(201);
      }

      // 11th rapid registration in the burst window must be blocked with 429 and Retry-After
      const burstBlocked = await request(app)
        .post("/api/v1/auth/register")
        .set("x-test-rate-limit", "true")
        .send({
          email: "burst-11@test-ratelimit-suite.com",
          password: "ValidPassword123!",
          displayName: "Burst User 11",
          skills: ["React"],
        });

      expect(burstBlocked.status).toBe(429);
      expect(burstBlocked.body.error.code).toBe("RATE_LIMITED");
      expect(burstBlocked.body.error.message).toContain("Too many rapid registration attempts");
      expect(burstBlocked.headers["retry-after"]).toBeDefined();
      expect(Number(burstBlocked.headers["retry-after"])).toBeGreaterThan(0);
    });

    it("12. General API browsing does not consume login rate limit quota", async () => {
      const email = "browser-user@test-ratelimit-suite.com";
      const password = "BrowserPassword123!";
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          email,
          password,
          displayName: "Browser User",
          skills: ["Kubernetes"],
        });

      // Make 20 general API requests (e.g. browsing hackathons)
      for (let i = 0; i < 20; i++) {
        const apiRes = await request(app)
          .get("/api/v1/hackathons")
          .set("x-test-rate-limit", "true");
        expect(apiRes.status).toBe(200);
      }

      // Login MUST proceed unhindered by general browsing traffic
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .set("x-test-rate-limit", "true")
        .send({ email, password });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });

    it("13. Proxy IP Trust & Anti-Spoofing: Forwarded IP headers cannot be spoofed to bypass limits", async () => {
      app.set("trust proxy", 1);
      process.env.NODE_ENV = "production";

      const victimEmail = "spoof-target@test-ratelimit-suite.com";
      const victimPassword = "RealSecretPassword123!";
      const attackerRealIp = "198.51.100.99";

      try {
        await request(app)
          .post("/api/v1/auth/register")
          .set("X-Forwarded-For", attackerRealIp)
          .send({
            email: victimEmail,
            password: victimPassword,
            displayName: "Spoof Target",
            skills: ["Security"],
          });

        // Attacker exhausts failed attempts on their real IP
        for (let i = 0; i < 5; i++) {
          const failRes = await request(app)
            .post("/api/v1/auth/login")
            .set("X-Forwarded-For", attackerRealIp)
            .send({ email: victimEmail, password: "AttackerBadGuess!" });
          expect(failRes.status).toBe(401);
        }

        // Attacker is now throttled on attackerRealIp
        const blockedRes = await request(app)
          .post("/api/v1/auth/login")
          .set("X-Forwarded-For", attackerRealIp)
          .send({ email: victimEmail, password: "AttackerBadGuess!" });
        expect(blockedRes.status).toBe(429);

        // Attacker attempts to forge X-Forwarded-For by prepending spoofed IPs (e.g. 8.8.8.8)
        // When behind a single reverse proxy (trust proxy = 1), Express looks 1 hop back from socket,
        // which resolves to the last untrusted IP (attackerRealIp), ignoring prepended spoofed IPs!
        const spoofAttempt = await request(app)
          .post("/api/v1/auth/login")
          .set("X-Forwarded-For", `8.8.8.8, 1.1.1.1, ${attackerRealIp}`)
          .send({ email: victimEmail, password: "AttackerBadGuess!" });

        // The spoof attempt MUST STILL BE BLOCKED with 429 because the real IP was detected!
        expect(spoofAttempt.status).toBe(429);
        expect(spoofAttempt.body.error.code).toBe("RATE_LIMITED");

        // Real victim on home IP 203.0.113.88 can still log in legitimately!
        const victimRes = await request(app)
          .post("/api/v1/auth/login")
          .set("X-Forwarded-For", "203.0.113.88")
          .send({ email: victimEmail, password: victimPassword });

        expect(victimRes.status).toBe(200);
        expect(victimRes.body.success).toBe(true);
      } finally {
        app.set("trust proxy", false);
        process.env.NODE_ENV = "test";
      }
    });
  });
});
