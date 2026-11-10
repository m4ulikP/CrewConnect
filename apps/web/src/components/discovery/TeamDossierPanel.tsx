import React from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import type { TeamMemberRecord, TeamRecord } from "../../lib/api";
import { Avatar } from "../Avatar";
import { CapacityBadge } from "../CapacityBadge";
import { SeatSlotStrip } from "./SeatSlotStrip";

interface TeamDossierPanelProps {
  team: TeamRecord | null;
  hackathonTitle?: string;
  hackathonStatus?: "UPCOMING" | "ACTIVE" | "COMPLETED";
  roster: TeamMemberRecord[];
  loadingRoster: boolean;
  rosterError: string | null;
  onRetryRoster: () => void;
  myTeam: { team: TeamRecord; role: string } | null;
  isAuthenticated: boolean;
  isJoining: boolean;
  joinSuccess: string | null;
  joinError: string | null;
  onDirectJoin: (team: TeamRecord) => void;
  onOpenJoinRequest: () => void;
  onCloseMobileDetail: () => void;
}

export const TeamDossierPanel: React.FC<TeamDossierPanelProps> = ({
  team,
  hackathonTitle,
  hackathonStatus,
  roster,
  loadingRoster,
  rosterError,
  onRetryRoster,
  myTeam,
  isAuthenticated,
  isJoining,
  joinSuccess,
  joinError,
  onDirectJoin,
  onOpenJoinRequest,
  onCloseMobileDetail,
}) => {
  if (!team) {
    return (
      <div className="bg-surface border border-border-subtle rounded-lg p-10 text-center space-y-3">
        <div className="w-10 h-10 rounded-md bg-surface-tonal border border-border-subtle text-ink-secondary flex items-center justify-center mx-auto">
          <Users className="w-5 h-5" aria-hidden="true" />
        </div>
        <h2 className="font-display text-base font-semibold text-ink-primary">
          Inspect a Squad Dossier
        </h2>
        <p className="text-xs text-ink-secondary max-w-sm mx-auto leading-relaxed">
          Select any squad from the directory to review its mission, needed capabilities, confirmed
          roster, and live seat allocation.
        </p>
      </div>
    );
  }

  const isFull = team.memberCount >= team.maxCapacity;
  const isUserInSelected = Boolean(myTeam && myTeam.team.id === team.id);
  const isCommittedElsewhere = Boolean(myTeam && myTeam.team.id !== team.id);
  const isHackathonCompleted = hackathonStatus === "COMPLETED";
  const canApplyOrJoin =
    team.status === "ACTIVE" && team.isOpen && !isFull && !isHackathonCompleted;

  const leaderDisplay =
    typeof team.leaderId === "object" && team.leaderId !== null
      ? team.leaderId.displayName
      : team.leader?.displayName;

  return (
    <section
      aria-label={`Squad dossier for ${team.name}`}
      className="bg-surface border border-border-strong rounded-lg p-5 sm:p-6 space-y-5 lg:sticky lg:top-20"
    >
      {/* Mobile back trigger */}
      <button
        type="button"
        onClick={onCloseMobileDetail}
        className="lg:hidden inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink-primary py-1 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Back to team list</span>
      </button>

      {/* Dossier Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-border-subtle">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span>Squad Dossier</span>
            {hackathonTitle && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-ink-secondary">{hackathonTitle}</span>
              </>
            )}
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-ink-primary leading-tight">
            {team.name}
          </h2>
          {leaderDisplay && (
            <p className="text-xs text-ink-secondary">
              Led by <span className="font-medium text-ink-primary">{leaderDisplay}</span>
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

      {/* Mission & Vision */}
      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold text-ink-secondary">Mission & Focus</h3>
        <p className="text-sm text-ink-secondary leading-relaxed">
          {team.description || team.tagline || "No mission statement specified for this squad yet."}
        </p>
      </div>

      {/* Seeking Capabilities */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-ink-secondary">Seeking Capabilities</h3>
        {team.skillsNeeded && team.skillsNeeded.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {team.skillsNeeded.map((skill) => (
              <span
                key={skill}
                className="text-xs px-2.5 py-1 rounded-sm bg-surface-tonal border border-border-subtle font-medium text-ink-primary"
              >
                {skill}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-muted">No specific skill tags listed.</p>
        )}
      </div>

      {/* Confirmed Roster */}
      <div className="space-y-2.5 pt-3 border-t border-border-subtle">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-ink-secondary">Confirmed Roster</h3>
          <span className="text-xs text-ink-muted tabular">
            {rosterError ? "—" : `${roster.length} / ${team.maxCapacity}`}
          </span>
        </div>

        {loadingRoster ? (
          <div className="space-y-2 py-1" aria-busy="true">
            <div className="h-9 rounded bg-surface-tonal" />
            <div className="h-9 rounded bg-surface-tonal" />
          </div>
        ) : rosterError ? (
          <div className="p-3 rounded-md border border-border-subtle bg-surface-hover flex items-center justify-between gap-3 text-xs">
            <span className="text-danger">{rosterError}</span>
            <button
              type="button"
              onClick={onRetryRoster}
              className="inline-flex items-center gap-1 font-semibold text-accent hover:underline cursor-pointer flex-shrink-0"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        ) : roster.length === 0 ? (
          <p className="text-xs text-ink-muted py-1">No active members returned for this roster.</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {roster.map((member) => {
              const mUser = typeof member.userId === "object" ? member.userId : null;
              const mName = mUser ? mUser.displayName : "Squad Member";
              const mSkills = mUser?.skills?.slice(0, 3) || [];
              const isLeader = member.role === "LEADER";

              return (
                <div
                  key={member.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={mName} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink-primary truncate">{mName}</span>
                        {isLeader && (
                          <span className="text-[11px] font-semibold text-accent bg-accent-tint px-1.5 py-0.5 rounded-sm">
                            Lead
                          </span>
                        )}
                      </div>
                      {mSkills.length > 0 && (
                        <p className="text-[11px] text-ink-muted truncate">{mSkills.join(" · ")}</p>
                      )}
                    </div>
                  </div>

                  <span className="text-ink-muted tabular text-[11px] flex-shrink-0">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Seat Allocation & Authoritative Join Actions */}
      <div className="p-4 rounded-lg border border-border-subtle bg-surface-tonal space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ink-primary">Seat Allocation</span>
          <span className="text-ink-secondary tabular">
            Server confirmed: {team.memberCount} / {team.maxCapacity}
          </span>
        </div>

        {joinSuccess && (
          <div
            role="status"
            className="p-3 rounded-md border border-[#BBF7D0] bg-positive-bg flex items-start gap-2 text-xs text-positive"
          >
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>{joinSuccess}</div>
          </div>
        )}

        {joinError && (
          <div
            role="alert"
            className="p-3 rounded-md border border-[#FCA5A5] bg-danger-bg flex items-start gap-2 text-xs text-danger"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>{joinError}</div>
          </div>
        )}

        {isUserInSelected ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-xs font-semibold text-accent">
              You are a confirmed member of this squad.
            </span>
            <Link to={`/teams/${team.id}`} className="btn btn-primary text-xs h-9 px-4">
              Open Workspace
            </Link>
          </div>
        ) : isCommittedElsewhere && myTeam ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-ink-secondary">
              You are already committed to <strong>{myTeam.team.name}</strong> in this hackathon.
            </p>
            <Link to={`/teams/${myTeam.team.id}`} className="btn btn-secondary text-xs h-9 px-3.5">
              View Your Squad
            </Link>
          </div>
        ) : isHackathonCompleted ? (
          <p className="text-xs text-ink-muted">
            This hackathon has completed and is no longer accepting team changes.
          </p>
        ) : isFull ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">
              This squad has reached maximum capacity ({team.maxCapacity} seats filled).
            </p>
            <Link to={`/teams/${team.id}`} className="btn btn-secondary text-xs h-9 px-3.5">
              <span>Open Dossier</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>
        ) : !team.isOpen ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">
              This squad is currently closed to new applications.
            </p>
            <Link to={`/teams/${team.id}`} className="btn btn-secondary text-xs h-9 px-3.5">
              <span>Open Dossier</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onDirectJoin(team)}
              disabled={isJoining || !canApplyOrJoin}
              className="btn btn-primary text-xs h-10 px-4 cursor-pointer"
            >
              {isJoining ? (
                <>
                  <div
                    className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  <span>Claiming seat...</span>
                </>
              ) : (
                <span>Instant direct join</span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenJoinRequest}
              disabled={!canApplyOrJoin}
              className="btn btn-secondary text-xs h-10 px-4 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Request to join</span>
            </button>

            <Link to={`/teams/${team.id}`} className="btn btn-ghost text-xs h-10 px-3 ml-auto">
              <span>Full Dossier</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>
        )}

        <p className="text-[11px] text-ink-muted leading-relaxed">
          {isAuthenticated
            ? "Direct join sends an Idempotency-Key and confirms seat reservation on the server before updating occupancy."
            : "Sign in when ready to reserve an open seat or submit an application with an Idempotency-Key."}
        </p>
      </div>
    </section>
  );
};
