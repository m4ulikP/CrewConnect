import { describe, it, expect } from "vitest";
import {
  ERROR_CODES,
  TEAM_ROLES,
  DEFAULT_MAX_TEAM_SIZE,
  RegisterSchema,
  CreateTeamSchema,
} from "../src/index.js";

describe("@crewconnect/shared", () => {
  it("exports domain constants correctly", () => {
    expect(TEAM_ROLES).toContain("LEADER");
    expect(TEAM_ROLES).toContain("MEMBER");
    expect(DEFAULT_MAX_TEAM_SIZE).toBe(5);
    expect(ERROR_CODES.TEAM_FULL).toBe("TEAM_FULL");
    expect(ERROR_CODES.ALREADY_IN_TEAM).toBe("ALREADY_IN_TEAM");
  });

  it("validates valid registration schema input", () => {
    const validData = {
      email: "user@example.com",
      password: "Password123!",
      displayName: "Jane Doe",
      skills: ["React", "Node.js"],
    };
    const result = RegisterSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects invalid registration schema input", () => {
    const invalidData = {
      email: "not-an-email",
      password: "weak",
      displayName: "",
      skills: [],
    };
    const result = RegisterSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("validates team creation schema and applies default empty skillsNeeded", () => {
    const parsed = CreateTeamSchema.parse({ name: "Alpha Squad" });
    expect(parsed.name).toBe("Alpha Squad");
    expect(parsed.skillsNeeded).toEqual([]);
  });
});
