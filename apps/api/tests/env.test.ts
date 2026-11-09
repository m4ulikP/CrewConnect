import { describe, it, expect } from "vitest";
import { validateEnv } from "../src/config/env.js";

describe("Environment Validation", () => {
  it("validates valid environment configuration successfully", () => {
    const validConfig = {
      NODE_ENV: "test",
      PORT: "5000",
      CLIENT_URL: "http://localhost:5173",
      MONGODB_URI: "mongodb://localhost:27017/crewconnect?replicaSet=rs0",
      JWT_SECRET: "this_is_a_very_secure_jwt_secret_with_32_characters_minimum!",
    };

    const parsed = validateEnv(validConfig);
    expect(parsed.NODE_ENV).toBe("test");
    expect(parsed.PORT).toBe(5000);
    expect(parsed.CLIENT_URL).toBe("http://localhost:5173");
  });

  it("throws an error when JWT_SECRET is shorter than 32 characters", () => {
    const invalidConfig = {
      JWT_SECRET: "short_secret",
    };

    expect(() => validateEnv(invalidConfig)).toThrow(
      "JWT_SECRET must be at least 32 characters long"
    );
  });

  it("throws an error when CLIENT_URL is not a valid URL", () => {
    const invalidConfig = {
      CLIENT_URL: "not-a-valid-url",
      JWT_SECRET: "valid_secret_that_is_at_least_32_characters_long!",
    };

    expect(() => validateEnv(invalidConfig)).toThrow("Invalid url");
  });
});
