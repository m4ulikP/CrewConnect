import { useEffect, useRef, useState } from "react";

/**
 * Shared reduced-motion preference hook reacting to live OS/browser changes.
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (evt: MediaQueryListEvent) => {
      setReducedMotion(evt.matches);
    };
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  return reducedMotion;
}

/**
 * Triggers once when an element enters (or has already been scrolled past in) the viewport.
 * Disconnects immediately after reveal to keep scroll performance zero-overhead.
 * Always resolves immediately visible when IntersectionObserver is unavailable or reduced motion is enabled.
 */
export function useInViewOnce<T extends HTMLElement>(threshold = 0.12) {
  const ref = useRef<T | null>(null);
  const reducedMotion = useReducedMotion();

  const [inView, setInView] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    if (typeof IntersectionObserver === "undefined") return true;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;
    return false;
  });

  useEffect(() => {
    if (reducedMotion) {
      setInView(true);
    }
  }, [reducedMotion]);

  useEffect(() => {
    if (inView || reducedMotion) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const alreadyAboveFold =
            entry.boundingClientRect.height > 0 &&
            entry.boundingClientRect.top < window.innerHeight;
          if (entry.isIntersecting || alreadyAboveFold) {
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold, rootMargin: "0px 0px -16px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, reducedMotion, threshold]);

  return { ref, inView: inView || reducedMotion, reducedMotion };
}
