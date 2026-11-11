/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../src/context/AuthContext";
import { Login } from "../src/pages/Login";
import { PasswordCompanion, deriveCompanionState } from "../src/components/auth/PasswordCompanion";
import { LargePasswordCompanion } from "../src/components/auth/LargePasswordCompanion";
import * as apiModule from "../src/lib/api";

describe("Phase 3 — Redesigned Sign-In Experience & Interactive Character Companions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Companion State Matrix & Large Showcase Illustration", () => {
    it("derives all 5 deterministic expressions consistently across compact and large companions", () => {
      expect(deriveCompanionState(false, false, false)).toBe("neutral");
      expect(deriveCompanionState(false, true, true)).toBe("neutral");
      expect(deriveCompanionState(true, false, false)).toBe("focused-hidden");
      expect(deriveCompanionState(true, false, true)).toBe("typing-hidden");
      expect(deriveCompanionState(true, true, false)).toBe("focused-visible");
      expect(deriveCompanionState(true, true, true)).toBe("typing-visible");
    });

    it("renders LargePasswordCompanion neutrally with aria-hidden and zero interactive controls", () => {
      const { container } = render(
        <LargePasswordCompanion
          isPasswordFocused={false}
          isPasswordVisible={false}
          isTyping={false}
        />
      );

      const largeComp = screen.getByTestId("large-password-companion");
      expect(largeComp).toHaveAttribute("data-companion-state", "neutral");
      expect(largeComp).toHaveAttribute("aria-hidden", "true");
      expect(container.querySelectorAll("button, a, input, [tabindex]").length).toBe(0);
    });

    it("drives leftward gaze, head tilt, blush, and raised hand transitions across all 5 states", () => {
      const { container, rerender } = render(
        <LargePasswordCompanion
          isPasswordFocused={true}
          isPasswordVisible={false}
          isTyping={false}
        />
      );

      const largeComp = screen.getByTestId("large-password-companion");
      const pupils = container.querySelector(".large-companion-pupils") as HTMLElement;
      const head = container.querySelector(".large-companion-head") as HTMLElement;
      const blush = container.querySelector(".large-companion-blush") as HTMLElement;

      expect(largeComp).toHaveAttribute("data-companion-state", "focused-hidden");
      expect(pupils.style.transform).toContain("translate3d(-5.5px, 1.5px, 0)");

      rerender(
        <LargePasswordCompanion
          isPasswordFocused={true}
          isPasswordVisible={false}
          isTyping={true}
        />
      );
      expect(largeComp).toHaveAttribute("data-companion-state", "typing-hidden");
      expect(head.style.transform).toContain("rotate(2.5deg)");
      expect(pupils.style.transform).toContain("translate3d(-7px, 3px, 0)");

      rerender(
        <LargePasswordCompanion
          isPasswordFocused={true}
          isPasswordVisible={true}
          isTyping={false}
        />
      );
      expect(largeComp).toHaveAttribute("data-companion-state", "focused-visible");
      expect(head.style.transform).toContain("rotate(-6deg)");
      expect(blush.style.opacity).toBe("0.5");

      rerender(
        <LargePasswordCompanion isPasswordFocused={true} isPasswordVisible={true} isTyping={true} />
      );
      expect(largeComp).toHaveAttribute("data-companion-state", "typing-visible");
      expect(head.style.transform).toContain("rotate(-8.5deg)");
      expect(blush.style.opacity).toBe("0.75");
    });

    it("keeps compact companion strictly neutral with zero continuous blinking", () => {
      const { container } = render(
        <PasswordCompanion isPasswordFocused={false} isPasswordVisible={false} isTyping={false} />
      );
      expect(screen.getByTestId("password-companion")).toHaveAttribute(
        "data-companion-state",
        "neutral"
      );
      expect(container.querySelector(".companion-eyes-idle")).toBeNull();
    });
  });

  describe("Redesigned Two-Section Login Page Integration", () => {
    it("renders Welcome back heading without redundant branding/caption, real Google button, and Register link", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));

      const { container } = render(
        <MemoryRouter initialEntries={["/login"]}>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: /Welcome back\./i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Continue with Google/i })).toBeEnabled();
      expect(screen.getByRole("link", { name: /Create an account/i })).toHaveAttribute(
        "href",
        "/register"
      );

      // Verify redundant branding and right-panel caption were removed
      expect(screen.queryByText(/Your squad workspace is ready when you are\./i)).toBeNull();
      expect(container.querySelector("section")?.textContent).not.toContain("CrewConnect");
    });

    it("renders friendly inline error when returning from failed Google OAuth without exposing raw internals", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));

      render(
        <MemoryRouter initialEntries={["/login?error=access_denied"]}>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        /Google sign-in was cancelled\. You can try again or sign in with email and password\./i
      );
    });

    it("ignores email-field focus/typing and background autofill without reacting", () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      );

      const emailInput = screen.getByLabelText(/Email Address/i);
      const passwordInput = screen.getByLabelText("Password");
      const compactComp = screen.getByTestId("password-companion");
      const largeComp = screen.getByTestId("large-password-companion");

      fireEvent.focus(emailInput);
      fireEvent.change(emailInput, { target: { value: "developer@crewconnect.io" } });
      expect(compactComp).toHaveAttribute("data-companion-state", "neutral");
      expect(largeComp).toHaveAttribute("data-companion-state", "neutral");

      // Background autofill while password input is unfocused
      fireEvent.change(passwordInput, { target: { value: "AutofilledSecret!" } });
      expect(compactComp).toHaveAttribute("data-companion-state", "neutral");
      expect(largeComp).toHaveAttribute("data-companion-state", "neutral");
    });

    it("synchronizes both compact and large companions across full interaction lifecycle without leaking password", () => {
      vi.useFakeTimers();
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      );

      const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
      const toggleButton = screen.getByRole("button", { name: /Show characters/i });
      const compactComp = screen.getByTestId("password-companion");
      const largeComp = screen.getByTestId("large-password-companion");
      const secret = "TopSecretPassword99!";

      // 1. Focus -> focused-hidden
      fireEvent.focus(passwordInput);
      expect(compactComp).toHaveAttribute("data-companion-state", "focused-hidden");
      expect(largeComp).toHaveAttribute("data-companion-state", "focused-hidden");

      // 2. Type -> typing-hidden
      fireEvent.change(passwordInput, { target: { value: secret } });
      expect(compactComp).toHaveAttribute("data-companion-state", "typing-hidden");
      expect(largeComp).toHaveAttribute("data-companion-state", "typing-hidden");
      expect(compactComp.innerHTML).not.toContain(secret);
      expect(largeComp.innerHTML).not.toContain(secret);

      // 3. Inactivity -> focused-hidden
      act(() => {
        vi.advanceTimersByTime(700);
      });
      expect(compactComp).toHaveAttribute("data-companion-state", "focused-hidden");
      expect(largeComp).toHaveAttribute("data-companion-state", "focused-hidden");

      // 4. Toggle visibility ON -> focused-visible
      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe("text");
      expect(compactComp).toHaveAttribute("data-companion-state", "focused-visible");
      expect(largeComp).toHaveAttribute("data-companion-state", "focused-visible");

      // 5. Type while visible -> typing-visible
      fireEvent.change(passwordInput, { target: { value: secret + "!" } });
      expect(compactComp).toHaveAttribute("data-companion-state", "typing-visible");
      expect(largeComp).toHaveAttribute("data-companion-state", "typing-visible");
      expect(largeComp.innerHTML).not.toContain(secret);

      // 6. Blur while typing -> neutral immediately
      fireEvent.blur(passwordInput);
      expect(compactComp).toHaveAttribute("data-companion-state", "neutral");
      expect(largeComp).toHaveAttribute("data-companion-state", "neutral");
    });

    it("preserves form validation, API error handling, and login submission", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
      const loginSpy = vi.spyOn(apiModule, "apiLogin").mockResolvedValue({
        user: {
          id: "u1",
          email: "test@crew.org",
          displayName: "Test User",
          skills: ["Builder"],
          timeZone: "UTC",
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "test@crew.org" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "Password123!" },
      });

      fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

      await waitFor(() => {
        expect(loginSpy).toHaveBeenCalledWith({
          email: "test@crew.org",
          password: "Password123!",
        });
      });
    });

    it("keeps email/password login fully functional even after Google sign-in becomes unavailable", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
      vi.spyOn(apiModule, "apiGetGoogleAuthStatus").mockResolvedValue({ configured: false });
      const loginSpy = vi.spyOn(apiModule, "apiLogin").mockResolvedValue({
        user: {
          id: "u1",
          email: "test@crew.org",
          displayName: "Test User",
          skills: ["Builder"],
          timeZone: "UTC",
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      );

      // Click Google -> unavailable inline state
      fireEvent.click(screen.getByRole("button", { name: /Continue with Google/i }));
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent(/unavailable right now/i);
      });

      // Immediately submit standard email/password form -> works seamlessly
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "test@crew.org" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "Password123!" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

      await waitFor(() => {
        expect(loginSpy).toHaveBeenCalledTimes(1);
      });
    });
  });
});
