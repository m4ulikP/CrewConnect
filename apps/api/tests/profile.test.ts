import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { User, Hackathon, Team, Membership } from "../src/models/index.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";

const TEST_ORIGIN = "http://localhost:5173";
const EMAIL_DOMAIN = "@test-profile-suite.com";

describe("User Profile Editing Integration Tests (PATCH /api/v1/users/me)", () => {
  beforeAll(async () => {
    await connectToDatabase();
    await User.syncIndexes();
    await Hackathon.syncIndexes();
    await Team.syncIndexes();
    await Membership.syncIndexes();
  });

  afterAll(async () => {
    await User.deleteMany({ email: new RegExp(`${EMAIL_DOMAIN.replace(".", "\\.")}$`) });
    await Hackathon.deleteMany({ slug: /test-profile-hackathon-/ });
    await Team.deleteMany({});
    await Membership.deleteMany({});
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await User.deleteMany({ email: new RegExp(`${EMAIL_DOMAIN.replace(".", "\\.")}$`) });
    await Hackathon.deleteMany({ slug: /test-profile-hackathon-/ });
    await Team.deleteMany({});
    await Membership.deleteMany({});
  });

  const registerUser = async (emailPrefix: string, displayName = "Original Name") => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: `${emailPrefix}${EMAIL_DOMAIN}`,
        password: "SecurePassword123!",
        displayName,
        skills: ["TypeScript", "React"],
        bio: "Original bio",
        timeZone: "UTC",
      });

    expect(res.status).toBe(201);
    const cookie = res.headers["set-cookie"][0];
    const user = res.body.data.user;
    return { user, cookie };
  };

  it("successfully updates all editable profile fields", async () => {
    const { cookie } = await registerUser("alice");

    const updatePayload = {
      displayName: "Alice Wonderland",
      bio: "Full-stack distributed systems engineer with 5 years experience.",
      skills: ["Rust", "Go", "Docker", "Kubernetes"],
      timeZone: "America/New_York",
      experienceLevel: "ADVANCED",
      githubUrl: "https://github.com/alice-wonder",
      linkedinUrl: "https://linkedin.com/in/alice-wonder",
      portfolioUrl: "https://alice.codes",
    };

    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Cookie", cookie)
      .set("Origin", TEST_ORIGIN)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = res.body.data.user;
    expect(updated.displayName).toBe("Alice Wonderland");
    expect(updated.bio).toBe("Full-stack distributed systems engineer with 5 years experience.");
    expect(updated.skills).toEqual(["Rust", "Go", "Docker", "Kubernetes"]);
    expect(updated.timeZone).toBe("America/New_York");
    expect(updated.experienceLevel).toBe("ADVANCED");
    expect(updated.githubUrl).toBe("https://github.com/alice-wonder");
    expect(updated.linkedinUrl).toBe("https://linkedin.com/in/alice-wonder");
    expect(updated.portfolioUrl).toBe("https://alice.codes");

    // Invariant check: passwordHash and tokenVersion must never be exposed
    expect(updated.passwordHash).toBeUndefined();
    expect(updated.tokenVersion).toBeUndefined();
  });

  it("supports partial update: omitted fields retain their existing values", async () => {
    const { cookie } = await registerUser("bob", "Bob Developer");

    // Only update displayName and bio, omitting skills and timezone
    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Cookie", cookie)
      .set("Origin", TEST_ORIGIN)
      .send({
        displayName: "Bob The Builder",
        bio: "Can we build it? Yes we can!",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.user.displayName).toBe("Bob The Builder");
    expect(res.body.data.user.bio).toBe("Can we build it? Yes we can!");
    // Existing skills and timezone are preserved
    expect(res.body.data.user.skills).toEqual(["TypeScript", "React"]);
    expect(res.body.data.user.timeZone).toBe("UTC");
  });

  it("allows setting empty skills array ([])", async () => {
    const { cookie } = await registerUser("empty-skills");

    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Cookie", cookie)
      .set("Origin", TEST_ORIGIN)
      .send({
        skills: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.user.skills).toEqual([]);
  });

  it("allows clearing bio and URLs with empty string or null", async () => {
    const { cookie } = await registerUser("clear-fields");

    // First, populate URLs
    await request(app)
      .patch("/api/v1/users/me")
      .set("Cookie", cookie)
      .set("Origin", TEST_ORIGIN)
      .send({
        githubUrl: "https://github.com/original",
        linkedinUrl: "https://linkedin.com/in/original",
        portfolioUrl: "https://original.site",
      });

    // Now clear them
    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Cookie", cookie)
      .set("Origin", TEST_ORIGIN)
      .send({
        bio: "",
        githubUrl: "",
        linkedinUrl: null,
        portfolioUrl: "",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.user.bio).toBe("");
    expect(res.body.data.user.githubUrl).toBeFalsy();
    expect(res.body.data.user.linkedinUrl).toBeFalsy();
    expect(res.body.data.user.portfolioUrl).toBeFalsy();
  });

  it("rejects duplicate skills in update payload (case-insensitive)", async () => {
    const { cookie } = await registerUser("duplicate-skills");

    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Cookie", cookie)
      .set("Origin", TEST_ORIGIN)
      .send({
        skills: ["TypeScript", "typescript", "React"],
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(res.body.error.details)).toMatch(/duplicate/i);
  });

  it("rejects invalid URLs with 422 Validation Error", async () => {
    const { cookie } = await registerUser("invalid-url");

    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Cookie", cookie)
      .set("Origin", TEST_ORIGIN)
      .send({
        githubUrl: "not-a-valid-url",
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects javascript: and ftp: pseudo-protocol URLs", async () => {
    const { cookie } = await registerUser("xss-url");

    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Cookie", cookie)
      .set("Origin", TEST_ORIGIN)
      .send({
        portfolioUrl: "javascript:alert('xss')",
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid IANA timezone with 422 Validation Error", async () => {
    const { cookie } = await registerUser("invalid-tz");

    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Cookie", cookie)
      .set("Origin", TEST_ORIGIN)
      .send({
        timeZone: "Mars/Olympus_Mons",
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(res.body.error.details)).toMatch(/timezone/i);
  });

  it("rejects invalid experience level with 422 Validation Error", async () => {
    const { cookie } = await registerUser("invalid-exp");

    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Cookie", cookie)
      .set("Origin", TEST_ORIGIN)
      .send({
        experienceLevel: "SUPER_EXPERT",
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects unauthenticated requests with 401 Unauthorized", async () => {
    const res = await request(app).patch("/api/v1/users/me").set("Origin", TEST_ORIGIN).send({
      displayName: "Anonymous Intruder",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects attempts to update protected fields (strict schema validation)", async () => {
    const { cookie } = await registerUser("protected-fields");

    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Cookie", cookie)
      .set("Origin", TEST_ORIGIN)
      .send({
        displayName: "Legit Name",
        role: "ADMIN",
        status: "SUSPENDED",
        passwordHash: "malicious_hash",
        tokenVersion: 999,
        email: "hacked@example.com",
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(res.body.error.details)).toMatch(/unrecognized key|unknown/i);
  });

  it("rejects unknown arbitrary fields (strict schema validation)", async () => {
    const { cookie } = await registerUser("unknown-fields");

    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Cookie", cookie)
      .set("Origin", TEST_ORIGIN)
      .send({
        displayName: "Legit Name",
        favoriteEditor: "Neovim",
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("ensures User A cannot update User B's profile (identity derived solely from session)", async () => {
    const userA = await registerUser("user-a", "User A Original");
    const userB = await registerUser("user-b", "User B Original");

    // User A attempts to target User B via query, body, or params
    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Cookie", userA.cookie)
      .set("Origin", TEST_ORIGIN)
      .send({
        displayName: "User A Updated",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(userA.user.id);
    expect(res.body.data.user.displayName).toBe("User A Updated");

    // Invariant check: User B remains completely untouched
    const userBInDb = await User.findById(userB.user.id);
    expect(userBInDb!.displayName).toBe("User B Original");
  });

  it("reflects updated skills in public team discovery aggregation", async () => {
    // 1. Register leader and create team
    const { cookie: leaderCookie } = await registerUser("discovery-leader", "Original Leader");

    const hackathon = await Hackathon.create({
      slug: `test-profile-hackathon-${Date.now()}`,
      title: "Discovery Test Hackathon",
      description: "Testing discovery skill reflection",
      minTeamSize: 1,
      maxTeamSize: 4,
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const teamRes = await request(app)
      .post(`/api/v1/hackathons/${hackathon._id}/teams`)
      .set("Cookie", leaderCookie)
      .set("Origin", TEST_ORIGIN)
      .send({
        name: "Discovery Test Team",
        tagline: "Skills integration verification",
        skillsNeeded: ["Rust", "Distributed Systems"],
      });

    expect(teamRes.status).toBe(201);

    // Initial discovery check: leader has ["TypeScript", "React"]
    let discoveryRes = await request(app)
      .get(`/api/v1/hackathons/${hackathon._id}/teams`)
      .set("Origin", TEST_ORIGIN);

    expect(discoveryRes.status).toBe(200);
    expect(discoveryRes.body.data[0].leaderId.displayName).toBe("Original Leader");
    expect(discoveryRes.body.data[0].leaderId.skills).toEqual(["TypeScript", "React"]);
    // Verify leader email is NOT exposed in public discovery
    expect(discoveryRes.body.data[0].leaderId.email).toBeUndefined();

    // 2. Leader updates their profile skills and display name
    const updateRes = await request(app)
      .patch("/api/v1/users/me")
      .set("Cookie", leaderCookie)
      .set("Origin", TEST_ORIGIN)
      .send({
        displayName: "Updated Leader Name",
        skills: ["Rust", "WebAssembly", "Distributed Systems"],
      });

    expect(updateRes.status).toBe(200);

    // 3. Discovery query must immediately reflect updated skills and name via $lookup
    discoveryRes = await request(app)
      .get(`/api/v1/hackathons/${hackathon._id}/teams`)
      .set("Origin", TEST_ORIGIN);

    expect(discoveryRes.status).toBe(200);
    const updatedLeader = discoveryRes.body.data[0].leaderId;
    expect(updatedLeader.displayName).toBe("Updated Leader Name");
    expect(updatedLeader.skills).toEqual(["Rust", "WebAssembly", "Distributed Systems"]);
    expect(updatedLeader.email).toBeUndefined();
  });
});
