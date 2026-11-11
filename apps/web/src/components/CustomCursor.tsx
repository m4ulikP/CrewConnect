import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type CursorMode = "default" | "interactive" | "native";

const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const NATIVE_CONTROL_SELECTOR = [
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
  "textarea",
  "select",
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[data-cursor="text"]',
  '[data-cursor="native"]',
].join(", ");

const DISABLED_CONTROL_SELECTOR = ':disabled, [aria-disabled="true"]';

const INTERACTIVE_SELECTOR = [
  '[data-cursor="interactive"]',
  "a[href]",
  "button",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  "summary",
  "label[for]",
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="submit"]',
  'input[type="button"]',
  'input[type="reset"]',
  '[tabindex]:not([tabindex="-1"]):not(input):not(textarea):not(select)',
].join(", ");

function supportsCustomCursor(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  const hasFinePointer = window.matchMedia(FINE_POINTER_QUERY).matches;
  const prefersReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
  return hasFinePointer && !prefersReducedMotion;
}

function subscribeMediaQuery(mql: MediaQueryList, handler: () => void): () => void {
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }
  mql.addListener(handler);
  return () => mql.removeListener(handler);
}

function toElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) {
    return target;
  }
  if (target instanceof Node) {
    return target.parentElement;
  }
  return null;
}

function resolveCursorMode(target: EventTarget | null): CursorMode {
  const el = toElement(target);
  if (!el) {
    return "default";
  }
  if (el.closest(NATIVE_CONTROL_SELECTOR)) {
    return "native";
  }
  if (el.closest(DISABLED_CONTROL_SELECTOR)) {
    return "native";
  }
  if (el.closest(INTERACTIVE_SELECTOR)) {
    return "interactive";
  }
  return "default";
}

/**
 * Globally mounted CrewConnect custom pointer.
 * Active exclusively on hover-capable fine-pointer devices without reduced motion.
 */
