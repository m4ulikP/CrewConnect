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
    }, 360);
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
          Under hackathon submission rushes, optimistic client checks let two builders claim the final seat at once. CrewConnect uses a{" "}
          <strong className="font-semibold text-ink-primary">Two-Tier Reservation</strong>{" "}
          model backed by{" "}
          <strong className="font-semibold text-ink-primary">MongoDB 7.0 (rs0)</strong>{" "}
          replica-set transactions.
        </p>

        <p className="text-base text-ink-secondary leading-relaxed max-w-[60ch]">
          Every join submission passes a client-generated{" "}
          <span className="font-semibold text-ink-primary">Idempotency-Key</span> and executes an atomic conditional{" "}
          <span className="font-semibold text-ink-primary">memberCount</span> increment only when remaining capacity is positive. Competing callers fail cleanly with HTTP 409 Conflict instead of oversubscribing the roster.
        </p>

        <div className="pt-2 flex items-center gap-2.5 text-sm">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              loadingHealth
                ? "bg-warning"
                : apiOnline
                  ? "bg-positive"
                  : "bg-ink-muted"
            }`}
          />
          <span className="font-medium text-ink-primary">
            {loadingHealth
              ? "Checking backend readiness..."
              : apiOnline
                ? "Local API replica-set backend online (200 OK)"
                : "Backend standby (interactive simulation runs locally)"}
          </span>
        </div>
      </div>

      {/* Right Interactive Contention Simulator */}
      <div
        data-ui="reservation-simulator"
        className={`lg:col-span-7 bg-ground border border-border-strong rounded-[10px] overflow-hidden transition-[transform,opacity] duration-500 ease-out ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* Top Bar */}
        <div className="bg-surface px-5 py-4 border-b border-border-subtle flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink-primary">
              Concurrent Last-Seat Contention Trace
            </p>
            <p className="text-[13px] text-ink-muted">
              Target squad capacity: <span className="tabular font-semibold text-ink-primary">{currentCount} / 4 seats</span>
            </p>
          </div>

          {stage === "idle" ? (
            <button
              type="button"
              onClick={handleRunRace}
              className="btn btn-primary h-9 px-4 text-[13px]"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Simulate Concurrent Join</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              disabled={stage === "racing"}
              className="btn btn-secondary h-9 px-4 text-[13px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Trace</span>
            </button>
          )}
        </div>

        {/* Two Contending Callers */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Applicant A */}
            <div
              className={`rounded-lg p-4 border transition-colors duration-200 ${
                stage === "resolved"
                  ? "bg-accent-tint border-accent"
                  : "bg-surface border-border-subtle"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-semibold text-ink-primary">
                  Caller A · POST /join
                </span>
                <span
                  className={`status-label tabular ${
                    stage === "resolved"
                      ? "status-open"
                      : stage === "racing"
                        ? "status-warning"
                        : "status-full"
                  }`}
                >
                  {stage === "resolved"
                    ? "201 Created"
                    : stage === "racing"
                      ? "Evaluating..."
                      : "Ready"}
                </span>
              </div>
              <p className="text-[13px] text-ink-secondary">
                Idempotency-Key: k_9f2a1c
              </p>
              <p className="text-[13px] font-medium text-ink-primary mt-2">
                {stage === "resolved"
                  ? "Predicate matched (memberCount < 4). Counter updated 3 → 4."
                  : stage === "racing"
                    ? "Acquiring document write lock inside rs0 session..."
                    : "Queued with valid idempotency header."}
              </p>
            </div>

            {/* Applicant B */}
            <div
              className={`rounded-lg p-4 border transition-colors duration-200 ${
                stage === "resolved"
                  ? "bg-danger-bg/60 border-[#FECACA]"
                  : "bg-surface border-border-subtle"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-semibold text-ink-primary">
                  Caller B · POST /join
                </span>
                <span
                  className={`status-label tabular ${
                    stage === "resolved"
                      ? "status-danger"
                      : stage === "racing"
                        ? "status-warning"
                        : "status-full"
                  }`}
                >
                  {stage === "resolved"
                    ? "409 Conflict"
                    : stage === "racing"
                      ? "Evaluating..."
                      : "Ready"}
                </span>
              </div>
              <p className="text-[13px] text-ink-secondary">
                Idempotency-Key: k_4d8b7e
              </p>
              <p className="text-[13px] font-medium text-ink-primary mt-2">
                {stage === "resolved"
                  ? "Conditional predicate failed (memberCount == 4). Zero oversubscription."
                  : stage === "racing"
                    ? "Waiting on conditional update predicate..."
                    : "Arrives simultaneously for remaining slot."}
              </p>
            </div>
          </div>

          {/* Atomic Guard Summary Strip */}
          <div className="bg-surface border border-border-subtle rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[13px]">
            <span className="font-medium text-ink-secondary">
              Conditional guard:{" "}
              <code className="font-semibold text-ink-primary">
                {"{ memberCount: { $lt: maxCapacity }, isOpen: true }"}
              </code>
            </span>
            <span className="font-semibold text-accent tabular">
              {stage === "resolved"
                ? "Final state: 4 / 4 members (exact match)"
                : "Invariant: memberCount ≤ maxCapacity"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
