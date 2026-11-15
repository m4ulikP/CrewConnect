/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Hackathon } from "../src/models/index.js";
import { FALLBACK_DEMO_HACKATHON, FALLBACK_DEMO_TEAMS } from "../src/services/demo-fixtures.js";

describe("Production Fallback Safety & Dev-Only Demarcation Invariants", () => {
  const originalNodeEnv = env.NODE_ENV;

  afterEach(() => {
    (env as { NODE_ENV: string }).NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  describe("In Production Mode (env.NODE_ENV = 'production')", () => {
    beforeEach(() => {
      (env as { NODE_ENV: string }).NODE_ENV = "production";
    });

    it("STRICTLY NEVER serves demo hackathon fixtures when database is offline", async () => {
      vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(0 as any);
      vi.spyOn(Hackathon, "find").mockImplementation(() => {
        throw new Error("MongooseServerSelectionError: connect ECONNREFUSED");
      });

      const res = await request(app).get("/api/v1/hackathons");

      expect(res.status).toBe(500);
      expect(res.body.data).not.toEqual([FALLBACK_DEMO_HACKATHON]);
    });

    it("STRICTLY NEVER serves demo teams fixtures when database is offline", async () => {
      vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(0 as any);

      const res = await request(app).get("/api/v1/hackathons/hack4hack-2026/teams");

      expect(res.status).not.toBe(200);
      expect(res.body.data).not.toEqual(FALLBACK_DEMO_TEAMS);
    });

    it("STRICTLY NEVER serves demo squad details when database is offline", async () => {
      vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(0 as any);

      const res = await request(app).get("/api/v1/teams/team-atlas-consensus");

      expect(res.status).not.toBe(200);
      expect(res.body.data).not.toEqual(FALLBACK_DEMO_TEAMS[0]);
    });

    it("STRICTLY NEVER serves synthetic member roster when database is offline", async () => {
      vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(0 as any);

      const res = await request(app).get("/api/v1/teams/team-atlas-consensus/members");

      expect(res.status).not.toBe(200);
      if (res.body.data) {
        expect(res.body.data).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ userId: "user-1" })])
        );
      }
    });
  });

  describe("In Development Mode (env.NODE_ENV = 'development')", () => {
    beforeEach(() => {
      (env as { NODE_ENV: string }).NODE_ENV = "development";
    });

    it("Serves demo fixtures when database is offline to enable zero-config local UI evaluation", async () => {
      vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(0 as any);

      const resHackathons = await request(app).get("/api/v1/hackathons");
      expect(resHackathons.status).toBe(200);
      expect(resHackathons.body.success).toBe(true);
      expect(resHackathons.body.data[0].id).toBe("hack4hack-2026");

      const resTeams = await request(app).get("/api/v1/hackathons/hack4hack-2026/teams");
      expect(resTeams.status).toBe(200);
      expect(resTeams.body.success).toBe(true);
      expect(resTeams.body.data.length).toBeGreaterThanOrEqual(1);
      expect(resTeams.body.data[0].id).toBe("team-atlas-consensus");

      const resTeam = await request(app).get("/api/v1/teams/team-atlas-consensus");
      expect(resTeam.status).toBe(200);
      expect(resTeam.body.success).toBe(true);
      expect(resTeam.body.data.id).toBe("team-atlas-consensus");

      const resRoster = await request(app).get("/api/v1/teams/team-atlas-consensus/members");
      expect(resRoster.status).toBe(200);
      expect(resRoster.body.success).toBe(true);
      expect(resRoster.body.data[0].user.displayName).toBe("Lead Builder");
    });
  });
});
