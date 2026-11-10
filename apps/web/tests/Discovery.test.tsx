/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "../src/context/AuthContext";
import { TeamsPreview } from "../src/pages/TeamsPreview";
import * as apiModule from "../src/lib/api";

const mockUser = {
  id: "user-999",
  email: "builder@example.com",
  displayName: "Builder Maya",
  skills: ["TypeScript", "React"],
  status: "ACTIVE" as const,
  createdAt: new Date().toISOString(),
};

const mockHackathons: apiModule.HackathonRecord[] = [
  {
    id: "hack-1",
    slug: "hack-2026",
    title: "Spring Systems Hack 2026",
    description: "Distributed systems challenge",
    minTeamSize: 1,
    maxTeamSize: 4,
    status: "ACTIVE",
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
  },
];

const openTeam: apiModule.TeamRecord = {
  id: "team-open",
  hackathonId: "hack-1",
  name: "Vector Forge",
  tagline: "Low-latency indexing engine",
  description: "Building deterministic vector indexes.",
  skillsNeeded: ["Rust", "TypeScript", "Docker"],
  memberCount: 2,
  maxCapacity: 4,
  isOpen: true,
  status: "ACTIVE",
  leaderId: { id: "user-100", displayName: "Asha Rao" },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const fullTeam: apiModule.TeamRecord = {
  id: "team-full",
  hackathonId: "hack-1",
  name: "Ledger Guard",
  tagline: "Zero-conflict state machine",
  description: "Atomic seat locking.",
  skillsNeeded: ["Go", "MongoDB"],
  memberCount: 4,
  maxCapacity: 4,
  isOpen: true,
  status: "ACTIVE",
  leaderId: { id: "user-200", displayName: "Dev Patel" },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const closedTeam: apiModule.TeamRecord = {
  id: "team-closed",
  hackathonId: "hack-1",
  name: "Static Frame",
  tagline: "UI kit specialists",
  skillsNeeded: ["React"],
  memberCount: 2,
  maxCapacity: 4,
  isOpen: false,
  status: "ACTIVE",
  leaderId: "user-300",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockRoster: apiModule.TeamMemberRecord[] = [
  {
    id: "mem-1",
    hackathonId: "hack-1",
    teamId: "team-open",
    userId: {
      id: "user-100",
      displayName: "Asha Rao",
      email: "asha@example.com",
      skills: ["Rust", "C++"],
    },
    role: "LEADER",
    status: "ACTIVE",
    joinedAt: new Date().toISOString(),
  },
];

function renderDiscovery(initialEntry = "/teams-preview", currentUser = mockUser) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/teams-preview" element={<TeamsPreview />} />
            <Route path="/teams/:teamId" element={<div>Full Team Route</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

describe("Phase 3 — Team Discovery Experience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(apiModule, "apiGetMyTeam").mockResolvedValue(null);
    vi.spyOn(apiModule, "apiGetTeamRoster").mockResolvedValue(mockRoster);
    vi.spyOn(apiModule, "apiGetTeam").mockResolvedValue(openTeam);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces search input and applies combined vacancies and skill filters", async () => {
    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
    const listSpy = vi
      .spyOn(apiModule, "apiGetHackathonTeams")
      .mockResolvedValue([openTeam, closedTeam]);

    renderDiscovery();

    await waitFor(() => {
      expect(screen.getByText("Vector Forge")).toBeInTheDocument();
    });

    vi.useFakeTimers();
    const searchInput = screen.getByPlaceholderText(/Search name or tagline/i);
    fireEvent.change(searchInput, { target: { value: "Vector" } });

    // Before 300ms debounce expires, only initial mount query ran
    expect(listSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(320);
    });

    vi.useRealTimers();

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        "hack-1",
        expect.objectContaining({
          page: 1,
          limit: 10,
          search: "Vector",
        })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Vacancies Only/i }));
    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        "hack-1",
        expect.objectContaining({
          hasVacancies: true,
          search: "Vector",
        })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Rust" }));
    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        "hack-1",
        expect.objectContaining({
          hasVacancies: true,
          search: "Vector",
          skills: ["Rust"],
        })
      );
    });
  });

  it("preserves backend pagination metadata and requests next pages", async () => {
    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
    const listSpy = vi
      .spyOn(apiModule, "apiGetHackathonTeams")
      .mockImplementation(async (_hackId, params) => {
        const p = params?.page || 1;
        return apiModule.attachTeamPaginationMeta(p === 1 ? [openTeam] : [fullTeam], {
          page: p,
          limit: 10,
          total: 15,
        });
      });

    renderDiscovery();

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2 · 15 total")).toBeInTheDocument();
    });

    const prevButton = screen.getByRole("button", { name: "Previous page" });
    const nextButton = screen.getByRole("button", { name: "Next page" });
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeEnabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        "hack-1",
        expect.objectContaining({
          page: 2,
          limit: 10,
        })
      );
      expect(screen.getByText("Page 2 of 2 · 15 total")).toBeInTheDocument();
    });
  });

  it("renders error state with retry action and filtered empty state cleanly", async () => {
    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
    const listSpy = vi
      .spyOn(apiModule, "apiGetHackathonTeams")
      .mockRejectedValueOnce(new Error("Network offline"))
      .mockResolvedValueOnce([]);

    renderDiscovery();

    await waitFor(() => {
      expect(screen.getByText("Unable to Load Directory")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Retry Directory/i }));

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByText("No Teams Found")).toBeInTheDocument();
    });
  });

  it("inspects squad dossier on card click, navigates to detail route, and enforces join eligibility", async () => {
    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
    vi.spyOn(apiModule, "apiGetHackathonTeams").mockResolvedValue([openTeam, fullTeam, closedTeam]);

    renderDiscovery();

    await waitFor(() => {
      expect(screen.getByText("Vector Forge")).toBeInTheDocument();
    });

    // Click open team card -> shows active join controls + Full Dossier link
    fireEvent.click(screen.getByRole("button", { name: /Vector Forge/i }));

    await waitFor(() => {
      expect(screen.getByText("Building deterministic vector indexes.")).toBeInTheDocument();
      expect(screen.getByText("Asha Rao")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Instant direct join/i })).toBeEnabled();
    });

    expect(screen.getByRole("link", { name: /Full Dossier/i })).toHaveAttribute(
      "href",
      "/teams/team-open"
    );

    // Click closed team -> closed notice shown, direct join button absent
    fireEvent.click(screen.getByRole("button", { name: /Static Frame/i }));
    await waitFor(() => {
      expect(screen.getByText(/currently closed to new applications/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Instant direct join/i })).toBeNull();
    });
  });

  it("reconciles server capacity after HTTP 409 Conflict without optimistic decrement", async () => {
    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
    const filledUpdate: apiModule.TeamRecord = { ...openTeam, memberCount: 4 };
    vi.spyOn(apiModule, "apiGetHackathonTeams")
      .mockResolvedValueOnce([openTeam])
      .mockResolvedValueOnce([filledUpdate]);
    vi.spyOn(apiModule, "apiGetTeam").mockResolvedValue(filledUpdate);
    vi.spyOn(apiModule, "apiJoinTeam").mockRejectedValue(
      new apiModule.ApiClientError("TEAM_FULL", "The team has reached maximum capacity (4/4).", 409)
    );

    renderDiscovery();

    await waitFor(() => {
      expect(screen.getByText("Vector Forge")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Vector Forge/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Instant direct join/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /Instant direct join/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/maximum capacity \(4\/4\)/i);
      expect(screen.getByText(/Server confirmed: 4 \/ 4/i)).toBeInTheDocument();
    });
  });
});
