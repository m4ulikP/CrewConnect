/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../src/App";
import { LiveSquadShowcase } from "../src/components/landing/LiveSquadShowcase";
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

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders the navigation bar with CrewConnect title", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("CrewConnect")).toBeInTheDocument();
    });
  });

  it("renders the hero heading and primary action", async () => {
    render(<App />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /Form your squad\./i })
      ).toBeInTheDocument();
      expect(screen.getByText(/Explore Team Board/i)).toBeInTheDocument();
    });
  });

  it("renders interactive squad showcase and reservation engine explanation", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Inspect a squad before joining.")).toBeInTheDocument();
      expect(screen.getByText("Engineered to prevent phantom memberships.")).toBeInTheDocument();
      expect(screen.getByText("MongoDB 7.0 (rs0)")).toBeInTheDocument();
      expect(screen.getByText("Two-Tier Reservation")).toBeInTheDocument();
      const showcase = document.querySelector('[data-ui="live-squad-showcase"]') as HTMLElement;
      expect(showcase).toBeInTheDocument();
      expect(within(showcase).getByRole("link", { name: /Inspect live squads/i })).toHaveAttribute(
        "href",
        "/teams-preview"
      );
      expect(within(showcase).queryByText("Helios Mesh")).not.toBeInTheDocument();
      expect(within(showcase).queryByText("Veridian Grid")).not.toBeInTheDocument();
      expect(within(showcase).queryByText(/Try Reserve Final Seat/i)).not.toBeInTheDocument();
    });
  });

  it("animates the fourth-seat completion cycle and resets cleanly", () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <LiveSquadShowcase />
      </MemoryRouter>
    );

    const root = document.querySelector('[data-ui="live-squad-showcase"]');
    expect(root).toHaveAttribute("data-stage", "open");
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
    expect(screen.getByText("1 seat open")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(root).toHaveAttribute("data-stage", "spotlighting");

    act(() => {
      vi.advanceTimersByTime(1150);
    });
    expect(root).toHaveAttribute("data-stage", "joining");

    act(() => {
      vi.advanceTimersByTime(950);
    });
    expect(root).toHaveAttribute("data-stage", "connecting");

    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(root).toHaveAttribute("data-stage", "complete");
    expect(screen.getByText("4 / 4")).toBeInTheDocument();
    expect(screen.getByText("Squad complete")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(root).toHaveAttribute("data-stage", "resetting");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(root).toHaveAttribute("data-stage", "open");
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
  });

  it("stays in static 3 / 4 state when prefers-reduced-motion is enabled", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <MemoryRouter>
        <LiveSquadShowcase />
      </MemoryRouter>
    );

    const root = document.querySelector('[data-ui="live-squad-showcase"]');
    expect(root).toHaveAttribute("data-stage", "open");
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
    expect(screen.getByText("1 seat open")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(root).toHaveAttribute("data-stage", "open");
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
    expect(screen.queryByText("Squad complete")).not.toBeInTheDocument();
  });
});
