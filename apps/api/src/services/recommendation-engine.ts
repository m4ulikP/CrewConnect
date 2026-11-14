import type {
  ExperienceLevel,
  CandidatePublicDTO,
  TeammateRecommendationDTO,
  TimezoneCompatibilityLabel,
} from "@crewconnect/shared";

export interface TeamScoringContext {
  teamId: string;
  skillsNeeded: string[];
  members: Array<{
    id: string;
    skills: string[];
    experienceLevel?: ExperienceLevel;
    timeZone?: string;
  }>;
}

export interface CandidateScoringInput {
  id: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  skills: string[];
  experienceLevel?: ExperienceLevel;
  timeZone?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
}

/**
 * Calculates UTC offset in minutes for a given IANA timezone name.
 * Uses native Intl.DateTimeFormat with DST consideration.
 */
export function getTimezoneOffsetMinutes(
  timeZone: string,
  refDate: Date = new Date()
): number | null {
  if (!timeZone || typeof timeZone !== "string") return null;
  try {
    const trimmed = timeZone.trim();
    // Test validity with Intl
    new Intl.DateTimeFormat(undefined, { timeZone: trimmed });

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: trimmed,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    }).formatToParts(refDate);

    const values: Record<string, string> = {};
    for (const part of parts) {
      values[part.type] = part.value;
    }
    const hour = values.hour === "24" ? 0 : parseInt(values.hour, 10);
    const targetUtc = Date.UTC(
      parseInt(values.year, 10),
      parseInt(values.month, 10) - 1,
      parseInt(values.day, 10),
      hour,
      parseInt(values.minute, 10),
      parseInt(values.second, 10)
    );

    return Math.round((targetUtc - refDate.getTime()) / (60 * 1000));
  } catch {
    return null;
  }
}

/**
 * Calculates working hour overlap (09:00 - 18:00 local time) between candidate and team members in hours.
 * Uses pairwise member overlap and team average to prevent single-member outlier penalization.
 */
export function calculateTimezoneOverlap(
  candidateTz?: string,
  teamTzs: string[] = [],
  refDate: Date = new Date()
): {
  label: TimezoneCompatibilityLabel;
  score: number;
  overlapHours: number | null;
  description: string;
} {
  const candidateOffset = candidateTz ? getTimezoneOffsetMinutes(candidateTz, refDate) : null;
  const validTeamOffsets = teamTzs
    .map((tz) => getTimezoneOffsetMinutes(tz, refDate))
    .filter((o): o is number => o !== null);

  if (candidateOffset === null || validTeamOffsets.length === 0) {
    return {
      label: "UNKNOWN",
      score: 50,
      overlapHours: null,
      description: "Timezone unlisted or invalid; neutral baseline applied.",
    };
  }

  // Calculate pairwise working-hour overlap (09:00 - 18:00 = 9h window) with each team member
  const pairwiseOverlaps = validTeamOffsets.map((teamOffset) => {
    const diffHours = Math.abs(candidateOffset - teamOffset) / 60;
    return Math.max(0, Math.round((9 - diffHours) * 10) / 10);
  });

  const totalOverlap = pairwiseOverlaps.reduce((sum, o) => sum + o, 0);
  const avgOverlap = Math.round((totalOverlap / pairwiseOverlaps.length) * 10) / 10;
  const minOverlap = Math.min(...pairwiseOverlaps);

  let label: TimezoneCompatibilityLabel;
  let score: number;
  let description: string;

  if (avgOverlap >= 6) {
    label = "STRONG";
    score = 100;
    if (minOverlap < 2 && validTeamOffsets.length > 1) {
      description = `Approx. ${avgOverlap} hrs avg working-hour overlap (distributed squad with varied member coverage).`;
    } else {
      description = `Approx. ${avgOverlap} hours of shared working-hour overlap across the squad.`;
    }
  } else if (avgOverlap >= 4) {
    label = "MODERATE";
    score = 75;
    description = `Approx. ${avgOverlap} hours of shared working-hour overlap.`;
  } else if (avgOverlap >= 1) {
    label = "LIMITED";
    score = 50;
    description = `Limited working-hour overlap (~${avgOverlap} hours). Asynchronous communication recommended.`;
  } else {
    label = "MINIMAL";
    score = 25;
    description = "Minimal working-hour overlap. Best suited for fully asynchronous collaboration.";
  }

  return {
    label,
    score,
    overlapHours: avgOverlap,
    description,
  };
}

