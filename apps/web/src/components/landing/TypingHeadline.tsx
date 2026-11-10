import React, { useEffect, useState } from "react";

const PHRASES = [
  "Find your builder.",
  "Turn skills to teams.",
  "Claim the open seat.",
  "Build something real.",
] as const;

/**
 * Accessible rotating headline with natural type/pause/delete cadence.
 * Preserves stable two-line geometry, announces static text to screen readers,
 * and shows a complete static phrase immediately under prefers-reduced-motion.
 */
export const TypingHeadline: React.FC = () => {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  const [phraseIndex, setPhraseIndex] = useState(0);
  const [visibleChars, setVisibleChars] = useState<number>(PHRASES[0].length);
  const [phase, setPhase] = useState<"holding" | "deleting" | "pausing" | "typing">("holding");

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (evt: MediaQueryListEvent) => {
      setReducedMotion(evt.matches);
    };
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    const currentPhrase = PHRASES[phraseIndex];
    let delay = 65;

    if (phase === "holding") {
      delay = 2200;
    } else if (phase === "deleting") {
      delay = 36;
    } else if (phase === "pausing") {
      delay = 360;
    } else if (phase === "typing") {
      delay = 65;
    }

    const timer = window.setTimeout(() => {
      if (phase === "holding") {
        setPhase("deleting");
      } else if (phase === "deleting") {
        if (visibleChars > 0) {
          setVisibleChars((c) => c - 1);
        } else {
          setPhraseIndex((idx) => (idx + 1) % PHRASES.length);
          setPhase("pausing");
        }
      } else if (phase === "pausing") {
        setPhase("typing");
      } else if (phase === "typing") {
        if (visibleChars < currentPhrase.length) {
          setVisibleChars((c) => c + 1);
        } else {
          setPhase("holding");
        }
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [phase, phraseIndex, visibleChars, reducedMotion]);

  const displayedText = reducedMotion ? PHRASES[0] : PHRASES[phraseIndex].slice(0, visibleChars);

  return (
    <h1
      aria-label="Form your squad. Find your builder."
      className="font-display text-[30px] min-[400px]:text-[34px] sm:text-5xl lg:text-[62px] font-bold text-ink-primary tracking-[-0.03em] leading-[1.04]"
    >
      <span aria-hidden="true" className="block hero-line-mask">
        <span className="hero-line-inner">Form your squad.</span>
      </span>
      <span aria-hidden="true" className="block mt-1.5 min-h-[1.2em]">
        <span className="inline-flex items-center bg-highlight border-2 border-ink-primary px-2.5 py-0.5 rounded-[4px] min-h-[1.14em] whitespace-nowrap">
          <span>{displayedText || "\u200B"}</span>
          {!reducedMotion && <span className="typing-caret" />}
        </span>
      </span>
    </h1>
  );
};
