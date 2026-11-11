import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { useInViewOnce } from "../../hooks/useInViewOnce";

type SequenceStage = "open" | "spotlighting" | "joining" | "connecting" | "complete" | "resetting";

const STAGE_DURATIONS: Record<SequenceStage, number> = {
  open: 900,
  spotlighting: 1150,
  joining: 950,
  connecting: 750,
  complete: 2400,
  resetting: 500,
};

const NEXT_STAGE: Record<SequenceStage, SequenceStage> = {
  open: "spotlighting",
  spotlighting: "joining",
  joining: "connecting",
  connecting: "complete",
  complete: "resetting",
  resetting: "open",
};

/**
 * Editorial architectural illustration depicting "The Fourth Seat":
 * Upon scrolling into view, three builders settle around the shared project core
 * and draw their connection traces inward; then the fourth open seat highlights,
 * a fourth builder glides into place, completes the connection, and confirms 4 / 4.
 *
 * Purely illustrative — performs no simulated reservation requests.
 * Under prefers-reduced-motion, renders a static 3 / 4 composition immediately.
 */
export const LiveSquadShowcase: React.FC = () => {
  const { ref: containerRef, inView, reducedMotion } = useInViewOnce<HTMLDivElement>(0.2);

  const [tracesDrawn, setTracesDrawn] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    if (typeof IntersectionObserver === "undefined") return true;
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  });

  const [stage, setStage] = useState<SequenceStage>("open");

  useEffect(() => {
    if (reducedMotion) {
      setTracesDrawn(true);
      setStage("open");
      return;
    }
    if (!inView || tracesDrawn) return;

    const timer = window.setTimeout(() => {
      setTracesDrawn(true);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [inView, reducedMotion, tracesDrawn]);

  useEffect(() => {
    if (reducedMotion || !inView) {
      setStage("open");
      return;
    }

    const timer = window.setTimeout(() => {
      setStage((prev) => NEXT_STAGE[prev]);
    }, STAGE_DURATIONS[stage]);

    return () => window.clearTimeout(timer);
  }, [stage, reducedMotion, inView]);

  const effectiveStage: SequenceStage = reducedMotion ? "open" : stage;
  const membersVisible = reducedMotion || inView;
  const starterTracesVisible = reducedMotion || tracesDrawn;

  const isSpotlit =
    reducedMotion ||
    effectiveStage === "spotlighting" ||
    effectiveStage === "joining" ||
    effectiveStage === "connecting";

  const fourthMemberDocked =
    !reducedMotion &&
    (effectiveStage === "joining" ||
      effectiveStage === "connecting" ||
      effectiveStage === "complete");

  const pathConnected =
    !reducedMotion && (effectiveStage === "connecting" || effectiveStage === "complete");

  const isComplete = !reducedMotion && effectiveStage === "complete";
  const isResetting = !reducedMotion && effectiveStage === "resetting";

  let incomingTransform = "translate3d(44px, 24px, 0) scale(0.9)";
  let incomingOpacity = 0;
  let incomingTransition = "none";

  if (fourthMemberDocked) {
    incomingTransform = "translate3d(0, 0, 0) scale(1)";
    incomingOpacity = 1;
    incomingTransition = "transform 760ms cubic-bezier(0.23, 1, 0.32, 1), opacity 380ms ease-out";
  } else if (isResetting) {
    incomingTransform = "translate3d(0, 0, 0) scale(0.95)";
    incomingOpacity = 0;
    incomingTransition = "transform 420ms ease-out, opacity 380ms ease-out";
  }

  return (
    <div
      ref={containerRef}
      data-ui="live-squad-showcase"
      data-stage={effectiveStage}
      className="w-full max-w-[660px] lg:ml-auto"
    >
      {/* Open Architectural Drafting Canvas */}
      <div className="relative rounded-2xl bg-[#EEEDE9] px-4 pt-4 pb-3 sm:px-7 sm:pt-6 sm:pb-5 overflow-hidden">
        {/* Unobtrusive Capacity Readout */}
        <div
          aria-hidden="true"
          className="flex items-center justify-between gap-4 pb-2 select-none"
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full border border-ink-primary transition-colors duration-300 ${
                isComplete ? "bg-accent" : "bg-[#FFE45C]"
              }`}
            />
            <span className="font-display text-lg sm:text-xl font-bold text-ink-primary tabular leading-none">
              {isComplete ? "4 / 4" : "3 / 4"}
            </span>
          </div>

          <div className="relative h-7 flex items-center justify-end min-w-[144px]">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] text-[11px] sm:text-[12px] font-bold tracking-[0.06em] uppercase tabular transition-colors duration-300 ${
                isComplete
                  ? "bg-accent-tint text-accent border border-accent/40"
                  : "bg-[#FFE45C] text-ink-primary border border-ink-primary/80"
              }`}
            >
              {isComplete ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                  <span>Squad complete</span>
                </>
              ) : (
                <span>1 seat open</span>
              )}
            </span>
          </div>
        </div>

        {/* Geometric "Fourth Seat" Story Illustration */}
        <svg
          aria-hidden="true"
          viewBox="0 0 600 350"
          className="w-full h-auto overflow-visible select-none"
        >
          {/* Quiet Architectural Corner Registration Marks */}
          <g stroke="#8B8982" strokeWidth="1.5" strokeLinecap="round" opacity="0.65">
            <path d="M 10 22 V 10 H 22" fill="none" />
            <path d="M 578 10 H 590 V 22" fill="none" />
            <path d="M 10 328 V 340 H 22" fill="none" />
            <path d="M 578 340 H 590 V 328" fill="none" />
          </g>

          {/* Subtle Central Project Plinth Circle */}
          <circle
            cx="300"
            cy="175"
            r="102"
            fill="#F6F6F4"
            stroke="#D5D1C8"
            strokeWidth="1.5"
            style={{
              opacity: membersVisible ? 1 : 0,
              transition: "opacity 340ms cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          />

          {/* Connection Pathways: 3 Seated Builders drawing inward -> Central Project Core */}
          {/* Path 1: Top-Left Builder -> Core Q1 */}
          <path
            d="M 134 86 H 196 Q 210 86 210 100 V 138 Q 210 152 224 152 H 246"
            pathLength={100}
            fill="none"
            stroke="#18181B"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="100"
            strokeDashoffset={starterTracesVisible ? 0 : 100}
            style={{
              transition: "stroke-dashoffset 440ms cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          />
          <circle
            cx="246"
            cy="152"
            r="3.5"
            fill="#18181B"
            style={{
              opacity: starterTracesVisible ? 1 : 0,
              transition: "opacity 200ms ease-out 260ms",
            }}
          />

          {/* Path 2: Bottom-Left Builder -> Core Q2 */}
          <path
            d="M 134 264 H 196 Q 210 264 210 250 V 212 Q 210 198 224 198 H 246"
            pathLength={100}
            fill="none"
            stroke="#18181B"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="100"
            strokeDashoffset={starterTracesVisible ? 0 : 100}
            style={{
              transition: "stroke-dashoffset 440ms cubic-bezier(0.23, 1, 0.32, 1) 60ms",
            }}
          />
          <circle
            cx="246"
            cy="198"
            r="3.5"
            fill="#18181B"
            style={{
              opacity: starterTracesVisible ? 1 : 0,
              transition: "opacity 200ms ease-out 320ms",
            }}
          />

          {/* Path 3: Top-Right Builder -> Core Q3 */}
          <path
            d="M 466 86 H 404 Q 390 86 390 100 V 138 Q 390 152 376 152 H 354"
            pathLength={100}
            fill="none"
            stroke="#18181B"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="100"
            strokeDashoffset={starterTracesVisible ? 0 : 100}
            style={{
              transition: "stroke-dashoffset 440ms cubic-bezier(0.23, 1, 0.32, 1) 120ms",
            }}
          />
          <circle
            cx="354"
            cy="152"
            r="3.5"
            fill="#18181B"
            style={{
              opacity: starterTracesVisible ? 1 : 0,
              transition: "opacity 200ms ease-out 380ms",
            }}
          />

          {/* Path 4: Vacant Seat Guide Trace (Dashed) */}
          <path
            d="M 466 264 H 404 Q 390 264 390 250 V 212 Q 390 198 376 198 H 354"
            fill="none"
            stroke={isSpotlit ? "#18181B" : "#8B8982"}
            strokeWidth="2"
            strokeDasharray="6 5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              opacity: starterTracesVisible ? 1 : 0,
              transition: "stroke 320ms ease-out, opacity 280ms ease-out 180ms",
            }}
          />

          {/* Path 4: Active Pine Connection Trace (draws into Core Q4 when docked) */}
          <path
            d="M 466 264 H 404 Q 390 264 390 250 V 212 Q 390 198 376 198 H 354"
            pathLength={100}
            fill="none"
            stroke="#115E59"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="100"
            strokeDashoffset={pathConnected ? 0 : 100}
            style={{
              opacity: pathConnected ? 1 : 0,
              transition:
                effectiveStage === "open"
                  ? "none"
                  : "stroke-dashoffset 580ms cubic-bezier(0.23, 1, 0.32, 1), opacity 220ms ease-out",
            }}
          />
          <circle
            cx="354"
            cy="198"
            r="4"
            fill="#115E59"
            style={{
              opacity: pathConnected ? 1 : 0,
              transition: "opacity 240ms ease-out 320ms",
            }}
          />

          {/* Central Shared Project Artifact (2x2 Modular Blueprint Block) */}
          <svg x="300" y="175" overflow="visible">
            <g
              style={{
                transformOrigin: "0px 0px",
                opacity: membersVisible ? 1 : 0,
                transform: membersVisible ? "scale(1)" : "scale(0.94)",
                transition:
                  "transform 380ms cubic-bezier(0.23, 1, 0.32, 1), opacity 320ms cubic-bezier(0.23, 1, 0.32, 1)",
              }}
            >
              <rect
                x="-54"
                y="-54"
                width="108"
                height="108"
                rx="16"
                fill="#FFFFFF"
                stroke="#18181B"
                strokeWidth="2.5"
              />

              {/* Core Q1: Top-Left (Pine) */}
              <rect
                x="-44"
                y="-44"
                width="41"
                height="41"
                rx="7"
                fill="#115E59"
                stroke="#18181B"
                strokeWidth="2"
              />
              <path
                d="M -32 -16 A 16 16 0 0 1 -16 -32"
                fill="none"
                stroke="#F6F6F4"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Core Q2: Bottom-Left (Ink Stone) */}
              <rect
                x="-44"
                y="3"
                width="41"
                height="41"
                rx="7"
                fill="#18181B"
                stroke="#18181B"
                strokeWidth="2"
              />
              <path
                d="M -33 24 H -15 M -24 15 V 33"
                stroke="#F6F6F4"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Core Q3: Top-Right (Tangelo) */}
              <rect
                x="3"
                y="-44"
                width="41"
                height="41"
                rx="7"
                fill="#FF5A1F"
                stroke="#18181B"
                strokeWidth="2"
              />
              <circle cx="23.5" cy="-23.5" r="7" fill="#FFFFFF" stroke="#18181B" strokeWidth="2" />

              {/* Core Q4: Bottom-Right Vacant Recess */}
              <rect
                x="3"
                y="3"
                width="41"
                height="41"
                rx="7"
                fill={isSpotlit ? "#FFE45C" : "#F6F6F4"}
                fillOpacity={isSpotlit ? 0.55 : 1}
                stroke="#18181B"
                strokeWidth="1.75"
                strokeDasharray="4 3"
                style={{ transition: "fill 320ms ease-out, fill-opacity 320ms ease-out" }}
              />

              {/* Core Q4: Locked Module Overlay (when 4th builder connects) */}
              {!reducedMotion && (
                <g
                  style={{
                    transformOrigin: "23.5px 23.5px",
                    transform: pathConnected ? "scale(1)" : "scale(0.84)",
                    opacity: pathConnected ? 1 : 0,
                    transition:
                      effectiveStage === "open"
                        ? "none"
                        : "transform 420ms cubic-bezier(0.23, 1, 0.32, 1) 180ms, opacity 280ms ease-out 180ms",
                  }}
                >
                  <rect
                    x="3"
                    y="3"
                    width="41"
                    height="41"
                    rx="7"
                    fill="#FFE45C"
                    stroke="#18181B"
                    strokeWidth="2"
                  />
                  <polygon
                    points="23.5,14 33,23.5 23.5,33 14,23.5"
                    fill="#115E59"
                    stroke="#18181B"
                    strokeWidth="1.75"
                  />
                </g>
              )}

              {/* Central Hub Registration Pin */}
              <circle cx="0" cy="0" r="11" fill="#FFFFFF" stroke="#18181B" strokeWidth="2.25" />
              <circle cx="0" cy="0" r="3.5" fill="#18181B" />

              {/* Completion Confirmation Seal (appears cleanly in final state) */}
              {!reducedMotion && (
                <g
                  style={{
                    transformOrigin: "0px 0px",
                    transform: isComplete ? "scale(1)" : "scale(0.7)",
                    opacity: isComplete ? 1 : 0,
                    transition:
                      effectiveStage === "open"
                        ? "none"
                        : "transform 360ms cubic-bezier(0.23, 1, 0.32, 1), opacity 240ms ease-out",
                  }}
                >
                  <circle cx="0" cy="0" r="15" fill="#115E59" stroke="#18181B" strokeWidth="2.5" />
                  <path
                    d="M -5.5 0.5 L -1.5 4.5 L 6 -4"
                    fill="none"
                    stroke="#FFE45C"
                    strokeWidth="2.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )}
            </g>
          </svg>

          {/* Member 1 (Top-Left): Deep Pine Arch */}
          <svg x="62" y="52" overflow="visible">
            <g
              style={{
                transformOrigin: "36px 34px",
                opacity: membersVisible ? 1 : 0,
                transform: membersVisible
                  ? "translate3d(0, 0, 0) scale(1)"
                  : "translate3d(-8px, -6px, 0) scale(0.93)",
                transition:
                  "transform 380ms cubic-bezier(0.23, 1, 0.32, 1) 40ms, opacity 300ms ease-out 40ms",
              }}
            >
              <path
                d="M 4 68 V 32 C 4 14.327 18.327 0 36 0 C 53.673 0 68 14.327 68 32 V 68 H 4 Z"
                fill="#115E59"
                stroke="#18181B"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <circle cx="27" cy="34" r="3.5" fill="#FFFFFF" />
              <circle cx="45" cy="34" r="3.5" fill="#FFFFFF" />
              <circle cx="56" cy="14" r="5" fill="#FFE45C" stroke="#18181B" strokeWidth="2" />
            </g>
          </svg>

          {/* Member 2 (Bottom-Left): Ink & Alabaster Stepped Keystone */}
          <svg x="62" y="230" overflow="visible">
            <g
              style={{
                transformOrigin: "36px 34px",
                opacity: membersVisible ? 1 : 0,
                transform: membersVisible
                  ? "translate3d(0, 0, 0) scale(1)"
                  : "translate3d(-8px, 6px, 0) scale(0.93)",
                transition:
                  "transform 380ms cubic-bezier(0.23, 1, 0.32, 1) 100ms, opacity 300ms ease-out 100ms",
              }}
            >
              <rect
                x="4"
                y="2"
                width="64"
                height="64"
                rx="14"
                fill="#FFFFFF"
                stroke="#18181B"
                strokeWidth="2.5"
              />
              <rect x="4" y="16" width="64" height="16" fill="#18181B" />
              <circle cx="27" cy="24" r="3.2" fill="#FFE45C" />
              <circle cx="45" cy="24" r="3.2" fill="#FFE45C" />
              <path d="M 22 48 H 50" stroke="#18181B" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          </svg>

          {/* Member 3 (Top-Right): Tangelo Monolith Capsule */}
          <svg x="466" y="52" overflow="visible">
            <g
              style={{
                transformOrigin: "36px 34px",
                opacity: membersVisible ? 1 : 0,
                transform: membersVisible
                  ? "translate3d(0, 0, 0) scale(1)"
                  : "translate3d(8px, -6px, 0) scale(0.93)",
                transition:
                  "transform 380ms cubic-bezier(0.23, 1, 0.32, 1) 160ms, opacity 300ms ease-out 160ms",
              }}
            >
              <rect
                x="4"
                y="2"
                width="64"
                height="64"
                rx="22"
                fill="#FF5A1F"
                stroke="#18181B"
                strokeWidth="2.5"
              />
              <rect x="18" y="18" width="22" height="7" rx="3.5" fill="#18181B" />
              <circle cx="28" cy="40" r="3.8" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.5" />
              <circle cx="46" cy="40" r="3.8" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.5" />
            </g>
          </svg>

          {/* Position 4 (Bottom-Right): Clearly Identifiable Open Fourth Seat */}
          <svg x="466" y="230" overflow="visible">
            <g
              style={{
                opacity: membersVisible ? 1 : 0,
                transition: "opacity 320ms ease-out 200ms",
              }}
            >
              <rect
                x="4"
                y="2"
                width="64"
                height="64"
                rx="16"
                fill={isSpotlit ? "#FFE45C" : "#F6F6F4"}
                fillOpacity={isSpotlit ? 0.72 : 1}
                stroke="#18181B"
                strokeWidth="2"
                strokeDasharray="6 5"
                style={{ transition: "fill 320ms ease-out, fill-opacity 320ms ease-out" }}
              />
              <path
                d="M 36 25 V 43 M 27 34 H 45"
                stroke="#18181B"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
          </svg>

          {/* Incoming 4th Member: Butter-Yellow & Pine Keystone gliding into Position 4 */}
          {!reducedMotion && (
            <svg
              x="466"
              y="230"
              overflow="visible"
              style={{
                pointerEvents: "none",
              }}
            >
              <g
                style={{
                  transformOrigin: "36px 34px",
                  transform: incomingTransform,
                  opacity: incomingOpacity,
                  transition: incomingTransition,
                }}
              >
                <rect
                  x="4"
                  y="2"
                  width="64"
                  height="64"
                  rx="16"
                  fill="#FFE45C"
                  stroke="#18181B"
                  strokeWidth="2.5"
                />
                {/* Architectural Pine Base Accent */}
                <path
                  d="M 4 46 H 68 V 50 C 68 58.837 60.837 66 52 66 H 20 C 11.163 66 4 58.837 4 50 V 46 Z"
                  fill="#115E59"
                  stroke="#18181B"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <circle cx="27" cy="28" r="3.5" fill="#18181B" />
                <circle cx="45" cy="28" r="3.5" fill="#18181B" />
              </g>
            </svg>
          )}
        </svg>

        <p className="sr-only">
          Illustration showing three connected squad members around a shared project core with a
          fourth seat open, then filled by a fourth builder to complete a four-person squad.
        </p>
      </div>

      {/* Preserved Real Team Discovery Action */}
      <div className="mt-3.5 flex justify-start sm:justify-end px-1">
        <Link to="/teams-preview" className="btn-text-link group text-sm">
          <span>Inspect live squads</span>
          <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
};
