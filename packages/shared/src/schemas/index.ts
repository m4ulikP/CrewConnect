import { z } from "zod";
import { EXPERIENCE_LEVELS } from "../constants/index.js";

function isValidIanaTimezone(tz: string): boolean {
  if (typeof tz !== "string" || !tz.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

function isValidHttpUrl(val: string): boolean {
  try {
    const url = new URL(val);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const optionalUrlSchema = z
  .union([
    z
      .string()
      .trim()
      .max(200, "URL must not exceed 200 characters")
      .refine(isValidHttpUrl, { message: "Must be a valid HTTP or HTTPS URL" }),
    z.literal(""),
    z.null(),
  ])
  .optional();

export const UpdateProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Display name must be at least 2 characters")
      .max(50, "Display name must not exceed 50 characters")
      .optional(),
    bio: z
      .union([
        z.string().max(500, "Bio cannot exceed 500 characters").trim(),
        z.literal(""),
        z.null(),
      ])
      .optional(),
    skills: z
      .array(
        z
          .string()
          .trim()
          .min(1, "Skill name cannot be empty")
          .max(40, "Skill name cannot exceed 40 characters")
      )
      .max(20, "Cannot provide more than 20 skills")
      .refine(
        (items) => {
          const seen = new Set<string>();
          for (const item of items) {
            const normalized = item.toLowerCase();
            if (seen.has(normalized)) return false;
            seen.add(normalized);
          }
          return true;
        },
        { message: "Skills must not contain duplicate items" }
      )
      .optional(),
    timeZone: z
      .string()
      .trim()
      .refine(isValidIanaTimezone, { message: "Invalid IANA timezone identifier" })
      .optional(),
    experienceLevel: z
      .enum(EXPERIENCE_LEVELS, {
        errorMap: () => ({
          message: "Experience level must be BEGINNER, INTERMEDIATE, or ADVANCED",
        }),
      })
      .optional(),
    githubUrl: optionalUrlSchema,
    linkedinUrl: optionalUrlSchema,
    portfolioUrl: optionalUrlSchema,
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const RegisterSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Password must contain at least one digit")
    .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character"),
  displayName: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(50, "Display name must not exceed 50 characters")
    .trim(),
  skills: z.array(z.string().trim().min(1)).max(20).optional().default([]),
  timeZone: z.string().trim().optional().default("UTC"),
  bio: z.string().max(500).optional(),
});
export type RegisterInput = z.input<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const CreateTeamSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters").max(50).trim(),
  tagline: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  skillsNeeded: z.array(z.string().trim()).max(20).default([]),
  maxCapacity: z.number().int().min(1).max(10).optional(),
});
export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;

export const UpdateTeamSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters").max(50).trim().optional(),
  tagline: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  skillsNeeded: z.array(z.string().trim()).max(20).optional(),
  maxCapacity: z.number().int().min(1).max(10).optional(),
  isOpen: z.boolean().optional(),
});
export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>;

export const TransferLeadershipSchema = z.object({
  newLeaderId: z.string().min(1, "New leader ID is required"),
});
export type TransferLeadershipInput = z.infer<typeof TransferLeadershipSchema>;

export const CreateInviteCodeSchema = z.object({
  maxUses: z.number().int().min(1).max(10).default(1),
  expiresInHours: z.number().min(1).max(168).default(24), // Max 7 days
});
export type CreateInviteCodeInput = z.infer<typeof CreateInviteCodeSchema>;

export const CreateInvitationSchema = z.object({
  inviteeId: z.string().optional(),
  maxUses: z.number().int().min(1).max(10).default(1),
  expiresInHours: z.number().min(1).max(168).default(24),
});
export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>;

export const AcceptInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required").trim(),
});
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;

export const RedeemInviteCodeSchema = z.object({
  inviteCode: z.string().min(4, "Invalid invite code format").trim().toUpperCase(),
});
export type RedeemInviteCodeInput = z.infer<typeof RedeemInviteCodeSchema>;

export const CreateJoinRequestSchema = z.object({
  message: z.string().max(300).optional(),
});
export type CreateJoinRequestInput = z.infer<typeof CreateJoinRequestSchema>;

export const ResolveJoinRequestSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
});
export type ResolveJoinRequestInput = z.infer<typeof ResolveJoinRequestSchema>;

const strictIntQuery = (name: string, min: number, max: number, fallback: number) =>
  z.preprocess(
    (val) => {
      if (val === undefined) return fallback;
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed === "" || !/^-?\d+$/.test(trimmed)) return Number.NaN;
        return Number(trimmed);
      }
      return Number.NaN;
    },
    z
      .number()
      .int(`${name} must be an integer`)
      .min(min, `${name} must be at least ${min}`)
      .max(max, `${name} must be at most ${max}`)
  );

export const ListTeamsQuerySchema = z.object({
  page: strictIntQuery("Page", 1, 10_000, 1),
  limit: strictIntQuery("Limit", 1, 50, 20),
  search: z
    .string()
    .trim()
    .max(100, "Search query must not exceed 100 characters")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  hasVacancies: z.preprocess(
    (val) => {
      if (val === undefined || val === "") return false;
      if (val === true || val === "true") return true;
      if (val === false || val === "false") return false;
      return val;
    },
    z.boolean({ invalid_type_error: "hasVacancies must be 'true' or 'false'" })
  ),
  skills: z.preprocess(
    (val) => {
      if (val === undefined) return undefined;
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (!trimmed) return undefined;
        return trimmed
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (Array.isArray(val)) {
        return val
          .flatMap((item) => (typeof item === "string" ? item.split(",") : [item]))
          .map((s) => (typeof s === "string" ? s.trim() : s))
          .filter((s) => s !== "");
      }
      return val;
    },
    z
      .array(z.string().min(1).max(40, "Skill filter must not exceed 40 characters"))
      .max(20, "Cannot filter by more than 20 skills")
      .optional()
  ),
});
export type ListTeamsQueryInput = z.infer<typeof ListTeamsQuerySchema>;

// Phase 5: Recommendation Query Schema
export const RecommendationQuerySchema = z.object({
  page: z.preprocess((val) => {
    if (val === undefined || val === "") return 1;
    const num = Number(val);
    return Number.isFinite(num) ? Math.floor(num) : 1;
  }, z.number().int().min(1, "Page must be at least 1").default(1)),
  limit: z.preprocess((val) => {
    if (val === undefined || val === "") return 10;
    const num = Number(val);
    return Number.isFinite(num) ? Math.floor(num) : 10;
  }, z.number().int().min(1, "Limit must be at least 1").max(50, "Limit cannot exceed 50").default(10)),
});
export type RecommendationQueryInput = z.infer<typeof RecommendationQuerySchema>;
