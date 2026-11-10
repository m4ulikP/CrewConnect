import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import type { TeamMemberRecord, TeamRecord } from "../../lib/api";
import { Avatar } from "../Avatar";
import { CapacityBadge } from "../CapacityBadge";
import { SeatSlotStrip } from "../discovery/SeatSlotStrip";

interface SquadSummaryCardProps {
  team: TeamRecord;
  role: string;
  hackathonTitle?: string;
  roster: TeamMemberRecord[];
  loadingRoster: boolean;
  rosterError: string | null;
  onRetryRoster: () => void;
}

export const SquadSummaryCard: React.FC<SquadSummaryCardProps> = ({
  team,
  role,
  hackathonTitle,
  roster,
  loadingRoster,
  rosterError,
  onRetryRoster,
}) => {
  const isFull = team.memberCount >= team.maxCapacity;
  const isAccepting = team.isOpen && !isFull && team.status === "ACTIVE";
  const isLeader = role === "LEADER";

  return (
    <article className="rounded-lg border border-border-strong bg-surface p-5 sm:p-6 space-y-5">
      {/* Top Meta & Capacity */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-border-subtle">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`px-2 py-0.5 rounded-sm font-semibold ${
                isLeader
                  ? "bg-highlight border border-ink-primary text-ink-primary"
                  : "bg-accent-tint text-accent border border-[#C5E0DC]"
              }`}
            >
              {isLeader ? "Team Leader" : "Team Member"}
            </span>
            <span
              className={`status-label ${
                isAccepting ? "status-open" : isFull ? "status-full" : "status-warning"
              }`}
            >
              {isAccepting ? "Accepting Members" : isFull ? "Full Roster" : "Closed to Joins"}
            </span>
            {hackathonTitle && (
              <span className="text-ink-muted truncate max-w-[220px]">{hackathonTitle}</span>
            )}
          </div>

          <h3 className="font-display text-xl sm:text-2xl font-bold text-ink-primary tracking-tight">
            {team.name}
          </h3>
          {team.tagline && (
            <p className="text-[13px] sm:text-sm text-ink-secondary leading-relaxed">
              {team.tagline}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
          <CapacityBadge
            memberCount={team.memberCount}
            maxCapacity={team.maxCapacity}
            isOpen={team.isOpen}
            variant="indicator"
          />
          <SeatSlotStrip
            memberCount={team.memberCount}
            maxCapacity={team.maxCapacity}
            isOpen={team.isOpen}
            compact
          />
        </div>
      </div>

      {/* Needed Skills */}
      {team.skillsNeeded && team.skillsNeeded.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-ink-secondary block">Seeking Skills</span>
          <div className="flex flex-wrap gap-1.5">
            {team.skillsNeeded.map((skill) => (
              <span
                key={skill}
                className="text-xs px-2.5 py-0.5 rounded-sm bg-surface-tonal border border-border-subtle text-ink-primary font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Confirmed Roster Preview */}
      <div className="space-y-2.5 pt-2 border-t border-border-subtle">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ink-secondary">Confirmed Squad Roster</span>
          <span className="text-ink-muted tabular">
            {rosterError ? "—" : `${roster.length} / ${team.maxCapacity} active`}
          </span>
        </div>

        {loadingRoster ? (
          <div className="space-y-2" aria-busy="true">
            <div className="h-9 rounded bg-surface-tonal" />
            <div className="h-9 rounded bg-surface-tonal" />
          </div>
        ) : rosterError ? (
          <div
            role="alert"
            className="p-3 rounded-md border border-border-subtle bg-surface-hover flex items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-2 text-danger">
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>{rosterError}</span>
            </div>
            <button
              type="button"
              onClick={onRetryRoster}
              className="inline-flex items-center gap-1 font-semibold text-accent hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        ) : roster.length === 0 ? (
          <p className="text-xs text-ink-muted">No active member details available yet.</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {roster.map((member) => {
              const mUser = typeof member.userId === "object" ? member.userId : null;
              const mName = mUser ? mUser.displayName : "Squad Member";
              return (
                <div
                  key={member.id}
                  className="py-2 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={mName} size="sm" />
                    <span className="font-medium text-ink-primary truncate">{mName}</span>
                    {member.role === "LEADER" && (
                      <span className="text-[11px] font-semibold text-accent bg-accent-tint px-1.5 py-0.5 rounded-sm">
                        Lead
                      </span>
                    )}
                  </div>
                  <span className="text-ink-muted tabular flex-shrink-0">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Workspace Action */}
      <div className="pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-ink-muted">
          Manage roster, invites, and recruitment settings in your team workspace.
        </span>
        <Link to={`/teams/${team.id}`} className="btn btn-primary h-9 px-4 text-[13px]">
          <span>Open Workspace</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
};
