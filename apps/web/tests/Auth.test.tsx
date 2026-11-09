/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../src/context/AuthContext";
import { Login } from "../src/pages/Login";
import { Register } from "../src/pages/Register";
import { ProtectedRoute } from "../src/components/ProtectedRoute";
import { Profile } from "../src/pages/Profile";
import * as apiModule from "../src/lib/api";

describe("Frontend Authentication Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Login Page Validation & Submission", () => {
    it("renders email and password inputs with sign in button", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
      });
    });

    it("displays error message if fields are empty on submit", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      );

      const submitButton = screen.getByRole("button", { name: /Sign In/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Please enter both email and password."
        );
      });
    });

    it("displays API error alert when login fails", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
      vi.spyOn(apiModule, "apiLogin").mockRejectedValue(
        new apiModule.ApiClientError("INVALID_CREDENTIALS", "Invalid email or password", 401)
      );

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/Password/i), {
        target: { value: "wrongpassword" },
      });

      fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Invalid email or password");
      });
    });
  });

  describe("Register Page Validation", () => {
    it("displays error when password is less than 8 characters", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));

      render(
        <MemoryRouter initialEntries={["/register"]}>
          <AuthProvider>
            <Register />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Full Name/i), {
        target: { value: "Test User" },
      });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/Password/i), {
        target: { value: "short1!" },
      });

      fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Password must be at least 8 characters long."
        );
      });
    });

    it("displays error when password lacks numbers or special characters", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));

      render(
        <MemoryRouter initialEntries={["/register"]}>
          <AuthProvider>
            <Register />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Full Name/i), {
        target: { value: "Test User" },
      });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/Password/i), {
        target: { value: "PasswordWithoutNumbers" },
      });

      fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Password must contain at least one digit."
        );
      });
    });
  });

  describe("Protected Route Behavior", () => {
    it("redirects unauthenticated user to /login", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));

      render(
        <MemoryRouter initialEntries={["/profile"]}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>Login Page Target</div>} />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Login Page Target")).toBeInTheDocument();
      });
    });

    it("renders protected component when user is authenticated", async () => {
      vi.spyOn(apiModule, "apiGetMe").mockResolvedValue({
        user: {
          id: "mock_user_123",
          displayName: "Authenticated Hero",
          email: "hero@example.com",
          skills: ["React", "TypeScript", "Node.js"],
          timeZone: "UTC",
          status: "ACTIVE",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      });

      render(
        <MemoryRouter initialEntries={["/profile"]}>
          <AuthProvider>
            <Routes>
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Authenticated Hero")).toBeInTheDocument();
        expect(screen.getByText("hero@example.com")).toBeInTheDocument();
        expect(screen.getByText("Technical Skills (3)")).toBeInTheDocument();
      });
    });
  });
});
