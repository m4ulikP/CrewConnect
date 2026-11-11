/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../src/context/AuthContext";
import { GoogleAuth } from "../src/pages/GoogleAuth";
import { AuthCallback } from "../src/pages/AuthCallback";
import { Login } from "../src/pages/Login";
import * as apiModule from "../src/lib/api";

describe("Phase 1.2 — Frontend Custom Google Authentication UI Polish", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Dedicated Google Authentication Page (/auth/google)", () => {
    it("renders CrewConnect branding, heading, reassuring note, and enabled button when configured", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
      vi.spyOn(apiModule, "apiGetGoogleAuthStatus").mockResolvedValue({ configured: true });

      render(
        <MemoryRouter initialEntries={["/auth/google"]}>
          <AuthProvider>
            <GoogleAuth />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Continue with Google/i })).toBeEnabled();
      });

      expect(screen.getByText("CrewConnect")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Continue with Google/i })).toBeInTheDocument();
      expect(
        screen.getByText(/One account\. Your next great team starts here\./i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Your account, protected\./i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Sign in securely with Google\. Your account information is handled with care\./i
        )
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Use email and password/i })).toHaveAttribute(
        "href",
        "/login"
      );

      // Ensure no availability alert is shown when configured
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("displays concise user-friendly notice without exposing developer internals when unconfigured", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
      vi.spyOn(apiModule, "apiGetGoogleAuthStatus").mockResolvedValue({ configured: false });

      const { container } = render(
        <MemoryRouter initialEntries={["/auth/google"]}>
          <AuthProvider>
            <GoogleAuth />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /Google sign-in isn't available right now\. You can continue using your email and password\./i
        );
      });

      const button = screen.getByRole("button", { name: /Continue with Google/i });
      expect(button).toBeDisabled();

      // Strictly ensure NO developer env vars, callback URLs, or technical OAuth jargon are visible
      const fullText = container.textContent || "";
      expect(fullText).not.toContain("GOOGLE_CLIENT_ID");
      expect(fullText).not.toContain("GOOGLE_CLIENT_SECRET");
      expect(fullText).not.toContain("GOOGLE_CALLBACK_URL");
      expect(fullText).not.toContain("apps/api/.env");
      expect(fullText).not.toContain("http://localhost:5000");
      expect(fullText).not.toContain("PKCE");
      expect(fullText).not.toContain("HTTP-only");
      expect(fullText).not.toContain("localStorage");
      expect(fullText).not.toContain("Stage 01");
    });

    it("displays user-friendly notice if redirected with error=not_configured", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
      vi.spyOn(apiModule, "apiGetGoogleAuthStatus").mockResolvedValue({ configured: false });

      render(
        <MemoryRouter initialEntries={["/auth/google?error=not_configured"]}>
          <AuthProvider>
            <GoogleAuth />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /Google sign-in isn't available right now\. You can continue using your email and password\./i
        );
      });
    });

    it("displays clean user-facing error on other query error parameters", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
      vi.spyOn(apiModule, "apiGetGoogleAuthStatus").mockResolvedValue({ configured: true });

      render(
        <MemoryRouter initialEntries={["/auth/google?error=access_denied"]}>
          <AuthProvider>
            <GoogleAuth />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /Unable to complete Google sign-in\. Please try again or use your email and password\./i
        );
      });
    });

    it("shows loading state and initiates redirect once while preventing duplicate clicks", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
      vi.spyOn(apiModule, "apiGetGoogleAuthStatus").mockResolvedValue({ configured: true });

      const assignSpy = vi.fn();
      const originalLocation = window.location;
      delete (window as unknown as Record<string, unknown>).location;
      (window as unknown as Record<string, unknown>).location = {
        ...originalLocation,
        assign: assignSpy,
        set href(val: string) {
          assignSpy(val);
        },
        get href() {
          return "";
        },
      };

      render(
        <MemoryRouter initialEntries={["/auth/google?returnTo=/teams"]}>
          <AuthProvider>
            <GoogleAuth />
          </AuthProvider>
        </MemoryRouter>
      );

      const button = await screen.findByRole("button", { name: /Continue with Google/i });
      await waitFor(() => expect(button).toBeEnabled());

      // Click once
      fireEvent.click(button);

      expect(assignSpy).toHaveBeenCalledTimes(1);
      expect(assignSpy).toHaveBeenCalledWith(
        expect.stringContaining("/auth/google?returnTo=%2Fteams")
      );
      expect(screen.getByText(/Connecting to Google\.\.\./i)).toBeInTheDocument();
      expect(button).toBeDisabled();

      // Second click while loading should do nothing
      fireEvent.click(button);
      expect(assignSpy).toHaveBeenCalledTimes(1);

      // Restore window.location
      (window as unknown as Record<string, unknown>).location = originalLocation;
    });
  });

  describe("Callback Page (/auth/callback)", () => {
    it("renders friendly error notice and recovery options when error query param is present", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));

      render(
        <MemoryRouter
          initialEntries={[
            "/auth/callback?error=An%20account%20with%20this%20email%20already%20exists",
          ]}
        >
          <AuthProvider>
            <AuthCallback />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: /Sign-In Unsuccessful/i })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "An account with this email already exists"
      );
      expect(screen.getByRole("link", { name: /Sign in with Email & Password/i })).toHaveAttribute(
        "href",
        "/login"
      );
      expect(screen.getByRole("link", { name: /Try Google Again/i })).toHaveAttribute(
        "href",
        "/auth/google"
      );
    });

    it("verifies session and redirects to dashboard on successful callback", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockResolvedValue({
        user: {
          id: "u123",
          email: "verified@google.com",
          displayName: "Verified Dev",
          skills: ["Builder"],
          timeZone: "UTC",
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      render(
        <MemoryRouter initialEntries={["/auth/callback"]}>
          <AuthProvider>
            <Routes>
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/dashboard" element={<div>Authenticated Dashboard View</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Authenticated Dashboard View")).toBeInTheDocument();
      });
    });
  });

  describe("Login Page Integration", () => {
    it("renders enabled Continue with Google button initially and handles unavailable state inline", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
      const statusSpy = vi
        .spyOn(apiModule, "apiGetGoogleAuthStatus")
        .mockResolvedValue({ configured: false });

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      );

      const googleBtn = screen.getByRole("button", { name: /Continue with Google/i });
      expect(googleBtn).toBeEnabled();

      // Click establishes unavailable state inline without navigation
      fireEvent.click(googleBtn);

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent(
          /Google sign-in is unavailable right now\. Please use your email and password instead\./i
        );
      });

      expect(googleBtn).toBeDisabled();
      expect(statusSpy).toHaveBeenCalledTimes(1);

      // Repeated clicks do not trigger additional availability checks
      fireEvent.click(googleBtn);
      expect(statusSpy).toHaveBeenCalledTimes(1);
    });

    it("fails safely to unavailable state on network error or unexpected response", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
      vi.spyOn(apiModule, "apiGetGoogleAuthStatus").mockRejectedValue(new Error("Network offline"));

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      );

      const googleBtn = screen.getByRole("button", { name: /Continue with Google/i });
      fireEvent.click(googleBtn);

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent(
          /Google sign-in is unavailable right now\. Please use your email and password instead\./i
        );
      });
      expect(googleBtn).toBeDisabled();
    });

    it("initiates existing Google OAuth flow in same tab when configured", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
      vi.spyOn(apiModule, "apiGetGoogleAuthStatus").mockResolvedValue({ configured: true });

      const assignSpy = vi.fn();
      const originalLocation = window.location;
      delete (window as unknown as Record<string, unknown>).location;
      (window as unknown as Record<string, unknown>).location = {
        ...originalLocation,
        assign: assignSpy,
        set href(val: string) {
          assignSpy(val);
        },
        get href() {
          return "";
        },
      };

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      );

      const googleBtn = screen.getByRole("button", { name: /Continue with Google/i });
      fireEvent.click(googleBtn);

      await waitFor(() => {
        expect(assignSpy).toHaveBeenCalledWith(expect.stringContaining("/auth/google"));
      });

      (window as unknown as Record<string, unknown>).location = originalLocation;
    });
  });
});
