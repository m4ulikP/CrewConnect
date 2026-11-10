import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Key, Plus, Search, User } from "lucide-react";
import type { HackathonRecord, TeamRecord } from "../../lib/api";

interface DashboardQuickActionsProps {
  selectedHackathon: HackathonRecord | null;
  myTeam: { team: TeamRecord; role: string } | null;
  onOpenCreateTeam: () => void;
  onOpenRedeemInvite: () => void;
}

export const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = ({
  selectedHackathon,
  myTeam,
  onOpenCreateTeam,
  onOpenRedeemInvite,
}) => {
  const isCompleted = selectedHackathon?.status === "COMPLETED";

  return (
    <section
      aria-labelledby="quick-actions-heading"
      className="bg-surface border border-border-subtle rounded-lg p-5 space-y-3"
    >
      <h2 id="quick-actions-heading" className="text-base font-semibold text-ink-primary">
        Quick Actions
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[13px]">
        <Link
          to={
            selectedHackathon
              ? `/teams-preview?hackathon=${encodeURIComponent(selectedHackathon.id)}`
              : "/teams-preview"
          }
          className="flex items-center justify-between gap-2 p-3 rounded-md border border-border-subtle bg-surface-hover hover:border-border-strong transition-colors font-medium text-ink-primary"
        >
          <span className="inline-flex items-center gap-2">
            <Search className="w-4 h-4 text-accent" aria-hidden="true" />
            <span>Discover Squads</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />
        </Link>

        {myTeam ? (
          <Link
            to={`/teams/${myTeam.team.id}`}
            className="flex items-center justify-between gap-2 p-3 rounded-md border border-border-subtle bg-surface-hover hover:border-border-strong transition-colors font-medium text-ink-primary"
          >
            <span className="inline-flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Team Workspace</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onOpenCreateTeam}
            disabled={isCompleted || !selectedHackathon}
            className="flex items-center justify-between gap-2 p-3 rounded-md border border-border-subtle bg-surface-hover hover:border-border-strong transition-colors font-medium text-ink-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-left"
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Create a Team</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenRedeemInvite}
          disabled={Boolean(myTeam) || isCompleted}
          className="flex items-center justify-between gap-2 p-3 rounded-md border border-border-subtle bg-surface-hover hover:border-border-strong transition-colors font-medium text-ink-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-left"
        >
          <span className="inline-flex items-center gap-2">
            <Key className="w-4 h-4 text-accent" aria-hidden="true" />
            <span>Redeem Invite</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />
        </button>

        <Link
          to="/profile"
          className="flex items-center justify-between gap-2 p-3 rounded-md border border-border-subtle bg-surface-hover hover:border-border-strong transition-colors font-medium text-ink-primary"
        >
          <span className="inline-flex items-center gap-2">
            <User className="w-4 h-4 text-accent" aria-hidden="true" />
            <span>View Profile</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
};
