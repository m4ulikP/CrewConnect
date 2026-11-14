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

  it("throws an error in production mode if JWT_SECRET uses the default dev placeholder", () => {
    const prodConfigWithDefaultSecret = {
      NODE_ENV: "production",
      CLIENT_URL: "https://crewconnect.app",
      JWT_SECRET: "default_development_secret_key_that_is_at_least_32_characters_long!",
    };

    expect(() => validateEnv(prodConfigWithDefaultSecret)).toThrow(
      "In production, JWT_SECRET is mandatory and cannot use the default development secret"
    );
  });

  it("successfully validates production environment with strong custom secret and cookie options", () => {
    const prodValidConfig = {
      NODE_ENV: "production",
      CLIENT_URL: "https://crewconnect.app",
      JWT_SECRET: "production_cryptographically_secure_token_key_over_32_characters!",
      COOKIE_SECURE: "true",
      COOKIE_SAME_SITE: "strict",
      JOIN_RATE_LIMIT_MAX_REQUESTS: "5",
    };

    const parsed = validateEnv(prodValidConfig);
    expect(parsed.NODE_ENV).toBe("production");
    expect(parsed.COOKIE_SECURE).toBe(true);
    expect(parsed.COOKIE_SAME_SITE).toBe("strict");
    expect(parsed.JOIN_RATE_LIMIT_MAX_REQUESTS).toBe(5);
  });

  it("defaults JOIN_REQUEST_EXPIRATION_HOURS to 72 when not set", () => {
    const config = {
      CLIENT_URL: "http://localhost:5173",
      JWT_SECRET: "valid_secret_that_is_at_least_32_characters_long!",
    };
    const parsed = validateEnv(config);
    expect(parsed.JOIN_REQUEST_EXPIRATION_HOURS).toBe(72);
  });

  it("accepts a custom JOIN_REQUEST_EXPIRATION_HOURS value within range", () => {
    const config = {
      CLIENT_URL: "http://localhost:5173",
      JWT_SECRET: "valid_secret_that_is_at_least_32_characters_long!",
      JOIN_REQUEST_EXPIRATION_HOURS: "48",
    };
    const parsed = validateEnv(config);
    expect(parsed.JOIN_REQUEST_EXPIRATION_HOURS).toBe(48);
  });

  it("rejects JOIN_REQUEST_EXPIRATION_HOURS below minimum (1)", () => {
    const config = {
      CLIENT_URL: "http://localhost:5173",
      JWT_SECRET: "valid_secret_that_is_at_least_32_characters_long!",
      JOIN_REQUEST_EXPIRATION_HOURS: "0",
    };
    expect(() => validateEnv(config)).toThrow();
  });

  it("rejects JOIN_REQUEST_EXPIRATION_HOURS above maximum (720)", () => {
    const config = {
      CLIENT_URL: "http://localhost:5173",
      JWT_SECRET: "valid_secret_that_is_at_least_32_characters_long!",
      JOIN_REQUEST_EXPIRATION_HOURS: "721",
    };
    expect(() => validateEnv(config)).toThrow();
  });
});
