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
    it("successfully registers a new user with cookie and returns user profile", async () => {
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
      expect(res.body.data.token).toBeDefined();

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

    it("successfully logs in with valid credentials and sets session cookie", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "LOGIN.USER@test-auth-suite.com", // testing normalization
        password: "CorrectPassword123!",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("login.user@test-auth-suite.com");
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.token).toBeDefined();

      const cookies = res.headers["set-cookie"];
      expect(cookies[0]).toMatch(/^token=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);
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
    let authToken: string;

    beforeEach(async () => {
      const regRes = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "me.test@test-auth-suite.com",
          password: "Password123!",
          displayName: "Me User",
          skills: ["Docker", "Kubernetes"],
        });

      authToken = regRes.body.data.token;
      authCookie = regRes.headers["set-cookie"][0].split(";")[0];
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
        .set("Authorization", `Bearer ${authToken}`);

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

  describe("POST /api/v1/auth/logout", () => {
    it("clears authentication cookie", async () => {
      const res = await request(app).post("/api/v1/auth/logout");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe("Logged out successfully");

      const cookies = res.headers["set-cookie"];
      expect(cookies[0]).toMatch(/token=;/);
    });
  });

  describe("Authentication Rate Limiting", () => {
    it("returns 429 when rate limit threshold is exceeded", async () => {
      // Send 10 requests to trigger rate limit (max 10)
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
