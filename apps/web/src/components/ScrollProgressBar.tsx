import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

export const ScrollProgressBar: React.FC = () => {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  const rafRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const updateMetrics = () => {
      const doc = document.documentElement;
      const maxScroll = Math.max(0, doc.scrollHeight - window.innerHeight);
      const scrollable = maxScroll > 20;
      setIsScrollable(scrollable);

      if (scrollable) {
        const ratio = Math.min(1, Math.max(0, window.scrollY / maxScroll));
        setProgress(ratio);
      } else {
        setProgress(0);
      }
      rafRef.current = null;
    };

    const handleScroll = () => {
      // Activate animated scrollbar thumb highlight
      document.documentElement.classList.add("is-scrolling");
      setIsScrolling(true);

      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
      settleTimerRef.current = window.setTimeout(() => {
        document.documentElement.classList.remove("is-scrolling");
        setIsScrolling(false);
        settleTimerRef.current = null;
      }, 280);

      if (rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(updateMetrics);
      }
    };

    const handleResize = () => {
      if (rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(updateMetrics);
      }
    };

    updateMetrics();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      document.documentElement.classList.remove("is-scrolling");
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, [location.pathname]);

  if (!isScrollable) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-testid="scroll-progress-bar"
      className="fixed top-16 left-0 right-0 h-[3px] z-40 pointer-events-none bg-transparent overflow-hidden"
    >
      <div
        className="h-full bg-accent relative transition-[opacity] duration-200"
        style={{
          width: "100%",
          transform: `scaleX(${progress})`,
          transformOrigin: "left center",
          opacity: progress > 0.005 ? 1 : 0,
        }}
      >
        <span
          className={`absolute right-0 top-0 bottom-0 w-3 bg-highlight transition-opacity duration-200 ${
            isScrolling ? "opacity-100" : "opacity-75"
          }`}
        />
      </div>
    </div>
  );
};
