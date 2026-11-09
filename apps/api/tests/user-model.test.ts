import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { User } from "../src/models/User.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";

describe("User Model Tests", () => {
  beforeAll(async () => {
    await connectToDatabase();
    await User.syncIndexes();
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@test-user-model\.com$/ });
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await User.deleteMany({ email: /@test-user-model\.com$/ });
  });

  it("creates a valid user with Argon2id password hash", async () => {
    const passwordHash = await User.hashPassword("SecurePassword123!");
    expect(passwordHash).toMatch(/^\$argon2id\$/);

    const user = await User.create({
      email: "valid.user@test-user-model.com",
      passwordHash,
      displayName: "Valid User",
      skills: ["TypeScript", "Node.js"],
      timeZone: "America/New_York",
      status: "ACTIVE",
    });

    expect(user._id).toBeDefined();
    expect(user.email).toBe("valid.user@test-user-model.com");
    expect(user.displayName).toBe("Valid User");
    expect(user.skills).toEqual(["TypeScript", "Node.js"]);
    expect(user.status).toBe("ACTIVE");

    // Test password verification
    const isMatch = await user.verifyPassword("SecurePassword123!");
    expect(isMatch).toBe(true);

    const isWrongMatch = await user.verifyPassword("WrongPassword999!");
    expect(isWrongMatch).toBe(false);
  });

  it("normalizes email to lowercase and trims whitespace", async () => {
    const passwordHash = await User.hashPassword("SecurePassword123!");
    const user = await User.create({
      email: "  UPPERCASE.Email@test-user-model.com  ",
      passwordHash,
      displayName: "Normalization Test",
      skills: ["React"],
    });

    expect(user.email).toBe("uppercase.email@test-user-model.com");
  });

  it("enforces unique email constraint in MongoDB", async () => {
    const passwordHash = await User.hashPassword("SecurePassword123!");
    await User.create({
      email: "duplicate@test-user-model.com",
      passwordHash,
      displayName: "User One",
      skills: ["Go"],
    });

    await expect(
      User.create({
        email: "duplicate@test-user-model.com",
        passwordHash,
        displayName: "User Two",
        skills: ["Rust"],
      })
    ).rejects.toThrow();
  });

  it("rejects invalid user data failing schema validation", async () => {
    const passwordHash = await User.hashPassword("SecurePassword123!");

    // Missing display name
    await expect(
      User.create({
        email: "invalid@test-user-model.com",
        passwordHash,
        skills: ["Python"],
      })
    ).rejects.toThrow();

    // Display name too short
    await expect(
      User.create({
        email: "invalid2@test-user-model.com",
        passwordHash,
        displayName: "A",
        skills: ["Python"],
      })
    ).rejects.toThrow();

    // Empty skills array
    await expect(
      User.create({
        email: "invalid3@test-user-model.com",
        passwordHash,
        displayName: "Valid Name",
        skills: [],
      })
    ).rejects.toThrow();
  });

  it("does not expose password hash in toJSON output or standard queries", async () => {
    const passwordHash = await User.hashPassword("SuperSecretHash123!");
    const user = await User.create({
      email: "privacy@test-user-model.com",
      passwordHash,
      displayName: "Privacy User",
      skills: ["Security"],
    });

    // In toJSON()
    const json = user.toJSON();
    expect(json.passwordHash).toBeUndefined();
    expect(json.id).toBe(user._id.toString());
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();

    // Standard query without select
    const fetched = await User.findOne({ email: "privacy@test-user-model.com" });
    expect(fetched).not.toBeNull();
    expect(fetched?.passwordHash).toBeUndefined();
  });
});
