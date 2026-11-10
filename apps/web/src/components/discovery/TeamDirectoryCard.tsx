import React from "react";
import { ChevronRight } from "lucide-react";
import type { TeamRecord } from "../../lib/api";
import { CapacityBadge } from "../CapacityBadge";
import { SeatSlotStrip } from "./SeatSlotStrip";

interface TeamDirectoryCardProps {
  team: TeamRecord;
  isSelected: boolean;
  isMyTeam: boolean;
  onSelect: () => void;
}

export const TeamDirectoryCard: React.FC<TeamDirectoryCardProps> = ({
  team,
  isSelected,
  isMyTeam,
  onSelect,
}) => {
  const isFull = team.memberCount >= team.maxCapacity;
  const isAccepting = team.isOpen && !isFull && team.status === "ACTIVE";
  const remaining = Math.max(0, team.maxCapacity - team.memberCount);
  const leaderName =
    typeof team.leaderId === "object" && team.leaderId !== null
      ? team.leaderId.displayName
      : team.leader?.displayName;

  const visibleSkills = team.skillsNeeded.slice(0, 4);
  const extraSkillsCount = Math.max(0, team.skillsNeeded.length - visibleSkills.length);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`w-full text-left p-4 rounded-lg border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        isSelected
          ? "bg-surface-hover border-ink-primary border-l-4 border-l-accent"
          : "bg-surface border-border-subtle hover:border-border-strong hover:bg-surface-hover"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display font-semibold text-ink-primary text-[15px] leading-snug truncate">
              {team.name}
            </h2>
            {isMyTeam && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-sm bg-highlight border border-ink-primary text-ink-primary">
                Your Squad
              </span>
            )}
          </div>
          {team.tagline && (
            <p className="text-[13px] text-ink-secondary mt-1 line-clamp-2 leading-relaxed">
              {team.tagline}
            </p>
          )}
        </div>

        <CapacityBadge
          memberCount={team.memberCount}
          maxCapacity={team.maxCapacity}
          isOpen={team.isOpen}
        />
      </div>

      {/* Needed Skills Preview */}
      {visibleSkills.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {visibleSkills.map((skill) => (
            <span
              key={skill}
              className="text-[11px] font-medium px-2 py-0.5 rounded-sm bg-surface-tonal border border-border-subtle text-ink-secondary"
            >
              {skill}
            </span>
          ))}
          {extraSkillsCount > 0 && (
            <span className="text-[11px] text-ink-muted tabular px-1">+{extraSkillsCount}</span>
          )}
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3 min-w-0">
          <SeatSlotStrip
            memberCount={team.memberCount}
            maxCapacity={team.maxCapacity}
            isOpen={team.isOpen}
            compact
          />
          <span
            className={`font-semibold ${
              isAccepting ? (remaining === 1 ? "text-warning" : "text-positive") : "text-ink-muted"
            }`}
          >
            {isAccepting ? "Open for Join" : isFull ? "Full Roster" : "Closed"}
          </span>
          {leaderName && (
            <span className="text-[11px] text-ink-muted truncate hidden sm:inline">
              Lead: {leaderName}
            </span>
          )}
        </div>

        <span className="inline-flex items-center gap-1 text-xs text-accent font-semibold">
          <span>{isSelected ? "Inspecting" : "Inspect"}</span>
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </div>
    </button>
  );
};
