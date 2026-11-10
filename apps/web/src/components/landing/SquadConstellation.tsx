import React, { useState } from "react";
import { Avatar } from "../Avatar";

interface BuilderNode {
  id: string;
  name: string;
  role: string;
  skill: string;
  avatarVariant: "pine" | "ochre" | "slate" | "clay";
  status: "Locked" | "Open Position";
  detail: string;
}

const CONSTELLATION_NODES: BuilderNode[] = [
  {
    id: "maya",
    name: "Maya Lin",
    role: "Squad Leader · Edge Runtime",
    skill: "Rust & QUIC",
    avatarVariant: "pine",
    status: "Locked",
    detail: "Seat 1 reserved at squad initialization (UTC-5).",
  },
  {
    id: "arjun",
    name: "Arjun Nair",
    role: "Inference & Data",
    skill: "PyTorch",
    avatarVariant: "ochre",
    status: "Locked",
    detail: "Seat 2 joined via invitation token (UTC+5:30).",
  },
  {
    id: "sofia",
    name: "Sofia Reyes",
    role: "Design Systems",
    skill: "TypeScript UI",
    avatarVariant: "slate",
    status: "Locked",
    detail: "Seat 3 approved from join request (UTC+1).",
  },
  {
    id: "open-seat",
    name: "Seat 4 Open",
    role: "Seeking Sync Engineer",
    skill: "WebRTC / CRDT",
    avatarVariant: "clay",
    status: "Open Position",
    detail: "1 remaining capacity slot. Eligible for atomic direct join.",
  },
];

export const SquadConstellation: React.FC = () => {
  const [activeId, setActiveId] = useState<string>("open-seat");
  const activeNode =
    CONSTELLATION_NODES.find((node) => node.id === activeId) ?? CONSTELLATION_NODES[3];

  return (
    <div
      data-ui="squad-constellation"
      className="relative bg-surface border border-border-subtle rounded-[10px] p-5 sm:p-6 overflow-hidden"
    >
      {/* Top Header Strip */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-border-subtle">
        <div>
          <p className="text-[13px] font-medium text-ink-muted">
            Illustrative Squad Formation
          </p>
          <p className="font-serif text-lg font-medium text-ink-primary">
            Helios Mesh — Edge Mesh Track
          </p>
        </div>
        <span className="status-label status-open tabular">3 / 4 seats filled</span>
      </div>

      {/* Asymmetric Constellation Map */}
      <div className="relative py-6 sm:py-8">
        {/* SVG Connecting Paths (Desktop & Tablet visual lattice) */}
        <svg
          aria-hidden="true"
          viewBox="0 0 480 230"
          className="hidden sm:block absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="none"
        >
          {/* Maya (top-left) -> Center */}
          <path
            d="M 110 48 C 165 48, 185 112, 240 115"
            fill="none"
            stroke={activeId === "maya" ? "#115E59" : "#CFCBC2"}
            strokeWidth={activeId === "maya" ? "2" : "1.5"}
            className="transition-colors duration-200"
          />
          {/* Arjun (bottom-left) -> Center */}
          <path
            d="M 110 182 C 165 182, 185 120, 240 115"
            fill="none"
            stroke={activeId === "arjun" ? "#115E59" : "#CFCBC2"}
            strokeWidth={activeId === "arjun" ? "2" : "1.5"}
            className="transition-colors duration-200"
          />
          {/* Sofia (top-right) -> Center */}
          <path
            d="M 370 48 C 315 48, 295 112, 240 115"
            fill="none"
            stroke={activeId === "sofia" ? "#115E59" : "#CFCBC2"}
            strokeWidth={activeId === "sofia" ? "2" : "1.5"}
            className="transition-colors duration-200"
          />
          {/* Seat 4 Open (bottom-right) -> Center */}
          <path
            d="M 370 182 C 315 182, 295 120, 240 115"
            fill="none"
            stroke="#115E59"
            strokeWidth={activeId === "open-seat" ? "2.25" : "1.5"}
            strokeDasharray="6 5"
            className="constellation-dash-flow transition-[stroke,stroke-width] duration-200"
          />
          {/* Center Anchor Point */}
          <circle cx="240" cy="115" r="5" fill="#115E59" />
          <circle cx="240" cy="115" r="11" fill="none" stroke="#115E59" strokeOpacity="0.22" />
        </svg>

        {/* 2x2 Builder Nodes Grid flanking Center Core */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-y-12 sm:gap-x-10">
          {CONSTELLATION_NODES.map((node, index) => {
            const isSelected = node.id === activeId;
            const isOpen = node.status === "Open Position";

            return (
              <button
                key={node.id}
                type="button"
                onMouseEnter={() => setActiveId(node.id)}
                onFocus={() => setActiveId(node.id)}
                onClick={() => setActiveId(node.id)}
                style={{ animationDelay: `${120 + index * 70}ms` }}
                className={`reveal-line text-left rounded-md p-3 transition-transform duration-150 cursor-pointer active:scale-[0.98] ${
                  isOpen
                    ? isSelected
                      ? "bg-accent-tint border border-accent"
                      : "bg-surface border border-dashed border-accent/70 hover:bg-accent-tint/60"
                    : isSelected
                      ? "bg-surface-tonal border border-border-control"
                      : "bg-surface border border-border-subtle hover:bg-surface-hover"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {isOpen ? (
                    <span className="avatar border border-dashed border-accent text-accent bg-surface font-semibold">
                      +1
                    </span>
                  ) : (
                    <Avatar name={node.name} size="sm" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-primary truncate">
                      {node.name}
                    </p>
                    <p className="text-[13px] text-ink-secondary truncate">
                      {node.skill}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Node Inspection Readout */}
      <div className="bg-surface-tonal rounded-md px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink-primary">
            {activeNode.role}
          </p>
          <p className="text-[13px] text-ink-secondary leading-snug">
            {activeNode.detail}
          </p>
        </div>
        <span
          className={`status-label self-start sm:self-center ${
            activeNode.status === "Open Position" ? "status-open" : "status-full"
          }`}
        >
          {activeNode.status}
        </span>
      </div>
    </div>
  );
};
