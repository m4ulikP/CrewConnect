import React from "react";

export interface PasswordCompanionProps {
  isPasswordFocused: boolean;
  isPasswordVisible: boolean;
  isTyping?: boolean;
  className?: string;
}

export type CompanionState =
  "neutral" | "focused-hidden" | "typing-hidden" | "focused-visible" | "typing-visible";

export function deriveCompanionState(
  isPasswordFocused: boolean,
  isPasswordVisible: boolean,
  isTyping = false
): CompanionState {
  if (!isPasswordFocused) {
    return "neutral";
  }
  if (isPasswordVisible) {
    return isTyping ? "typing-visible" : "focused-visible";
  }
  return isTyping ? "typing-hidden" : "focused-hidden";
}

export const PasswordCompanion: React.FC<PasswordCompanionProps> = ({
  isPasswordFocused,
  isPasswordVisible,
  isTyping = false,
  className = "",
}) => {
  const state = deriveCompanionState(isPasswordFocused, isPasswordVisible, isTyping);

  const headTransformMap: Record<CompanionState, string> = {
    neutral: "translate3d(0, 0, 0)",
    "focused-hidden": "translate3d(0, 1px, 0)",
    "typing-hidden": "rotate(2.5deg) translate3d(0, 1.5px, 0)",
    "focused-visible": "rotate(-4.5deg) translate3d(1px, 2px, 0)",
    "typing-visible": "rotate(-7deg) translate3d(2px, 2.5px, 0)",
  };

  const pupilTransformMap: Record<CompanionState, string> = {
    neutral: "translate3d(0, 0, 0)",
    "focused-hidden": "translate3d(0, 3px, 0)",
    "typing-hidden": "translate3d(-2.5px, 3.5px, 0)",
    "focused-visible": "translate3d(2.8px, 3.5px, 0)",
    "typing-visible": "translate3d(3.8px, 4px, 0)",
  };

  const leftBrowTransformMap: Record<CompanionState, string> = {
    neutral: "translate3d(0, 0, 0)",
    "focused-hidden": "translate3d(0, -1px, 0)",
    "typing-hidden": "translate3d(0, -0.5px, 0) rotate(-3deg)",
    "focused-visible": "translate3d(0, -1.5px, 0) rotate(-8deg)",
    "typing-visible": "translate3d(0, -2.5px, 0) rotate(-14deg)",
  };

  const rightBrowTransformMap: Record<CompanionState, string> = {
    neutral: "translate3d(0, 0, 0)",
    "focused-hidden": "translate3d(0, -1px, 0)",
    "typing-hidden": "translate3d(0, -2px, 0) rotate(8deg)",
    "focused-visible": "translate3d(0, 0.5px, 0) rotate(5deg)",
    "typing-visible": "translate3d(0, 1px, 0) rotate(8deg)",
  };

  const leftPawTransformMap: Record<CompanionState, string> = {
    neutral: "translate3d(0, 0, 0)",
    "focused-hidden": "translate3d(0, -2.5px, 0)",
    "typing-hidden": "translate3d(-1px, -3.5px, 0)",
    "focused-visible": "translate3d(1px, -4px, 0)",
    "typing-visible": "translate3d(2px, -5px, 0)",
  };

  const rightPawTransformMap: Record<CompanionState, string> = {
    neutral: "translate3d(0, 0, 0)",
    "focused-hidden": "translate3d(0, -2.5px, 0)",
    "typing-hidden": "translate3d(1px, -4.5px, 0)",
    "focused-visible": "translate3d(-3px, -6px, 0)",
    "typing-visible": "translate3d(-4px, -8px, 0)",
  };

  const blushOpacity = state === "typing-visible" ? 0.7 : state === "focused-visible" ? 0.45 : 0;

  return (
    <div
      aria-hidden="true"
      data-testid="password-companion"
      data-companion-state={state}
      className={`inline-flex items-end justify-center select-none pointer-events-none flex-shrink-0 w-[88px] h-[68px] ${className}`}
    >
      <svg viewBox="0 0 112 86" className="w-full h-full overflow-visible" aria-hidden="true">
        {/* Subtle base shadow line */}
        <line
          x1="16"
          y1="82"
          x2="96"
          y2="82"
          stroke="#CFCBC2"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Head & Body Group */}
        <g
          className="companion-head"
          style={{
            transform: headTransformMap[state],
            transformOrigin: "56px 78px",
            transition: "transform 180ms cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          {/* Little Butter-Yellow Crew Crest / Tuft */}
          <path
            d="M46 14 C46 7 52 4 56 4 C60 4 66 7 66 14 Z"
            fill="#FDE047"
            stroke="#18181B"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Main Architectural Arch Silhouette (Deep Pine) */}
          <path
            d="M24 81 V43 C24 22 38 11 56 11 C74 11 88 22 88 43 V81 Z"
            fill="#115E59"
            stroke="#18181B"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />

          {/* Mineral Alabaster Faceplate */}
          <rect
            x="31"
            y="25"
            width="50"
            height="38"
            rx="18"
            fill="#F6F6F4"
            stroke="#18181B"
            strokeWidth="2"
          />

          {/* Mischievous Tangelo Cheek Blush */}
          <g
            className="companion-blush"
            style={{
              opacity: blushOpacity,
              transition: "opacity 180ms ease-out",
            }}
          >
            <ellipse cx="38" cy="52" rx="4.5" ry="2.5" fill="#FF5A1F" />
            <ellipse cx="74" cy="52" rx="4.5" ry="2.5" fill="#FF5A1F" />
          </g>

          {/* Eyebrows */}
          <path
            d="M39 34 Q43 32 47 34"
            fill="none"
            stroke="#18181B"
            strokeWidth="1.8"
            strokeLinecap="round"
            style={{
              transform: leftBrowTransformMap[state],
              transformOrigin: "43px 33px",
              transition: "transform 160ms cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          />
          <path
            d="M65 34 Q69 32 73 34"
            fill="none"
            stroke="#18181B"
            strokeWidth="1.8"
            strokeLinecap="round"
            style={{
              transform: rightBrowTransformMap[state],
              transformOrigin: "69px 33px",
              transition: "transform 160ms cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          />

          {/* Expressive Eyes (Static sclera; pupils track direction cleanly) */}
          <g className="companion-eyes">
            <circle cx="43" cy="43" r="6.5" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.8" />
            <circle cx="69" cy="43" r="6.5" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.8" />

            <g
              className="companion-pupils"
              style={{
                transform: pupilTransformMap[state],
                transition: "transform 150ms cubic-bezier(0.23, 1, 0.32, 1)",
              }}
            >
              <circle cx="43" cy="43" r="2.8" fill="#18181B" />
              <circle cx="41.8" cy="41.6" r="1" fill="#FFFFFF" />

              <circle cx="69" cy="43" r="2.8" fill="#18181B" />
              <circle cx="67.8" cy="41.6" r="1" fill="#FFFFFF" />
            </g>
          </g>

          {/* Distinct Mouth Expression per State */}
          {state === "typing-visible" ? (
            <path
              d="M49.5 53.5 Q56 61.5 62.5 53.5 Z"
              fill="#18181B"
              stroke="#18181B"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          ) : state === "focused-visible" ? (
            <path
              d="M50 54.5 Q56 59 62 53"
              fill="none"
              stroke="#18181B"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          ) : state === "typing-hidden" ? (
            <circle cx="56" cy="55.5" r="2.2" fill="#18181B" />
          ) : state === "focused-hidden" ? (
            <path
              d="M52.5 55 Q56 55 59.5 55"
              fill="none"
              stroke="#18181B"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M51 54.5 Q56 57.5 61 54.5"
              fill="none"
              stroke="#18181B"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          )}
        </g>

        {/* Left Paw */}
        <g
          className="companion-paw-left"
          style={{
            transform: leftPawTransformMap[state],
            transition: "transform 180ms cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          <rect
            x="27"
            y="73"
            width="14"
            height="9"
            rx="4.5"
            fill="#FDE047"
            stroke="#18181B"
            strokeWidth="2"
          />
        </g>

        {/* Right Paw */}
        <g
          className="companion-paw-right"
          style={{
            transform: rightPawTransformMap[state],
            transition: "transform 180ms cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          <rect
            x="71"
            y="73"
            width="14"
            height="9"
            rx="4.5"
            fill="#FDE047"
            stroke="#18181B"
            strokeWidth="2"
          />
        </g>
      </svg>
    </div>
  );
};
