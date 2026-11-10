import type {
  ApiResponse,
  ApiErrorResponse,
  UserDTO,
  RegisterInput,
  LoginInput,
} from "@crewconnect/shared";

const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface ApiPaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export async function apiRequestWithMeta<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; meta?: ApiResponse<T>["meta"] }> {
  const url = `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = data as ApiErrorResponse | null;
    throw new ApiClientError(
      errorBody?.error?.code || "HTTP_ERROR",
      errorBody?.error?.message || `Request failed with status ${response.status}`,
      response.status,
      errorBody?.error?.details
    );
  }

  const successBody = data as ApiResponse<T>;
  return { data: successBody.data, meta: successBody.meta };
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const result = await apiRequestWithMeta<T>(endpoint, options);
  return result.data;
}

export async function fetchHealth(): Promise<{
  status: string;
  uptime: number;
  timestamp: string;
  version: string;
  database: { connected: boolean; status: string; isReplicaSet: boolean };
}> {
  const url = `${BASE_URL}/health`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

export async function apiRegister(data: RegisterInput): Promise<{ user: UserDTO }> {
  return apiRequest<{ user: UserDTO }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiLogin(data: LoginInput): Promise<{ user: UserDTO }> {
  return apiRequest<{ user: UserDTO }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiGetMe(): Promise<{ user: UserDTO }> {
  return apiRequest<{ user: UserDTO }>("/auth/me", {
    method: "GET",
  });
}

export async function apiLogout(): Promise<void> {
  await apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
  });
}

// -------------------------------------------------------------------
// Hackathons & Teams API
// -------------------------------------------------------------------

export interface HackathonRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  minTeamSize: number;
  maxTeamSize: number;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED";
  startDate: string;
  endDate: string;
}

export interface TeamRecord {
  id: string;
  hackathonId: string;
  name: string;
  tagline?: string;
  description?: string;
  skillsNeeded: string[];
  memberCount: number;
  maxCapacity: number;
  isOpen: boolean;
  status: "ACTIVE" | "DISBANDED" | "ARCHIVED";
  leaderId: string | { id: string; displayName: string; email?: string; skills?: string[] };
  leader?: { id: string; displayName: string; email?: string; skills?: string[] };
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberRecord {
  id: string;
  hackathonId: string;
  teamId: string;
  userId:
    | {
        id: string;
        displayName: string;
        email: string;
        skills: string[];
        bio?: string;
        githubUrl?: string;
        experienceLevel?: string;
      }
    | string;
  role: "LEADER" | "MEMBER";
  status: "ACTIVE" | "LEFT" | "REMOVED";
  joinedAt: string;
  leftAt?: string;
}

export interface AuditLogRecord {
  id: string;
  hackathonId: string;
  teamId?: string;
  actorId: { id: string; displayName: string; email: string } | string;
  targetUserId?: { id: string; displayName: string; email: string } | string;
  action: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export async function apiGetHackathons(): Promise<HackathonRecord[]> {
  return apiRequest<HackathonRecord[]>("/hackathons");
}

export async function apiGetHackathon(id: string): Promise<HackathonRecord> {
  return apiRequest<HackathonRecord>(`/hackathons/${id}`);
}

const TEAM_PAGINATION_META = Symbol("teamPaginationMeta");

type TeamListWithMeta = TeamRecord[] & {
  [TEAM_PAGINATION_META]?: ApiPaginationMeta;
};

export function attachTeamPaginationMeta(
  teams: TeamRecord[],
  meta: ApiPaginationMeta
): TeamRecord[] {
  const tagged = teams as TeamListWithMeta;
  tagged[TEAM_PAGINATION_META] = meta;
  return tagged;
}

export function getTeamListPaginationMeta(
  teams: TeamRecord[],
  fallbackPage = 1,
  fallbackLimit = 12
): ApiPaginationMeta {
  const meta = (teams as TeamListWithMeta)[TEAM_PAGINATION_META];
  if (meta) {
    return meta;
  }
  return {
    page: fallbackPage,
    limit: fallbackLimit,
    total: teams.length,
  };
}

export async function apiGetHackathonTeams(
  hackathonId: string,
  params: {
    page?: number;
    limit?: number;
    search?: string;
    hasVacancies?: boolean;
    skills?: string[];
  } = {}
): Promise<TeamRecord[]> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search) query.set("search", params.search);
  if (params.hasVacancies) query.set("hasVacancies", "true");
  if (params.skills && params.skills.length > 0) query.set("skills", params.skills.join(","));

  const qs = query.toString();
  const res = await apiRequestWithMeta<TeamRecord[]>(
    `/hackathons/${hackathonId}/teams${qs ? `?${qs}` : ""}`
  );
  const teams = res.data;
  if (res.meta) {
    attachTeamPaginationMeta(teams, {
      page: res.meta.page ?? params.page ?? 1,
      limit: res.meta.limit ?? params.limit ?? 20,
      total: res.meta.total ?? teams.length,
    });
  }
  return teams;
}

export async function apiGetMyTeam(
  hackathonId: string
): Promise<{ team: TeamRecord; role: string } | null> {
  return apiRequest<{ team: TeamRecord; role: string } | null>(
    `/hackathons/${hackathonId}/my-team`
  );
}

export async function apiCreateTeam(
  hackathonId: string,
  data: {
    name: string;
    tagline?: string;
    description?: string;
    skillsNeeded?: string[];
    maxCapacity?: number;
  }
): Promise<{ team: TeamRecord; membership: TeamMemberRecord }> {
  return apiRequest<{ team: TeamRecord; membership: TeamMemberRecord }>(
    `/hackathons/${hackathonId}/teams`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function apiGetTeam(teamId: string): Promise<TeamRecord> {
  return apiRequest<TeamRecord>(`/teams/${teamId}`);
}

export async function apiGetTeamRoster(teamId: string): Promise<TeamMemberRecord[]> {
  return apiRequest<TeamMemberRecord[]>(`/teams/${teamId}/members`);
}

export async function apiUpdateTeam(
  teamId: string,
  data: {
    name?: string;
    tagline?: string;
    description?: string;
    skillsNeeded?: string[];
    maxCapacity?: number;
    isOpen?: boolean;
  }
): Promise<TeamRecord> {
  return apiRequest<TeamRecord>(`/teams/${teamId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function apiOpenTeam(teamId: string): Promise<TeamRecord> {
  return apiRequest<TeamRecord>(`/teams/${teamId}/open`, {
    method: "POST",
  });
}

export async function apiCloseTeam(teamId: string): Promise<TeamRecord> {
  return apiRequest<TeamRecord>(`/teams/${teamId}/close`, {
    method: "POST",
  });
}

export async function apiTransferLeadership(
  teamId: string,
  newLeaderId: string
): Promise<TeamRecord> {
  return apiRequest<TeamRecord>(`/teams/${teamId}/transfer-leadership`, {
    method: "POST",
    body: JSON.stringify({ newLeaderId }),
  });
}

export async function apiLeaveTeam(
  teamId: string
): Promise<{ disbanded: boolean; team: TeamRecord }> {
  return apiRequest<{ disbanded: boolean; team: TeamRecord }>(`/teams/${teamId}/leave`, {
    method: "POST",
  });
}

export async function apiRemoveMember(teamId: string, userId: string): Promise<TeamRecord> {
  return apiRequest<TeamRecord>(`/teams/${teamId}/members/${userId}`, {
    method: "DELETE",
  });
}

export async function apiDisbandTeam(teamId: string): Promise<TeamRecord> {
  return apiRequest<TeamRecord>(`/teams/${teamId}/disband`, {
    method: "POST",
  });
}

export async function apiGetTeamAuditLogs(teamId: string): Promise<AuditLogRecord[]> {
  return apiRequest<AuditLogRecord[]>(`/teams/${teamId}/audit-logs`);
}

// -------------------------------------------------------------------
// Phase 5: Race-Proof Membership, Join Requests & Invitations
// -------------------------------------------------------------------

export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export interface JoinTeamResponse {
  membershipId: string;
  teamId: string;
  userId: string;
  role: string;
  status: string;
  currentMemberCount: number;
  maxCapacity: number;
  joinedAt: string;
}

export async function apiJoinTeam(
  teamId: string,
  idempotencyKey?: string
): Promise<JoinTeamResponse> {
  const key = idempotencyKey || generateIdempotencyKey();
  return apiRequest<JoinTeamResponse>(`/teams/${teamId}/join`, {
    method: "POST",
    headers: {
      "Idempotency-Key": key,
    },
  });
}

export interface JoinRequestRecord {
  id: string;
  hackathonId: string;
  teamId: string;
  userId:
    | string
    | {
        id: string;
        displayName: string;
        email?: string;
        skills?: string[];
        bio?: string;
        githubUrl?: string;
        experienceLevel?: string;
      };
  message?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  createdAt: string;
}

export async function apiCreateJoinRequest(
  teamId: string,
  message?: string
): Promise<JoinRequestRecord> {
  return apiRequest<JoinRequestRecord>(`/teams/${teamId}/join-requests`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function apiGetJoinRequests(teamId: string): Promise<JoinRequestRecord[]> {
  return apiRequest<JoinRequestRecord[]>(`/teams/${teamId}/join-requests`);
}

export async function apiApproveJoinRequest(
  teamId: string,
  requestId: string,
  idempotencyKey?: string
): Promise<JoinTeamResponse> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  return apiRequest<JoinTeamResponse>(`/teams/${teamId}/join-requests/${requestId}/approve`, {
    method: "POST",
    headers,
  });
}

export async function apiRejectJoinRequest(
  teamId: string,
  requestId: string
): Promise<JoinRequestRecord> {
  return apiRequest<JoinRequestRecord>(`/teams/${teamId}/join-requests/${requestId}/reject`, {
    method: "POST",
  });
}

export async function apiCancelJoinRequest(
  teamId: string,
  requestId: string
): Promise<JoinRequestRecord> {
  return apiRequest<JoinRequestRecord>(`/teams/${teamId}/join-requests/${requestId}`, {
    method: "DELETE",
  });
}

export interface InvitationRecord {
  id: string;
  hackathonId: string;
  teamId: string;
  inviterId: string | { id: string; displayName: string };
  inviteeId?: string | { id: string; displayName: string };
  status: "ACTIVE" | "EXPIRED" | "REVOKED" | "EXHAUSTED";
  usesCount: number;
  maxUses: number;
  expiresAt: string;
  createdAt: string;
}

export async function apiCreateInvitation(
  teamId: string,
  data: { inviteeId?: string; maxUses?: number; expiresInHours?: number }
): Promise<{ invitation: InvitationRecord; token: string }> {
  return apiRequest<{ invitation: InvitationRecord; token: string }>(
    `/teams/${teamId}/invitations`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function apiGetInvitations(teamId: string): Promise<InvitationRecord[]> {
  return apiRequest<InvitationRecord[]>(`/teams/${teamId}/invitations`);
}

export async function apiRevokeInvitation(
  teamId: string,
  invitationId: string
): Promise<InvitationRecord> {
  return apiRequest<InvitationRecord>(`/teams/${teamId}/invitations/${invitationId}`, {
    method: "DELETE",
  });
}

export async function apiAcceptInvitation(
  token: string,
  idempotencyKey?: string
): Promise<JoinTeamResponse> {
  const key = idempotencyKey || generateIdempotencyKey();
  return apiRequest<JoinTeamResponse>("/invitations/accept", {
    method: "POST",
    headers: {
      "Idempotency-Key": key,
    },
    body: JSON.stringify({ token }),
  });
}
