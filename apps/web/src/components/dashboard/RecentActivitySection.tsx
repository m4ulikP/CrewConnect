import React from "react";
import { AlertCircle, History, RefreshCw } from "lucide-react";
import type { AuditLogRecord, TeamRecord } from "../../lib/api";
import { DashboardSectionSkeleton } from "./DashboardSectionSkeleton";

interface RecentActivitySectionProps {
  myTeam: { team: TeamRecord; role: string } | null;
  logs: AuditLogRecord[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  TEAM_CREATED: "created this squad",
  TEAM_UPDATED: "updated squad details",
  TEAM_OPENED: "opened recruitment",
  TEAM_CLOSED: "paused recruitment",
  TEAM_DISBANDED: "disbanded the squad",
  MEMBER_JOINED: "joined the squad",
  MEMBER_LEFT: "left the squad",
  MEMBER_REMOVED: "removed a member",
  LEADERSHIP_TRANSFERRED: "transferred leadership",
  INVITE_CREATED: "generated an invitation link",
  INVITE_REDEEMED: "joined via invitation token",
  INVITE_REVOKED: "revoked an invitation",
  JOIN_REQUEST_SUBMITTED: "submitted a join request",
  JOIN_REQUEST_APPROVED: "approved a join request",
  JOIN_REQUEST_REJECTED: "declined a join request",
  JOIN_REQUEST_CANCELLED: "cancelled a join request",
  COUNTER_RECONCILED: "reconciled squad occupancy",
};

function formatAuditAction(action: string): string {
  return ACTION_LABELS[action] || action.toLowerCase().replace(/_/g, " ");
}

export const RecentActivitySection: React.FC<RecentActivitySectionProps> = ({
  myTeam,
  logs,
  loading,
  error,
  onRetry,
}) => {
  return (
    <section
      aria-labelledby="recent-activity-heading"
      className="bg-surface border border-border-subtle rounded-lg p-5 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="recent-activity-heading" className="text-base font-semibold text-ink-primary">
          Recent Squad Activity
        </h2>
        <span className="text-xs text-ink-muted">Persisted audit trail</span>
      </div>

      {!myTeam ? (
        <div className="py-4 text-center space-y-1.5">
          <History className="w-5 h-5 text-ink-muted mx-auto" aria-hidden="true" />
          <p className="text-xs text-ink-secondary leading-relaxed">
            Persisted activity records are scoped to confirmed squad memberships and will appear
            here once you join or create a team.
          </p>
        </div>
      ) : loading ? (
        <DashboardSectionSkeleton rows={3} label="Loading recent squad activity" />
      ) : error ? (
        <div
          role="alert"
          className="p-3 rounded-md border border-border-subtle bg-surface-hover flex items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-2 text-danger">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 font-semibold text-accent hover:underline cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      ) : logs.length === 0 ? (
        <p className="text-xs text-ink-muted py-3 text-center">
          No persisted events recorded for {myTeam.team.name} yet.
        </p>
      ) : (
        <div className="divide-y divide-border-subtle text-xs">
          {logs.map((log) => {
            const actorName =
              typeof log.actorId === "object" && log.actorId !== null
                ? log.actorId.displayName
                : "Squad member";
            const timestamp = new Date(log.timestamp);
            return (
              <div key={log.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0 leading-relaxed">
                  <span className="font-semibold text-ink-primary">{actorName}</span>{" "}
                  <span className="text-ink-secondary">{formatAuditAction(log.action)}</span>
                </div>
                <span className="text-ink-muted tabular flex-shrink-0">
                  {timestamp.toLocaleDateString()} ·{" "}
                  {timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
