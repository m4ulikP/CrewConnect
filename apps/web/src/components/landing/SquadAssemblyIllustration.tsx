import React, { useEffect, useState } from "react";
import { useReducedMotion } from "../../hooks/useInViewOnce";

/**
 * Bespoke abstract geometric sculpture illustrating independent builders
 * converging along dynamic pathways into a capacity-locked orbital motif.
 * Sits directly on the hero drafting canvas without dashboard-card chrome.
 * Settles gracefully on initial mount and responds subtly to fine-pointer hover.
 */
export const SquadAssemblyIllustration: React.FC = () => {
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [settled, setSettled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  });

  useEffect(() => {
    if (reducedMotion) {
      setSettled(true);
      setHovered(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      setSettled(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion]);

  const shift = hovered && !reducedMotion;
  const visible = settled || reducedMotion;

  return (
    <div
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      className="relative mx-auto w-full max-w-[490px] py-2 select-none"
      aria-hidden="true"
    >
      {/* Capacity Datum Chip — Bottom Right */}
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: shift
            ? "translate3d(-4px, -3px, 0)"
            : visible
              ? "translate3d(0, 0, 0)"
              : "translate3d(0, 8px, 0)",
          transition:
            "transform 340ms cubic-bezier(0.23, 1, 0.32, 1) 180ms, opacity 320ms cubic-bezier(0.23, 1, 0.32, 1) 180ms",
        }}
        className="inline-flex items-center gap-2 absolute bottom-3 right-2 sm:right-4 z-10 bg-surface border-2 border-ink-primary px-3 py-1 rounded-[3px] text-[13px] font-bold text-ink-primary tabular"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-accent border border-ink-primary" />
        <span>{shift ? "Locking 4th path" : "3 / 4 connected"}</span>
      </div>

      {/* Open-Canvas Abstract SVG Sculpture */}
      <svg viewBox="0 0 480 380" className="w-full h-auto overflow-visible">
        {/* Asymmetric Soft Tonal Paper Anchor Shape Behind Ring */}
        <path
          d="M92 250 C92 150, 175 74, 286 74 L350 74 C368 74, 382 88, 382 106 L382 260 C382 300, 348 332, 308 332 L152 332 C118 332, 92 298, 92 250 Z"
          fill="#EEEDE9"
          stroke="#18181B"
          strokeWidth="2"
          strokeDasharray="6 6"
          style={{
            opacity: visible ? 1 : 0,
            transition: "opacity 360ms cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        />

        {/* Layered Butter Wedge — Lower Left Offset */}
        <path
          d="M54 218 H158 V322 H102 C75.49 322 54 300.51 54 274 V218 Z"
          fill="#FDE047"
          stroke="#18181B"
          strokeWidth="2.5"
          strokeLinejoin="round"
          style={{
            transformOrigin: "106px 270px",
            opacity: visible ? 1 : 0,
            transform: shift
              ? "translate3d(6px, -6px, 0) rotate(-3deg)"
              : visible
                ? "translate3d(0, 0, 0) rotate(-6deg)"
                : "translate3d(-8px, 8px, 0) rotate(-6deg)",
            transition:
              "transform 420ms cubic-bezier(0.23, 1, 0.32, 1) 60ms, opacity 340ms cubic-bezier(0.23, 1, 0.32, 1) 60ms",
          }}
        />

        {/* Dynamic Connection Pathways Converging Into Orbital Lock */}
        <g
          style={{
            opacity: visible ? 1 : 0,
            transition: "opacity 380ms cubic-bezier(0.23, 1, 0.32, 1) 120ms",
          }}
        >
          {/* Path 1: Top-Left Builder -> Core */}
          <path
            d="M 102 96 C 148 96, 165 156, 214 176"
            fill="none"
            stroke="#18181B"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Path 2: Bottom-Left Builder -> Core */}
          <path
            d="M 134 274 C 176 266, 188 228, 224 214"
            fill="none"
            stroke="#18181B"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Path 3: Top-Right Builder -> Core */}
          <path
            d="M 384 102 C 344 108, 326 154, 288 176"
            fill="none"
            stroke="#18181B"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Path 4: Dynamic Dashed Converging Path from Bottom-Right Builder Node */}
          <path
            d="M 392 276 C 348 264, 324 234, 294 216"
            fill="none"
            stroke="#115E59"
            strokeWidth={shift ? "3.2" : "2.5"}
            strokeDasharray="7 6"
            strokeLinecap="round"
            style={{ transition: "stroke-width 220ms cubic-bezier(0.23, 1, 0.32, 1)" }}
          />
        </g>

        {/* Central Orbital Seat-Lock Motif (Off-center focal anchor at 252, 194) */}
        <svg x="252" y="194" overflow="visible">
          <g
            style={{
              transformOrigin: "0px 0px",
              opacity: visible ? 1 : 0,
              transform: visible ? "scale(1)" : "scale(0.94)",
              transition:
                "transform 420ms cubic-bezier(0.23, 1, 0.32, 1) 80ms, opacity 340ms cubic-bezier(0.23, 1, 0.32, 1) 80ms",
            }}
          >
            {/* Outer Structural Ring */}
            <circle cx="0" cy="0" r="68" fill="#FFFFFF" stroke="#18181B" strokeWidth="2.5" />

            {/* 3 Locked Architectural Quadrant Arcs (Pine, Butter, Tangelo) */}
            <path
              d="M 0 -54 A 54 54 0 0 0 -54 0"
              fill="none"
              stroke="#115E59"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M -54 0 A 54 54 0 0 0 0 54"
              fill="none"
              stroke="#FDE047"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 54 0 A 54 54 0 0 0 0 -54"
              fill="none"
              stroke="#FF5A1F"
              strokeWidth="12"
              strokeLinecap="round"
            />

            {/* 4th Quadrant: Open Reservation Arc */}
            <path
              d="M 0 54 A 54 54 0 0 0 54 0"
              fill="none"
              stroke="#115E59"
              strokeWidth="3.5"
              strokeDasharray="6 5"
              strokeLinecap="round"
            />

            {/* Inner Precision Keyhole Core */}
            <circle cx="0" cy="0" r="28" fill="#115E59" stroke="#18181B" strokeWidth="2.5" />
            {/* Minimal Architectural Lock Emblem inside Core */}
            <circle cx="0" cy="-3" r="6" fill="#FDE047" />
            <path d="M -5 4 H5 L7 13 H-7 Z" fill="#FDE047" />
          </g>
        </svg>

        {/* Independent Builder Geometric Node 1 (Top-Left: Deep Pine Arch) */}
        <g
          style={{
            transformOrigin: "82px 92px",
            opacity: visible ? 1 : 0,
            transform: shift
              ? "translate3d(6px, 5px, 0) scale(1.03)"
              : visible
                ? "translate3d(0, 0, 0) scale(1)"
                : "translate3d(-8px, -8px, 0) scale(0.95)",
            transition:
              "transform 400ms cubic-bezier(0.23, 1, 0.32, 1) 110ms, opacity 320ms cubic-bezier(0.23, 1, 0.32, 1) 110ms",
          }}
        >
          <path
            d="M44 128 V86 C44 63.9 61.9 46 84 46 C106.1 46 124 63.9 124 86 V128 H44 Z"
            fill="#115E59"
            stroke="#18181B"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="72" cy="86" r="4" fill="#FFFFFF" />
          <circle cx="96" cy="86" r="4" fill="#FFFFFF" />
          <circle cx="102" cy="96" r="6" fill="#FDE047" stroke="#18181B" strokeWidth="2" />
        </g>

        {/* Node Connection Pivot 2 (Butter Wedge Anchor Dot) */}
        <circle
          cx="134"
          cy="274"
          r="8"
          fill="#115E59"
          stroke="#18181B"
          strokeWidth="2.5"
          style={{
            opacity: visible ? 1 : 0,
            transition: "opacity 320ms cubic-bezier(0.23, 1, 0.32, 1) 140ms",
          }}
        />

        {/* Independent Builder Geometric Node 3 (Top-Right: Tangelo Capsule Block) */}
        <g
          style={{
            transformOrigin: "392px 96px",
            opacity: visible ? 1 : 0,
            transform: shift
              ? "translate3d(-6px, 4px, 0) rotate(-3deg)"
              : visible
                ? "translate3d(0, 0, 0) rotate(5deg)"
                : "translate3d(8px, -8px, 0) rotate(5deg) scale(0.95)",
            transition:
              "transform 400ms cubic-bezier(0.23, 1, 0.32, 1) 140ms, opacity 320ms cubic-bezier(0.23, 1, 0.32, 1) 140ms",
          }}
        >
          <rect
            x="354"
            y="54"
            width="84"
            height="72"
            rx="22"
            fill="#FF5A1F"
            stroke="#18181B"
            strokeWidth="2.5"
          />
          <rect x="372" y="72" width="24" height="8" rx="4" fill="#18181B" />
          <circle cx="384" cy="100" r="4.5" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.5" />
          <circle cx="408" cy="100" r="4.5" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.5" />
        </g>

        {/* Dynamic Incoming Node 4 (Bottom-Right: Open Diamond Seat Key) */}
        <g
          style={{
            transformOrigin: "394px 276px",
            opacity: visible ? 1 : 0,
            transform: shift
              ? "translate3d(-14px, -12px, 0) rotate(0deg)"
              : visible
                ? "translate3d(0, 0, 0) rotate(8deg)"
                : "translate3d(10px, 10px, 0) rotate(8deg) scale(0.95)",
            transition:
              "transform 420ms cubic-bezier(0.23, 1, 0.32, 1) 170ms, opacity 320ms cubic-bezier(0.23, 1, 0.32, 1) 170ms",
          }}
        >
          <rect
            x="358"
            y="240"
            width="72"
            height="72"
            rx="16"
            fill="#FFFFFF"
            stroke="#18181B"
            strokeWidth="2.5"
          />
          <path
            d="M394 261 V285 M382 273 H406"
            stroke="#115E59"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="422" cy="248" r="10" fill="#FDE047" stroke="#18181B" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
};
