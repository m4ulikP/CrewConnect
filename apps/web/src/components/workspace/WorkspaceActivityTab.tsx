import React from "react";
import {
  History,
  ShieldAlert,
  UserPlus,
  UserMinus,
  ShieldCheck,
  Settings,
  FileText,
} from "lucide-react";
import type { AuditLogRecord } from "../../lib/api";
import type { WorkspaceUserRole } from "./WorkspaceHeader";

interface WorkspaceActivityTabProps {
  userRole: WorkspaceUserRole;
  auditLogs: AuditLogRecord[];
}

export const WorkspaceActivityTab: React.FC<WorkspaceActivityTabProps> = ({
  userRole,
  auditLogs,
}) => {
  const isMemberOrLeader = userRole === "leader" || userRole === "member";

  if (!isMemberOrLeader) {
    return (
      <div className="bg-surface border border-border-subtle rounded-lg p-8 text-center space-y-3 pane-enter">
        <div className="w-10 h-10 rounded-full bg-surface-tonal border border-border-strong text-ink-secondary mx-auto flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-ink-muted" />
        </div>
        <h3 className="text-base font-serif font-medium text-ink-primary">
          Restricted to Squad Members
        </h3>
        <p className="text-xs text-ink-secondary max-w-sm mx-auto">
          Audit activity logs and squad transaction history are only visible to confirmed team
          members.
        </p>
      </div>
    );
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case "MEMBER_JOINED":
      case "INVITATION_ACCEPTED":
      case "JOIN_REQUEST_APPROVED":
        return <UserPlus className="w-3.5 h-3.5 text-positive" />;
      case "MEMBER_LEFT":
      case "MEMBER_REMOVED":
        return <UserMinus className="w-3.5 h-3.5 text-danger" />;
      case "LEADERSHIP_TRANSFERRED":
        return <ShieldCheck className="w-3.5 h-3.5 text-accent" />;
      case "TEAM_UPDATED":
      case "CAPACITY_UPDATED":
        return <Settings className="w-3.5 h-3.5 text-ink-secondary" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-ink-muted" />;
    }
  };

  return (
    <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-6 pane-enter shadow-xs">
      {/* Header */}
      <div className="pb-4 border-b border-border-subtle">
        <h2 className="text-base font-serif font-medium text-ink-primary">
          Audit Activity History (<span className="tabular">{auditLogs.length}</span>)
        </h2>
        <p className="text-xs text-ink-secondary mt-0.5">
          Immutable event stream recorded with transactional guarantees.
        </p>
      </div>

      {/* Log Feed */}
      {auditLogs.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <History className="w-8 h-8 text-ink-muted mx-auto stroke-1" />
          <h3 className="text-sm font-medium text-ink-primary">No activity recorded</h3>
          <p className="text-xs text-ink-secondary max-w-xs mx-auto">
            Lifecycle actions taken within the squad workspace will be preserved here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle text-xs">
          {auditLogs.map((log) => {
            const actorName =
              typeof log.actorId === "object" && log.actorId !== null
                ? log.actorId.displayName
                : "Squad Member";

            const actionLabel = log.action.toLowerCase().replace(/_/g, " ");

            return (
              <div key={log.id} className="py-3.5 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-surface-tonal border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
                    {getActionIcon(log.action)}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <p className="text-ink-primary">
                      <span className="font-semibold">{actorName}</span>{" "}
                      <span className="text-ink-secondary">{actionLabel}</span>
                    </p>

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <p className="text-[11px] font-mono text-ink-muted truncate">
                        {" "}
                        {/* taste-skill-ignore */}
                        {JSON.stringify(log.metadata)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right text-[11px] text-ink-muted tabular shrink-0">
                  <div>
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