export const CustomCursor: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(() => supportsCustomCursor());

  const layerRef = useRef<HTMLDivElement | null>(null);
  const ringPosRef = useRef<HTMLDivElement | null>(null);
  const dotPosRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const pointerMql = window.matchMedia(FINE_POINTER_QUERY);
    const motionMql = window.matchMedia(REDUCED_MOTION_QUERY);

    const evaluate = () => {
      setEnabled(pointerMql.matches && !motionMql.matches);
    };

    evaluate();
    const unsubPointer = subscribeMediaQuery(pointerMql, evaluate);
    const unsubMotion = subscribeMediaQuery(motionMql, evaluate);

    return () => {
      unsubPointer();
      unsubMotion();
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!enabled) {
      root.classList.remove("has-custom-cursor");
      return;
    }

    let initialized = false;
    let pointerInside = false;
    let isPressed = false;
    let isTextSelecting = false;
    let mode: CursorMode = "default";
    let lastTarget: EventTarget | null = null;

    let targetX = -100;
    let targetY = -100;
    let ringX = -100;
    let ringY = -100;

    let rafId: number | null = null;
    let lastFrameTime = 0;

    const syncAttributes = () => {
      const layer = layerRef.current;
      if (!layer) return;

      const shouldShow = initialized && pointerInside && mode !== "native" && !isTextSelecting;
      layer.dataset.visible = shouldShow ? "true" : "false";
      layer.dataset.mode = mode;
      layer.dataset.pressed = isPressed ? "true" : "false";

      if (initialized && pointerInside && !isTextSelecting) {
        root.classList.add("has-custom-cursor");
      } else {
        root.classList.remove("has-custom-cursor");
      }
    };

    const applyPositions = (x: number, y: number) => {
      if (dotPosRef.current) {
        dotPosRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      }
      if (ringPosRef.current) {
        ringPosRef.current.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      }
    };

    const tick = (now: number) => {
      const dt = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.05) : 1 / 60;
      lastFrameTime = now;

      // Frame-rate independent exponential smoothing for the trailing ring
      const alpha = 1 - Math.exp(-18 * dt);
      ringX += (targetX - ringX) * alpha;
      ringY += (targetY - ringY) * alpha;

      const settled = Math.abs(targetX - ringX) < 0.08 && Math.abs(targetY - ringY) < 0.08;
      if (settled) {
        ringX = targetX;
        ringY = targetY;
      }

      applyPositions(ringX, ringY);

      if (!settled) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        rafId = null;
        lastFrameTime = 0;
      }
    };

    const scheduleFrame = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const suspendForTouch = () => {
      initialized = false;
      pointerInside = false;
      isPressed = false;
      isTextSelecting = false;
      lastTarget = null;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      syncAttributes();
    };

    const updateModeForTarget = (target: EventTarget | null) => {
      if (target === lastTarget) {
        return;
      }
      lastTarget = target;
      const nextMode = resolveCursorMode(target);
      if (nextMode !== mode) {
        mode = nextMode;
        syncAttributes();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        suspendForTouch();
        return;
      }

      targetX = e.clientX;
      targetY = e.clientY;
      pointerInside = true;

      if (!initialized) {
        initialized = true;
        ringX = targetX;
        ringY = targetY;
        applyPositions(ringX, ringY);
      }

      if (dotPosRef.current) {
        dotPosRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      }

      updateModeForTarget(e.target);

      if (isPressed && mode === "default") {
        const selection = window.getSelection();
        const selectingRange = Boolean(
          selection && selection.type === "Range" && selection.toString().length > 0
        );
        if (selectingRange !== isTextSelecting) {
          isTextSelecting = selectingRange;
        }
      }

      syncAttributes();
      scheduleFrame();
    };

    const onPointerOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        return;
      }
      pointerInside = true;
      updateModeForTarget(e.target);
      syncAttributes();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        suspendForTouch();
        return;
      }
      isPressed = true;
      targetX = e.clientX;
      targetY = e.clientY;
      if (!initialized) {
        initialized = true;
        pointerInside = true;
        ringX = targetX;
        ringY = targetY;
        applyPositions(ringX, ringY);
      }
      updateModeForTarget(e.target);
      syncAttributes();
      scheduleFrame();
    };

    const onPointerUp = () => {
      if (!isPressed && !isTextSelecting) {
        return;
      }
      isPressed = false;
      isTextSelecting = false;
      syncAttributes();
    };

    const onPointerLeaveViewport = () => {
      pointerInside = false;
      isPressed = false;
      isTextSelecting = false;
      lastTarget = null;
      syncAttributes();
    };

    const onSelectionChange = () => {
      if (!isPressed) {
        if (isTextSelecting) {
          isTextSelecting = false;
          syncAttributes();
        }
        return;
      }
      const selection = window.getSelection();
      const hasRange = Boolean(
        selection && selection.type === "Range" && selection.toString().length > 0
      );
      if (hasRange !== isTextSelecting) {
        isTextSelecting = hasRange;
        syncAttributes();
      }
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    document.addEventListener("selectionchange", onSelectionChange);
    document.documentElement.addEventListener("mouseleave", onPointerLeaveViewport);
    window.addEventListener("blur", onPointerLeaveViewport);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.documentElement.removeEventListener("mouseleave", onPointerLeaveViewport);
      window.removeEventListener("blur", onPointerLeaveViewport);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      root.classList.remove("has-custom-cursor");
    };
  }, [enabled]);

  if (!enabled || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={layerRef}
      className="cc-cursor-layer"
      data-testid="custom-cursor"
      data-visible="false"
      data-mode="default"
      data-pressed="false"
      aria-hidden="true"
    >
      <div ref={ringPosRef} className="cc-cursor-ring-pos">
        <div className="cc-cursor-ring-shape" />
      </div>
      <div ref={dotPosRef} className="cc-cursor-dot-pos">
        <div className="cc-cursor-dot-shape" />
      </div>
    </div>,
    document.body
  );
};
