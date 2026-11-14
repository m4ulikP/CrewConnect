/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import { PageTransition } from "../src/components/PageTransition";

const NavigationTester: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={() => navigate("/second")}>Go to Second</button>
      <button onClick={() => navigate("/third")}>Go to Third</button>
    </div>
  );
};

describe("PageTransition Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders child route content in idle stage initially", () => {
    render(
      <MemoryRouter initialEntries={["/first"]}>
        <PageTransition>
          <Routes>
            <Route
              path="/first"
              element={
                <div>
                  <h1>First Page Content</h1>
                  <NavigationTester />
                </div>
              }
            />
          </Routes>
        </PageTransition>
      </MemoryRouter>
    );

    expect(screen.getByText("First Page Content")).toBeInTheDocument();
    const transitionRoot = screen.getByTestId("page-transition");
    expect(transitionRoot).toHaveAttribute("data-stage", "idle");
  });

  it("triggers exit stage on navigation and transitions to new route", () => {
    render(
      <MemoryRouter initialEntries={["/first"]}>
        <PageTransition>
          <Routes>
            <Route
              path="/first"
              element={
                <div>
                  <h1>First Page Content</h1>
                  <NavigationTester />
                </div>
              }
            />
            <Route path="/second" element={<h1>Second Page Content</h1>} />
          </Routes>
        </PageTransition>
      </MemoryRouter>
    );

    expect(screen.getByText("First Page Content")).toBeInTheDocument();

    act(() => {
      screen.getByText("Go to Second").click();
    });

    const transitionRoot = screen.getByTestId("page-transition");
    expect(transitionRoot).toHaveAttribute("data-stage", "exit");
    // During exit, previous page content is still rendered to allow graceful exit animation
    expect(screen.getByText("First Page Content")).toBeInTheDocument();

    // Advance through the fallback transition timer
    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(screen.getByText("Second Page Content")).toBeInTheDocument();
    expect(transitionRoot).toHaveAttribute("data-stage", "enter");
  });

  it("switches routes immediately when reduced motion is preferred", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
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
      <MemoryRouter initialEntries={["/first"]}>
        <PageTransition>
          <Routes>
            <Route
              path="/first"
              element={
                <div>
                  <h1>First Page Content</h1>
                  <NavigationTester />
                </div>
              }
            />
            <Route path="/second" element={<h1>Second Page Content</h1>} />
          </Routes>
        </PageTransition>
      </MemoryRouter>
    );

    act(() => {
      screen.getByText("Go to Second").click();
    });

    // With reduced motion, route updates immediately without exit animation
    expect(screen.getByText("Second Page Content")).toBeInTheDocument();
    expect(screen.getByTestId("page-transition")).toHaveAttribute("data-stage", "idle");
  });
});
