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

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
  return successBody.data;
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
  return apiRequest<TeamRecord[]>(`/hackathons/${hackathonId}/teams${qs ? `?${qs}` : ""}`);
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
