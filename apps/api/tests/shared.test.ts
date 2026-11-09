import { describe, it, expect } from "vitest";
import {
  ERROR_CODES,
  TEAM_ROLES,
  DEFAULT_MAX_TEAM_SIZE,
  RegisterSchema,
} from "@crewconnect/shared";

describe("Shared Package Import in Backend", () => {
  it("imports constants correctly from @crewconnect/shared", () => {
    expect(TEAM_ROLES).toContain("LEADER");
    expect(DEFAULT_MAX_TEAM_SIZE).toBe(5);
    expect(ERROR_CODES.CONCURRENCY_CONFLICT).toBe("CONCURRENCY_CONFLICT");
    expect(ERROR_CODES.REQUEST_IN_PROGRESS).toBe("REQUEST_IN_PROGRESS");
  });

  it("validates data using shared Zod schema", () => {
    const valid = RegisterSchema.safeParse({
      email: "engineer@crewconnect.dev",
      password: "StrongPassword123!",
      displayName: "Backend Architect",
      skills: ["Node.js", "MongoDB", "TypeScript"],
    });

    expect(valid.success).toBe(true);
  });
});
