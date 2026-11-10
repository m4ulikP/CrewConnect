import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, RefreshCw, UserCheck } from "lucide-react";
import type { UserDTO } from "@crewconnect/shared";
import type { HackathonRecord, TeamRecord } from "../../lib/api";

interface DashboardHeaderProps {
  user: UserDTO;
  hackathons: HackathonRecord[];
  selectedHackathon: HackathonRecord | null;
  onSelectHackathon: (hackathonId: string) => void;
  myTeam: { team: TeamRecord; role: string } | null;
  loadingTeam: boolean;
  onOpenCreateTeam: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  user,
  hackathons,
  selectedHackathon,
  onSelectHackathon,
  myTeam,
  loadingTeam,
  onOpenCreateTeam,
  onRefresh,
  isRefreshing,
}) => {
  const greeting = getTimeGreeting();
  const isCompleted = selectedHackathon?.status === "COMPLETED";

  let statusSentence = "Loading your hackathon team-formation status...";
  if (!loadingTeam) {
    if (myTeam) {
      const roleLabel = myTeam.role === "LEADER" ? "leading" : "contributing on";
      statusSentence = `You are currently ${roleLabel} ${myTeam.team.name} (${myTeam.team.memberCount} of ${myTeam.team.maxCapacity} seats filled).`;
    } else if (isCompleted) {
      statusSentence = "This hackathon window has closed and team formation is read-only.";
    } else {
      statusSentence =
        "You are not yet committed to a squad in this hackathon. Join an open crew or launch your own.";
    }
  }

  return (
    <header className="pb-5 border-b border-border-subtle space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl sm:text-[28px] font-medium text-ink-primary tracking-tight leading-snug">
            {greeting}, {user.displayName}
          </h1>
          <p className="text-[13px] sm:text-sm text-ink-secondary max-w-2xl leading-relaxed">
            {statusSentence}
          </p>
        </div>

        {/* Context-Aware Primary Next Action & Profile Shortcut */}
        <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh dashboard data"
            className="btn btn-secondary h-10 px-3 text-[13px]"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>

          <Link to="/profile" className="btn btn-secondary h-10 px-3.5 text-[13px]">
            <UserCheck className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            <span>Profile</span>
          </Link>

          {myTeam ? (
            <Link to={`/teams/${myTeam.team.id}`} className="btn btn-primary h-10 px-4 text-[13px]">
              <span>Open Squad Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <>
              <Link
                to={
                  selectedHackathon
                    ? `/teams-preview?hackathon=${encodeURIComponent(selectedHackathon.id)}`
                    : "/teams-preview"
                }
                className="btn btn-secondary h-10 px-4 text-[13px]"
              >
                <span>Browse Teams</span>
              </Link>
              <button
                type="button"
                onClick={onOpenCreateTeam}
                disabled={isCompleted || !selectedHackathon}
                className="btn btn-primary h-10 px-4 text-[13px]"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Create a Team</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Event Context Bar */}
      {selectedHackathon && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {hackathons.length > 1 ? (
              <div className="flex items-center gap-2">
                <label htmlFor="dashboard-hackathon-select" className="text-ink-muted font-medium">
                  Event scope:
                </label>
                <select
                  id="dashboard-hackathon-select"
                  value={selectedHackathon.id}
                  onChange={(e) => onSelectHackathon(e.target.value)}
                  className="form-input !h-8 !w-auto !py-0 !px-2.5 text-xs font-medium bg-surface"
                >
                  {hackathons.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.title} ({h.status})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-surface-tonal border border-border-subtle text-ink-primary font-medium">
                <span>{selectedHackathon.title}</span>
              </span>
            )}

            <span
              className={`status-label ${
                selectedHackathon.status === "ACTIVE"
                  ? "status-open"
                  : selectedHackathon.status === "UPCOMING"
                    ? "status-warning"
                    : "status-full"
              }`}
            >
              {selectedHackathon.status}
            </span>
          </div>

          <span className="text-ink-muted tabular">
            Squad cap: {selectedHackathon.minTeamSize}-{selectedHackathon.maxTeamSize} members
          </span>
        </div>
      )}
    </header>
  );
};
