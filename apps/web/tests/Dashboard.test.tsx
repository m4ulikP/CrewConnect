/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext, AuthProvider } from "../src/context/AuthContext";
import { SocketContext } from "../src/context/SocketContext";
import { ProtectedRoute } from "../src/components/ProtectedRoute";
import { AuthenticatedDashboard } from "../src/components/dashboard/AuthenticatedDashboard";
import * as apiModule from "../src/lib/api";

const userAlice = {
  id: "user-alice",
  email: "alice@example.com",
  displayName: "Alice Lin",
  skills: ["Rust", "TypeScript"],
  status: "ACTIVE" as const,
  createdAt: new Date().toISOString(),
};

const userBob = {
  id: "user-bob",
  email: "bob@example.com",
  displayName: "Bob Diaz",
  skills: ["React"],
  status: "ACTIVE" as const,
  createdAt: new Date().toISOString(),
};

const mockHackathons: apiModule.HackathonRecord[] = [
  {
    id: "hack-1",
    slug: "spring-systems-2026",
    title: "Spring Systems 2026",
    description: "Systems challenge",
    minTeamSize: 1,
    maxTeamSize: 4,
    status: "ACTIVE",
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
  },
];

const aliceTeam: apiModule.TeamRecord = {
  id: "team-alice",
  hackathonId: "hack-1",
  name: "LockFree Guild",
  tagline: "Atomic state coordination",
  description: "Distributed seat coordinator",
  skillsNeeded: ["Rust", "MongoDB"],
  memberCount: 2,
  maxCapacity: 4,
  isOpen: true,
  status: "ACTIVE",
  leaderId: "user-alice",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const aliceRoster: apiModule.TeamMemberRecord[] = [
  {
    id: "mem-1",
    hackathonId: "hack-1",
    teamId: "team-alice",
    userId: {
      id: "user-alice",
      displayName: "Alice Lin",
      email: "alice@example.com",
      skills: ["Rust"],
    },
    role: "LEADER",
    status: "ACTIVE",
    joinedAt: new Date().toISOString(),
  },
];

const pendingReq: apiModule.JoinRequestRecord = {
  id: "req-1",
  hackathonId: "hack-1",
  teamId: "team-alice",
  userId: {
    id: "user-charlie",
    displayName: "Charlie Gomez",
    skills: ["TypeScript"],
  },
  message: "Happy to help with API instrumentation.",
  status: "PENDING",
  createdAt: new Date().toISOString(),
};

const mockAuditLogs: apiModule.AuditLogRecord[] = [
  {
    id: "log-1",
    hackathonId: "hack-1",
    teamId: "team-alice",
    actorId: { id: "user-alice", displayName: "Alice Lin", email: "alice@example.com" },
    action: "TEAM_CREATED",
    metadata: {},
    timestamp: new Date().toISOString(),
  },
];

function renderDashboardWithUser(
  currentUser: typeof userAlice | null,
  options: { queryClient?: QueryClient; refreshUser?: () => Promise<void> } = {}
) {
  const queryClient =
    options.queryClient ||
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  const refreshUser = options.refreshUser || vi.fn(async () => {});

  return {
    queryClient,
    refreshUser,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: currentUser,
            isLoading: false,
            error: null,
            login: vi.fn(),
            register: vi.fn(),
            logout: vi.fn(),
            refreshUser,
            clearError: vi.fn(),
          }}
        >
          <SocketContext.Provider
            value={{
              socket: null,
              connectionState: "connected",
              joinHackathonRoom: vi.fn(),
              leaveHackathonRoom: vi.fn(),
              joinTeamRoom: vi.fn(),
              leaveTeamRoom: vi.fn(),
            }}
          >
            <MemoryRouter initialEntries={["/dashboard"]}>
              <Routes>
                <Route path="/login" element={<div>Redirected to Login Page</div>} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <AuthenticatedDashboard key={currentUser?.id || "anon"} />
                    </ProtectedRoute>
                  }
                />
                <Route path="/teams/:teamId" element={<div>Squad Workspace Target</div>} />
              </Routes>
            </MemoryRouter>
          </SocketContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    ),
  };
}

