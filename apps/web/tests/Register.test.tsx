/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../src/context/AuthContext";
import { Register } from "../src/pages/Register";
import * as apiModule from "../src/lib/api";

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<div data-testid="home-route">Home</div>} />
          <Route path="/login" element={<div data-testid="login-route">Login</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("Redesigned Register Page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders only the strict required & optional fields with zero initial skills and no timezone selector", () => {
    renderRegister();

    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Technical Skills/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Short Bio/i)).toBeInTheDocument();

    expect(screen.queryByLabelText(/timezone/i)).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("0/20 selected")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Selected skills" })).toBeNull();
    expect(screen.getByRole("link", { name: /Sign in/i })).toHaveAttribute("href", "/login");
  });

  it("allows registration with zero selected skills, omits timeZone, and normalizes whitespace-only bio", async () => {
    const registerSpy = vi.spyOn(apiModule, "apiRegister").mockResolvedValue({
      user: {
        id: "user-0",
        email: "zero-skills@hackathon.org",
        displayName: "Zero Skills",
        skills: [],
        timeZone: "UTC",
        bio: "",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    renderRegister();

    const skillsInput = screen.getByLabelText(/Technical Skills/i);
    expect(skillsInput).not.toHaveAttribute("aria-invalid", "true");

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Zero Skills" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "zero-skills@hackathon.org" },
    });
    fireEvent.change(screen.getByLabelText(/^Password/i), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByLabelText(/Short Bio/i), {
      target: { value: "   " },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("home-route")).toBeInTheDocument();
    });

    const sentPayload = registerSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(sentPayload.skills).toEqual([]);
    expect(sentPayload.bio).toBeUndefined();
    expect("timeZone" in sentPayload).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("supports Enter-key skill entry without submitting, duplicate prevention, suggestions, and removal back to empty", async () => {
    const registerSpy = vi.spyOn(apiModule, "apiRegister");
    renderRegister();

    const skillsInput = screen.getByLabelText(/Technical Skills/i);

    // Pressing Enter adds the skill instead of submitting the form
    fireEvent.change(skillsInput, { target: { value: "Rust" } });
    fireEvent.keyDown(skillsInput, { key: "Enter", code: "Enter" });

    expect(registerSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Remove Rust" })).toBeInTheDocument();
    expect((skillsInput as HTMLInputElement).value).toBe("");

    // Prevents case-insensitive duplicate skills with polite notice
    fireEvent.change(skillsInput, { target: { value: "rust" } });
    fireEvent.keyDown(skillsInput, { key: "Enter", code: "Enter" });
    expect(screen.getByText(/"rust" is already added\./i)).toBeInTheDocument();

    // Quick-add suggested skill
    fireEvent.click(screen.getByRole("button", { name: "Add suggested skill Go" }));
    expect(screen.getByRole("button", { name: "Remove Go" })).toBeInTheDocument();

    // Removing all skills returns cleanly to 0/20 without error state
    fireEvent.click(screen.getByRole("button", { name: "Remove Rust" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Go" }));
    expect(screen.queryByRole("button", { name: "Remove Rust" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove Go" })).toBeNull();
    expect(screen.getByText("0/20 selected")).toBeInTheDocument();
    expect(skillsInput).not.toHaveAttribute("aria-invalid", "true");
    expect(registerSpy).not.toHaveBeenCalled();
  });

  it("omits timeZone and includes explicitly selected skills when registering", async () => {
    const registerSpy = vi.spyOn(apiModule, "apiRegister").mockResolvedValue({
      user: {
        id: "user-1",
        email: "maya@hackathon.org",
        displayName: "Maya Lin",
        skills: ["Rust", "Go"],
        timeZone: "UTC",
        bio: "",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    renderRegister();

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Maya Lin" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "maya@hackathon.org" },
    });
    fireEvent.change(screen.getByLabelText(/^Password/i), {
      target: { value: "StrongPass1!" },
    });
    // Explicitly add skills
    fireEvent.change(screen.getByLabelText(/Technical Skills/i), { target: { value: "Rust" } });
    fireEvent.keyDown(screen.getByLabelText(/Technical Skills/i), { key: "Enter", code: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Add suggested skill Go" }));

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("home-route")).toBeInTheDocument();
    });

    const sentPayload = registerSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(sentPayload.displayName).toBe("Maya Lin");
    expect(sentPayload.email).toBe("maya@hackathon.org");
    expect(sentPayload.skills).toEqual(["Rust", "Go"]);
    expect(sentPayload.bio).toBeUndefined();
    expect("timeZone" in sentPayload).toBe(false);
  });

  it("submits trimmed optional bio when provided and surfaces server errors", async () => {
    const registerSpy = vi
      .spyOn(apiModule, "apiRegister")
      .mockRejectedValueOnce(
        new apiModule.ApiClientError(
          "EMAIL_ALREADY_EXISTS",
          "An account with this email already exists",
          409
        )
      );

    renderRegister();

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Alex Rivera" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "alex@hackathon.org" },
    });
    fireEvent.change(screen.getByLabelText(/^Password/i), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add suggested skill TypeScript" }));
    fireEvent.change(screen.getByLabelText(/Short Bio/i), {
      target: { value: "  Systems and UI engineer  " },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "An account with this email already exists"
      );
    });

    const payload = registerSpy.mock.calls[0][0];
    expect(payload.bio).toBe("Systems and UI engineer");
  });

  it("synchronizes shared PasswordCompanion and LargePasswordCompanion (signup variant) without leaking password data", () => {
    vi.useFakeTimers();
    renderRegister();

    const smallCompanion = screen.getByTestId("password-companion");
    const largeCompanion = screen.getByTestId("large-password-companion");
    const passwordInput = screen.getByLabelText(/^Password/i) as HTMLInputElement;
    const toggleBtn = screen.getByRole("button", { name: "Show characters" });

    expect(largeCompanion.getAttribute("data-companion-variant")).toBe("signup");
    expect(largeCompanion.getAttribute("aria-hidden")).toBe("true");
    expect(smallCompanion.getAttribute("data-companion-state")).toBe("neutral");
    expect(largeCompanion.getAttribute("data-companion-state")).toBe("neutral");

    // Focus password input
    fireEvent.focus(passwordInput);
    expect(smallCompanion.getAttribute("data-companion-state")).toBe("focused-hidden");
    expect(largeCompanion.getAttribute("data-companion-state")).toBe("focused-hidden");

    // Typing masked password
    const secret = "SuperSecret99!";
    fireEvent.change(passwordInput, { target: { value: secret } });
    expect(smallCompanion.getAttribute("data-companion-state")).toBe("typing-hidden");
    expect(largeCompanion.getAttribute("data-companion-state")).toBe("typing-hidden");
    expect(largeCompanion.innerHTML).not.toContain(secret);

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(largeCompanion.getAttribute("data-companion-state")).toBe("focused-hidden");

    // Toggle password visibility
    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe("text");
    expect(toggleBtn.getAttribute("aria-pressed")).toBe("true");
    expect(toggleBtn.getAttribute("aria-label")).toBe("Hide characters");
    expect(smallCompanion.getAttribute("data-companion-state")).toBe("focused-visible");
    expect(largeCompanion.getAttribute("data-companion-state")).toBe("focused-visible");

    fireEvent.change(passwordInput, { target: { value: `${secret}X` } });
    expect(largeCompanion.getAttribute("data-companion-state")).toBe("typing-visible");
    expect(largeCompanion.innerHTML).not.toContain(secret);

    // Blur returns companion to neutral
    fireEvent.blur(passwordInput);
    expect(smallCompanion.getAttribute("data-companion-state")).toBe("neutral");
    expect(largeCompanion.getAttribute("data-companion-state")).toBe("neutral");
  });
});
