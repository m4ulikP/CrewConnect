/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ScrollProgressBar } from "../src/components/ScrollProgressBar";

describe("ScrollProgressBar & Custom Animated Scrollbar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.classList.remove("is-scrolling");
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.documentElement.classList.remove("is-scrolling");
  });

  it("does not render when page content fits within viewport", () => {
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 900,
    });

    render(
      <MemoryRouter>
        <ScrollProgressBar />
      </MemoryRouter>
    );

    expect(screen.queryByTestId("scroll-progress-bar")).toBeNull();
  });

  it("renders scroll progress bar, animates scaleX on scroll, and toggles is-scrolling class", () => {
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 0,
    });

    render(
      <MemoryRouter>
        <ScrollProgressBar />
      </MemoryRouter>
    );

    const bar = screen.getByTestId("scroll-progress-bar");
    expect(bar).toHaveAttribute("aria-hidden", "true");

    // Simulate scrolling halfway down (500px of 1000px maxScroll)
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 500,
    });

    act(() => {
      fireEvent.scroll(window);
    });

    expect(document.documentElement.classList.contains("is-scrolling")).toBe(true);
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.transform).toBe("scaleX(0.5)");
    expect(fill.style.opacity).toBe("1");

    // Settle timeout removes active scroll class
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(document.documentElement.classList.contains("is-scrolling")).toBe(false);
  });

  it("cleans up is-scrolling class upon unmount", () => {
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 1000,
    });

    const { unmount } = render(
      <MemoryRouter>
        <ScrollProgressBar />
      </MemoryRouter>
    );

    act(() => {
      fireEvent.scroll(window);
    });
    expect(document.documentElement.classList.contains("is-scrolling")).toBe(true);

    unmount();
    expect(document.documentElement.classList.contains("is-scrolling")).toBe(false);
  });
});
