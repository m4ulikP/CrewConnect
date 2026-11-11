import React, { useEffect, useState } from "react";
import { useReducedMotion } from "../../hooks/useInViewOnce";

const PHRASES = [
  "Find your builder.",
  "Turn skills to teams.",
  "Claim the open seat.",
  "Build something real.",
] as const;

/**
 * Accessible rotating headline with natural type/pause/delete cadence.
 * Preserves stable two-line geometry, announces static text to screen readers,
 * renders a soft organic marker highlight behind the active action word,
 * and shows a complete static phrase immediately under prefers-reduced-motion.
 */
export const TypingHeadline: React.FC = () => {
  const reducedMotion = useReducedMotion();

  const [phraseIndex, setPhraseIndex] = useState(0);
  const [visibleChars, setVisibleChars] = useState<number>(PHRASES[0].length);
  const [phase, setPhase] = useState<"holding" | "deleting" | "pausing" | "typing">("holding");

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

  const activePhrase = reducedMotion ? PHRASES[0] : PHRASES[phraseIndex];
  const displayedText = reducedMotion ? PHRASES[0] : activePhrase.slice(0, visibleChars);
  const firstSpaceIndex = activePhrase.indexOf(" ");
  const leadEnd = firstSpaceIndex === -1 ? activePhrase.length : firstSpaceIndex;
  const displayedLead = displayedText.slice(0, leadEnd);
  const displayedRest = displayedText.slice(leadEnd);

  return (
    <h1
      aria-label="Form your squad. Find your builder."
      className="font-display text-[30px] min-[400px]:text-[34px] sm:text-5xl lg:text-[62px] font-bold text-ink-primary tracking-[-0.03em] leading-[1.04]"
    >
      <span aria-hidden="true" className="block hero-line-mask">
        <span className="hero-line-inner">Form your squad.</span>
      </span>
      <span aria-hidden="true" className="block mt-1.5 min-h-[1.2em]">
        <span className="inline-flex items-baseline min-h-[1.14em] whitespace-nowrap">
          {displayedLead ? (
            <span className="relative inline-block">
              <svg
                key={phraseIndex}
                aria-hidden="true"
                viewBox="0 0 200 44"
                preserveAspectRatio="none"
                className="hero-marker-swipe pointer-events-none absolute -inset-x-[0.07em] bottom-[0.02em] h-[0.76em] w-[calc(100%+0.14em)]"
              >
                <path
                  d="M5,9 C48,4 146,5 195,8 C199,16 198,30 193,38 C140,41 44,40 3,36 C0,28 1,17 5,9 Z"
                  fill="#FFE45C"
                  fillOpacity="0.86"
                />
              </svg>
              <span className="relative">{displayedLead}</span>
            </span>
          ) : (
            <span>{"\u200B"}</span>
          )}
          {displayedRest && <span className="whitespace-pre">{displayedRest}</span>}
          {!reducedMotion && <span className="typing-caret" />}
        </span>
      </span>
    </h1>
  );
};
