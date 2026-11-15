/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider, useTheme } from "../src/context/ThemeContext";
import { ThemeToggle } from "../src/components/ThemeToggle";
import { Navbar } from "../src/components/Navbar";
import { AuthProvider } from "../src/context/AuthContext";
import { SocketProvider } from "../src/context/SocketContext";
import * as apiModule from "../src/lib/api";

function mockMatchMedia(matches: boolean) {
  let currentMatches = matches;
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];

  const mql = {
    matches: currentMatches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: vi.fn((cb: (e: MediaQueryListEvent) => void) => listeners.push(cb)),
    removeListener: vi.fn((cb: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(cb);
      if (idx !== -1) listeners.splice(idx, 1);
    }),
    addEventListener: vi.fn((event: string, cb: (e: MediaQueryListEvent) => void) => {
      if (event === "change") listeners.push(cb);
    }),
    removeEventListener: vi.fn((_event: string, cb: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(cb);
      if (idx !== -1) listeners.splice(idx, 1);
    }),
    dispatchEvent: vi.fn(),
  };

  window.matchMedia = vi.fn().mockImplementation((_query: string) => mql);

  return {
    setMatches: (nextMatches: boolean) => {
      currentMatches = nextMatches;
      mql.matches = nextMatches;
      const event = {
        matches: nextMatches,
        media: "(prefers-color-scheme: dark)",
      } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

describe("Theme System & Dark Mode Integration", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
    mockMatchMedia(false);
    vi.spyOn(apiModule, "apiGetMe").mockRejectedValue(new Error("Unauthorized"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("defaults to light mode when no localStorage preference and OS prefers light", () => {
    mockMatchMedia(false);

    const Consumer = () => {
      const { theme, isDark } = useTheme();
      return (
        <div>
          theme:{theme},isDark:{String(isDark)}
        </div>
      );
    };

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByText("theme:light,isDark:false")).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("respects operating system preference when no stored preference exists", () => {
    mockMatchMedia(true);

    const Consumer = () => {
      const { theme, isDark } = useTheme();
      return (
        <div>
          theme:{theme},isDark:{String(isDark)}
        </div>
      );
    };

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByText("theme:dark,isDark:true")).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("toggles between light and dark theme on toggleTheme call", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTestId("theme-toggle");
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute("aria-label", "Switch to dark theme");
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    // Click to switch to Dark
    fireEvent.click(toggleBtn);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem("crewconnect-theme")).toBe("dark");
    expect(toggleBtn).toHaveAttribute("aria-label", "Switch to light theme");
    expect(toggleBtn).toHaveAttribute("aria-pressed", "true");

    // Click again to switch back to Light
    fireEvent.click(toggleBtn);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem("crewconnect-theme")).toBe("light");
    expect(toggleBtn).toHaveAttribute("aria-label", "Switch to dark theme");
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("restores dark theme from localStorage across reloads/remounts", () => {
    localStorage.setItem("crewconnect-theme", "dark");

    const Consumer = () => {
      const { theme, isDark } = useTheme();
      return (
        <div>
          theme:{theme},isDark:{String(isDark)}
        </div>
      );
    };

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByText("theme:dark,isDark:true")).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("updates theme when system OS changes if no manual preference is saved", () => {
    const mediaControl = mockMatchMedia(false);

    const Consumer = () => {
      const { theme } = useTheme();
      return <div>current:{theme}</div>;
    };

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByText("current:light")).toBeInTheDocument();

    act(() => {
      mediaControl.setMatches(true);
    });

    expect(screen.getByText("current:dark")).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("does not override manual user preference when system OS changes", () => {
    const mediaControl = mockMatchMedia(false);
    localStorage.setItem("crewconnect-theme", "light");

    const Consumer = () => {
      const { theme } = useTheme();
      return <div>current:{theme}</div>;
    };

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByText("current:light")).toBeInTheDocument();

    act(() => {
      mediaControl.setMatches(true);
    });

    // Remains light because user explicitly saved "light"
    expect(screen.getByText("current:light")).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("renders ThemeToggle inside Navbar with full accessibility attributes", () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <SocketProvider>
              <Navbar />
            </SocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    const toggleBtn = screen.getByTestId("theme-toggle");
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute("type", "button");
    expect(toggleBtn).toHaveAttribute("aria-label");
    expect(toggleBtn).toHaveAttribute("title");
    expect(toggleBtn).toHaveAttribute("aria-pressed");
  });

  it("supports keyboard interaction (Space and Enter) and applies smooth transition class", () => {
    vi.useFakeTimers();

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTestId("theme-toggle");

    // Click triggers theme switch and applies theme-transition class
    act(() => {
      fireEvent.click(toggleBtn);
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("theme-transition")).toBe(true);

    // After 320ms, theme-transition class is cleanly removed
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(document.documentElement.classList.contains("theme-transition")).toBe(false);

    vi.useRealTimers();
  });

  it("provides safe fallback when useTheme is used outside of ThemeProvider", () => {
    let capturedTheme: ReturnType<typeof useTheme> | undefined;
    const ConsumerOutside = () => {
      capturedTheme = useTheme();
      return <div>theme:{capturedTheme.theme}</div>;
    };

    render(<ConsumerOutside />);
    expect(screen.getByText("theme:light")).toBeInTheDocument();
    expect(capturedTheme?.isDark).toBe(false);
  });

  it("gracefully falls back to system theme when localStorage throws an error", () => {
    mockMatchMedia(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: localStorage is inaccessible");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError: localStorage is inaccessible");
    });

    const Consumer = () => {
      const { theme, isDark, toggleTheme } = useTheme();
      return (
        <div>
          <span>
            theme:{theme},isDark:{String(isDark)}
          </span>
          <button onClick={toggleTheme}>Toggle</button>
        </div>
      );
    };

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByText("theme:dark,isDark:true")).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // Toggle should work in-memory without throwing despite localStorage write error
    fireEvent.click(screen.getByText("Toggle"));
    expect(screen.getByText("theme:light,isDark:false")).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("cleans up transition timers and handles rapid consecutive toggles safely", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    const { unmount } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTestId("theme-toggle");

    // Toggle 1
    act(() => {
      fireEvent.click(toggleBtn);
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("theme-transition")).toBe(true);

    // Toggle 2 rapidly (within 40ms)
    act(() => {
      vi.advanceTimersByTime(40);
      fireEvent.click(toggleBtn);
    });
    // Should have cleared the pending timer
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("theme-transition")).toBe(true);

    // Advance beyond 320ms to allow transition class removal
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(document.documentElement.classList.contains("theme-transition")).toBe(false);

    // Unmount cleans up any pending timers
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
