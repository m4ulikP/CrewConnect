import React, { useEffect, useRef, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { useInViewOnce } from "../../hooks/useInViewOnce";

interface ReservationEngineDemoProps {
  apiOnline: boolean;
  loadingHealth: boolean;
}

type RaceStage = "idle" | "racing" | "resolved";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

export const ReservationEngineDemo: React.FC<ReservationEngineDemoProps> = ({
  apiOnline,
  loadingHealth,
}) => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>(0.15);
  const [stage, setStage] = useState<RaceStage>("idle");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleRunRace = () => {
    if (stage === "racing") return;
    setStage("racing");
    timerRef.current = window.setTimeout(() => {
      setStage("resolved");
      timerRef.current = null;
    }, 340);
  };

  const handleReset = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setStage("idle");
  };

  const currentCount = stage === "resolved" ? 4 : 3;

  return (
    <div
      ref={ref}
      id="architecture"
      className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start"
    >
      {/* Left Narrative Column: Staggered Editorial Reveal */}
      <div className="lg:col-span-5 space-y-5">
        <div className="motion-reveal" data-visible={inView}>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink-primary tracking-tight leading-tight">
            Engineered to prevent phantom memberships.
          </h2>
        </div>

        <p
          data-visible={inView}
          style={{ transitionDelay: "60ms" }}
          className="text-base text-ink-secondary leading-relaxed max-w-[48ch] motion-reveal"
        >
          When two builders click <strong className="font-semibold text-ink-primary">Join</strong>{" "}
          on the last open seat at the exact same millisecond, naive checks let both slip into a
          4-seat squad.
        </p>

        <p
          data-visible={inView}
          style={{ transitionDelay: "120ms" }}
          className="text-base text-ink-secondary leading-relaxed max-w-[48ch] motion-reveal"
        >
          CrewConnect serializes seat claims using a{" "}
          <strong className="font-semibold text-ink-primary">Two-Tier Reservation</strong> inside a{" "}
          <strong className="font-semibold text-ink-primary">MongoDB 7.0 (rs0)</strong> replica-set
          transaction—awarding Seat 4 to the first caller (
          <strong className="text-ink-primary">201 Created</strong>) and cleanly turning the second
          away (<strong className="text-ink-primary">409 Conflict</strong>).
        </p>

        <div
          data-visible={inView}
          style={{ transitionDelay: "180ms" }}
          className="pt-1 flex items-center gap-2.5 text-sm motion-reveal"
        >
          <span
            className={`w-2.5 h-2.5 rounded-full border border-ink-primary flex-shrink-0 transition-colors duration-200 ${
              loadingHealth ? "bg-highlight" : apiOnline ? "bg-accent" : "bg-surface-tonal"
            }`}
          />
          <span className="font-medium text-ink-primary">
            {loadingHealth
              ? "Checking backend readiness..."
              : apiOnline
                ? "Live backend ready (API online · 200 OK)"
                : "API offline locally (simulation runs client-side)"}
          </span>
        </div>
      </div>

      {/* Right Interactive Contention Simulator */}
      <div
        data-ui="reservation-simulator"
        data-visible={inView}
        style={{ transitionDelay: "80ms" }}
        className="lg:col-span-7 bg-surface border-2 border-ink-primary rounded-lg overflow-hidden motion-reveal-scale"
      >
        {/* Top Bar */}
        <div className="bg-chrome px-5 py-4 border-b-2 border-ink-primary flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-ink-primary">Last-Seat Race Simulation</p>
            <p className="text-[13px] text-ink-secondary">
              Client-side simulation · No database write ·{" "}
              <span className="tabular font-bold text-ink-primary">{currentCount} / 4 seats</span>
            </p>
          </div>

          {stage === "idle" ? (
            <button
              type="button"
              onClick={handleRunRace}
              className="btn btn-brutal-highlight h-9 !px-4 text-[13px]"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Simulate Concurrent Join</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              disabled={stage === "racing"}
              className="btn btn-brutal-secondary h-9 !px-4 text-[13px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Trace</span>
            </button>
          )}
        </div>

        {/* Two Builder Contenders Racing to Seat 4 */}
        <div className="p-5 sm:p-6 space-y-4 bg-ground">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Caller A (Pine Builder Character) */}
            <div
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translate3d(0, 0, 0)" : "translate3d(-8px, 6px, 0)",
                transition: `opacity 360ms ${EASE_OUT} 140ms, transform 380ms ${EASE_OUT} 140ms, background-color 220ms ease-out, border-color 220ms ease-out`,
              }}
              className={`rounded-lg p-4 border-2 ${
                stage === "resolved"
                  ? "bg-accent-tint border-accent"
                  : stage === "racing"
                    ? "bg-highlight-soft border-ink-primary"
                    : "bg-surface border-border-strong"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0">
                    <path
                      d="M2 22 V12 C2 6.477 6.477 2 12 2 C17.523 2 22 6.477 22 12 V22 H2 Z"
                      fill="#115E59"
                      stroke="#18181B"
                      strokeWidth="2"
                    />
                    <circle cx="9.5" cy="12" r="1.5" fill="#FFF" />
                    <circle cx="14.5" cy="12" r="1.5" fill="#FFF" />
                  </svg>
                  <span className="text-sm font-bold text-ink-primary">Builder A</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[12px] font-bold tabular border border-ink-primary transition-colors duration-200 ${
                    stage === "resolved"
                      ? "bg-accent text-white"
                      : stage === "racing"
                        ? "bg-highlight text-ink-primary"
                        : "bg-surface-tonal text-ink-primary"
                  }`}
                >
                  {stage === "resolved"
                    ? "201 Created"
                    : stage === "racing"
                      ? "Locking..."
                      : "Queued"}
                </span>
              </div>

              <div className="mt-2.5 h-2 w-full bg-surface-tonal rounded-full overflow-hidden border border-ink-primary/20">
                <div
                  style={{ transitionTimingFunction: EASE_OUT }}
                  className={`h-full w-full rounded-full origin-left transition-[transform,background-color] duration-300 ${
                    stage === "resolved"
                      ? "bg-accent scale-x-100"
                      : stage === "racing"
                        ? "bg-highlight scale-x-75"
                        : "bg-ink-muted/35 scale-x-[0.2]"
                  }`}
                />
              </div>

              <p className="text-[13px] font-medium text-ink-primary mt-3 leading-snug">
                {stage === "resolved"
                  ? "Succeeded: open seat locked and Seat 4 assigned."
                  : stage === "racing"
                    ? "Acquiring atomic reservation lock..."
                    : "Clicks Join on final open seat."}
              </p>
            </div>

            {/* Caller B (Tangelo Builder Character) */}
            <div
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translate3d(0, 0, 0)" : "translate3d(8px, 6px, 0)",
                transition: `opacity 360ms ${EASE_OUT} 200ms, transform 380ms ${EASE_OUT} 200ms, background-color 220ms ease-out, border-color 220ms ease-out`,
              }}
              className={`rounded-lg p-4 border-2 ${
                stage === "resolved"
                  ? "bg-tangelo-soft border-tangelo"
                  : stage === "racing"
                    ? "bg-highlight-soft border-ink-primary"
                    : "bg-surface border-border-strong"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0">
                    <rect
                      x="2"
                      y="2"
                      width="20"
                      height="20"
                      rx="6"
                      fill="#FF5A1F"
                      stroke="#18181B"
                      strokeWidth="2"
                    />
                    <circle cx="9.5" cy="12" r="1.5" fill="#18181B" />
                    <circle cx="14.5" cy="12" r="1.5" fill="#18181B" />
                  </svg>
                  <span className="text-sm font-bold text-ink-primary">Builder B</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[12px] font-bold tabular border border-ink-primary transition-colors duration-200 ${
                    stage === "resolved"
                      ? "bg-tangelo text-ink-primary"
                      : stage === "racing"
                        ? "bg-highlight text-ink-primary"
                        : "bg-surface-tonal text-ink-primary"
                  }`}
                >
                  {stage === "resolved"
                    ? "409 Conflict"
                    : stage === "racing"
                      ? "Waiting..."
                      : "Queued"}
                </span>
              </div>

              <div className="mt-2.5 h-2 w-full bg-surface-tonal rounded-full overflow-hidden border border-ink-primary/20">
                <div
                  style={{ transitionTimingFunction: EASE_OUT }}
                  className={`h-full w-full rounded-full origin-left transition-[transform,background-color] duration-300 ${
                    stage === "resolved"
                      ? "bg-tangelo scale-x-[0.88]"
                      : stage === "racing"
                        ? "bg-highlight scale-x-75"
                        : "bg-ink-muted/35 scale-x-[0.2]"
                  }`}
                />
              </div>

              <p className="text-[13px] font-medium text-ink-primary mt-3 leading-snug">
                {stage === "resolved"
                  ? "Rejected: team reached 4 / 4 capacity. Zero overbooking."
                  : stage === "racing"
                    ? "Waiting on document transaction..."
                    : "Clicks Join at the same millisecond."}
              </p>
            </div>
          </div>

          {/* Secondary Technical Disclosure */}
          <details
            style={{
              opacity: inView ? 1 : 0,
              transition: `opacity 360ms ${EASE_OUT} 240ms`,
            }}
            className="bg-surface border border-border-strong rounded-md px-4 py-2.5 text-[13px]"
          >
            <summary className="cursor-pointer font-semibold text-ink-secondary hover:text-ink-primary select-none flex items-center justify-between gap-2">
              <span>Technical details: atomic capacity guard</span>
              <span className="text-accent font-bold tabular">
                {stage === "resolved" ? "Verified: 4 / 4 seats" : "Capacity invariant active"}
              </span>
            </summary>
            <div className="mt-2.5 pt-2.5 border-t border-border-subtle text-ink-secondary space-y-1">
              <p>
                Conditional MongoDB transaction filter:{" "}
                <code className="font-semibold text-ink-primary break-words">
                  {"{ memberCount: { $lt: maxCapacity }, isOpen: true }"}
                </code>
              </p>
              <p>
                Each request also carries a unique Idempotency-Key so retries never double-join.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
