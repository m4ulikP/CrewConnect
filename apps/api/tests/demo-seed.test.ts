import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";
import { Hackathon, Team, Membership } from "../src/models/index.js";
import { ensureDefaultHackathonAndDemoData } from "../src/services/demo-seed.service.js";

describe("Demo Hackathon & Squad Seeding", () => {
  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("creates Hack4Hack 2026 and initial demo squads idempotently", async () => {
    const result1 = await ensureDefaultHackathonAndDemoData();
    expect(result1.hackathon.slug).toBe("hack4hack-2026");
    expect(result1.hackathon.status).toBe("ACTIVE");

    const hackathon = await Hackathon.findOne({ slug: "hack4hack-2026" });
    expect(hackathon).not.toBeNull();
    expect(hackathon?.title).toContain("Hack4Hack 2026");

    const teams = await Team.find({ hackathonId: hackathon?._id });
    expect(teams.length).toBeGreaterThanOrEqual(3);

    // Verify memberships exist for the teams
    for (const team of teams) {
      const leaderMembership = await Membership.findOne({
        teamId: team._id,
        role: "LEADER",
        status: "ACTIVE",
      });
      expect(leaderMembership).not.toBeNull();
    }

    // Call again to verify idempotency (should not duplicate)
    const result2 = await ensureDefaultHackathonAndDemoData();
    expect(result2.hackathon.slug).toBe("hack4hack-2026");
    expect(result2.teamsCreated).toBe(0);

    const teamsAfter = await Team.find({ hackathonId: hackathon?._id });
    expect(teamsAfter.length).toBe(teams.length);
  });

  it("POST /api/v1/hackathons/seed-demo returns 200 with seed details", async () => {
    const res = await request(app).post("/api/v1/hackathons/seed-demo");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hackathon.slug).toBe("hack4hack-2026");
  });
});