describe("Phase 4 — Authenticated Dashboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects unauthenticated visitors away from /dashboard via ProtectedRoute", async () => {
    vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>Redirected to Login Page</div>} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <AuthenticatedDashboard />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Redirected to Login Page")).toBeInTheDocument();
    });
  });

  it("renders user identity, active leader squad, persisted activity, and backend gap disclosures", async () => {
    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
    vi.spyOn(apiModule, "apiGetMyTeam").mockResolvedValue({ team: aliceTeam, role: "LEADER" });
    vi.spyOn(apiModule, "apiGetTeamRoster").mockResolvedValue(aliceRoster);
    vi.spyOn(apiModule, "apiGetJoinRequests").mockResolvedValue([pendingReq]);
    vi.spyOn(apiModule, "apiGetTeamAuditLogs").mockResolvedValue(mockAuditLogs);
    vi.spyOn(apiModule, "apiGetHackathonTeams").mockResolvedValue([aliceTeam]);

    renderDashboardWithUser(userAlice);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /Alice Lin/i })).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 2, name: /Incoming Join Requests/i })
      ).toBeInTheDocument();
      expect(screen.getByText("Scope: Spring Systems 2026")).toBeInTheDocument();
      expect(screen.getByText("LockFree Guild")).toBeInTheDocument();
      expect(screen.getByText("Team Leader")).toBeInTheDocument();
      expect(screen.getByText("Charlie Gomez")).toBeInTheDocument();
      expect(screen.getByText(/created this squad/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/GET \/api\/v1\/me\/join-requests/i)).toBeInTheDocument();
    expect(screen.getByText(/GET \/api\/v1\/me\/invitations/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Squad Workspace/i })).toHaveAttribute(
      "href",
      "/teams/team-alice"
    );
  });

  it("renders Incoming Join Requests empty and error/retry states cleanly", async () => {
    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
    vi.spyOn(apiModule, "apiGetMyTeam").mockResolvedValue({ team: aliceTeam, role: "LEADER" });
    vi.spyOn(apiModule, "apiGetTeamRoster").mockResolvedValue(aliceRoster);
    vi.spyOn(apiModule, "apiGetTeamAuditLogs").mockResolvedValue(mockAuditLogs);
    vi.spyOn(apiModule, "apiGetHackathonTeams").mockResolvedValue([]);
    const reqSpy = vi
      .spyOn(apiModule, "apiGetJoinRequests")
      .mockRejectedValueOnce(new Error("Incoming queue unavailable"))
      .mockResolvedValueOnce([]);

    renderDashboardWithUser(userAlice);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: /Incoming Join Requests/i })
      ).toBeInTheDocument();
      expect(screen.getByText("Incoming queue unavailable")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Retry loading incoming join requests/i }));

    await waitFor(() => {
      expect(reqSpy).toHaveBeenCalledTimes(2);
      expect(
        screen.getByText(/No incoming join requests awaiting your review for LockFree Guild/i)
      ).toBeInTheDocument();
    });
  });

  it("renders hackathon-scoped empty state without implying user has no squads globally", async () => {
    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
    vi.spyOn(apiModule, "apiGetMyTeam").mockResolvedValue(null);
    vi.spyOn(apiModule, "apiGetHackathonTeams").mockResolvedValue([aliceTeam]);

    const auditSpy = vi.spyOn(apiModule, "apiGetTeamAuditLogs");
    const joinReqSpy = vi.spyOn(apiModule, "apiGetJoinRequests");

    renderDashboardWithUser(userBob);

    await waitFor(() => {
      expect(screen.getByText("No active squad in Spring Systems 2026")).toBeInTheDocument();
      expect(
        screen.getByText(/Memberships are queried one hackathon at a time/i)
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Discover Open Squads/i })).toBeInTheDocument();
    });

    // Must not call leader/member-only endpoints when user has no team
    expect(auditSpy).not.toHaveBeenCalled();
    expect(joinReqSpy).not.toHaveBeenCalled();
  });

  it("switches hackathons without leaking previous hackathon squad or request data", async () => {
    const secondHackathon: apiModule.HackathonRecord = {
      id: "hack-2",
      slug: "fall-ai-sprint",
      title: "Fall AI Sprint",
      description: "Autumn challenge",
      minTeamSize: 1,
      maxTeamSize: 4,
      status: "UPCOMING",
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
    };

    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue([mockHackathons[0], secondHackathon]);
    const myTeamSpy = vi.spyOn(apiModule, "apiGetMyTeam").mockImplementation(async (hId) => {
      if (hId === "hack-1") return { team: aliceTeam, role: "LEADER" };
      return null;
    });
    vi.spyOn(apiModule, "apiGetTeamRoster").mockResolvedValue(aliceRoster);
    vi.spyOn(apiModule, "apiGetJoinRequests").mockResolvedValue([pendingReq]);
    vi.spyOn(apiModule, "apiGetTeamAuditLogs").mockResolvedValue(mockAuditLogs);
    vi.spyOn(apiModule, "apiGetHackathonTeams").mockResolvedValue([]);

    renderDashboardWithUser(userAlice);

    await waitFor(() => {
      expect(screen.getByText("LockFree Guild")).toBeInTheDocument();
      expect(screen.getByText("Charlie Gomez")).toBeInTheDocument();
      expect(screen.getByLabelText("Hackathon scope")).toHaveValue("hack-1");
    });

    // Initial load calls myTeam once for selected hackathon (no N+1 across all hackathons)
    expect(myTeamSpy).toHaveBeenCalledTimes(1);
    expect(myTeamSpy).toHaveBeenCalledWith("hack-1");

    fireEvent.change(screen.getByLabelText("Hackathon scope"), { target: { value: "hack-2" } });

    await waitFor(() => {
      expect(screen.getByText("Scope: Fall AI Sprint")).toBeInTheDocument();
      expect(screen.getByText("No active squad in Fall AI Sprint")).toBeInTheDocument();
    });

    expect(screen.queryByText("LockFree Guild")).toBeNull();
    expect(screen.queryByText("Charlie Gomez")).toBeNull();
    expect(myTeamSpy).toHaveBeenCalledTimes(2);
    expect(myTeamSpy).toHaveBeenLastCalledWith("hack-2");
  });

  it("prevents duplicate approve submissions, sends Idempotency-Key, and reconciles state", async () => {
    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
    const updatedTeam = { ...aliceTeam, memberCount: 3 };
    vi.spyOn(apiModule, "apiGetMyTeam")
      .mockResolvedValueOnce({ team: aliceTeam, role: "LEADER" })
      .mockResolvedValue({ team: updatedTeam, role: "LEADER" });
    vi.spyOn(apiModule, "apiGetTeamRoster").mockResolvedValue(aliceRoster);
    vi.spyOn(apiModule, "apiGetJoinRequests")
      .mockResolvedValueOnce([pendingReq])
      .mockResolvedValue([]);
    vi.spyOn(apiModule, "apiGetTeamAuditLogs").mockResolvedValue(mockAuditLogs);
    vi.spyOn(apiModule, "apiGetHackathonTeams").mockResolvedValue([aliceTeam]);

    let resolveApprove!: (val: apiModule.JoinTeamResponse) => void;
    const approveSpy = vi.spyOn(apiModule, "apiApproveJoinRequest").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveApprove = resolve;
        })
    );

    renderDashboardWithUser(userAlice);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Approve$/i })).toBeInTheDocument();
    });

    const approveBtn = screen.getByRole("button", { name: /^Approve$/i });
    fireEvent.click(approveBtn);
    // Second click while pending must be blocked
    fireEvent.click(screen.getByRole("button", { name: /Processing/i }));

    expect(approveSpy).toHaveBeenCalledTimes(1);
    expect(approveSpy).toHaveBeenCalledWith("team-alice", "req-1", expect.any(String));

    resolveApprove({
      membershipId: "mem-2",
      teamId: "team-alice",
      userId: "user-charlie",
      role: "MEMBER",
      status: "ACTIVE",
      currentMemberCount: 3,
      maxCapacity: 4,
      joinedAt: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Join request approved/i);
      expect(screen.getByText(/3 of 4 seats filled/i)).toBeInTheDocument();
    });
  });

  it("redeems invitation token via Invitations section with Idempotency-Key", async () => {
    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
    vi.spyOn(apiModule, "apiGetMyTeam").mockResolvedValue(null);
    vi.spyOn(apiModule, "apiGetHackathonTeams").mockResolvedValue([aliceTeam]);
    const acceptSpy = vi.spyOn(apiModule, "apiAcceptInvitation").mockResolvedValue({
      membershipId: "mem-99",
      teamId: "team-alice",
      userId: userBob.id,
      role: "MEMBER",
      status: "ACTIVE",
      currentMemberCount: 3,
      maxCapacity: 4,
      joinedAt: new Date().toISOString(),
    });

    renderDashboardWithUser(userBob);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Redeem Invitation Token/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /Redeem Invitation Token/i }));
    const tokenInput = screen.getByLabelText(/Invitation Token/i);
    fireEvent.change(tokenInput, { target: { value: "crew_valid_token_abc" } });
    fireEvent.click(screen.getByRole("button", { name: /Accept & Join/i }));

    await waitFor(() => {
      expect(acceptSpy).toHaveBeenCalledWith("crew_valid_token_abc", expect.any(String));
      expect(screen.getByText("Squad Workspace Target")).toBeInTheDocument();
    });
  });

  it("isolates partial section failures with retry and calls refreshUser on 401 session expiry", async () => {
    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
    vi.spyOn(apiModule, "apiGetMyTeam").mockResolvedValue({ team: aliceTeam, role: "MEMBER" });
    vi.spyOn(apiModule, "apiGetTeamRoster").mockResolvedValue(aliceRoster);
    vi.spyOn(apiModule, "apiGetHackathonTeams").mockResolvedValue([aliceTeam]);
    const auditSpy = vi
      .spyOn(apiModule, "apiGetTeamAuditLogs")
      .mockRejectedValueOnce(new apiModule.ApiClientError("UNAUTHORIZED", "Session expired", 401))
      .mockResolvedValueOnce(mockAuditLogs);

    const refreshUser = vi.fn(async () => {});
    renderDashboardWithUser(userAlice, { refreshUser });

    await waitFor(() => {
      // My Squads still renders cleanly even though audit logs failed
      expect(screen.getByText("LockFree Guild")).toBeInTheDocument();
      expect(screen.getByText("Session expired")).toBeInTheDocument();
      expect(refreshUser).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /^Retry$/i }));

    await waitFor(() => {
      expect(auditSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/created this squad/i)).toBeInTheDocument();
    });
  });

  it("prevents cross-user private data leakage across signed-in sessions sharing a QueryClient", async () => {
    const sharedQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
    const myTeamSpy = vi
      .spyOn(apiModule, "apiGetMyTeam")
      .mockResolvedValueOnce({ team: aliceTeam, role: "LEADER" })
      .mockResolvedValueOnce(null);
    vi.spyOn(apiModule, "apiGetTeamRoster").mockResolvedValue(aliceRoster);
    vi.spyOn(apiModule, "apiGetJoinRequests").mockResolvedValue([pendingReq]);
    vi.spyOn(apiModule, "apiGetTeamAuditLogs").mockResolvedValue(mockAuditLogs);
    vi.spyOn(apiModule, "apiGetHackathonTeams").mockResolvedValue([]);

    const firstRender = renderDashboardWithUser(userAlice, { queryClient: sharedQueryClient });

    await waitFor(() => {
      expect(screen.getByText("LockFree Guild")).toBeInTheDocument();
      expect(screen.getByText("Charlie Gomez")).toBeInTheDocument();
    });

    firstRender.unmount();

    // Verify Alice's private cached keys were purged on unmount
    expect(
      sharedQueryClient.getQueryData(["dashboard", "user-alice", "my-team", "hack-1"])
    ).toBeUndefined();

    // Second user Bob logs in using the same QueryClient
    renderDashboardWithUser(userBob, { queryClient: sharedQueryClient });

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /Bob Diaz/i })).toBeInTheDocument();
      expect(screen.getByText("No active squad in Spring Systems 2026")).toBeInTheDocument();
    });

    expect(myTeamSpy).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("LockFree Guild")).toBeNull();
    expect(screen.queryByText("Charlie Gomez")).toBeNull();
  });
});
