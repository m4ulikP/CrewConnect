import React from "react";
import { ShieldAlert, Check, X, Clock, AlertCircle } from "lucide-react";
import type { JoinRequestRecord } from "../../lib/api";
import { Avatar } from "../Avatar";
import type { WorkspaceUserRole } from "./WorkspaceHeader";

interface WorkspaceRequestsTabProps {
  userRole: WorkspaceUserRole;
  joinRequests: JoinRequestRecord[];
  hasAvailableSeats: boolean;
  actionLoading: boolean;
  onApproveRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
}

export const WorkspaceRequestsTab: React.FC<WorkspaceRequestsTabProps> = ({
  userRole,
  joinRequests,
  hasAvailableSeats,
  actionLoading,
  onApproveRequest,
  onRejectRequest,
}) => {
  const isLeader = userRole === "leader";

  if (!isLeader) {
    return (
      <div className="bg-surface border border-border-subtle rounded-lg p-8 text-center space-y-3 pane-enter">
        <div className="w-10 h-10 rounded-full bg-surface-tonal border border-border-strong text-ink-secondary mx-auto flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-ink-muted" />
        </div>
        <h3 className="text-base font-serif font-medium text-ink-primary">
          Restricted to Squad Leader
        </h3>
        <p className="text-xs text-ink-secondary max-w-sm mx-auto">
          Incoming join applications and candidate dossiers can only be reviewed and resolved by the
          squad leader.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-6 pane-enter shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border-subtle">
        <div>
          <h2 className="text-base font-serif font-medium text-ink-primary">
            Incoming Join Applications (<span className="tabular">{joinRequests.length}</span>)
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Review candidate notes and approve additions to your squad roster.
          </p>
        </div>

        {!hasAvailableSeats && (
          <div className="flex items-center gap-1.5 text-xs text-warning bg-warning-bg px-2.5 py-1 rounded border border-[#FDE68A]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Roster full — approval disabled</span>
          </div>
        )}
      </div>

      {/* Requests List */}
      {joinRequests.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Clock className="w-8 h-8 text-ink-muted mx-auto stroke-1" />
          <h3 className="text-sm font-medium text-ink-primary">No pending applications</h3>
          <p className="text-xs text-ink-secondary max-w-xs mx-auto">
            When participants apply to join your squad, their submissions will appear here for
            review.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle">
          {joinRequests.map((req) => {
            const reqUser = typeof req.userId === "object" ? req.userId : null;
            const reqName = reqUser ? reqUser.displayName : "Applicant";

            return (
              <div key={req.id} className="py-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={reqName} size="md" />
                    <div>
                      <span className="font-semibold text-sm text-ink-primary">{reqName}</span>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary mt-0.5">
                        {reqUser?.email && <span>{reqUser.email}</span>}
                        {reqUser?.experienceLevel && (
                          <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted bg-surface-tonal px-1.5 py-0.2 rounded">
                            {reqUser.experienceLevel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs text-ink-muted tabular self-start sm:self-auto">
                    Applied {new Date(req.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Candidate Message Note */}
                {req.message ? (
                  <div className="bg-surface-tonal p-3.5 rounded border border-border-subtle text-xs text-ink-secondary leading-relaxed">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted block mb-1">
                      Candidate Note:
                    </span>
                    <p className="italic font-serif">"{req.message}"</p>
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted italic">No candidate note provided.</p>
                )}

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => onRejectRequest(req.id)}
                    disabled={actionLoading}
                    className="btn btn-secondary text-xs h-8 px-3.5 inline-flex items-center gap-1.5 cursor-pointer text-ink-secondary hover:text-danger hover:border-danger"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </button>

                  <button
                    onClick={() => onApproveRequest(req.id)}
                    disabled={actionLoading || !hasAvailableSeats}
                    className="btn btn-primary text-xs h-8 px-3.5 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{actionLoading ? "Processing..." : "Approve & Admit"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
