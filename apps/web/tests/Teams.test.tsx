/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "../src/context/AuthContext";
import { CreateTeamModal } from "../src/components/CreateTeamModal";
import { EditTeamModal } from "../src/components/EditTeamModal";
import { TransferLeadershipModal } from "../src/components/TransferLeadershipModal";
import { JoinRequestModal } from "../src/components/JoinRequestModal";
import { CreateInvitationModal } from "../src/components/CreateInvitationModal";
import { RedeemInvitationModal } from "../src/components/RedeemInvitationModal";
import { TeamsPreview } from "../src/pages/TeamsPreview";
import * as apiModule from "../src/lib/api";

const mockUser = {
  id: "user-123",
  email: "leader@example.com",
  displayName: "Leader User",
  skills: ["TypeScript", "React"],
  status: "ACTIVE" as const,
  createdAt: new Date().toISOString(),
};

const mockHackathons = [
  {
    id: "hack-1",
    slug: "hack-2026",
    title: "Hack4Hack 2026",
    description: "Race-proof challenge",
    minTeamSize: 1,
    maxTeamSize: 5,
    status: "ACTIVE" as const,
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
  },
];

const mockTeam: apiModule.TeamRecord = {
  id: "team-1",
  hackathonId: "hack-1",
  name: "Kernel Panic",
  tagline: "Autonomous systems",
  description: "Building race-proof solutions",
  skillsNeeded: ["Rust", "TypeScript"],
  memberCount: 2,
  maxCapacity: 5,
  isOpen: true,
  status: "ACTIVE",
  leaderId: "user-123",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockMembers: apiModule.TeamMemberRecord[] = [
  {
    id: "mem-1",
    hackathonId: "hack-1",
    teamId: "team-1",
    userId: {
      id: "user-123",
      displayName: "Leader User",
      email: "leader@example.com",
      skills: ["TypeScript"],
    },
    role: "LEADER",
    status: "ACTIVE",
    joinedAt: new Date().toISOString(),
  },
  {
    id: "mem-2",
    hackathonId: "hack-1",
    teamId: "team-1",
    userId: {
      id: "user-456",
      displayName: "Teammate Alex",
      email: "alex@example.com",
      skills: ["Rust"],
    },
    role: "MEMBER",
    status: "ACTIVE",
    joinedAt: new Date().toISOString(),
  },
];

describe("Frontend Team Management Components", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
  });

  const renderWithProviders = (ui: React.ReactElement, currentUser = mockUser) => {
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
          <BrowserRouter>{ui}</BrowserRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
  };

  describe("CreateTeamModal", () => {
    it("renders team creation form inputs and adds skill chips", () => {
      const handleClose = vi.fn();
      const handleCreated = vi.fn();

      render(
        <CreateTeamModal
          hackathons={mockHackathons}
          isOpen={true}
          onClose={handleClose}
          onTeamCreated={handleCreated}
        />
      );

      expect(screen.getByRole("heading", { name: /Create a New Team/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Team Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Tagline/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Max Capacity/i)).toBeInTheDocument();

      const skillInput = screen.getByPlaceholderText(/e\.g\. TypeScript, Rust, Docker/i);
      fireEvent.change(skillInput, { target: { value: "MongoDB" } });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      expect(screen.getByText("MongoDB")).toBeInTheDocument();
    });
  });

  describe("EditTeamModal", () => {
    it("pre-populates current team attributes and enforces capacity boundary", () => {
      const handleClose = vi.fn();
      const handleUpdated = vi.fn();

      render(
        <EditTeamModal
          team={mockTeam}
          isOpen={true}
          onClose={handleClose}
          onTeamUpdated={handleUpdated}
        />
      );

      expect(screen.getByRole("heading", { name: /Edit Team Details/i })).toBeInTheDocument();
      const nameInput = screen.getByDisplayValue("Kernel Panic");
      expect(nameInput).toBeInTheDocument();

      // Max capacity input should have min equal to memberCount (2)
      const capInput = screen.getByDisplayValue("5") as HTMLInputElement;
      expect(capInput.min).toBe("2");
    });
  });

  describe("TransferLeadershipModal", () => {
    it("filters eligible non-leader active members for leadership succession", () => {
      const handleClose = vi.fn();
      const handleTransferred = vi.fn();

      render(
        <TransferLeadershipModal
          teamId="team-1"
          members={mockMembers}
          currentLeaderId="user-123"
          isOpen={true}
          onClose={handleClose}
          onTransferred={handleTransferred}
        />
      );

      expect(screen.getByRole("heading", { name: /Transfer Leadership/i })).toBeInTheDocument();
      expect(screen.getByText(/Teammate Alex/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirm Transfer/i })).toBeInTheDocument();
    });
  });

  describe("TeamsPreview / Directory", () => {
    it("renders team directory and displays team card with capacity badge", async () => {
      vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
      vi.spyOn(apiModule, "apiGetHackathonTeams").mockResolvedValue([mockTeam]);
      vi.spyOn(apiModule, "apiGetMyTeam").mockResolvedValue(null);

      renderWithProviders(<TeamsPreview />);

      await waitFor(() => {
        expect(screen.getByText("Hackathon Teams Directory")).toBeInTheDocument();
        expect(screen.getByText("Kernel Panic")).toBeInTheDocument();
        expect(screen.getByText("2 / 5 seats")).toBeInTheDocument();
        expect(screen.getByText("Open for Join")).toBeInTheDocument();
      });
    });
  });

  describe("JoinRequestModal", () => {
    it("renders join request modal and calls apiCreateJoinRequest", async () => {
      const handleClose = vi.fn();
      const handleSuccess = vi.fn();
      const spyApi = vi.spyOn(apiModule, "apiCreateJoinRequest").mockResolvedValue({
        id: "req-1",
        hackathonId: "hack-1",
        teamId: "team-1",
        userId: "user-123",
        status: "PENDING",
        message: "Excited to join and build race-proof algorithms!",
        createdAt: new Date().toISOString(),
      });

      render(
        <JoinRequestModal
          isOpen={true}
          onClose={handleClose}
          teamId="team-1"
          teamName="Kernel Panic"
          onSuccess={handleSuccess}
        />
      );

      expect(screen.getByRole("heading", { name: "Request to Join" })).toBeInTheDocument();
      expect(screen.getByText("Kernel Panic")).toBeInTheDocument();
      const textarea = screen.getByPlaceholderText(/Tell the leader about your skills/i);
      fireEvent.change(textarea, {
        target: { value: "Excited to join and build race-proof algorithms!" },
      });

      const submitButton = screen.getByRole("button", { name: /Send Request/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(spyApi).toHaveBeenCalledWith(
          "team-1",
          "Excited to join and build race-proof algorithms!"
        );
        expect(handleSuccess).toHaveBeenCalled();
        expect(handleClose).toHaveBeenCalled();
      });
    });
  });

  describe("CreateInvitationModal", () => {
    it("generates invitation token and displays the secret to copy", async () => {
      const handleClose = vi.fn();
      const handleSuccess = vi.fn();
      const spyApi = vi.spyOn(apiModule, "apiCreateInvitation").mockResolvedValue({
        invitation: {
          id: "inv-1",
          hackathonId: "hack-1",
          teamId: "team-1",
          inviterId: "user-123",
          maxUses: 1,
          usesCount: 0,
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          createdAt: new Date().toISOString(),
        },
        token: "crew_sec_test_token_12345",
      });

      render(
        <CreateInvitationModal
          isOpen={true}
          onClose={handleClose}
          teamId="team-1"
          teamName="Kernel Panic"
          onSuccess={handleSuccess}
        />
      );

      expect(
        screen.getByRole("heading", { name: /Generate Invitation Token/i })
      ).toBeInTheDocument();
      const generateButton = screen.getByRole("button", { name: /Generate Token/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(spyApi).toHaveBeenCalledWith("team-1", {
          inviteeId: undefined,
          maxUses: 1,
          expiresInHours: 24,
        });
        expect(screen.getByDisplayValue("crew_sec_test_token_12345")).toBeInTheDocument();
        expect(handleSuccess).toHaveBeenCalled();
      });
    });
  });

  describe("RedeemInvitationModal", () => {
    it("accepts token input and calls apiAcceptInvitation with stable idempotency key", async () => {
      const handleClose = vi.fn();
      const handleSuccess = vi.fn();
      const spyApi = vi.spyOn(apiModule, "apiAcceptInvitation").mockResolvedValue({
        membershipId: "mem-3",
        teamId: "team-1",
        userId: mockUser.id,
        role: "MEMBER",
        status: "ACTIVE",
        currentMemberCount: 3,
        maxCapacity: 5,
        joinedAt: new Date().toISOString(),
      });

      render(
        <RedeemInvitationModal isOpen={true} onClose={handleClose} onSuccess={handleSuccess} />
      );

      expect(screen.getByRole("heading", { name: /Redeem Team Invitation/i })).toBeInTheDocument();
      const input = screen.getByPlaceholderText(/e\.g\. crew_7f8a9b\.\.\./i);
      fireEvent.change(input, { target: { value: "crew_sec_test_token_12345" } });

      const joinButton = screen.getByRole("button", { name: /Accept & Join/i });
      fireEvent.click(joinButton);

      await waitFor(() => {
        expect(spyApi).toHaveBeenCalledWith(
          "crew_sec_test_token_12345",
          expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          )
        );
        expect(handleSuccess).toHaveBeenCalledWith("team-1");
        expect(handleClose).toHaveBeenCalled();
      });
    });
  });
});
