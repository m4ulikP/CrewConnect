import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { User } from "../src/models/User.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";

describe("Authentication Integration Tests", () => {
  beforeAll(async () => {
    await connectToDatabase();
    await User.syncIndexes();
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@test-auth-suite\.com$/ });
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await User.deleteMany({ email: /@test-auth-suite\.com$/ });
  });

  describe("POST /api/v1/auth/register", () => {
    it("successfully registers a new user with HTTP-only cookie and never exposes JWT in JSON response", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "alex.dev@test-auth-suite.com",
          password: "SecurePassword123!",
          displayName: "Alex Dev",
          skills: ["TypeScript", "React", "Node.js"],
          timeZone: "America/New_York",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe("alex.dev@test-auth-suite.com");
      expect(res.body.data.user.displayName).toBe("Alex Dev");
      expect(res.body.data.user.passwordHash).toBeUndefined();

      // SECURITY AUDIT: JWT token must NEVER be returned in response JSON
      expect(res.body.data.token).toBeUndefined();

      // Verify Set-Cookie header
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/^token=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);
      expect(cookies[0]).toMatch(/SameSite=Lax/i);
    });

    it("rejects registration with duplicate email (409 Conflict)", async () => {
      // First registration
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "duplicate@test-auth-suite.com",
          password: "SecurePassword123!",
          displayName: "First User",
          skills: ["Rust"],
        });

      // Duplicate registration
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "DUPLICATE@test-auth-suite.com",
          password: "AnotherPassword123!",
          displayName: "Second User",
          skills: ["Go"],
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    });

    it("rejects registration with invalid input schema (422 Unprocessable Entity)", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "not-an-email",
        password: "short", // less than 8 chars, no digit/special
        displayName: "A", // too short
        skills: [], // empty
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(Array.isArray(res.body.error.details)).toBe(true);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    beforeEach(async () => {
      // Register a user for login testing
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "login.user@test-auth-suite.com",
          password: "CorrectPassword123!",
          displayName: "Login User",
          skills: ["Python", "Django"],
        });
    });

    it("successfully logs in with valid credentials, sets HTTP-only cookie and never exposes token in JSON", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "LOGIN.USER@test-auth-suite.com", // testing normalization
        password: "CorrectPassword123!",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("login.user@test-auth-suite.com");
      expect(res.body.data.user.passwordHash).toBeUndefined();

      // SECURITY AUDIT: JWT token must NEVER be exposed in response body
      expect(res.body.data.token).toBeUndefined();

      const cookies = res.headers["set-cookie"];
      expect(cookies[0]).toMatch(/^token=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);
      expect(cookies[0]).toMatch(/SameSite=Lax/i);
    });

    it("rejects login with incorrect password with 401 and generic error message", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "login.user@test-auth-suite.com",
        password: "WrongPassword123!",
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
      expect(res.body.error.message).toBe("Invalid email or password");
    });

    it("rejects login for nonexistent email with identical 401 error (account enumeration protection)", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "nonexistent@test-auth-suite.com",
        password: "AnyPassword123!",
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
      expect(res.body.error.message).toBe("Invalid email or password");
    });
  });

  describe("GET /api/v1/auth/me", () => {
    let authCookie: string;
    let bearerToken: string;

    beforeEach(async () => {
      const regRes = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "me.test@test-auth-suite.com",
          password: "Password123!",
          displayName: "Me User",
          skills: ["Docker", "Kubernetes"],
        });

      authCookie = regRes.headers["set-cookie"][0].split(";")[0];
      const match = authCookie.match(/token=([^;]+)/);
      bearerToken = match ? match[1] : "";
    });

    it("returns authenticated user profile when cookie is supplied", async () => {
      const res = await request(app).get("/api/v1/auth/me").set("Cookie", [authCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("me.test@test-auth-suite.com");
      expect(res.body.data.user.displayName).toBe("Me User");
    });

    it("returns authenticated user profile when Bearer token is supplied", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${bearerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("me.test@test-auth-suite.com");
    });

    it("rejects unauthenticated request with 401 UNAUTHORIZED", async () => {
      const res = await request(app).get("/api/v1/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects request with invalid token", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer invalid-tampered-token");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Actual Logout & Session Revocation", () => {
    it("genuinely revokes session: accessing protected endpoint with previously issued credential fails after logout", async () => {
      // 1. User registers & logs in
      const regRes = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "revocation.test@test-auth-suite.com",
          password: "Password123!",
          displayName: "Revocation User",
          skills: ["TypeScript"],
        });

      const sessionCookie = regRes.headers["set-cookie"][0].split(";")[0];

      // 2. Verified active access with session cookie
      const preLogoutRes = await request(app).get("/api/v1/auth/me").set("Cookie", [sessionCookie]);
      expect(preLogoutRes.status).toBe(200);
      expect(preLogoutRes.body.data.user.email).toBe("revocation.test@test-auth-suite.com");

      // 3. User logs out
      const logoutRes = await request(app)
        .post("/api/v1/auth/logout")
        .set("Cookie", [sessionCookie])
        .set("Origin", "http://localhost:5173");

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Verify cookie cleared
      const clearedCookies = logoutRes.headers["set-cookie"];
      expect(clearedCookies[0]).toMatch(/token=;/);

      // 4. CRITICAL SECURITY TEST: Reusing previously issued credential fails
      const postLogoutRes = await request(app)
        .get("/api/v1/auth/me")
        .set("Cookie", [sessionCookie]);

      expect(postLogoutRes.status).toBe(401);
      expect(postLogoutRes.body.success).toBe(false);
      expect(postLogoutRes.body.error.code).toBe("UNAUTHORIZED");
      expect(postLogoutRes.body.error.message).toMatch(/revoked/i);

      // 5. User must re-authenticate to gain access
      const reLoginRes = await request(app).post("/api/v1/auth/login").send({
        email: "revocation.test@test-auth-suite.com",
        password: "Password123!",
      });

      expect(reLoginRes.status).toBe(200);
      const newSessionCookie = reLoginRes.headers["set-cookie"][0].split(";")[0];

      const newMeRes = await request(app).get("/api/v1/auth/me").set("Cookie", [newSessionCookie]);

      expect(newMeRes.status).toBe(200);
      expect(newMeRes.body.data.user.email).toBe("revocation.test@test-auth-suite.com");
    });
  });

  describe("CSRF Protection Middleware", () => {
    let testCookie: string;

    beforeEach(async () => {
      const regRes = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "csrf.test@test-auth-suite.com",
          password: "Password123!",
          displayName: "CSRF User",
          skills: ["Security"],
        });

      testCookie = regRes.headers["set-cookie"][0].split(";")[0];
    });

    it("rejects state-changing requests with cookie from unauthorized cross-origin (403 Forbidden)", async () => {
      const res = await request(app)
        .post("/api/v1/auth/logout")
        .set("Cookie", [testCookie])
        .set("Origin", "http://malicious-attacker.com");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(res.body.error.message).toMatch(/CSRF/i);
    });

    it("accepts state-changing requests with cookie from authorized origin (200 OK)", async () => {
      const res = await request(app)
        .post("/api/v1/auth/logout")
        .set("Cookie", [testCookie])
        .set("Origin", "http://localhost:5173");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("allows safe GET requests with cookie even from external referer (safe methods bypass)", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Cookie", [testCookie])
        .set("Origin", "http://external-site.com");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Authentication Rate Limiting", () => {
    it("returns 429 when rate limit threshold is exceeded", async () => {
      // Send 10 requests to reach rate limit threshold
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post("/api/v1/auth/login")
          .set("x-test-rate-limit", "true")
          .send({ email: "rate.limit@test.com", password: "pwd" });
      }

      // The 11th request must be rejected with 429
      const res = await request(app)
        .post("/api/v1/auth/login")
        .set("x-test-rate-limit", "true")
        .send({ email: "rate.limit@test.com", password: "pwd" });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("RATE_LIMITED");
      expect(res.headers["retry-after"]).toBeDefined();
    });
  });
});
