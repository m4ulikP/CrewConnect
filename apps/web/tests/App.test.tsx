/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { App } from "../src/App";
import * as apiModule from "../src/lib/api";

describe("Frontend Shell Rendering", () => {
  beforeEach(() => {
    vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
    vi.spyOn(apiModule, "fetchHealth").mockResolvedValue({
      status: "ok",
      uptime: 100,
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      database: { connected: true, status: "connected", isReplicaSet: true },
    });
  });

  it("renders the navigation bar with CrewConnect title", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("CrewConnect")).toBeInTheDocument();
      expect(screen.getByText("PS1 Engine")).toBeInTheDocument();
    });
  });

  it("renders the hero heading and primary action", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Race-proof squads,/i)).toBeInTheDocument();
      expect(screen.getByText(/formed cleanly\./i)).toBeInTheDocument();
      expect(screen.getByText("Explore Team Board")).toBeInTheDocument();
    });
  });

  it("renders interactive squad showcase and reservation engine explanation", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Inspect a squad before you claim a seat.")).toBeInTheDocument();
      expect(screen.getByText("Engineered to prevent phantom memberships.")).toBeInTheDocument();
      expect(screen.getByText("MongoDB 7.0 (rs0)")).toBeInTheDocument();
      expect(screen.getByText("Two-Tier Reservation")).toBeInTheDocument();
    });
  });
});