/**
 * Calculates Skill Complementarity (0 - 100) and extracts complementary vs overlapping skills.
 */
export function calculateSkillComplementarity(
  candidateSkills: string[],
  skillsNeeded: string[],
  teamCoveredSkills: Set<string>
): {
  score: number;
  complementarySkills: string[];
  overlappingSkills: string[];
  explanation: string;
} {
  const normCandidate = candidateSkills.map((s) => s.trim()).filter(Boolean);

  if (normCandidate.length === 0) {
    return {
      score: 10,
      complementarySkills: [],
      overlappingSkills: [],
      explanation: "No technical skills listed on candidate profile.",
    };
  }

  const normNeeded = skillsNeeded.map((s) => s.trim()).filter(Boolean);
  const neededLower = normNeeded.map((s) => s.toLowerCase());

  // 1. Target needs match
  const complementaryNeeded: string[] = [];
  for (const skill of normCandidate) {
    const lower = skill.toLowerCase();
    if (neededLower.includes(lower)) {
      complementaryNeeded.push(skill);
    }
  }

  // Complementary non-needed skills that expand team's uncovered breadth
  const expandingSkills: string[] = [];
  const overlappingSkills: string[] = [];

  for (const skill of normCandidate) {
    const lower = skill.toLowerCase();
    if (teamCoveredSkills.has(lower)) {
      overlappingSkills.push(skill);
    } else if (!neededLower.includes(lower)) {
      expandingSkills.push(skill);
    }
  }

  const allComplementary = [...complementaryNeeded, ...expandingSkills];

  let needScore = 0;
  if (normNeeded.length > 0) {
    needScore = (complementaryNeeded.length / normNeeded.length) * 60;
  } else {
    // If team has no explicit needed skills, adding missing capabilities fills the need score
    needScore = Math.min(60, expandingSkills.length * 20);
  }

  // Diversity score (up to 25 pts)
  const diversityScore = Math.min(25, expandingSkills.length * 8 + complementaryNeeded.length * 5);

  // Collaboration overlap (up to 15 pts)
  let overlapScore = 5;
  if (overlappingSkills.length >= 1 && overlappingSkills.length <= 2) {
    overlapScore = 15; // Optimal shared foundation
  } else if (overlappingSkills.length > 2) {
    overlapScore = 10; // Diminishing return due to duplication
  }

  const totalSkillScore = Math.min(
    100,
    Math.max(0, Math.round(needScore + diversityScore + overlapScore))
  );

  let explanation = "";
  if (complementaryNeeded.length > 0) {
    explanation = `Directly fulfills ${complementaryNeeded.length} squad requirement${
      complementaryNeeded.length > 1 ? "s" : ""
    } (${complementaryNeeded.slice(0, 3).join(", ")})`;
    if (overlappingSkills.length > 0) {
      explanation += ` with shared ${overlappingSkills.slice(0, 2).join(", ")} foundation`;
    }
    explanation += ".";
  } else if (expandingSkills.length > 0) {
    explanation = `Expands squad technical breadth with ${expandingSkills.slice(0, 3).join(", ")}.`;
  } else {
    explanation = "Strong skill alignment with existing squad stack.";
  }

  return {
    score: totalSkillScore,
    complementarySkills: allComplementary,
    overlappingSkills,
    explanation,
  };
}

/**
 * Calculates Experience Compatibility (0 - 100) based on team distribution and candidate level.
 */
