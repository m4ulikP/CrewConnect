export const USER_STATUS = ["ACTIVE", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const TEAM_ROLES = ["LEADER", "MEMBER"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const MEMBERSHIP_STATUS = ["ACTIVE", "LEFT", "REMOVED"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUS)[number];

export const TEAM_STATUS = ["ACTIVE", "DISBANDED", "ARCHIVED"] as const;
export type TeamStatus = (typeof TEAM_STATUS)[number];

export const HACKATHON_STATUS = ["UPCOMING", "ACTIVE", "COMPLETED"] as const;
export type HackathonStatus = (typeof HACKATHON_STATUS)[number];

export const INVITATION_STATUS = ["ACTIVE", "EXPIRED", "REVOKED", "EXHAUSTED"] as const;
export type InvitationStatus = (typeof INVITATION_STATUS)[number];

export const JOIN_REQUEST_STATUS = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUS)[number];

export const IDEMPOTENCY_STATUS = ["PROCESSING", "COMPLETED", "FAILED"] as const;
export type IdempotencyStatus = (typeof IDEMPOTENCY_STATUS)[number];

export const AUDIT_ACTIONS = [
  "TEAM_CREATED",
  "TEAM_UPDATED",
  "TEAM_OPENED",
  "TEAM_CLOSED",
  "TEAM_DISBANDED",
  "MEMBER_JOINED",
  "MEMBER_LEFT",
  "MEMBER_REMOVED",
  "LEADERSHIP_TRANSFERRED",
  "INVITE_CREATED",
  "INVITE_REDEEMED",
  "JOIN_REQUEST_SUBMITTED",
  "JOIN_REQUEST_APPROVED",
  "JOIN_REQUEST_REJECTED",
  "COUNTER_RECONCILED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const DEFAULT_MIN_TEAM_SIZE = 1;
export const DEFAULT_MAX_TEAM_SIZE = 5;
export const IDEMPOTENCY_LEASE_TIMEOUT_MS = 30_000; // 30 seconds lease window
export const IDEMPOTENCY_TTL_SECONDS = 86_400; // 24 hours TTL
