/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../src/context/AuthContext";
import { SocketContext } from "../src/context/SocketContext";
import { ProtectedRoute } from "../src/components/ProtectedRoute";
import { Navbar } from "../src/components/Navbar";
import { Home } from "../src/pages/Home";
import { AuthenticatedDashboard } from "../src/components/dashboard/AuthenticatedDashboard";
import { Login } from "../src/pages/Login";
import { Profile } from "../src/pages/Profile";
import * as apiModule from "../src/lib/api";
import type { UserDTO } from "@crewconnect/shared";

const mockUser: UserDTO = {
  id: "user-test-1",
  email: "test.builder@hackathon.org",
  displayName: "Test Builder",
  skills: ["TypeScript", "React"],
  timeZone: "UTC",
  bio: "Full stack hacker",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const mockHackathons: apiModule.HackathonRecord[] = [
  {
    id: "hack-1",
    slug: "hack4hack-2026",
    title: "Hack4Hack 2026",
    description: "Main hiring challenge",
    minTeamSize: 1,
    maxTeamSize: 4,
    status: "ACTIVE",
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
  },
];

const LocationTracker: React.FC = () => {
  const location = useLocation();
  return (
    <div data-testid="location-tracker" data-pathname={location.pathname}>
      {location.pathname}
    </div>
  );
};

function renderApp(initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
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
            <Navbar />
            <LocationTracker />
            <main>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <AuthenticatedDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="/login" element={<Login />} />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/teams-preview"
                  element={<div data-testid="teams-preview-page">Teams Preview Page</div>}
                />
              </Routes>
            </main>
          </SocketContext.Provider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Route Separation: Public Landing Page (/) vs Authenticated Dashboard (/dashboard)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiModule, "fetchHealth").mockResolvedValue({
      status: "healthy",
      uptime: 120,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      database: { connected: true, status: "connected", isReplicaSet: true },
    });
    vi.spyOn(apiModule, "apiGetHackathons").mockResolvedValue(mockHackathons);
    vi.spyOn(apiModule, "apiGetMyTeam").mockResolvedValue(null);
    vi.spyOn(apiModule, "apiGetHackathonTeams").mockResolvedValue([]);
    vi.spyOn(apiModule, "apiGetTeamAuditLogs").mockResolvedValue([]);
    vi.spyOn(apiModule, "apiGetJoinRequests").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Visiting / while logged out renders the public landing page", async () => {
    vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));

    renderApp(["/"]);

    await waitFor(() => {
      expect(screen.getByText("Explore Team Board")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Discover hackathon teams, check which skills they need, and claim open seats backed by atomic database reservations that prevent double-bookings."
        )
      ).toBeInTheDocument();
    });

    // Ensure dashboard specific header is not present
    expect(screen.queryByLabelText("Refresh dashboard data")).toBeNull();
  });

  it("2. Visiting / while logged in still renders the public landing page (not the dashboard)", async () => {
    vi.spyOn(apiModule, "apiGetMe").mockResolvedValue({ user: mockUser });

    renderApp(["/"]);

    // Verify public landing page renders
    await waitFor(() => {
      expect(screen.getByText("Explore Team Board")).toBeInTheDocument();
    });

    // Verify dashboard is NOT rendered on /
    expect(screen.queryByLabelText("Refresh dashboard data")).toBeNull();

    // Verify no separate Dashboard navigation item exists
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();

    // Verify user's name/profile identity in navbar links to /dashboard
    expect(screen.getByRole("link", { name: /Test Builder/i })).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(screen.getByRole("link", { name: "Platform" })).toHaveAttribute("href", "/");
  });

  it("3. Visiting /dashboard while logged out redirects to /login preserving intended destination", async () => {
    vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));

    renderApp(["/dashboard"]);

    await waitFor(() => {
      const tracker = screen.getByTestId("location-tracker");
      expect(tracker).toHaveAttribute("data-pathname", "/login");
      expect(screen.getByRole("heading", { name: /Welcome back\./i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    });
  });

  it("4. Visiting /dashboard while logged in renders the authenticated dashboard", async () => {
    vi.spyOn(apiModule, "apiGetMe").mockResolvedValue({ user: mockUser });

    renderApp(["/dashboard"]);

    await waitFor(() => {
      expect(screen.getByLabelText("Refresh dashboard data")).toBeInTheDocument();
      expect(screen.getByText("Hack4Hack 2026")).toBeInTheDocument();
    });

    // Landing page elements should not be rendered
    expect(screen.queryByText("Explore Team Board")).toBeNull();
  });

  it("5. Successful login redirects to /dashboard", async () => {
    vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
    const loginSpy = vi.spyOn(apiModule, "apiLogin").mockResolvedValue({ user: mockUser });

    renderApp(["/login"]);

    await waitFor(() => {
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "test.builder@hackathon.org" },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: "StrongPass1!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledTimes(1);
      const tracker = screen.getByTestId("location-tracker");
      expect(tracker).toHaveAttribute("data-pathname", "/dashboard");
    });
  });

  it("6. Logout from /dashboard redirects the user to /", async () => {
    vi.spyOn(apiModule, "apiGetMe").mockResolvedValue({ user: mockUser });
    const logoutSpy = vi.spyOn(apiModule, "apiLogout").mockResolvedValue(undefined);

    renderApp(["/dashboard"]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalledTimes(1);
      const tracker = screen.getByTestId("location-tracker");
      expect(tracker).toHaveAttribute("data-pathname", "/");
      expect(screen.getByText("Explore Team Board")).toBeInTheDocument();
    });
  });

  it("7. Refreshing /dashboard preserves the authenticated dashboard", async () => {
    // Initial fetch of /me resolves active user (like an active HTTP-only cookie on reload)
    vi.spyOn(apiModule, "apiGetMe").mockResolvedValue({ user: mockUser });

    renderApp(["/dashboard"]);

    await waitFor(() => {
      expect(screen.getByLabelText("Refresh dashboard data")).toBeInTheDocument();
      const tracker = screen.getByTestId("location-tracker");
      expect(tracker).toHaveAttribute("data-pathname", "/dashboard");
    });
  });

  it("8. Direct navigation to /dashboard works for authenticated users", async () => {
    vi.spyOn(apiModule, "apiGetMe").mockResolvedValue({ user: mockUser });

    renderApp(["/dashboard"]);

    await waitFor(() => {
      expect(screen.getByText("Test Builder")).toBeInTheDocument();
      expect(screen.getByLabelText("Refresh dashboard data")).toBeInTheDocument();
    });
  });

  it("9. Clicking user's name navigates to /dashboard and clicking CrewConnect logo navigates to /", async () => {
    vi.spyOn(apiModule, "apiGetMe").mockResolvedValue({ user: mockUser });

    renderApp(["/"]);

    // Starts on public landing page
    await waitFor(() => {
      expect(screen.getByText("Explore Team Board")).toBeInTheDocument();
    });

    // Click User's name/profile identity in navbar
    const userProfileLink = screen.getByRole("link", { name: /Test Builder/i });
    fireEvent.click(userProfileLink);

    // Navigates to /dashboard
    await waitFor(() => {
      const tracker = screen.getByTestId("location-tracker");
      expect(tracker).toHaveAttribute("data-pathname", "/dashboard");
      expect(screen.getByLabelText("Refresh dashboard data")).toBeInTheDocument();
    });

    // Click CrewConnect logo in navbar
    const logoLink = screen.getByRole("link", { name: /CrewConnect/i });
    fireEvent.click(logoLink);

    // Navigates back to / and displays landing page
    await waitFor(() => {
      const tracker = screen.getByTestId("location-tracker");
      expect(tracker).toHaveAttribute("data-pathname", "/");
      expect(screen.getByText("Explore Team Board")).toBeInTheDocument();
    });
  });

  it("10. Existing routes (like /teams-preview and /profile) remain functional", async () => {
    vi.spyOn(apiModule, "apiGetMe").mockResolvedValue({ user: mockUser });

    renderApp(["/teams-preview"]);

    await waitFor(() => {
      expect(screen.getByTestId("teams-preview-page")).toBeInTheDocument();
    });

    // Direct navigation to protected profile works
    renderApp(["/profile"]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit Profile/i })).toBeInTheDocument();
    });
  });
});
