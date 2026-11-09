import { z } from "zod";

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
  skills: z.array(z.string().trim().min(1)).min(1, "At least one skill is required").max(20),
  timeZone: z.string().trim().optional().default("UTC"),
  bio: z.string().max(500).optional(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

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
