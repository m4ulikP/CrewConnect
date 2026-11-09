import type {
  TeamRole,
  MembershipStatus,
  TeamStatus,
  HackathonStatus,
  InvitationStatus,
  JoinRequestStatus,
  AuditAction,
  IdempotencyStatus,
} from "../constants/index.js";
import type { ErrorCode } from "../errors/index.js";

// Standard API Responses
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  [key: string]: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId?: string;
  };
}

// Domain Entities
export interface UserDTO {
  id: string;
  email: string;
  displayName: string;
  bio?: string;
  skills: string[];
  experienceLevel?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  githubUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  createdAt: string;
}

export interface HackathonDTO {
  id: string;
  slug: string;
  title: string;
  description: string;
  minTeamSize: number;
  maxTeamSize: number;
  status: HackathonStatus;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface TeamDTO {
  id: string;
  hackathonId: string;
  name: string;
  tagline?: string;
  description?: string;
  skillsNeeded: string[];
  memberCount: number;
  maxCapacity: number;
  isOpen: boolean;
  status: TeamStatus;
  leaderId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipDTO {
  id: string;
  hackathonId: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  status: MembershipStatus;
  joinedAt: string;
  leftAt?: string;
}

export interface JoinRequestDTO {
  id: string;
  hackathonId: string;
  teamId: string;
  userId: string;
  message?: string;
  status: JoinRequestStatus;
  createdAt: string;
}

export interface InvitationDTO {
  id: string;
  hackathonId: string;
  teamId: string;
  inviterId: string;
  inviteeId?: string;
  status: InvitationStatus;
  usesCount: number;
  maxUses: number;
  expiresAt: string;
  createdAt: string;
}

export interface AuditLogDTO {
  id: string;
  hackathonId: string;
  teamId?: string;
  actorId: string;
  targetUserId?: string;
  action: AuditAction;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface IdempotencyRecordDTO {
  id: string;
  key: string;
  userId: string;
  endpoint: string;
  payloadHash: string;
  ownerToken: string;
  status: IdempotencyStatus;
  lockedAt?: string;
  completedAt?: string;
  statusCode?: number;
  responseBody?: unknown;
  expiresAt: string;
}
