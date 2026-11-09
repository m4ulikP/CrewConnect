/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../src/App";

describe("Frontend Shell Rendering", () => {
  it("renders the navigation bar with CrewConnect title", () => {
    render(<App />);
    expect(screen.getByText("CrewConnect")).toBeInTheDocument();
    expect(screen.getByText("PS1 Engine")).toBeInTheDocument();
  });

  it("renders the hero heading and core challenge description", () => {
    render(<App />);
    expect(screen.getByText("Race-Proof Team Formation")).toBeInTheDocument();
    expect(screen.getByText("Explore Team Board")).toBeInTheDocument();
  });

  it("renders infrastructure telemetry card", () => {
    render(<App />);
    expect(screen.getByText("Infrastructure Telemetry")).toBeInTheDocument();
    expect(screen.getByText("MongoDB 7.0 (rs0)")).toBeInTheDocument();
    expect(screen.getByText("Two-Tier Reservation")).toBeInTheDocument();
  });
});
