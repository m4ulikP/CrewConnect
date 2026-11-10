import React, { useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";

/**
 * Bespoke architectural-playful illustration of 4 independent skill disciplines
 * snapping cleanly into a fixed-capacity 4-seat hackathon squad.
 * Illustrative hero centerpiece replacing the previous constellation cards.
 */
export const SquadAssemblyIllustration: React.FC = () => {
  const [assembled, setAssembled] = useState(false);
  const [hoveredPiece, setHoveredPiece] = useState<string | null>(null);
  const [pointerShift, setPointerShift] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setPointerShift({
      x: Math.round(nx * 10),
      y: Math.round(ny * 8),
    });
  };

  const handleMouseLeave = () => {
    setPointerShift({ x: 0, y: 0 });
    setHoveredPiece(null);
  };

  const roleLabels: Record<string, string> = {
    systems: "Systems Arch · Core backend & reliability",
    ml: "Electric Block · AI / ML pipelines & ingestion",
    product: "Butter Wedge · Frontend & design engineering",
    seat4: assembled
      ? "Seat 4 Locked · Squad formation complete"
      : "Open Slot 4 · Waiting for final builder",
  };

  const activeCaption = hoveredPiece
    ? roleLabels[hoveredPiece]
    : assembled
      ? "All 4 disciplines locked inside fixed capacity."
      : "Tap 'Snap Squad Together' to test the 4-seat lock.";

  return (
    <div
      data-ui="squad-assembly-hero"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative bg-surface border-2 border-ink-primary rounded-lg overflow-hidden select-none"
    >
      {/* Top Brutalist Poster Bar */}
      <div className="bg-highlight border-b-2 border-ink-primary px-4 py-2.5 flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-ink-primary tracking-tight">
          Illustrative Visual · 4-Seat Squad Lock
        </span>
        <span
          className={`px-2.5 py-0.5 rounded text-[13px] font-bold tabular border border-ink-primary ${
            assembled
              ? "bg-accent text-white"
              : "bg-surface text-ink-primary"
          }`}
        >
          {assembled ? "4 / 4 Locked" : "3 / 4 Ready"}
        </span>
      </div>

      {/* Main Graphic Canvas */}
      <div className="relative bg-ground/70 px-3 py-4 sm:p-5">
        {/* Corner Decorative Geometric Stamp reacting gently to pointer */}
        <div
          aria-hidden="true"
          style={{
            transform: `translate3d(${pointerShift.x * -0.5}px, ${pointerShift.y * -0.5}px, 0) rotate(${assembled ? 0 : -4}deg)`,
          }}
          className="hidden sm:flex absolute top-4 left-4 z-10 items-center gap-1.5 bg-surface border-2 border-ink-primary rounded px-2.5 py-1 text-[13px] font-semibold text-ink-primary transition-transform duration-200 ease-out"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-tangelo border border-ink-primary" />
          <span>Max 4 seats</span>
        </div>

        <svg
          role="img"
          aria-label="Interactive illustration showing four distinct builder blocks assembling into a four-seat hackathon team"
          viewBox="0 0 420 280"
          className="w-full h-auto max-h-[300px] overflow-visible"
        >
          <defs>
            <pattern
              id="heroDotMatrix"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1.3" fill="#CFCBC2" />
            </pattern>
          </defs>

          {/* Architectural Dot Canvas */}
          <rect width="420" height="280" fill="url(#heroDotMatrix)" rx="6" />

          {/* Background Ambient Accent Rings (restrained pointer depth) */}
          <g
            style={{
              transform: `translate3d(${pointerShift.x * 0.6}px, ${pointerShift.y * 0.6}px, 0)`,
              transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <circle
              cx="358"
              cy="54"
              r="18"
              fill="#FDE047"
              stroke="#18181B"
              strokeWidth="2"
            />
            <rect
              x="44"
              y="222"
              width="22"
              height="22"
              rx="4"
              transform="rotate(14 55 233)"
              fill="#FF5A1F"
              stroke="#18181B"
              strokeWidth="2"
            />
          </g>

          {/* Central Target 4-Seat Socket Frame */}
          <rect
            x="110"
            y="38"
            width="200"
            height="200"
            rx="14"
            fill="#FFFFFF"
            fillOpacity={assembled ? 1 : 0.72}
            stroke="#18181B"
            strokeWidth="2.5"
            strokeDasharray={assembled ? "none" : "8 6"}
            className="transition-[fill-opacity] duration-300"
          />

          {/* 4-Cell Inner Crosshairs (Structural Alignment Lines inside SVG) */}
          <line x1="210" y1="48" x2="210" y2="228" stroke="#E4E2DC" strokeWidth="1.5" />
          <line x1="120" y1="138" x2="300" y2="138" stroke="#E4E2DC" strokeWidth="1.5" />

          {/* Open 4th Quadrant Placeholder Badge */}
          <g opacity={assembled ? 0 : 1} style={{ transition: "opacity 200ms ease-out" }}>
            <rect
              x="218"
              y="146"
              width="82"
              height="82"
              rx="10"
              fill="#E6F2F0"
              stroke="#115E59"
              strokeWidth="2"
              strokeDasharray="5 4"
            />
            <path
              d="M259 175 V199 M247 187 H271"
              stroke="#115E59"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>

          {/* SHAPE 1 (Top-Left): Deep Pine Systems Arch */}
          <g
            onMouseEnter={() => setHoveredPiece("systems")}
            onClick={() => setAssembled((prev) => !prev)}
            className="cursor-pointer"
            style={{
              transformOrigin: "161px 89px",
              transform: assembled
                ? "translate(0px, 0px) rotate(0deg)"
                : "translate(-26px, -16px) rotate(-7deg)",
              transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <path
              d="M120 130 V88 C120 65.9086 137.909 48 160 48 H162 C184.091 48 202 65.9086 202 88 V130 H120 Z"
              fill="#115E59"
              stroke="#18181B"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Friendly Minimal Eyes */}
            <circle cx="150" cy="88" r="5" fill="#FFFFFF" />
            <circle cx="151.5" cy="88" r="2.2" fill="#18181B" />
            <circle cx="172" cy="88" r="5" fill="#FFFFFF" />
            <circle cx="173.5" cy="88" r="2.2" fill="#18181B" />
            <path
              d="M154 104 Q161 110 168 104"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>

          {/* SHAPE 2 (Top-Right): Electric Tangelo AI/Data Monolith */}
          <g
            onMouseEnter={() => setHoveredPiece("ml")}
            onClick={() => setAssembled((prev) => !prev)}
            className="cursor-pointer"
            style={{
              transformOrigin: "259px 89px",
              transform: assembled
                ? "translate(0px, 0px) rotate(0deg)"
                : "translate(26px, -18px) rotate(8deg)",
              transition: "transform 460ms cubic-bezier(0.22, 1, 0.36, 1) 40ms",
            }}
          >
            <rect
              x="218"
              y="48"
              width="82"
              height="82"
              rx="22"
              fill="#FF5A1F"
              stroke="#18181B"
              strokeWidth="2.5"
            />
            {/* Architectural Signal Stripes & Eyes */}
            <rect
              x="232"
              y="64"
              width="22"
              height="8"
              rx="4"
              fill="#18181B"
            />
            <circle cx="248" cy="94" r="5" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.5" />
            <circle cx="247" cy="94" r="2" fill="#18181B" />
            <circle cx="270" cy="94" r="5" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.5" />
            <circle cx="269" cy="94" r="2" fill="#18181B" />
            <path
              d="M251 110 H267"
              stroke="#18181B"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>

          {/* SHAPE 3 (Bottom-Left): Sunburst Butter Product Block */}
          <g
            onMouseEnter={() => setHoveredPiece("product")}
            onClick={() => setAssembled((prev) => !prev)}
            className="cursor-pointer"
            style={{
              transformOrigin: "161px 187px",
              transform: assembled
                ? "translate(0px, 0px) rotate(0deg)"
                : "translate(-22px, 16px) rotate(6deg)",
              transition: "transform 480ms cubic-bezier(0.22, 1, 0.36, 1) 70ms",
            }}
          >
            <path
              d="M120 146 H202 V228 H144 C130.745 228 120 217.255 120 204 V146 Z"
              fill="#FDE047"
              stroke="#18181B"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <circle cx="149" cy="180" r="5" fill="#18181B" />
            <circle cx="173" cy="180" r="5" fill="#18181B" />
            <path
              d="M153 196 Q161 203 169 196"
              fill="none"
              stroke="#18181B"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>

          {/* SHAPE 4 (Bottom-Right): Incoming Final Builder Key */}
          <g
            onMouseEnter={() => setHoveredPiece("seat4")}
            onClick={() => setAssembled((prev) => !prev)}
            className="cursor-pointer"
            style={{
              transformOrigin: "259px 187px",
              transform: assembled
                ? "translate(0px, 0px) rotate(0deg)"
                : "translate(42px, 22px) rotate(-10deg)",
              transition: "transform 520ms cubic-bezier(0.22, 1, 0.36, 1) 90ms",
            }}
          >
            <rect
              x="218"
              y="146"
              width="82"
              height="82"
              rx="14"
              fill={assembled ? "#E6F2F0" : "#FFFFFF"}
              stroke="#18181B"
              strokeWidth="2.5"
              className="transition-colors duration-200"
            />
            {assembled ? (
              <>
                <circle
                  cx="259"
                  cy="176"
                  r="13"
                  fill="#115E59"
                />
                <path
                  d="M253 176 L257.5 180.5 L265.5 171.5"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text
                  x="259"
                  y="211"
                  textAnchor="middle"
                  fill="#18181B"
                  fontSize="13"
                  fontWeight="700"
                >
                  SEAT 4
                </text>
              </>
            ) : (
              <>
                <circle cx="249" cy="178" r="4.5" fill="#115E59" />
                <circle cx="269" cy="178" r="4.5" fill="#115E59" />
                <text
                  x="259"
                  y="210"
                  textAnchor="middle"
                  fill="#115E59"
                  fontSize="14"
                  fontWeight="700"
                >
                  +1 YOU
                </text>
              </>
            )}
          </g>
        </svg>
      </div>

      {/* Bottom Interactive Control Bar */}
      <div className="bg-surface border-t-2 border-ink-primary px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-primary leading-snug">
          {activeCaption}
        </p>

        <button
          type="button"
          onClick={() => setAssembled((prev) => !prev)}
          className={`btn h-9 !px-3.5 text-[13px] flex-shrink-0 border-2 border-ink-primary ${
            assembled
              ? "bg-surface text-ink-primary hover:bg-surface-tonal"
              : "bg-highlight text-ink-primary hover:bg-highlight-hover"
          }`}
        >
          {assembled ? (
            <>
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Scatter Sparks</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Snap Squad Together</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