export function calculateExperienceCompatibility(
  candidateExp?: ExperienceLevel,
  teamMembersExp: Array<ExperienceLevel | undefined> = []
): {
  score: number;
  explanation: string;
} {
  if (!candidateExp) {
    return {
      score: 50,
      explanation: "Experience level unlisted; neutral compatibility baseline applied.",
    };
  }

  const validTeamExp = teamMembersExp.filter((e): e is ExperienceLevel => Boolean(e));
  if (validTeamExp.length === 0) {
    if (candidateExp === "ADVANCED" || candidateExp === "INTERMEDIATE") {
      return {
        score: 85,
        explanation: `${candidateExp.toLowerCase()} experience level offers a strong starting foundation.`,
      };
    }
    return {
      score: 80,
      explanation: "beginner experience level offers a solid starting foundation.",
    };
  }

  const beginnerCount = validTeamExp.filter((e) => e === "BEGINNER").length;
  const advancedCount = validTeamExp.filter((e) => e === "ADVANCED").length;

  // Case 1: Team has predominantly beginner members
  if (beginnerCount > validTeamExp.length / 2) {
    if (candidateExp === "ADVANCED") {
      return {
        score: 100,
        explanation:
          "Advanced background brings essential architectural leadership and mentorship.",
      };
    }
    if (candidateExp === "INTERMEDIATE") {
      return {
        score: 90,
        explanation:
          "Intermediate experience adds practical development momentum to an early-stage squad.",
      };
    }
    return {
      score: 70,
      explanation: "Peer beginner; squad may benefit from senior technical guidance.",
    };
  }

  // Case 2: Team is predominantly advanced
  if (advancedCount > validTeamExp.length / 2) {
    if (candidateExp === "INTERMEDIATE") {
      return {
        score: 95,
        explanation: "Solid intermediate developer ready to execute alongside senior leadership.",
      };
    }
    if (candidateExp === "ADVANCED") {
      return {
        score: 90,
        explanation: "Peer senior contributor capable of driving complex distributed subsystems.",
      };
    }
    return {
      score: 75,
      explanation: "Junior contributor; team has ample senior bandwidth for mentorship.",
    };
  }

  // Case 3: Balanced or intermediate squad
  if (candidateExp === "INTERMEDIATE") {
    return {
      score: 95,
      explanation: "Intermediate capability maintains balanced development throughput.",
    };
  }
  if (candidateExp === "ADVANCED") {
    return {
      score: 90,
      explanation: "Advanced skillset reinforces architectural rigor across the squad.",
    };
  }
  return {
    score: 80,
    explanation: "Beginner level well supported by squad's existing development experience.",
  };
}

/**
 * Pure evaluation function scoring a single candidate for a team context.
 */
export function scoreCandidate(
  candidate: CandidateScoringInput,
  teamCtx: TeamScoringContext,
  refDate: Date = new Date()
): TeammateRecommendationDTO {
  // Collect team covered skills lowercased
  const coveredSkillsSet = new Set<string>();
  for (const m of teamCtx.members) {
    for (const s of m.skills) {
      coveredSkillsSet.add(s.trim().toLowerCase());
    }
  }

  // 1. Skill Complementarity
  const skillResult = calculateSkillComplementarity(
    candidate.skills,
    teamCtx.skillsNeeded,
    coveredSkillsSet
  );

  // 2. Experience Compatibility
  const expResult = calculateExperienceCompatibility(
    candidate.experienceLevel,
    teamCtx.members.map((m) => m.experienceLevel)
  );

  // 3. Timezone Overlap
  const tzResult = calculateTimezoneOverlap(
    candidate.timeZone,
    teamCtx.members.map((m) => m.timeZone).filter((tz): tz is string => Boolean(tz)),
    refDate
  );

  // Composite Normalized Score: 50% Skill, 25% Experience, 25% Timezone
  const rawComposite = 0.5 * skillResult.score + 0.25 * expResult.score + 0.25 * tzResult.score;
  const compatibilityScore = Math.min(100, Math.max(0, Math.round(rawComposite)));

  // Compose overall summary explanation
  const summary = `${skillResult.explanation} ${expResult.explanation} ${tzResult.description}`;

  const candidateDto: CandidatePublicDTO = {
    id: candidate.id,
    displayName: candidate.displayName,
    avatarUrl: candidate.avatarUrl,
    bio: candidate.bio,
    skills: candidate.skills,
    experienceLevel: candidate.experienceLevel,
    githubUrl: candidate.githubUrl,
    linkedinUrl: candidate.linkedinUrl,
    portfolioUrl: candidate.portfolioUrl,
  };

  return {
    candidate: candidateDto,
    compatibilityScore,
    dimensionScores: {
      skillScore: skillResult.score,
      experienceScore: expResult.score,
      timezoneScore: tzResult.score,
    },
    explanations: {
      summary,
      complementarySkills: skillResult.complementarySkills,
      overlappingSkills: skillResult.overlappingSkills,
      experienceFit: expResult.explanation,
      timezoneFit: {
        label: tzResult.label,
        overlapHours: tzResult.overlapHours,
        description: tzResult.description,
      },
    },
  };
}
