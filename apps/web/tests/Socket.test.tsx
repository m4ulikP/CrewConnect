/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthContext } from "../src/context/AuthContext";
import { SocketContext, type SocketConnectionState } from "../src/context/SocketContext";
import type { Socket } from "socket.io-client";
import { Navbar } from "../src/components/Navbar";
import { TeamsPreview } from "../src/pages/TeamsPreview";
import { REALTIME_EVENTS } from "@crewconnect/shared";
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

function createFakeSocket() {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  return {
    connected: true,
    on: vi.fn((event: string, cb: (payload: unknown) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(cb);
    }),
    off: vi.fn((event: string, cb: (payload: unknown) => void) => {
      listeners.get(event)?.delete(cb);
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    trigger(event: string, payload: unknown) {
      listeners.get(event)?.forEach((cb) => cb(payload));
    },
  };
}

describe("Frontend Real-Time Socket Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function renderNavbar(connectionState: SocketConnectionState, authenticated = true) {
    return render(
      <BrowserRouter>
        <AuthContext.Provider
          value={{
            user: authenticated ? mockUser : null,
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
              socket: null,
              connectionState,
              joinHackathonRoom: vi.fn(),
              leaveHackathonRoom: vi.fn(),
              joinTeamRoom: vi.fn(),
              leaveTeamRoom: vi.fn(),
            }}
          >
            <Navbar />
          </SocketContext.Provider>
        </AuthContext.Provider>
      </BrowserRouter>
    );
  }

  it("displays Live indicator when socket is connected for authenticated users", () => {
    renderNavbar("connected", true);
    const badge = screen.getByTestId("realtime-status-badge");
    expect(badge).toHaveTextContent("Live");
  });

  it("displays Syncing indicator when socket is reconnecting", () => {
    renderNavbar("reconnecting", true);
    const badge = screen.getByTestId("realtime-status-badge");
    expect(badge).toHaveTextContent("Syncing");
  });

  it("displays Offline indicator when socket is disconnected", () => {
    renderNavbar("disconnected", true);
    const badge = screen.getByTestId("realtime-status-badge");
    expect(badge).toHaveTextContent("Offline");
  });

  it("hides real-time indicator when unauthenticated", () => {
    renderNavbar("disconnected", false);
    expect(screen.queryByTestId("realtime-status-badge")).toBeNull();
  });

  it("live-updates team capacity and full state in TeamsPreview when TEAM_CAPACITY_UPDATED arrives", async () => {
    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
    vi.spyOn(apiModule, "apiGetHackathonTeams").mockResolvedValue([mockTeam]);
    vi.spyOn(apiModule, "apiGetMyTeam").mockResolvedValue(null);

    const fakeSocket = createFakeSocket();
    const joinHackathonRoom = vi.fn();

    render(
      <BrowserRouter>
        <AuthContext.Provider
          value={{
            user: mockUser,
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
              socket: fakeSocket as unknown as Socket,
              connectionState: "connected",
              joinHackathonRoom,
              leaveHackathonRoom: vi.fn(),
              joinTeamRoom: vi.fn(),
              leaveTeamRoom: vi.fn(),
            }}
          >
            <TeamsPreview />
          </SocketContext.Provider>
        </AuthContext.Provider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Kernel Panic")).toBeInTheDocument();
      expect(screen.getByText(/2 \/ 5/i)).toBeInTheDocument();
    });

    expect(joinHackathonRoom).toHaveBeenCalledWith("hack-1");

    // Emit live capacity update event filling the team
    act(() => {
      fakeSocket.trigger(REALTIME_EVENTS.TEAM_CAPACITY_UPDATED, {
        teamId: "team-1",
        hackathonId: "hack-1",
        memberCount: 5,
        maxCapacity: 5,
        isOpen: false,
        timestamp: new Date().toISOString(),
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/5 \/ 5/i)).toBeInTheDocument();
    });
  });

  it("removes disbanded team from TeamsPreview when TEAM_DISBANDED arrives", async () => {
    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
    vi.spyOn(apiModule, "apiGetHackathonTeams").mockResolvedValue([mockTeam]);
    vi.spyOn(apiModule, "apiGetMyTeam").mockResolvedValue(null);

    const fakeSocket = createFakeSocket();

    render(
      <BrowserRouter>
        <AuthContext.Provider
          value={{
            user: mockUser,
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
              socket: fakeSocket as unknown as Socket,
              connectionState: "connected",
              joinHackathonRoom: vi.fn(),
              leaveHackathonRoom: vi.fn(),
              joinTeamRoom: vi.fn(),
              leaveTeamRoom: vi.fn(),
            }}
          >
            <TeamsPreview />
          </SocketContext.Provider>
        </AuthContext.Provider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Kernel Panic")).toBeInTheDocument();
    });

    act(() => {
      fakeSocket.trigger(REALTIME_EVENTS.TEAM_DISBANDED, {
        teamId: "team-1",
        hackathonId: "hack-1",
        disbandedBy: "user-123",
        timestamp: new Date().toISOString(),
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("Kernel Panic")).toBeNull();
    });
  });
});
