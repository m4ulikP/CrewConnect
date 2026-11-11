/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { CustomCursor } from "../src/components/CustomCursor";

type MediaChangeListener = () => void;

function mockMediaQueries(options: { finePointer: boolean; reducedMotion: boolean }) {
  const listeners = new Map<string, Set<MediaChangeListener>>();
  const state = { ...options };

  const matchMediaMock = vi.fn((query: string) => {
    const queryListeners = listeners.get(query) ?? new Set<MediaChangeListener>();
    listeners.set(query, queryListeners);

    return {
      get matches() {
        if (query.includes("pointer: fine")) return state.finePointer;
        if (query.includes("prefers-reduced-motion: reduce")) return state.reducedMotion;
        return false;
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, cb: MediaChangeListener) => {
        queryListeners.add(cb);
      },
      removeEventListener: (_: string, cb: MediaChangeListener) => {
        queryListeners.delete(cb);
      },
      addListener: (cb: MediaChangeListener) => {
        queryListeners.add(cb);
      },
      removeListener: (cb: MediaChangeListener) => {
        queryListeners.delete(cb);
      },
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  });

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMediaMock,
  });

  return {
    update(next: Partial<{ finePointer: boolean; reducedMotion: boolean }>) {
      Object.assign(state, next);
      for (const set of listeners.values()) {
        for (const cb of set) cb();
      }
    },
  };
}

function dispatchPointer(
  target: EventTarget,
  type: string,
  options: { clientX?: number; clientY?: number; pointerType?: string } = {}
) {
  const EventCtor = typeof window.PointerEvent === "function" ? window.PointerEvent : MouseEvent;
  const event = new EventCtor(type, {
    bubbles: true,
    cancelable: true,
    clientX: options.clientX ?? 0,
    clientY: options.clientY ?? 0,
  });
  Object.defineProperty(event, "pointerType", {
    configurable: true,
    value: options.pointerType ?? "mouse",
  });
  target.dispatchEvent(event);
}

