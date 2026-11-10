/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "../src/context/AuthContext";
import { SocketContext, useSocket } from "../src/context/SocketContext";
import { TeamDetails } from "../src/pages/TeamDetails";
import * as apiModule from "../src/lib/api";

const mockLeaderUser = {
  id: "user-leader-1",
  email: "leader@squad.dev",
  displayName: "Ada Lovelace",
  skills: ["TypeScript", "Distributed Systems"],
  status: "ACTIVE" as const,
  createdAt: new Date().toISOString(),
};

const mockMemberUser = {
  id: "user-member-2",
  email: "member@squad.dev",
  displayName: "Alan Turing",
  skills: ["Cryptography", "Algorithms"],
  status: "ACTIVE" as const,
  createdAt: new Date().toISOString(),
};

const mockVisitorUser = {
  id: "user-visitor-3",
  email: "visitor@squad.dev",
  displayName: "Grace Hopper",
  skills: ["Compilers", "COBOL"],
  status: "ACTIVE" as const,
  createdAt: new Date().toISOString(),
};

const mockTeam: apiModule.TeamRecord = {
  id: "team-omega",
  hackathonId: "hack-quantum",
  name: "Omega Distributed Core",
  tagline: "Resilient decentralized consensus primitives",
  description:
    "We are architecting high-throughput consensus engines with formally verified safety invariants.",
  skillsNeeded: ["Rust", "TypeScript", "Formal Verification"],
  memberCount: 2,
  maxCapacity: 4,
  isOpen: true,
  status: "ACTIVE",
  leaderId: "user-leader-1",
  leader: {
    id: "user-leader-1",
    displayName: "Ada Lovelace",
    email: "leader@squad.dev",
    skills: ["TypeScript", "Distributed Systems"],
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockRoster: apiModule.TeamMemberRecord[] = [
  {
    id: "mem-1",
    hackathonId: "hack-quantum",
    teamId: "team-omega",
    userId: {
      id: "user-leader-1",
      displayName: "Ada Lovelace",
      email: "leader@squad.dev",
      skills: ["TypeScript", "Distributed Systems"],
      bio: "Mathematical programmer and computational pioneer",
      experienceLevel: "EXPERT",
    },
    role: "LEADER",
    status: "ACTIVE",
    joinedAt: new Date("2026-11-01T10:00:00Z").toISOString(),
  },
  {
    id: "mem-2",
    hackathonId: "hack-quantum",
    teamId: "team-omega",
    userId: {
      id: "user-member-2",
      displayName: "Alan Turing",
      email: "member@squad.dev",
      skills: ["Cryptography", "Algorithms"],
      bio: "Cracking cryptographic systems",
      experienceLevel: "ADVANCED",
    },
    role: "MEMBER",
    status: "ACTIVE",
    joinedAt: new Date("2026-11-02T14:30:00Z").toISOString(),
  },
];

const mockAuditLogs: apiModule.AuditLogRecord[] = [
  {
    id: "audit-1",
    hackathonId: "hack-quantum",
    teamId: "team-omega",
    actorId: {
      id: "user-leader-1",
      displayName: "Ada Lovelace",
      email: "leader@squad.dev",
    },
    action: "TEAM_CREATED",
    metadata: { initialCapacity: 4 },
    timestamp: new Date("2026-11-01T10:00:00Z").toISOString(),
  },
  {
    id: "audit-2",
    hackathonId: "hack-quantum",
    teamId: "team-omega",
    actorId: {
      id: "user-member-2",
      displayName: "Alan Turing",
      email: "member@squad.dev",
    },
    action: "MEMBER_JOINED",
    metadata: { method: "DIRECT_JOIN" },
    timestamp: new Date("2026-11-02T14:30:00Z").toISOString(),
  },
];

const mockJoinRequests: apiModule.JoinRequestRecord[] = [
  {
    id: "req-candidate-1",
    hackathonId: "hack-quantum",
    teamId: "team-omega",
    userId: {
      id: "user-candidate-9",
      displayName: "Katherine Johnson",
      email: "katherine@nasa.gov",
      experienceLevel: "EXPERT",
    },
    message: "I specialize in orbital mechanics and numerical verification algorithms.",
    status: "PENDING",
    createdAt: new Date("2026-11-05T09:15:00Z").toISOString(),
  },
];

const mockInvitations: apiModule.InvitationRecord[] = [
  {
    id: "inv-alpha-99",
    hackathonId: "hack-quantum",
    teamId: "team-omega",
    inviterId: "user-leader-1",
    maxUses: 1,
    usesCount: 0,
    expiresAt: new Date("2026-11-20T12:00:00Z").toISOString(),
    status: "ACTIVE",
    createdAt: new Date("2026-11-04T12:00:00Z").toISOString(),
  },
];

describe("Phase 5 — Team Workspace Component & Integration Suite", () => {
  let queryClient: QueryClient;
  let mockSocket: {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();

    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };

    vi.spyOn(apiModule, "apiGetTeam").mockResolvedValue(mockTeam);
    vi.spyOn(apiModule, "apiGetTeamRoster").mockResolvedValue(mockRoster);
    vi.spyOn(apiModule, "apiGetTeamAuditLogs").mockResolvedValue(mockAuditLogs);
    vi.spyOn(apiModule, "apiGetJoinRequests").mockResolvedValue(mockJoinRequests);
    vi.spyOn(apiModule, "apiGetInvitations").mockResolvedValue(mockInvitations);
  });

  const renderWorkspace = (
    currentUser: typeof mockLeaderUser | null = mockLeaderUser,
    initialPath = "/teams/team-omega"
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: currentUser,
            isLoading: false,
            error: null,
            login: vi.fn(),
            register: vi.fn(),
            logout: vi.fn(),
            refreshUser: vi.fn(),
            clearError: vi.fn(),
          }}
        >
          <SocketContext.Provider
            value={{
              socket: mockSocket as unknown as ReturnType<typeof useSocket>["socket"],
              connectionState: "connected",
              joinHackathonRoom: vi.fn(),
              leaveHackathonRoom: vi.fn(),
              joinTeamRoom: vi.fn(),
              leaveTeamRoom: vi.fn(),
            }}
          >
            <MemoryRouter initialEntries={[initialPath]}>
              <Routes>
                <Route path="/teams/:teamId" element={<TeamDetails />} />
                <Route path="/login" element={<div>Mock Login Page</div>} />
                <Route path="/teams-preview" element={<div>Mock Teams Preview Directory</div>} />
              </Routes>
            </MemoryRouter>
          </SocketContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
  };

  describe("1. Leader Access & Workspace Controls", () => {
    it("renders squad workspace header, leader permissions badge, and full tab suite", async () => {
      renderWorkspace(mockLeaderUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      // Role badge
      expect(screen.getByText("Leader Access")).toBeInTheDocument();

      // Occupancy meter & seat indicators
      expect(screen.getByText(/2 seats open/i)).toBeInTheDocument();

      // Leader action buttons
      expect(screen.getByRole("button", { name: /Edit Team/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Close Recruiting/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Create Invite Link/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Disband Squad/i })).toBeInTheDocument();

      // Navigation tabs
      expect(screen.getByRole("button", { name: /Overview/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Roster/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Join Requests/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Invitations/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Audit Log/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Settings/i })).toBeInTheDocument();
    });

    it("switches to Roster tab and allows leader to initiate member removal", async () => {
      renderWorkspace(mockLeaderUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      // Switch to Roster tab
      fireEvent.click(screen.getByRole("button", { name: /^Roster/i }));

      // Both members visible
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(screen.getByText("Alan Turing")).toBeInTheDocument();

      // Open vacant seats callout
      expect(screen.getByText(/Open Seat 3 — Seeking Contributor/i)).toBeInTheDocument();
      expect(screen.getByText(/Open Seat 4 — Seeking Contributor/i)).toBeInTheDocument();

      // Click Remove on Alan Turing
      const removeButtons = screen.getAllByRole("button", { name: /Remove/i });
      fireEvent.click(removeButtons[0]);

      // Remove confirmation modal should appear
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/Remove Member from Roster/i)).toBeInTheDocument();
      expect(within(dialog).getByText("Alan Turing")).toBeInTheDocument();
      expect(
        within(dialog).getByText(/Their reserved seat will be opened for recruitment\./i)
      ).toBeInTheDocument();
    });

    it("switches to Join Requests tab and processes approve mutation with idempotency key", async () => {
      const approveSpy = vi.spyOn(apiModule, "apiApproveJoinRequest").mockResolvedValue({
        membershipId: "mem-new-1",
        teamId: "team-omega",
        userId: "user-candidate-9",
        role: "MEMBER",
        status: "ACTIVE",
        currentMemberCount: 3,
        maxCapacity: 4,
        joinedAt: new Date().toISOString(),
      });

      renderWorkspace(mockLeaderUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      // Switch to Join Requests tab
      fireEvent.click(screen.getByRole("button", { name: /Join Requests/i }));

      expect(screen.getByText("Katherine Johnson")).toBeInTheDocument();
      expect(
        screen.getByText(
          /"I specialize in orbital mechanics and numerical verification algorithms."/i
        )
      ).toBeInTheDocument();

      // Click Approve & Admit
      const approveBtn = screen.getByRole("button", { name: /Approve & Admit/i });
      fireEvent.click(approveBtn);

      await waitFor(() => {
        expect(approveSpy).toHaveBeenCalledTimes(1);
        expect(approveSpy).toHaveBeenCalledWith(
          "team-omega",
          "req-candidate-1",
          expect.any(String)
        );
      });
    });

    it("switches to Invitations tab and revokes active token", async () => {
      const revokeSpy = vi
        .spyOn(apiModule, "apiRevokeInvitation")
        .mockResolvedValue({ success: true } as unknown as apiModule.InvitationRecord);

      renderWorkspace(mockLeaderUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      // Switch to Invitations tab
      fireEvent.click(screen.getByRole("button", { name: /Invitations/i }));

      expect(screen.getByText(/Token ID: inv-alpha-99/i)).toBeInTheDocument();

      // Revoke token
      const revokeBtn = screen.getByRole("button", { name: /Revoke/i });
      fireEvent.click(revokeBtn);

      await waitFor(() => {
        expect(revokeSpy).toHaveBeenCalledTimes(1);
        expect(revokeSpy).toHaveBeenCalledWith("team-omega", "inv-alpha-99");
      });
    });
  });

  describe("2. Confirmed Member View & Boundaries", () => {
    it("renders member view with Confirmed Member badge and restricts leader-only controls", async () => {
      renderWorkspace(mockMemberUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      // Confirmed Member badge
      expect(screen.getByText("Confirmed Member")).toBeInTheDocument();

      // Has Leave Team action but NOT Edit Team, Disband Squad, or Close Recruiting
      expect(screen.getByRole("button", { name: /Leave Team/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Edit Team/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Disband Squad/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Close Recruiting/i })).not.toBeInTheDocument();

      // Tabs: should NOT have Join Requests, Invitations, or Settings in navigation
      expect(screen.queryByRole("button", { name: /Join Requests/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Invitations/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Settings/i })).not.toBeInTheDocument();

      // But CAN view Audit Log
      expect(screen.getByRole("button", { name: /Audit Log/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Audit Log/i }));

      expect(screen.getByText(/Audit Activity History/i)).toBeInTheDocument();
      expect(screen.getByText(/team created/i)).toBeInTheDocument();
    });
  });

  describe("3. Candidate Visitor View & Seat Claiming", () => {
    it("renders candidate visitor with direct join, request, and redeem actions", async () => {
      renderWorkspace(mockVisitorUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      expect(screen.getByText("Candidate Visitor")).toBeInTheDocument();

      const header = screen.getByRole("banner");
      expect(
        within(header).getByRole("button", { name: /Instant direct join/i })
      ).toBeInTheDocument();
      expect(within(header).getByRole("button", { name: /Request to join/i })).toBeInTheDocument();
      expect(within(header).getByRole("button", { name: /Redeem token/i })).toBeInTheDocument();
    });

    it("triggers direct join with stable idempotency key", async () => {
      const joinSpy = vi.spyOn(apiModule, "apiJoinTeam").mockResolvedValue({
        membershipId: "new-mem",
        teamId: "team-omega",
        userId: "user-visitor-3",
        role: "MEMBER",
        status: "ACTIVE",
        currentMemberCount: 3,
        maxCapacity: 4,
        joinedAt: new Date().toISOString(),
      });

      renderWorkspace(mockVisitorUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      const header = screen.getByRole("banner");
      const directJoinBtn = within(header).getByRole("button", { name: /Instant direct join/i });
      fireEvent.click(directJoinBtn);

      await waitFor(() => {
        expect(joinSpy).toHaveBeenCalledWith("team-omega", expect.any(String));
      });
    });

    it("handles 409 conflict reconciliation on direct join when team capacity is exhausted", async () => {
      vi.spyOn(apiModule, "apiJoinTeam").mockRejectedValue(
        new apiModule.ApiClientError(
          "TEAM_FULL",
          "Team capacity reached. All seats are now occupied.",
          409
        )
      );

      const refreshSpy = vi.spyOn(apiModule, "apiGetTeam");

      renderWorkspace(mockVisitorUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      const header = screen.getByRole("banner");
      const directJoinBtn = within(header).getByRole("button", { name: /Instant direct join/i });
      fireEvent.click(directJoinBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Team capacity reached. All seats are now occupied.")
        ).toBeInTheDocument();
        expect(refreshSpy).toHaveBeenCalledTimes(2); // Initial load + 409 silent refresh
      });
    });

    it("shows honest authorization boundary on Audit Log tab for non-members", async () => {
      vi.spyOn(apiModule, "apiGetTeamAuditLogs").mockRejectedValue(
        new apiModule.ApiClientError("FORBIDDEN", "Forbidden", 403)
      );

      renderWorkspace(mockVisitorUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /Audit Log/i }));

      expect(screen.getByText(/Restricted to Squad Members/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Audit activity logs and squad transaction history are only visible to confirmed team members\./i
        )
      ).toBeInTheDocument();
    });
  });

  describe("4. Unauthenticated Visitor View", () => {
    it("renders Public Preview badge and prompts unauthenticated visitor to login on join action", async () => {
      renderWorkspace(null);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      expect(screen.getByText("Public Preview")).toBeInTheDocument();

      const header = screen.getByRole("banner");
      const signInBtn = within(header).getByRole("button", { name: /Sign in to Join/i });
      fireEvent.click(signInBtn);

      await waitFor(() => {
        expect(screen.getByText("Mock Login Page")).toBeInTheDocument();
      });
    });
  });

  describe("5. Disbanded Squad Lifecycle Invariant", () => {
    it("renders DISBANDED status banner and disables mutative recruitment controls", async () => {
      const disbandedTeam: apiModule.TeamRecord = {
        ...mockTeam,
        status: "DISBANDED",
        isOpen: false,
        memberCount: 0,
      };

      vi.spyOn(apiModule, "apiGetTeam").mockResolvedValue(disbandedTeam);
      vi.spyOn(apiModule, "apiGetTeamRoster").mockResolvedValue([]);

      renderWorkspace(mockLeaderUser);

      await waitFor(() => {
        expect(
          screen.getByText(
            "This squad has been disbanded by its leader. All memberships and reservations are closed."
          )
        ).toBeInTheDocument();
      });

      // Edit, Join, Leave buttons should not be active
      expect(
        screen.queryByRole("button", { name: /Instant direct join/i })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Create Invite Link/i })).not.toBeInTheDocument();
    });
  });
});
