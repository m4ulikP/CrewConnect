import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import type { UserDTO } from "@crewconnect/shared";
import { app } from "../src/app.js";
import { User, Hackathon, Team, Membership } from "../src/models/index.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";

const TEST_ORIGIN = "http://localhost:5173";

describe("Rate Limiter Security & Production Invariant Enforcement", () => {
  let leaderUser: UserDTO;
  let leaderCookie: string;
  let testHackathonId: string;
  let testTeamId: string;

  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    process.env.NODE_ENV = "test";
    await User.deleteMany({ email: /@test-ratelimit-suite\.com$/ });
    await Hackathon.deleteMany({ slug: /test-ratelimit-hackathon-/ });
    if (testHackathonId) {
      await Team.deleteMany({ hackathonId: testHackathonId });
      await Membership.deleteMany({ hackathonId: testHackathonId });
    }
    await disconnectDatabase();
  });

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
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
});