describe("CustomCursor", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("has-custom-cursor");
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(performance.now());
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    document.documentElement.classList.remove("has-custom-cursor");
  });

  it("does not render on coarse/touch-only pointers and preserves native cursor", () => {
    mockMediaQueries({ finePointer: false, reducedMotion: false });
    render(<CustomCursor />);

    expect(screen.queryByTestId("custom-cursor")).toBeNull();
    expect(document.documentElement.classList.contains("has-custom-cursor")).toBe(false);
  });

  it("does not render when prefers-reduced-motion: reduce is active", () => {
    mockMediaQueries({ finePointer: true, reducedMotion: true });
    render(<CustomCursor />);

    expect(screen.queryByTestId("custom-cursor")).toBeNull();
    expect(document.documentElement.classList.contains("has-custom-cursor")).toBe(false);
  });

  it("responds dynamically when media queries change", () => {
    const mq = mockMediaQueries({ finePointer: true, reducedMotion: false });
    render(<CustomCursor />);

    expect(screen.getByTestId("custom-cursor")).not.toBeNull();

    act(() => {
      mq.update({ reducedMotion: true });
    });

    expect(screen.queryByTestId("custom-cursor")).toBeNull();
    expect(document.documentElement.classList.contains("has-custom-cursor")).toBe(false);
  });

  it("keeps native cursor visible until first non-touch pointer movement, then tracks pointer without layout reads", () => {
    mockMediaQueries({ finePointer: true, reducedMotion: false });
    const getComputedStyleSpy = vi.spyOn(window, "getComputedStyle");
    const bcrSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");

    render(
      <div>
        <CustomCursor />
        <div data-testid="canvas">Editorial canvas</div>
      </div>
    );

    const cursor = screen.getByTestId("custom-cursor");
    expect(cursor.getAttribute("aria-hidden")).toBe("true");
    expect(cursor.dataset.visible).toBe("false");
    expect(document.documentElement.classList.contains("has-custom-cursor")).toBe(false);

    const canvas = screen.getByTestId("canvas");
    act(() => {
      dispatchPointer(canvas, "pointermove", { clientX: 240, clientY: 160, pointerType: "mouse" });
    });

    expect(cursor.dataset.visible).toBe("true");
    expect(cursor.dataset.mode).toBe("default");
    expect(document.documentElement.classList.contains("has-custom-cursor")).toBe(true);

    const dotPos = cursor.querySelector(".cc-cursor-dot-pos") as HTMLElement;
    const ringPos = cursor.querySelector(".cc-cursor-ring-pos") as HTMLElement;
    expect(dotPos.style.transform).toContain("240px, 160px");
    expect(ringPos.style.transform).toContain("translate3d");

    expect(getComputedStyleSpy).not.toHaveBeenCalled();
    expect(bcrSpy).not.toHaveBeenCalled();
  });

  it("switches to interactive hover mode on links, buttons, and data-cursor=interactive, and respects disabled controls", () => {
    mockMediaQueries({ finePointer: true, reducedMotion: false });

    render(
      <div>
        <CustomCursor />
        <button type="button" data-testid="cta">
          Join Squad
        </button>
        <a href="/teams" data-testid="nav-link">
          Browse Teams
        </a>
        <div data-cursor="interactive" data-testid="card">
          Interactive Card
        </div>
        <button type="button" disabled data-testid="disabled-btn">
          Unavailable
        </button>
        <p data-testid="copy">Neutral copy</p>
      </div>
    );

    const cursor = screen.getByTestId("custom-cursor");

    act(() => {
      dispatchPointer(screen.getByTestId("cta"), "pointermove", { clientX: 50, clientY: 50 });
    });
    expect(cursor.dataset.visible).toBe("true");
    expect(cursor.dataset.mode).toBe("interactive");

    act(() => {
      dispatchPointer(screen.getByTestId("nav-link"), "pointerover");
    });
    expect(cursor.dataset.mode).toBe("interactive");

    act(() => {
      dispatchPointer(screen.getByTestId("card"), "pointerover");
    });
    expect(cursor.dataset.mode).toBe("interactive");

    act(() => {
      dispatchPointer(screen.getByTestId("disabled-btn"), "pointerover");
    });
    expect(cursor.dataset.mode).toBe("native");
    expect(cursor.dataset.visible).toBe("false");

    act(() => {
      dispatchPointer(screen.getByTestId("copy"), "pointerover");
    });
    expect(cursor.dataset.mode).toBe("default");
    expect(cursor.dataset.visible).toBe("true");
  });

  it("defers gracefully to native text cursor over inputs, textareas, selects, and text zones", () => {
    mockMediaQueries({ finePointer: true, reducedMotion: false });

    render(
      <div>
        <CustomCursor />
        <input type="password" data-testid="password-input" aria-label="Password" />
        <textarea data-testid="bio-textarea" aria-label="Bio" />
        <select data-testid="role-select" aria-label="Role">
          <option value="dev">Developer</option>
        </select>
        <div data-cursor="text" data-testid="text-region">
          Selectable prose
        </div>
      </div>
    );

    const cursor = screen.getByTestId("custom-cursor");

    for (const id of ["password-input", "bio-textarea", "role-select", "text-region"]) {
      act(() => {
        dispatchPointer(screen.getByTestId(id), "pointermove", { clientX: 120, clientY: 90 });
      });
      expect(cursor.dataset.mode).toBe("native");
      expect(cursor.dataset.visible).toBe("false");
    }
  });

  it("handles press, release, cancel, touch suspension, viewport exit, and unmount cleanup cleanly", () => {
    mockMediaQueries({ finePointer: true, reducedMotion: false });

    const { unmount } = render(
      <div>
        <CustomCursor />
        <button type="button" data-testid="btn">
          Press me
        </button>
      </div>
    );

    const cursor = screen.getByTestId("custom-cursor");
    const btn = screen.getByTestId("btn");

    act(() => {
      dispatchPointer(btn, "pointerdown", { clientX: 80, clientY: 80 });
    });
    expect(cursor.dataset.pressed).toBe("true");
    expect(cursor.dataset.visible).toBe("true");

    act(() => {
      dispatchPointer(window, "pointerup");
    });
    expect(cursor.dataset.pressed).toBe("false");

    act(() => {
      dispatchPointer(btn, "pointerdown", { clientX: 80, clientY: 80 });
      dispatchPointer(window, "pointercancel");
    });
    expect(cursor.dataset.pressed).toBe("false");

    act(() => {
      dispatchPointer(btn, "pointermove", { clientX: 85, clientY: 85, pointerType: "touch" });
    });
    expect(cursor.dataset.visible).toBe("false");
    expect(document.documentElement.classList.contains("has-custom-cursor")).toBe(false);

    act(() => {
      dispatchPointer(btn, "pointermove", { clientX: 90, clientY: 90, pointerType: "mouse" });
    });
    expect(cursor.dataset.visible).toBe("true");
    expect(document.documentElement.classList.contains("has-custom-cursor")).toBe(true);

    act(() => {
      document.documentElement.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
    });
    expect(cursor.dataset.visible).toBe("false");

    unmount();
    expect(document.documentElement.classList.contains("has-custom-cursor")).toBe(false);
  });
});
