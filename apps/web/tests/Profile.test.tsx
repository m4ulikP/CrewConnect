/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../src/context/AuthContext";
import { Profile } from "../src/pages/Profile";
import * as apiModule from "../src/lib/api";
import type { UserDTO } from "@crewconnect/shared";

const mockInitialUser: UserDTO = {
  id: "user-123",
  email: "alex.rivera@hackathon.org",
  displayName: "Alex Rivera",
  bio: "Systems architect and distributed systems enthusiast.",
  skills: ["TypeScript", "React", "Rust"],
  timeZone: "America/New_York",
  experienceLevel: "ADVANCED",
  githubUrl: "https://github.com/alex-rivera",
  linkedinUrl: "https://linkedin.com/in/alex-rivera",
  portfolioUrl: "https://alexrivera.dev",
  status: "ACTIVE",
  createdAt: "2026-01-15T10:00:00.000Z",
};

function renderProfile(user: UserDTO = mockInitialUser) {
  vi.spyOn(apiModule, "apiGetMe").mockResolvedValue({ user });

  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <AuthProvider>
        <Routes>
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<div data-testid="login-route">Login</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("Complete Profile Editing Experience (Profile.tsx)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads and displays existing user profile data in view mode", async () => {
    renderProfile();

    // Wait for user data to load and render
    await waitFor(() => {
      expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    });

    expect(screen.getByText("alex.rivera@hackathon.org")).toBeInTheDocument();
    expect(
      screen.getByText("Systems architect and distributed systems enthusiast.")
    ).toBeInTheDocument();
    expect(screen.getAllByText("ADVANCED").length).toBeGreaterThan(0);
    expect(screen.getByText("America/New_York")).toBeInTheDocument();
    expect(screen.getAllByText("ACTIVE").length).toBeGreaterThan(0);

    // Verify skills rendered
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Rust")).toBeInTheDocument();

    // Verify external links
    expect(screen.getByText("github.com/alex-rivera")).toBeInTheDocument();
    expect(screen.getByText("linkedin.com/in/alex-rivera")).toBeInTheDocument();
    expect(screen.getByText("alexrivera.dev")).toBeInTheDocument();

    // Actions visible in view mode
    expect(screen.getByRole("button", { name: /Edit Profile/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign Out/i })).toBeInTheDocument();
  });

  it("toggles between view mode and edit mode cleanly", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit Profile/i })).toBeInTheDocument();
    });

    // Enter edit mode
    fireEvent.click(screen.getByRole("button", { name: /Edit Profile/i }));

    expect(screen.getByRole("heading", { name: "Edit Profile" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toHaveValue("Alex Rivera");
    expect(screen.getByLabelText(/Short Bio/i)).toHaveValue(
      "Systems architect and distributed systems enthusiast."
    );

    // Cancel edit mode
    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" })[0]);

    // Back to view mode
    expect(screen.queryByRole("heading", { name: "Edit Profile" })).toBeNull();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
  });

  it("successfully edits and saves updated profile fields", async () => {
    const updateSpy = vi.spyOn(apiModule, "apiUpdateProfile").mockResolvedValue({
      user: {
        ...mockInitialUser,
        displayName: "Alexandra Rivera",
        bio: "Updated bio for the hackathon season.",
        experienceLevel: "INTERMEDIATE",
        timeZone: "UTC",
      },
    });

    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit Profile/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Edit Profile/i }));

    const nameInput = screen.getByLabelText(/Full Name/i);
    const bioInput = screen.getByLabelText(/Short Bio/i);
    const expSelect = screen.getByLabelText(/Experience Level/i);
    const tzInput = screen.getByLabelText(/Timezone/i);

    fireEvent.change(nameInput, { target: { value: "Alexandra Rivera" } });
    fireEvent.change(bioInput, { target: { value: "Updated bio for the hackathon season." } });
    fireEvent.change(expSelect, { target: { value: "INTERMEDIATE" } });
    fireEvent.change(tzInput, { target: { value: "UTC" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: "Alexandra Rivera",
          bio: "Updated bio for the hackathon season.",
          experienceLevel: "INTERMEDIATE",
          timeZone: "UTC",
        })
      );
    });

    // Success feedback is displayed
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Profile updated successfully/i);
    });

    // View mode reflects updated fields
    expect(screen.getByText("Alexandra Rivera")).toBeInTheDocument();
    expect(screen.getByText("Updated bio for the hackathon season.")).toBeInTheDocument();
  });

  it("supports adding skills via Enter key, clicking Add, and suggested skills with duplicate prevention", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit Profile/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Edit Profile/i }));

    const skillInput = screen.getByPlaceholderText(/Add a technical skill/i);

    // 1. Add skill via Enter key
    fireEvent.change(skillInput, { target: { value: "Docker" } });
    fireEvent.keyDown(skillInput, { key: "Enter", code: "Enter" });
    expect(screen.getByRole("button", { name: "Remove Docker" })).toBeInTheDocument();

    // 2. Add skill via Add button
    fireEvent.change(skillInput, { target: { value: "GraphQL" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("button", { name: "Remove GraphQL" })).toBeInTheDocument();

    // 3. Duplicate skill prevention (case-insensitive)
    fireEvent.change(skillInput, { target: { value: "docker" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("status")).toHaveTextContent(/"docker" is already added\./i);

    // 4. Click a suggested skill
    const pythonSuggestion = screen.getByRole("button", { name: "Python" });
    fireEvent.click(pythonSuggestion);
    expect(screen.getByRole("button", { name: "Remove Python" })).toBeInTheDocument();

    // 5. Remove a skill
    fireEvent.click(screen.getByRole("button", { name: "Remove TypeScript" }));
    expect(screen.queryByRole("button", { name: "Remove TypeScript" })).toBeNull();
  });

  it("allows saving with zero technical skills (optional skills)", async () => {
    const updateSpy = vi.spyOn(apiModule, "apiUpdateProfile").mockResolvedValue({
      user: {
        ...mockInitialUser,
        skills: [],
      },
    });

    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit Profile/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Edit Profile/i }));

    // Remove all 3 initial skills
    fireEvent.click(screen.getByRole("button", { name: "Remove TypeScript" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove React" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Rust" }));

    expect(screen.getByText("0/20 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          skills: [],
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/No technical skills listed/i)).toBeInTheDocument();
    });
  });

  it("displays inline validation errors when required fields are missing or URLs are invalid", async () => {
    const updateSpy = vi.spyOn(apiModule, "apiUpdateProfile");

    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit Profile/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Edit Profile/i }));

    const nameInput = screen.getByLabelText(/Full Name/i);
    const githubInput = screen.getByLabelText(/GitHub URL/i);

    // Empty full name (required)
    fireEvent.change(nameInput, { target: { value: "" } });
    // Invalid URL format
    fireEvent.change(githubInput, { target: { value: "not-a-valid-url" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    // Expect inline errors and alert
    expect(screen.getByText("Full name is required.")).toBeInTheDocument();
    expect(screen.getByText(/Please provide a valid URL/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Please resolve the highlighted validation errors/i
    );

    // Ensure API was not called
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("handles server-side API error gracefully and displays error feedback", async () => {
    vi.spyOn(apiModule, "apiUpdateProfile").mockRejectedValue(
      new apiModule.ApiClientError("VALIDATION_ERROR", "Invalid timezone specified on server.", 400)
    );

    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit Profile/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Edit Profile/i }));

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid timezone specified on server.");
    });

    // Form stays open in edit mode
    expect(screen.getByRole("heading", { name: "Edit Profile" })).toBeInTheDocument();
  });
});
