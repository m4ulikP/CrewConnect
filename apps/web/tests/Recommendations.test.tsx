import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { WorkspaceRecommendationsTab } from "../src/components/workspace/WorkspaceRecommendationsTab";
import * as apiModule from "../src/lib/api";
import type { TeammateRecommendationDTO } from "@crewconnect/shared";

const mockTeam: apiModule.TeamRecord = {
  id: "team-123",
  hackathonId: "hack-456",
  leaderId: "user-leader",
  name: "Distributed Systems Guild",
  tagline: "Solving race conditions with consensus",
  description: "A squad dedicated to building rock-solid distributed applications.",
  skillsNeeded: ["Rust", "Kubernetes", "TypeScript"],
  memberCount: 2,
  maxCapacity: 4,
  isOpen: true,
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const mockRecs: TeammateRecommendationDTO[] = [
  {
    candidate: {
      id: "cand-1",
      displayName: "Sarah Connor",
      bio: "Distributed systems enthusiast and concurrency specialist.",
      skills: ["Rust", "Kubernetes", "TypeScript"],
      experienceLevel: "ADVANCED",
      githubUrl: "https://github.com/sconnor",
      linkedinUrl: "https://linkedin.com/in/sconnor",
      portfolioUrl: "https://sconnor.dev",
    },
    compatibilityScore: 94,
    dimensionScores: {
      skillScore: 96,
      experienceScore: 95,
      timezoneScore: 90,
    },
    explanations: {
      summary:
        "Directly fulfills 2 squad requirements (Rust, Kubernetes) with shared TypeScript foundation.",
      complementarySkills: ["Rust", "Kubernetes"],
      overlappingSkills: ["TypeScript"],
      experienceFit:
        "Advanced background brings essential architectural leadership and mentorship.",
      timezoneFit: {
        label: "STRONG",
        overlapHours: 8,
        description: "Approx. 8 hours of shared working-hour overlap.",
      },
    },
  },
  {
    candidate: {
      id: "cand-2",
      displayName: "John Doe",
      bio: "Frontend engineer diving into full-stack.",
      skills: ["React", "CSS", "TypeScript"],
      experienceLevel: "INTERMEDIATE",
    },
    compatibilityScore: 68,
    dimensionScores: {
      skillScore: 60,
      experienceScore: 80,
      timezoneScore: 75,
    },
    explanations: {
      summary: "Expands squad technical breadth with React, CSS with shared TypeScript foundation.",
      complementarySkills: ["React", "CSS"],
      overlappingSkills: ["TypeScript"],
      experienceFit: "Intermediate capability maintains balanced development throughput.",
      timezoneFit: {
        label: "MODERATE",
        overlapHours: 5,
        description: "Approx. 5 hours of shared working-hour overlap.",
      },
    },
  },
];

describe("WorkspaceRecommendationsTab Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads and displays teammate recommendation cards with scores and explanations", async () => {
    vi.spyOn(apiModule, "apiGetTeamRecommendations").mockResolvedValue({
      data: {
        teamId: "team-123",
        teamName: "Distributed Systems Guild",
        hackathonId: "hack-456",
        vacancies: 2,
        recommendations: mockRecs,
      },
      meta: {
        page: 1,
        limit: 6,
        total: 2,
      },
    });

    render(
      <BrowserRouter>
        <WorkspaceRecommendationsTab team={mockTeam} isLeader={true} />
      </BrowserRouter>
    );

    // Shows loading skeleton initially
    expect(
      screen.getByRole("status", { name: /loading teammate recommendations/i })
    ).toBeInTheDocument();

    // Resolves and displays candidates
    await waitFor(() => {
      expect(screen.getByText("Sarah Connor")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    // Score pills
    expect(screen.getByText("94% Match")).toBeInTheDocument();
    expect(screen.getByText("68% Match")).toBeInTheDocument();

    // Skill breakdown
    expect(screen.getAllByText("Rust")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Kubernetes")[0]).toBeInTheDocument();

    // Explanations
    expect(
      screen.getByText(/Directly fulfills 2 squad requirements \(Rust, Kubernetes\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Approx\. 8 hours of shared working-hour overlap/i)
    ).toBeInTheDocument();

    // Vacancies readout
    expect(screen.getByText("2 seats left")).toBeInTheDocument();
  });

  it("renders empty state cleanly when no eligible candidates are available", async () => {
    vi.spyOn(apiModule, "apiGetTeamRecommendations").mockResolvedValue({
      data: {
        teamId: "team-123",
        teamName: "Distributed Systems Guild",
        hackathonId: "hack-456",
        vacancies: 2,
        recommendations: [],
      },
      meta: {
        page: 1,
        limit: 6,
        total: 0,
      },
    });

    render(
      <BrowserRouter>
        <WorkspaceRecommendationsTab team={mockTeam} isLeader={true} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("recommendations-empty-state")).toBeInTheDocument();
      expect(screen.getByText("No Eligible Candidates Found")).toBeInTheDocument();
    });
  });

  it("handles API errors gracefully and provides a retry button", async () => {
    const recsSpy = vi
      .spyOn(apiModule, "apiGetTeamRecommendations")
      .mockRejectedValueOnce(
        new apiModule.ApiClientError("NETWORK_ERROR", "Server unavailable", 500)
      )
      .mockResolvedValueOnce({
        data: {
          teamId: "team-123",
          teamName: "Distributed Systems Guild",
          hackathonId: "hack-456",
          vacancies: 2,
          recommendations: mockRecs,
        },
        meta: { page: 1, limit: 6, total: 2 },
      });

    render(
      <BrowserRouter>
        <WorkspaceRecommendationsTab team={mockTeam} isLeader={true} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Server unavailable/i)).toBeInTheDocument();
    });

    // Click retry
    const retryBtn = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("Sarah Connor")).toBeInTheDocument();
    });
    expect(recsSpy).toHaveBeenCalledTimes(2);
  });

  it("triggers invite modal callback when leader clicks 'Invite to Squad'", async () => {
    vi.spyOn(apiModule, "apiGetTeamRecommendations").mockResolvedValue({
      data: {
        teamId: "team-123",
        teamName: "Distributed Systems Guild",
        hackathonId: "hack-456",
        vacancies: 2,
        recommendations: mockRecs,
      },
      meta: { page: 1, limit: 6, total: 2 },
    });

    const onOpenInviteModal = vi.fn();

    render(
      <BrowserRouter>
        <WorkspaceRecommendationsTab
          team={mockTeam}
          isLeader={true}
          onOpenInviteModal={onOpenInviteModal}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Sarah Connor")).toBeInTheDocument();
    });

    const inviteButtons = screen.getAllByRole("button", { name: /invite to squad/i });
    expect(inviteButtons.length).toBe(2);

    fireEvent.click(inviteButtons[0]);
    expect(onOpenInviteModal).toHaveBeenCalledWith("cand-1");
  });

  it("shows full capacity alert when team is at maximum capacity", async () => {
    const fullTeam: apiModule.TeamRecord = {
      ...mockTeam,
      memberCount: 4,
      maxCapacity: 4,
    };

    vi.spyOn(apiModule, "apiGetTeamRecommendations").mockResolvedValue({
      data: {
        teamId: "team-123",
        teamName: "Distributed Systems Guild",
        hackathonId: "hack-456",
        vacancies: 0,
        recommendations: [],
      },
      meta: { page: 1, limit: 6, total: 0 },
    });

    render(
      <BrowserRouter>
        <WorkspaceRecommendationsTab team={fullTeam} isLeader={true} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Squad has reached full capacity \(4\/4\)/i)).toBeInTheDocument();
    });
  });

  it("does not render invite action button when viewer is a confirmed non-leader member", async () => {
    vi.spyOn(apiModule, "apiGetTeamRecommendations").mockResolvedValue({
      data: {
        teamId: "team-123",
        teamName: "Distributed Systems Guild",
        hackathonId: "hack-456",
        vacancies: 2,
        recommendations: mockRecs,
      },
      meta: { page: 1, limit: 6, total: 2 },
    });

    render(
      <BrowserRouter>
        <WorkspaceRecommendationsTab
          team={mockTeam}
          isLeader={false}
          onOpenInviteModal={undefined}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Sarah Connor")).toBeInTheDocument();
    });

    // Ensure no invite button is present for non-leaders
    const inviteButtons = screen.queryAllByRole("button", { name: /invite to squad/i });
    expect(inviteButtons.length).toBe(0);

    // Verify informative "Leader can invite" text is present
    const leaderCanInviteBadges = screen.getAllByText("Leader can invite");
    expect(leaderCanInviteBadges.length).toBe(2);
  });
});
