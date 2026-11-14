import { describe, it, expect } from "vitest";
import {
  calculateSkillComplementarity,
  calculateExperienceCompatibility,
  calculateTimezoneOverlap,
  scoreCandidate,
  getTimezoneOffsetMinutes,
  type TeamScoringContext,
  type CandidateScoringInput,
} from "../src/services/recommendation-engine.js";

describe("Teammate Recommendation Engine Unit Tests", () => {
  describe("1. Skill Complementarity Calculation", () => {
    it("rewards candidate who directly satisfies declared team skills needed", () => {
      const skillsNeeded = ["Rust", "Kubernetes", "Docker"];
      const coveredSkills = new Set(["typescript", "react"]);

      const candidateA = ["Rust", "Kubernetes", "TypeScript"];
      const candidateB = ["CSS", "HTML", "Figma"];

      const resA = calculateSkillComplementarity(candidateA, skillsNeeded, coveredSkills);
      const resB = calculateSkillComplementarity(candidateB, skillsNeeded, coveredSkills);

      expect(resA.score).toBeGreaterThan(resB.score);
      expect(resA.complementarySkills).toContain("Rust");
      expect(resA.complementarySkills).toContain("Kubernetes");
      expect(resA.overlappingSkills).toContain("TypeScript");
      expect(resA.explanation).toMatch(/directly fulfills 2 squad requirements/i);
    });

    it("rewards useful skill overlap without inflating duplicate-only skills", () => {
      const skillsNeeded = ["Go", "Kafka"];
      const coveredSkills = new Set(["typescript", "react", "node.js"]);

      // Candidate with 1 missing need + 1 overlap
      const balancedCandidate = ["Go", "TypeScript"];
      // Candidate with only duplicate skills
      const duplicateCandidate = ["TypeScript", "React", "Node.js"];

      const resBalanced = calculateSkillComplementarity(
        balancedCandidate,
        skillsNeeded,
        coveredSkills
      );
      const resDuplicate = calculateSkillComplementarity(
        duplicateCandidate,
        skillsNeeded,
        coveredSkills
      );

      expect(resBalanced.score).toBeGreaterThan(resDuplicate.score);
      expect(resBalanced.overlappingSkills).toEqual(["TypeScript"]);
      expect(resDuplicate.overlappingSkills.length).toBe(3);
    });

    it("handles candidates with zero technical skills gracefully and transparently", () => {
      const skillsNeeded = ["Python", "FastAPI"];
      const coveredSkills = new Set(["react"]);

      const emptyCandidate: string[] = [];
      const res = calculateSkillComplementarity(emptyCandidate, skillsNeeded, coveredSkills);

      expect(res.score).toBe(10);
      expect(res.complementarySkills).toEqual([]);
      expect(res.overlappingSkills).toEqual([]);
      expect(res.explanation).toMatch(/no technical skills listed/i);
    });

    it("handles teams with empty skillsNeeded by rewarding technical breadth and diversity", () => {
      const skillsNeeded: string[] = [];
      const coveredSkills = new Set(["typescript", "next.js"]);

      const broadeningCandidate = ["PostgreSQL", "Docker"];
      const res = calculateSkillComplementarity(broadeningCandidate, skillsNeeded, coveredSkills);

      expect(res.score).toBeGreaterThan(40);
      expect(res.complementarySkills).toContain("PostgreSQL");
      expect(res.complementarySkills).toContain("Docker");
    });
  });

  describe("2. Experience Compatibility Calculation", () => {
    it("prioritizes ADVANCED candidates when team is predominantly BEGINNER for mentorship", () => {
      const teamExp = ["BEGINNER", "BEGINNER"] as const;

      const advRes = calculateExperienceCompatibility("ADVANCED", [...teamExp]);
      const begRes = calculateExperienceCompatibility("BEGINNER", [...teamExp]);

      expect(advRes.score).toBe(100);
      expect(advRes.explanation).toMatch(/mentorship/i);
      expect(advRes.score).toBeGreaterThan(begRes.score);
    });

    it("supports BEGINNER contributors when team is predominantly ADVANCED with mentoring bandwidth", () => {
      const teamExp = ["ADVANCED", "ADVANCED"] as const;

      const begRes = calculateExperienceCompatibility("BEGINNER", [...teamExp]);
      const advRes = calculateExperienceCompatibility("ADVANCED", [...teamExp]);

      expect(begRes.score).toBe(75);
      expect(begRes.explanation).toMatch(/mentorship/i);
      expect(advRes.score).toBe(90);
    });

    it("evaluates INTERMEDIATE candidates well in balanced teams", () => {
      const teamExp = ["BEGINNER", "ADVANCED"] as const;

      const intRes = calculateExperienceCompatibility("INTERMEDIATE", [...teamExp]);
      expect(intRes.score).toBe(95);
      expect(intRes.explanation).toMatch(/balanced/i);
    });

    it("handles unlisted candidate experience with a neutral baseline", () => {
      const teamExp = ["INTERMEDIATE"] as const;

      const unlistedRes = calculateExperienceCompatibility(undefined, [...teamExp]);
      expect(unlistedRes.score).toBe(50);
      expect(unlistedRes.explanation).toMatch(/unlisted/i);
    });

    it("prefers INTERMEDIATE candidates over ADVANCED in predominantly senior squads to prevent architectural friction", () => {
      const teamExp = ["ADVANCED", "ADVANCED"] as const;

      const intRes = calculateExperienceCompatibility("INTERMEDIATE", [...teamExp]);
      const advRes = calculateExperienceCompatibility("ADVANCED", [...teamExp]);

      expect(intRes.score).toBe(95);
      expect(advRes.score).toBe(90);
      expect(intRes.score).toBeGreaterThan(advRes.score);
    });

    describe("Table-Driven Experience Compatibility Matrix", () => {
      interface ExpTestCase {
        candidateExp: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | undefined;
        teamExp: Array<"BEGINNER" | "INTERMEDIATE" | "ADVANCED" | undefined>;
        expectedScore: number;
        explanationPattern: RegExp;
      }

      const testCases: ExpTestCase[] = [
        // 1. Beginner-heavy squad
        {
          candidateExp: "ADVANCED",
          teamExp: ["BEGINNER", "BEGINNER"],
          expectedScore: 100,
          explanationPattern: /mentorship/i,
        },
        {
          candidateExp: "INTERMEDIATE",
          teamExp: ["BEGINNER", "BEGINNER"],
          expectedScore: 90,
          explanationPattern: /practical development momentum/i,
        },
        {
          candidateExp: "BEGINNER",
          teamExp: ["BEGINNER", "BEGINNER"],
          expectedScore: 70,
          explanationPattern: /peer beginner/i,
        },
        {
          candidateExp: undefined,
          teamExp: ["BEGINNER", "BEGINNER"],
          expectedScore: 50,
          explanationPattern: /unlisted/i,
        },

        // 2. Advanced-heavy squad
        {
          candidateExp: "INTERMEDIATE",
          teamExp: ["ADVANCED", "ADVANCED"],
          expectedScore: 95,
          explanationPattern: /execute alongside senior leadership/i,
        },
        {
          candidateExp: "ADVANCED",
          teamExp: ["ADVANCED", "ADVANCED"],
          expectedScore: 90,
          explanationPattern: /peer senior contributor/i,
        },
        {
          candidateExp: "BEGINNER",
          teamExp: ["ADVANCED", "ADVANCED"],
          expectedScore: 75,
          explanationPattern: /ample senior bandwidth/i,
        },
        {
          candidateExp: undefined,
          teamExp: ["ADVANCED", "ADVANCED"],
          expectedScore: 50,
          explanationPattern: /unlisted/i,
        },

        // 3. Balanced squad
        {
          candidateExp: "INTERMEDIATE",
          teamExp: ["BEGINNER", "ADVANCED"],
          expectedScore: 95,
          explanationPattern: /balanced development throughput/i,
        },
        {
          candidateExp: "ADVANCED",
          teamExp: ["BEGINNER", "ADVANCED"],
          expectedScore: 90,
          explanationPattern: /architectural rigor/i,
        },
        {
          candidateExp: "BEGINNER",
          teamExp: ["BEGINNER", "ADVANCED"],
          expectedScore: 80,
          explanationPattern: /well supported/i,
        },
        {
          candidateExp: undefined,
          teamExp: ["BEGINNER", "ADVANCED"],
          expectedScore: 50,
          explanationPattern: /unlisted/i,
        },

        // 4. Empty / Unlisted squad
        {
          candidateExp: "ADVANCED",
          teamExp: [],
          expectedScore: 85,
          explanationPattern: /strong starting foundation/i,
        },
        {
          candidateExp: "INTERMEDIATE",
          teamExp: [undefined],
          expectedScore: 85,
          explanationPattern: /strong starting foundation/i,
        },
        {
          candidateExp: "BEGINNER",
          teamExp: [],
          expectedScore: 80,
          explanationPattern: /solid starting foundation/i,
        },
        {
          candidateExp: undefined,
          teamExp: [],
          expectedScore: 50,
          explanationPattern: /unlisted/i,
        },
      ];

      testCases.forEach(({ candidateExp, teamExp, expectedScore, explanationPattern }, idx) => {
        it(`evaluates case #${idx + 1}: candidate [${candidateExp ?? "NONE"}] with team [${teamExp.join(", ")}] -> score ${expectedScore}`, () => {
          const res = calculateExperienceCompatibility(candidateExp, teamExp);
          expect(res.score).toBe(expectedScore);
          expect(res.explanation).toMatch(explanationPattern);
        });
      });
    });
  });

  describe("3. Timezone Overlap Calculation", () => {
    const fixedDate = new Date("2026-06-15T12:00:00Z"); // Summer DST reference

    it("accurately parses valid IANA timezones and calculates UTC offset in minutes", () => {
      const offsetUtc = getTimezoneOffsetMinutes("UTC", fixedDate);
      const offsetNy = getTimezoneOffsetMinutes("America/New_York", fixedDate); // EDT = UTC-4 (-240 min)
      const offsetLondon = getTimezoneOffsetMinutes("Europe/London", fixedDate); // BST = UTC+1 (+60 min)
      const offsetIndia = getTimezoneOffsetMinutes("Asia/Kolkata", fixedDate); // IST = UTC+5:30 (+330 min)

      expect(offsetUtc).toBe(0);
      expect(offsetNy).toBe(-240);
      expect(offsetLondon).toBe(60);
      expect(offsetIndia).toBe(330);
    });

    it("returns null for malformed or invalid timezone identifiers", () => {
      expect(getTimezoneOffsetMinutes("Mars/Olympus_Mons")).toBeNull();
      expect(getTimezoneOffsetMinutes("")).toBeNull();
      expect(getTimezoneOffsetMinutes(null as unknown as string)).toBeNull();
    });

    it("accurately handles half-hour and quarter-hour timezone offsets", () => {
      // Kathmandu is UTC+5:45 (+345 min)
      const offsetKathmandu = getTimezoneOffsetMinutes("Asia/Kathmandu", fixedDate);
      // Adelaide (Australia) in summer (June is winter in southern hemisphere = ACST UTC+9:30 = +570 min)
      const offsetAdelaide = getTimezoneOffsetMinutes("Australia/Adelaide", fixedDate);

      expect(offsetKathmandu).toBe(345);
      expect(offsetAdelaide).toBe(570);
    });

    it("correctly evaluates daylight-saving transitions across seasons", () => {
      const summerDate = new Date("2026-07-15T12:00:00Z");
      const winterDate = new Date("2026-01-15T12:00:00Z");

      // New York: EDT (-240) in summer, EST (-300) in winter
      expect(getTimezoneOffsetMinutes("America/New_York", summerDate)).toBe(-240);
      expect(getTimezoneOffsetMinutes("America/New_York", winterDate)).toBe(-300);

      // London: BST (+60) in summer, GMT (0) in winter
      expect(getTimezoneOffsetMinutes("Europe/London", summerDate)).toBe(60);
      expect(getTimezoneOffsetMinutes("Europe/London", winterDate)).toBe(0);
    });

    it("prevents outlier member from unfairly penalizing team-level compatibility", () => {
      // Team has 3 members in UTC (offset 0) and 1 remote member in Tokyo (UTC+9)
      const teamTzs = ["UTC", "UTC", "UTC", "Asia/Tokyo"];
      // Candidate is also in UTC
      const res = calculateTimezoneOverlap("UTC", teamTzs, fixedDate);

      // Overlaps: [9, 9, 9, 0] -> average = 6.8 hrs
      // Using average overlap prevents a single outlier from dropping candidate to 0 / MINIMAL
      expect(res.label).toBe("STRONG");
      expect(res.score).toBe(100);
      expect(res.overlapHours).toBe(6.8);
      expect(res.description).toMatch(/distributed squad with varied member coverage/i);
    });

    it("accurately calculates multi-member pairwise overlap without phantom midpoint", () => {
      // Team has 1 member in NY (EDT -4 = -240 min) and 1 member in India (IST +5:30 = +330 min)
      const teamTzs = ["America/New_York", "Asia/Kolkata"];
      // Candidate is in UTC (0 min)
      // NY overlap: max(0, 9 - 4) = 5h
      // India overlap: max(0, 9 - 5.5) = 3.5h
      // Average: (5 + 3.5) / 2 = 4.25 -> rounded to 4.3h
      const res = calculateTimezoneOverlap("UTC", teamTzs, fixedDate);

      expect(res.label).toBe("MODERATE");
      expect(res.score).toBe(75);
      expect(res.overlapHours).toBe(4.3);
    });

    it("calculates STRONG overlap (100) when candidate shares identical timezone", () => {
      const res = calculateTimezoneOverlap("America/New_York", ["America/New_York"], fixedDate);

      expect(res.label).toBe("STRONG");
      expect(res.score).toBe(100);
      expect(res.overlapHours).toBe(9);
    });

    it("calculates MODERATE overlap (75) for 4-hour timezone offset", () => {
      // EDT (-4) vs UTC (0) is 4 hours difference -> 5 hours overlap
      const res = calculateTimezoneOverlap("America/New_York", ["UTC"], fixedDate);

      expect(res.label).toBe("MODERATE");
      expect(res.score).toBe(75);
      expect(res.overlapHours).toBe(5);
    });

    it("calculates LIMITED or MINIMAL overlap for distant timezones", () => {
      // EDT (-4) vs Tokyo (+9) is 13 hours difference -> 0 hours overlap
      const res = calculateTimezoneOverlap("America/New_York", ["Asia/Tokyo"], fixedDate);

      expect(res.label).toBe("MINIMAL");
      expect(res.score).toBe(25);
      expect(res.overlapHours).toBe(0);
    });

    it("handles missing or invalid timezones safely with neutral UNKNOWN baseline", () => {
      const resA = calculateTimezoneOverlap(undefined, ["UTC"], fixedDate);
      const resB = calculateTimezoneOverlap("Invalid/Zone", ["UTC"], fixedDate);
      const resC = calculateTimezoneOverlap("UTC", [], fixedDate);

      expect(resA.label).toBe("UNKNOWN");
      expect(resA.score).toBe(50);
      expect(resA.overlapHours).toBeNull();

      expect(resB.label).toBe("UNKNOWN");
      expect(resB.score).toBe(50);

      expect(resC.label).toBe("UNKNOWN");
      expect(resC.score).toBe(50);
    });
  });

  describe("4. Composite Scoring & Normalization", () => {
    const teamContext: TeamScoringContext = {
      teamId: "team-123",
      skillsNeeded: ["Rust", "Distributed Systems"],
      members: [
        {
          id: "member-1",
          skills: ["TypeScript", "React"],
          experienceLevel: "BEGINNER",
          timeZone: "America/New_York",
        },
      ],
    };

    it("produces deterministic, bounded (0-100) compatibility scores", () => {
      const candidate: CandidateScoringInput = {
        id: "cand-1",
        displayName: "Ada Lovelace",
        skills: ["Rust", "Distributed Systems", "TypeScript"],
        experienceLevel: "ADVANCED",
        timeZone: "America/New_York",
      };

      const result1 = scoreCandidate(candidate, teamContext);
      const result2 = scoreCandidate(candidate, teamContext);

      expect(result1.compatibilityScore).toBeGreaterThanOrEqual(0);
      expect(result1.compatibilityScore).toBeLessThanOrEqual(100);
      expect(result1.compatibilityScore).toBe(result2.compatibilityScore);
      expect(result1.dimensionScores.skillScore).toBe(result2.dimensionScores.skillScore);
      expect(result1.dimensionScores.experienceScore).toBe(result2.dimensionScores.experienceScore);
      expect(result1.dimensionScores.timezoneScore).toBe(result2.dimensionScores.timezoneScore);
      expect(result1.candidate.id).toBe("cand-1");
      expect(result1.explanations.summary).toBeTruthy();
    });

    it("ranks complementary candidate higher than unrelated candidate", () => {
      const perfectCandidate: CandidateScoringInput = {
        id: "cand-high",
        displayName: "High Fit",
        skills: ["Rust", "Distributed Systems", "TypeScript"],
        experienceLevel: "ADVANCED",
        timeZone: "America/New_York",
      };

      const lowCandidate: CandidateScoringInput = {
        id: "cand-low",
        displayName: "Low Fit",
        skills: ["WordPress", "PHP"],
        experienceLevel: "BEGINNER",
        timeZone: "Asia/Tokyo",
      };

      const highResult = scoreCandidate(perfectCandidate, teamContext);
      const lowResult = scoreCandidate(lowCandidate, teamContext);

      expect(highResult.compatibilityScore).toBeGreaterThan(lowResult.compatibilityScore);
      expect(highResult.dimensionScores.skillScore).toBeGreaterThan(
        lowResult.dimensionScores.skillScore
      );
      expect(highResult.dimensionScores.experienceScore).toBeGreaterThan(
        lowResult.dimensionScores.experienceScore
      );
      expect(highResult.dimensionScores.timezoneScore).toBeGreaterThan(
        lowResult.dimensionScores.timezoneScore
      );
    });
  });
});
