import React, { useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { useInViewOnce } from "../../hooks/useInViewOnce";

interface ReservationEngineDemoProps {
  apiOnline: boolean;
  loadingHealth: boolean;
}

type RaceStage = "idle" | "racing" | "resolved";

export const ReservationEngineDemo: React.FC<ReservationEngineDemoProps> = ({
  apiOnline,
  loadingHealth,
}) => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>(0.15);
  const [stage, setStage] = useState<RaceStage>("idle");

  const handleRunRace = () => {
    if (stage === "racing") return;
    setStage("racing");
    setTimeout(() => {
      setStage("resolved");
    }, 340);
  };

  const handleReset = () => {
    setStage("idle");
  };

  const currentCount = stage === "resolved" ? 4 : 3;

  return (
    <div
      ref={ref}
      id="architecture"
      className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start"
    >
      {/* Left Narrative Column */}
      <div
        className={`lg:col-span-5 space-y-5 transition-[transform,opacity] duration-500 ease-out ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <h2 className="font-serif text-[28px] sm:text-4xl font-medium text-ink-primary tracking-tight leading-tight">
          Engineered to prevent phantom memberships.
        </h2>

        <p className="text-base text-ink-secondary leading-relaxed max-w-[60ch]">
          Under hackathon submission rushes, optimistic checks let two builders claim the final seat at once. CrewConnect uses a{" "}
          <strong className="font-semibold text-ink-primary">Two-Tier Reservation</strong>{" "}
          model backed by{" "}
          <strong className="font-semibold text-ink-primary">MongoDB 7.0 (rs0)</strong>{" "}
          replica-set transactions.
        </p>

        <p className="text-base text-ink-secondary leading-relaxed max-w-[60ch]">
          Each join request sends a client{" "}
          <span className="font-semibold text-ink-primary">Idempotency-Key</span> and executes an atomic conditional{" "}
          <span className="font-semibold text-ink-primary">memberCount</span> increment only when open capacity remains. Contending callers receive HTTP 409 Conflict instead of oversubscribing the squad.
        </p>

        <div className="pt-2 flex items-center gap-2.5 text-sm">
          <span
            className={`w-3 h-3 rounded-full border border-ink-primary flex-shrink-0 ${
              loadingHealth
                ? "bg-highlight"
                : apiOnline
                  ? "bg-accent"
                  : "bg-surface-tonal"
            }`}
          />
          <span className="font-semibold text-ink-primary">
            {loadingHealth
              ? "Checking backend readiness..."
              : apiOnline
                ? "Live backend health: API online (200 OK)"
                : "Backend standby (client trace runs locally)"}
          </span>
        </div>
      </div>

      {/* Right Interactive Contention Simulator */}
      <div
        data-ui="reservation-simulator"
        style={{ transitionDelay: "90ms" }}
        className={`lg:col-span-7 bg-surface border-2 border-ink-primary rounded-lg overflow-hidden transition-[transform,opacity] duration-500 ease-out ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* Top Bar */}
        <div className="bg-chrome px-5 py-4 border-b-2 border-ink-primary flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-ink-primary">
              Concurrent Last-Seat Contention Trace (Simulated)
            </p>
            <p className="text-[13px] text-ink-secondary">
              Target capacity:{" "}
              <span className="tabular font-bold text-ink-primary">
                {currentCount} / 4 seats
              </span>
            </p>
          </div>

          {stage === "idle" ? (
            <button
              type="button"
              onClick={handleRunRace}
              className="btn h-9 !px-4 text-[13px] bg-highlight text-ink-primary border-2 border-ink-primary hover:bg-highlight-hover"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Simulate Concurrent Join</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              disabled={stage === "racing"}
              className="btn btn-secondary h-9 !px-4 text-[13px] border-2 border-ink-primary"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Trace</span>
            </button>
          )}
        </div>

        {/* Race Lanes + Conditional Guard Gate */}
        <div className="p-5 sm:p-6 space-y-5 bg-ground">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Caller A */}
            <div
              className={`rounded-lg p-4 border-2 transition-colors duration-200 ${
                stage === "resolved"
                  ? "bg-accent-tint border-accent"
                  : stage === "racing"
                    ? "bg-highlight-soft border-ink-primary"
                    : "bg-surface border-border-strong"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-sm font-bold text-ink-primary">
                  Caller A · POST /join
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[13px] font-bold tabular border border-ink-primary ${
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

              <p className="text-[13px] text-ink-secondary">
                Idempotency-Key: k_9f2a1c
              </p>

              {/* Progress Motion Indicator Bar */}
              <div className="mt-3 h-2 w-full bg-surface-tonal rounded-full overflow-hidden border border-ink-primary/20">
                <div
                  className={`h-full w-full rounded-full origin-left transition-transform duration-300 ease-out ${
                    stage === "resolved"
                      ? "bg-accent scale-x-100"
                      : stage === "racing"
                        ? "bg-highlight scale-x-75"
                        : "bg-ink-muted/40 scale-x-[0.2]"
                  }`}
                />
              </div>

              <p className="text-[13px] font-semibold text-ink-primary mt-3 leading-snug">
                {stage === "resolved"
                  ? "Predicate matched (memberCount < 4). Seat 4 locked."
                  : stage === "racing"
                    ? "Evaluating conditional guard in rs0 session..."
                    : "Ready to execute direct seat claim."}
              </p>
            </div>

            {/* Caller B */}
            <div
              className={`rounded-lg p-4 border-2 transition-colors duration-200 ${
                stage === "resolved"
                  ? "bg-tangelo-soft border-tangelo"
                  : stage === "racing"
                    ? "bg-highlight-soft border-ink-primary"
                    : "bg-surface border-border-strong"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-sm font-bold text-ink-primary">
                  Caller B · POST /join
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[13px] font-bold tabular border border-ink-primary ${
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

              <p className="text-[13px] text-ink-secondary">
                Idempotency-Key: k_4d8b7e
              </p>

              {/* Progress Motion Indicator Bar */}
              <div className="mt-3 h-2 w-full bg-surface-tonal rounded-full overflow-hidden border border-ink-primary/20">
                <div
                  className={`h-full w-full rounded-full origin-left transition-transform duration-300 ease-out ${
                    stage === "resolved"
                      ? "bg-tangelo scale-x-90"
                      : stage === "racing"
                        ? "bg-highlight scale-x-75"
                        : "bg-ink-muted/40 scale-x-[0.2]"
                  }`}
                />
              </div>

              <p className="text-[13px] font-semibold text-ink-primary mt-3 leading-snug">
                {stage === "resolved"
                  ? "Conditional check failed (memberCount == 4). Rejected cleanly."
                  : stage === "racing"
                    ? "Contending for the same document lock..."
                    : "Arrives concurrently for the remaining slot."}
              </p>
            </div>
          </div>

          {/* Conditional Guard Footer */}
          <div className="bg-surface border-2 border-ink-primary rounded-md px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[13px]">
            <span className="font-medium text-ink-secondary">
              Atomic filter:{" "}
              <code className="font-semibold text-ink-primary">
                {"{ memberCount: { $lt: maxCapacity }, isOpen: true }"}
              </code>
            </span>
            <span className="font-bold text-accent tabular">
              {stage === "resolved"
                ? "Verified invariant: 4 / 4 seats"
                : "Invariant: memberCount ≤ maxCapacity"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
