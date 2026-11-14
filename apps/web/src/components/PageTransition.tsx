import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";

interface PageTransitionProps {
  children: React.ReactNode;
}

const safeScrollToTop = () => {
  if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
    try {
      window.scrollTo(0, 0);
    } catch {
      // Ignored in environments where scrollTo is not fully implemented
    }
  }
};

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState<"idle" | "exit" | "enter">("idle");
  const fallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      // Check for user's reduced-motion preference
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReducedMotion) {
        setDisplayLocation(location);
        setTransitionStage("idle");
        safeScrollToTop();
        return;
      }

      setTransitionStage("exit");

      // Robust fallback timer: ensures route updates even if animation events are skipped
      // (e.g. background tabs, headless test environments, or rapid clicks)
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }

      fallbackTimerRef.current = window.setTimeout(() => {
        setDisplayLocation(location);
        setTransitionStage("enter");
        safeScrollToTop();
        fallbackTimerRef.current = null;
      }, 150); // 130ms exit animation + 20ms safety margin
    }
  }, [location.pathname, displayLocation.pathname, location]);

  const handleAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    // Only respond to animations on the wrapper element itself
    if (e.target !== e.currentTarget) return;

    if (transitionStage === "exit") {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      setDisplayLocation(location);
      setTransitionStage("enter");
      safeScrollToTop();
    } else if (transitionStage === "enter") {
      setTransitionStage("idle");
    }
  };

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      data-testid="page-transition"
      data-stage={transitionStage}
      className={`page-transition page-transition-${transitionStage}`}
      onAnimationEnd={handleAnimationEnd}
    >
      {React.isValidElement(children)
        ? React.cloneElement(
            children as React.ReactElement<{ location?: typeof displayLocation }>,
            {
              location: displayLocation,
            }
          )
        : children}
    </div>
  );
};
