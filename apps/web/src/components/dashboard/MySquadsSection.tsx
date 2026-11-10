import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Key, Plus, RefreshCw, Search, Users } from "lucide-react";
import type { HackathonRecord, TeamMemberRecord, TeamRecord } from "../../lib/api";
import { CapacityBadge } from "../CapacityBadge";
import { DashboardEmptyState } from "./DashboardEmptyState";
import { DashboardSectionSkeleton } from "./DashboardSectionSkeleton";
import { SquadSummaryCard } from "./SquadSummaryCard";

interface MySquadsSectionProps {
  selectedHackathon: HackathonRecord | null;
  myTeam: { team: TeamRecord; role: string } | null;
  loadingTeam: boolean;
  teamError: string | null;
  onRetryTeam: () => void;
  roster: TeamMemberRecord[];
  loadingRoster: boolean;
  rosterError: string | null;
  onRetryRoster: () => void;
  openSquads: TeamRecord[];
  loadingOpenSquads: boolean;
  openSquadsError: string | null;
  onRetryOpenSquads: () => void;
  onOpenCreateTeam: () => void;
  onOpenRedeemInvite: () => void;
}

export const MySquadsSection: React.FC<MySquadsSectionProps> = ({
  selectedHackathon,
  myTeam,
  loadingTeam,
  teamError,
  onRetryTeam,
  roster,
  loadingRoster,
  rosterError,
  onRetryRoster,
  openSquads,
  loadingOpenSquads,
  openSquadsError,
  onRetryOpenSquads,
  onOpenCreateTeam,
  onOpenRedeemInvite,
}) => {
  const isCompleted = selectedHackathon?.status === "COMPLETED";
  const peerOpenSquads = myTeam
    ? openSquads.filter((squad) => squad.id !== myTeam.team.id)
    : openSquads;

  return (
    <section aria-labelledby="my-squads-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="my-squads-heading" className="text-base font-semibold text-ink-primary">
          My Squads
        </h2>
        <span className="text-xs text-ink-muted">
          {selectedHackathon ? `Scope: ${selectedHackathon.title}` : "Single-hackathon scope"}
        </span>
      </div>

      {loadingTeam ? (
        <div className="bg-surface border border-border-subtle rounded-lg p-5">
          <DashboardSectionSkeleton rows={3} label="Loading active squad membership" />
        </div>
      ) : teamError ? (
        <div
          role="alert"
          className="bg-surface border border-border-strong rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]"
        >
          <div className="flex items-center gap-2 text-danger">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>{teamError}</span>
          </div>
          <button
            type="button"
            onClick={onRetryTeam}
            className="btn btn-secondary h-9 px-3.5 text-[13px] self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      ) : myTeam ? (
        <SquadSummaryCard
          team={myTeam.team}
          role={myTeam.role}
          hackathonTitle={selectedHackathon?.title}
          roster={roster}
          loadingRoster={loadingRoster}
          rosterError={rosterError}
          onRetryRoster={onRetryRoster}
        />
      ) : (
        <DashboardEmptyState
          icon={Users}
          title={
            selectedHackathon
              ? `No active squad in ${selectedHackathon.title}`
              : "No active squad in this hackathon"
          }
          description={
            selectedHackathon
              ? `You do not hold an active membership in ${selectedHackathon.title}. Memberships are queried one hackathon at a time — use Hackathon scope above to check other events, or find a squad here.`
              : "You do not hold an active team membership for the selected event yet. Explore squads with open seats, start your own team, or redeem an invitation token."
          }
        >
          <Link
            to={
              selectedHackathon
                ? `/teams-preview?hackathon=${encodeURIComponent(selectedHackathon.id)}&vacancies=true`
                : "/teams-preview?vacancies=true"
            }
            className="btn btn-primary h-9 px-4 text-[13px]"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Discover Open Squads</span>
          </Link>
          <button
            type="button"
            onClick={onOpenCreateTeam}
            disabled={isCompleted || !selectedHackathon}
            className="btn btn-secondary h-9 px-4 text-[13px]"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Create a Team</span>
          </button>
          <button
            type="button"
            onClick={onOpenRedeemInvite}
            disabled={isCompleted}
            className="btn btn-secondary h-9 px-4 text-[13px]"
          >
            <Key className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Redeem Token</span>
          </button>
        </DashboardEmptyState>
      )}

      {/* Open Squads Preview (shown alongside when user is open to join or discovering) */}
      <div className="bg-surface border border-border-subtle rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink-primary">Open Squads with Vacancies</h3>
          <Link
            to={
              selectedHackathon
                ? `/teams-preview?hackathon=${encodeURIComponent(selectedHackathon.id)}&vacancies=true`
                : "/teams-preview?vacancies=true"
            }
            className="text-xs font-semibold text-accent hover:underline"
          >
            View all in Discovery →
          </Link>
        </div>

        {loadingOpenSquads ? (
          <DashboardSectionSkeleton rows={2} label="Loading open squads preview" />
        ) : openSquadsError ? (
          <div
            role="alert"
            className="p-3 rounded-md border border-border-subtle bg-surface-hover flex items-center justify-between gap-2 text-xs"
          >
            <span className="text-danger">{openSquadsError}</span>
            <button
              type="button"
              onClick={onRetryOpenSquads}
              className="text-accent font-semibold hover:underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : peerOpenSquads.length === 0 ? (
          <p className="text-xs text-ink-muted py-2">
            No other teams with open vacancies were found for this hackathon yet.
          </p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {peerOpenSquads.map((squad) => (
              <div key={squad.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-[13px] text-ink-primary truncate">
                    {squad.name}
                  </div>
                  <p className="text-xs text-ink-secondary truncate">
                    {squad.tagline || "Looking for builders"}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <CapacityBadge
                    memberCount={squad.memberCount}
                    maxCapacity={squad.maxCapacity}
                    isOpen={squad.isOpen}
                  />
                  <Link
                    to={`/teams/${squad.id}`}
                    className="text-xs font-semibold text-accent hover:underline whitespace-nowrap"
                  >
                    Inspect
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
