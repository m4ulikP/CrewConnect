import React from "react";
import { deriveCompanionState, type CompanionState } from "./PasswordCompanion";

export interface LargePasswordCompanionProps {
  isPasswordFocused: boolean;
  isPasswordVisible: boolean;
  isTyping?: boolean;
  className?: string;
}

export const LargePasswordCompanion: React.FC<LargePasswordCompanionProps> = ({
  isPasswordFocused,
  isPasswordVisible,
  isTyping = false,
  className = "",
}) => {
  const state = deriveCompanionState(isPasswordFocused, isPasswordVisible, isTyping);

  // Subtle body/shoulder lean toward the left-hand sign-in form
  const bodyTransformMap: Record<CompanionState, string> = {
    neutral: "translate3d(0, 0, 0)",
    "focused-hidden": "translate3d(-3px, 1px, 0)",
    "typing-hidden": "translate3d(-4px, 2px, 0)",
    "focused-visible": "translate3d(-6px, 2px, 0)",
    "typing-visible": "translate3d(-8px, 3px, 0)",
  };

  const headTransformMap: Record<CompanionState, string> = {
    neutral: "translate3d(0, 0, 0)",
    "focused-hidden": "rotate(-2deg) translate3d(-2px, 2px, 0)",
    "typing-hidden": "rotate(2.5deg) translate3d(-4px, 3px, 0)",
    "focused-visible": "rotate(-6deg) translate3d(-6px, 4px, 0)",
    "typing-visible": "rotate(-8.5deg) translate3d(-8px, 5px, 0)",
  };

  // Pupils track decisively left toward the password input in the left column
  const pupilTransformMap: Record<CompanionState, string> = {
    neutral: "translate3d(0, 0, 0)",
    "focused-hidden": "translate3d(-5.5px, 1.5px, 0)",
    "typing-hidden": "translate3d(-7px, 3px, 0)",
    "focused-visible": "translate3d(-8.5px, 2.5px, 0)",
    "typing-visible": "translate3d(-9.5px, 3.5px, 0)",
  };

  const leftBrowTransformMap: Record<CompanionState, string> = {
    neutral: "translate3d(0, 0, 0)",
    "focused-hidden": "translate3d(0, -3px, 0) rotate(-3deg)",
    "typing-hidden": "translate3d(0, -2px, 0) rotate(-6deg)",
    "focused-visible": "translate3d(0, -5px, 0) rotate(-12deg)",
    "typing-visible": "translate3d(0, -6.5px, 0) rotate(-16deg)",
  };

  const rightBrowTransformMap: Record<CompanionState, string> = {
    neutral: "translate3d(0, 0, 0)",
    "focused-hidden": "translate3d(0, -2.5px, 0) rotate(2deg)",
    "typing-hidden": "translate3d(0, -5px, 0) rotate(10deg)",
    "focused-visible": "translate3d(0, 1.5px, 0) rotate(7deg)",
    "typing-visible": "translate3d(0, 2px, 0) rotate(10deg)",
  };

  const leftHandTransformMap: Record<CompanionState, string> = {
    neutral: "translate3d(0, 0, 0)",
    "focused-hidden": "translate3d(-2px, -4px, 0)",
    "typing-hidden": "translate3d(-4px, -7px, 0) rotate(-4deg)",
    "focused-visible": "translate3d(-3px, -6px, 0)",
    "typing-visible": "translate3d(-5px, -9px, 0) rotate(-6deg)",
  };

  const rightHandTransformMap: Record<CompanionState, string> = {
    neutral: "translate3d(0, 0, 0)",
    "focused-hidden": "translate3d(-2px, -4px, 0)",
    "typing-hidden": "translate3d(0, -5px, 0) rotate(4deg)",
    "focused-visible": "translate3d(-10px, -18px, 0) rotate(10deg)",
    "typing-visible": "translate3d(-14px, -24px, 0) rotate(14deg)",
  };

  const blushOpacity = state === "typing-visible" ? 0.75 : state === "focused-visible" ? 0.5 : 0;

  return (
    <div
      aria-hidden="true"
      data-testid="large-password-companion"
      data-companion-state={state}
      className={`w-full max-w-[430px] xl:max-w-[500px] aspect-[336/318] select-none pointer-events-none ${className}`}
    >
      <svg viewBox="42 40 336 318" className="w-full h-full overflow-visible" aria-hidden="true">
        {/* Subtle Architectural Framing Circle */}
        <circle cx="216" cy="196" r="138" fill="#FFFFFF" stroke="#CFCBC2" strokeWidth="1.5" />

        {/* Subtle Geometric Environment Shapes */}
        <rect x="74" y="238" width="36" height="97" rx="6" fill="#E4E2DC" opacity="0.7" />
        <circle cx="326" cy="98" r="22" fill="#FDE047" stroke="#18181B" strokeWidth="2.2" />
        <circle cx="96" cy="142" r="7" fill="#FF5A1F" />
        <circle cx="348" cy="240" r="5" fill="#115E59" opacity="0.45" />

        {/* Subtle horizontal desk/ledge line */}
        <line
          x1="58"
          y1="335"
          x2="362"
          y2="335"
          stroke="#18181B"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="92"
          y1="345"
          x2="328"
          y2="345"
          stroke="#CFCBC2"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Character Torso & Shoulders */}
        <g
          className="large-companion-body"
          style={{
            transform: bodyTransformMap[state],
            transformOrigin: "210px 335px",
            transition: "transform 220ms cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          {/* Architectural Torso Silhouette (Deep Pine) */}
          <path
            d="M126 335 V242 C126 205 154 186 210 186 C266 186 294 205 294 242 V335 Z"
            fill="#115E59"
            stroke="#18181B"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Subtle Collar Seam & CrewConnect Chest Emblem */}
          <path
            d="M168 202 Q210 226 252 202"
            fill="none"
            stroke="#0F4C48"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <g transform="translate(242, 242)">
            <path
              d="M0 16 V9 C0 4 4 0 9 0 H11 V16 H0 Z"
              fill="#F6F6F4"
              stroke="#18181B"
              strokeWidth="1.8"
            />
            <circle cx="15" cy="12" r="5" fill="#FDE047" stroke="#18181B" strokeWidth="1.8" />
          </g>

          {/* Character Head Group */}
          <g
            className="large-companion-head"
            style={{
              transform: headTransformMap[state],
              transformOrigin: "210px 205px",
              transition: "transform 200ms cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          >
            {/* Butter-Yellow Tufted Crest / Cap */}
            <path
              d="M180 88 C180 65 198 56 210 56 C222 56 240 65 240 88 Z"
              fill="#FDE047"
              stroke="#18181B"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />

            {/* Head Outer Shell */}
            <rect
              x="136"
              y="84"
              width="148"
              height="122"
              rx="58"
              fill="#115E59"
              stroke="#18181B"
              strokeWidth="2.5"
            />

            {/* Mineral Alabaster Faceplate */}
            <rect
              x="150"
              y="108"
              width="120"
              height="84"
              rx="38"
              fill="#F6F6F4"
              stroke="#18181B"
              strokeWidth="2.2"
            />

            {/* Expressive Tangelo Blush Cheeks */}
            <g
              className="large-companion-blush"
              style={{
                opacity: blushOpacity,
                transition: "opacity 200ms ease-out",
              }}
            >
              <ellipse cx="167" cy="166" rx="9" ry="5" fill="#FF5A1F" />
              <ellipse cx="253" cy="166" rx="9" ry="5" fill="#FF5A1F" />
            </g>

            {/* Left & Right Eyebrows */}
            <path
              d="M168 124 Q182 118 196 124"
              fill="none"
              stroke="#18181B"
              strokeWidth="2.8"
              strokeLinecap="round"
              style={{
                transform: leftBrowTransformMap[state],
                transformOrigin: "182px 122px",
                transition: "transform 180ms cubic-bezier(0.23, 1, 0.32, 1)",
              }}
            />
            <path
              d="M224 124 Q238 118 252 124"
              fill="none"
              stroke="#18181B"
              strokeWidth="2.8"
              strokeLinecap="round"
              style={{
                transform: rightBrowTransformMap[state],
                transformOrigin: "238px 122px",
                transition: "transform 180ms cubic-bezier(0.23, 1, 0.32, 1)",
              }}
            />

            {/* Expressive Eyes */}
            <g className="large-companion-eyes">
              <circle
                cx="182"
                cy="146"
                r="14.5"
                fill="#FFFFFF"
                stroke="#18181B"
                strokeWidth="2.2"
              />
              <circle
                cx="238"
                cy="146"
                r="14.5"
                fill="#FFFFFF"
                stroke="#18181B"
                strokeWidth="2.2"
              />

              <g
                className="large-companion-pupils"
                style={{
                  transform: pupilTransformMap[state],
                  transition: "transform 160ms cubic-bezier(0.23, 1, 0.32, 1)",
                }}
              >
                {/* Left Pupil */}
                <circle cx="182" cy="146" r="6.2" fill="#18181B" />
                <circle cx="179.5" cy="143" r="2.1" fill="#FFFFFF" />

                {/* Right Pupil */}
                <circle cx="238" cy="146" r="6.2" fill="#18181B" />
                <circle cx="235.5" cy="143" r="2.1" fill="#FFFFFF" />
              </g>
            </g>

            {/* Distinct Mouth Expression */}
            {state === "typing-visible" ? (
              <path
                d="M193 168 Q210 187 227 168 Z"
                fill="#18181B"
                stroke="#18181B"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            ) : state === "focused-visible" ? (
              <path
                d="M194 171 Q210 182 226 167"
                fill="none"
                stroke="#18181B"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            ) : state === "typing-hidden" ? (
              <circle cx="210" cy="172" r="5" fill="#18181B" />
            ) : state === "focused-hidden" ? (
              <path
                d="M200 172 Q210 172 220 172"
                fill="none"
                stroke="#18181B"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M197 170 Q210 179 223 170"
                fill="none"
                stroke="#18181B"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            )}
          </g>
        </g>

        {/* Left Hand resting on foreground ledge */}
        <g
          className="large-companion-hand-left"
          style={{
            transform: leftHandTransformMap[state],
            transformOrigin: "148px 330px",
            transition: "transform 200ms cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          <rect
            x="128"
            y="319"
            width="40"
            height="22"
            rx="11"
            fill="#FDE047"
            stroke="#18181B"
            strokeWidth="2.4"
          />
        </g>

        {/* Right Hand (lifts playfully when caught peeking) */}
        <g
          className="large-companion-hand-right"
          style={{
            transform: rightHandTransformMap[state],
            transformOrigin: "272px 330px",
            transition: "transform 200ms cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          <rect
            x="252"
            y="319"
            width="40"
            height="22"
            rx="11"
            fill="#FDE047"
            stroke="#18181B"
            strokeWidth="2.4"
          />
        </g>
      </svg>
    </div>
  );
};
