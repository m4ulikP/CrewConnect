/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { REALTIME_EVENTS } from "@crewconnect/shared";
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
      const dialog = screen.getByRole("alertdialog");
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

      expect(screen.getByText(/Team Audit History/i)).toBeInTheDocument();
      expect(screen.getByText(/Persisted team activity/i)).toBeInTheDocument();
      expect(screen.getByText(/team created/i)).toBeInTheDocument();
      expect(screen.queryByText(/immutable/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/cryptographic/i)).not.toBeInTheDocument();
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

  describe("6. Phase 5.1 — Mutative Workflows, Single-Flight & Realtime Sync", () => {
    it("allows leader to reject a pending join request and refreshes workspace data", async () => {
      const rejectSpy = vi.spyOn(apiModule, "apiRejectJoinRequest").mockResolvedValue({
        ...mockJoinRequests[0],
        status: "REJECTED",
      });

      renderWorkspace(mockLeaderUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /Join Requests/i }));
      fireEvent.click(screen.getByRole("button", { name: /Decline/i }));

      await waitFor(() => {
        expect(rejectSpy).toHaveBeenCalledWith("team-omega", "req-candidate-1");
        expect(screen.getByRole("status")).toHaveTextContent(/Join application declined\./i);
      });
    });

    it("prevents duplicate join request approvals on rapid repeated clicks (single-flight lock)", async () => {
      let resolveApprove!: (val: apiModule.JoinTeamResponse) => void;
      const pendingApprove = new Promise<apiModule.JoinTeamResponse>((res) => {
        resolveApprove = res;
      });
      const approveSpy = vi
        .spyOn(apiModule, "apiApproveJoinRequest")
        .mockReturnValue(pendingApprove);

      renderWorkspace(mockLeaderUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /Join Requests/i }));

      const approveBtn = screen.getByRole("button", { name: /Approve & Admit/i });
      // Rapid repeated clicks within the same render tick
      fireEvent.click(approveBtn);
      fireEvent.click(approveBtn);
      fireEvent.click(approveBtn);

      expect(approveSpy).toHaveBeenCalledTimes(1);

      resolveApprove({
        membershipId: "mem-new-99",
        teamId: "team-omega",
        userId: "user-candidate-9",
        role: "MEMBER",
        status: "ACTIVE",
        currentMemberCount: 3,
        maxCapacity: 4,
        joinedAt: new Date().toISOString(),
      });

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent(/Join application approved!/i);
      });
    });

    it("generates an invitation token, reveals raw token once, and locks Escape while revealed", async () => {
      const createInviteSpy = vi.spyOn(apiModule, "apiCreateInvitation").mockResolvedValue({
        invitation: mockInvitations[0],
        token: "crew_secret_one_time_token_123",
      });

      renderWorkspace(mockLeaderUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      const header = screen.getByRole("banner");
      fireEvent.click(within(header).getByRole("button", { name: /Create Invite Link/i }));

      const dialog = screen.getByRole("dialog");
      const form = within(dialog)
        .getByRole("button", { name: /Generate Token/i })
        .closest("form")!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(createInviteSpy).toHaveBeenCalledTimes(1);
        expect(
          within(dialog).getByDisplayValue("crew_secret_one_time_token_123")
        ).toBeInTheDocument();
      });

      // Escape should NOT dismiss the dialog while single-reveal token is displayed
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Explicit Done closes it
      fireEvent.click(within(dialog).getByRole("button", { name: /Done/i }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("rotates idempotency key in RedeemInvitationModal when token input changes after error", async () => {
      const redeemSpy = vi
        .spyOn(apiModule, "apiAcceptInvitation")
        .mockRejectedValueOnce(new apiModule.ApiClientError("INVITATION_REVOKED", "Revoked", 410))
        .mockResolvedValueOnce({
          membershipId: "mem-redeemed",
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

      fireEvent.click(screen.getByRole("button", { name: /Redeem token/i }));

      const dialog = screen.getByRole("dialog");
      const tokenInput = within(dialog).getByLabelText(/Invitation Token/i);

      // Attempt 1: revoked token
      fireEvent.change(tokenInput, { target: { value: "crew_revoked_1" } });
      fireEvent.click(within(dialog).getByRole("button", { name: /Accept & Join/i }));

      await waitFor(() => {
        expect(within(dialog).getByRole("alert")).toHaveTextContent("Revoked");
      });

      // Attempt 2: different token -> must get a fresh idempotency key
      fireEvent.change(tokenInput, { target: { value: "crew_valid_2" } });
      fireEvent.click(within(dialog).getByRole("button", { name: /Accept & Join/i }));

      await waitFor(() => {
        expect(redeemSpy).toHaveBeenCalledTimes(2);
      });
      const firstKey = redeemSpy.mock.calls[0][1];
      const secondKey = redeemSpy.mock.calls[1][1];
      expect(firstKey).toBeTruthy();
      expect(secondKey).toBeTruthy();
      expect(firstKey).not.toEqual(secondKey);
    });

    it("completes member removal and leadership transfer via accessible dialogs", async () => {
      const removeSpy = vi.spyOn(apiModule, "apiRemoveMember").mockResolvedValue({
        ...mockTeam,
        memberCount: 1,
      });

      renderWorkspace(mockLeaderUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /^Roster/i }));
      fireEvent.click(screen.getByRole("button", { name: /^Remove$/i }));

      const alertDialog = screen.getByRole("alertdialog");
      expect(alertDialog).toHaveAttribute("aria-modal", "true");
      expect(alertDialog).toHaveAttribute("aria-labelledby", "remove-member-dialog-title");
      expect(alertDialog).toHaveAttribute("aria-describedby", "remove-member-dialog-description");

      fireEvent.click(within(alertDialog).getByRole("button", { name: /Remove Member/i }));

      await waitFor(() => {
        expect(removeSpy).toHaveBeenCalledWith("team-omega", "user-member-2");
        expect(screen.getByRole("status")).toHaveTextContent(
          /Removed Alan Turing from the squad\./i
        );
      });
    });

    it("confirms team disband via alertdialog and updates UI cleanly", async () => {
      const disbandSpy = vi.spyOn(apiModule, "apiDisbandTeam").mockResolvedValue({
        ...mockTeam,
        status: "DISBANDED",
        isOpen: false,
        memberCount: 0,
      });

      renderWorkspace(mockLeaderUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      const header = screen.getByRole("banner");
      fireEvent.click(within(header).getByRole("button", { name: /Disband Squad/i }));

      const alertDialog = screen.getByRole("alertdialog");
      expect(alertDialog).toHaveAttribute("aria-labelledby", "disband-dialog-title");
      expect(alertDialog).toHaveAttribute("aria-describedby", "disband-dialog-description");

      fireEvent.click(within(alertDialog).getByRole("button", { name: /Confirm Disband/i }));

      await waitFor(() => {
        expect(disbandSpy).toHaveBeenCalledWith("team-omega");
        expect(screen.getByRole("status")).toHaveTextContent(
          /Squad has been successfully disbanded\./i
        );
      });
    });

    it("refreshes team data from REST when Socket.IO emits TEAM_MEMBER_JOINED", async () => {
      const getTeamSpy = vi.spyOn(apiModule, "apiGetTeam");
      renderWorkspace(mockLeaderUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      const joinedRegistration = mockSocket.on.mock.calls.find(
        (call: unknown[]) => call[0] === REALTIME_EVENTS.TEAM_MEMBER_JOINED
      );
      expect(joinedRegistration).toBeDefined();

      const callsBefore = getTeamSpy.mock.calls.length;
      const handler = joinedRegistration![1] as (payload: unknown) => void;
      act(() => {
        handler({
          teamId: "team-omega",
          memberCount: 3,
          maxCapacity: 4,
          isOpen: true,
        });
      });

      await waitFor(() => {
        expect(getTeamSpy.mock.calls.length).toBeGreaterThan(callsBefore);
      });
    });
  });

  describe("7. Phase 5.1 — Dialog Accessibility & Focus Management", () => {
    it("traps focus inside dialog, handles Escape, blocks background #root, and restores trigger focus", async () => {
      // Simulate app root element in document.body
      const rootDiv = document.createElement("div");
      rootDiv.id = "root";
      document.body.appendChild(rootDiv);

      try {
        renderWorkspace(mockLeaderUser);

        await waitFor(() => {
          expect(
            screen.getByRole("heading", { name: "Omega Distributed Core" })
          ).toBeInTheDocument();
        });

        const header = screen.getByRole("banner");
        const editTrigger = within(header).getByRole("button", { name: /Edit Team/i });
        editTrigger.focus();
        expect(document.activeElement).toBe(editTrigger);

        fireEvent.click(editTrigger);

        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(rootDiv).toHaveAttribute("aria-hidden", "true");
        expect(rootDiv).toHaveAttribute("inert", "");

        // Tab cycling from last element wraps to first inside dialog
        const saveBtn = within(dialog).getByRole("button", { name: /Save Changes/i });
        const closeBtn = within(dialog).getByRole("button", { name: /Close edit team dialog/i });
        saveBtn.focus();
        fireEvent.keyDown(document, { key: "Tab" });
        expect(document.activeElement).toBe(closeBtn);

        // Shift+Tab from first element wraps to last inside dialog
        fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
        expect(document.activeElement).toBe(saveBtn);

        // Escape closes dialog and restores focus + clears #root inert
        fireEvent.keyDown(document, { key: "Escape" });

        await waitFor(() => {
          expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
        expect(rootDiv).not.toHaveAttribute("aria-hidden");
        expect(rootDiv).not.toHaveAttribute("inert");
        expect(document.activeElement).toBe(editTrigger);
      } finally {
        rootDiv.remove();
      }
    });

    it("announces modal validation errors accessibly with role='alert'", async () => {
      renderWorkspace(mockVisitorUser);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Omega Distributed Core" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /Redeem token/i }));

      const dialog = screen.getByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: /Accept & Join/i }));

      const alert = within(dialog).getByRole("alert");
      expect(alert).toHaveTextContent(/Please enter your invitation token/i);
      expect(alert).toHaveAttribute("aria-live", "assertive");
    });
  });
});
