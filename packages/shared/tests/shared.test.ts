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
    if (result.success) {
      expect(result.data.timeZone).toBe("UTC");
    }
  });

  it("accepts zero skills during registration and applies default empty skills array", () => {
    const withEmptySkills = RegisterSchema.safeParse({
      email: "noskills@example.com",
      password: "Password123!",
      displayName: "Zero Skills",
      skills: [],
    });
    expect(withEmptySkills.success).toBe(true);
    if (withEmptySkills.success) {
      expect(withEmptySkills.data.skills).toEqual([]);
      expect(withEmptySkills.data.timeZone).toBe("UTC");
    }

    const withOmittedSkills = RegisterSchema.safeParse({
      email: "omittedskills@example.com",
      password: "Password123!",
      displayName: "Omitted Skills",
    });
    expect(withOmittedSkills.success).toBe(true);
    if (withOmittedSkills.success) {
      expect(withOmittedSkills.data.skills).toEqual([]);
    }
  });

  it("rejects invalid registration schema input", () => {
    const invalidData = {
      email: "not-an-email",
      password: "weak",
      displayName: "",
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
