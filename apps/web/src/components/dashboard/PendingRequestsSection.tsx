import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle, Clock, RefreshCw, XCircle } from "lucide-react";
import { isJoinRequestExpired, type JoinRequestRecord, type TeamRecord } from "../../lib/api";
import { DashboardSectionSkeleton } from "./DashboardSectionSkeleton";

interface PendingRequestsSectionProps {
  myTeam: { team: TeamRecord; role: string } | null;
  requests: JoinRequestRecord[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  processingRequestId: string | null;
  actionFeedback: { type: "success" | "error"; message: string } | null;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

export const PendingRequestsSection: React.FC<PendingRequestsSectionProps> = ({
  myTeam,
  requests,
  loading,
  error,
  onRetry,
  processingRequestId,
  actionFeedback,
  onApprove,
  onReject,
}) => {
  const isLeader = myTeam?.role === "LEADER";
  const pendingOnly = requests.filter((r) => r.status === "PENDING" && !isJoinRequestExpired(r));
  const expiredOnly = requests.filter(isJoinRequestExpired);
  const visibleRequests = [...pendingOnly, ...expiredOnly];

  return (
    <section
      aria-labelledby="incoming-requests-heading"
      className="bg-surface border border-border-subtle rounded-lg p-5 space-y-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="incoming-requests-heading" className="text-base font-semibold text-ink-primary">
          Incoming Join Requests
        </h2>
        {isLeader && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-sm bg-surface-tonal border border-border-subtle text-ink-secondary tabular">
            {loading ? "—" : `${pendingOnly.length} pending`}
          </span>
        )}
      </div>

      {actionFeedback && (
        <div
          role={actionFeedback.type === "error" ? "alert" : "status"}
          className={`p-3 rounded-md border flex items-start gap-2 text-xs ${
            actionFeedback.type === "error"
              ? "border-[#FCA5A5] bg-danger-bg text-danger"
              : "border-[#BBF7D0] bg-positive-bg text-positive"
          }`}
        >
          {actionFeedback.type === "error" ? (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* Leader Incoming Request Queue */}
      {isLeader && myTeam ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>Incoming requests to join {myTeam.team.name}</span>
            <Link
              to={`/teams/${myTeam.team.id}`}
              className="font-semibold text-accent hover:underline"
            >
              Manage in Workspace
            </Link>
          </div>

          {loading ? (
            <DashboardSectionSkeleton rows={2} label="Loading incoming join requests" />
          ) : error ? (
            <div
              role="alert"
              className="p-3 rounded-md border border-border-subtle bg-surface-hover flex items-center justify-between gap-2 text-xs"
            >
              <span className="text-danger">{error}</span>
              <button
                type="button"
                onClick={onRetry}
                aria-label="Retry loading incoming join requests"
                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          ) : visibleRequests.length === 0 ? (
            <p className="text-xs text-ink-muted py-2">
              No incoming join requests awaiting your review for {myTeam.team.name}.
            </p>
          ) : (
            <div className="divide-y divide-border-subtle">
              {visibleRequests.map((req) => {
                const applicant = typeof req.userId === "object" ? req.userId : null;
                const applicantName = applicant?.displayName || "Applicant";
                const isBusy = processingRequestId === req.id;
                const expired = isJoinRequestExpired(req);

                return (
                  <div key={req.id} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-ink-primary truncate">
                            {applicantName}
                          </span>
                          <span
                            className={`status-label ${
                              expired
                                ? "bg-surface-tonal border border-border-strong text-ink-muted"
                                : "status-warning"
                            }`}
                          >
                            {expired ? "EXPIRED" : "PENDING"}
                          </span>
                        </div>
                        <p className="text-xs text-ink-muted tabular mt-0.5">
                          Submitted {new Date(req.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {req.message && (
                      <p className="text-xs text-ink-secondary bg-surface-hover border border-border-subtle rounded p-2 leading-relaxed">
                        {req.message}
                      </p>
                    )}

                    {!expired && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => onApprove(req.id)}
                          disabled={Boolean(processingRequestId)}
                          className="btn btn-primary h-8 px-3 text-xs"
                        >
                          <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isBusy ? "Processing..." : "Approve"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onReject(req.id)}
                          disabled={Boolean(processingRequestId)}
                          className="btn btn-secondary h-8 px-3 text-xs"
                        >
                          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-ink-muted py-1">
          Incoming request review appears here when you lead a squad in the selected hackathon.
        </p>
      )}

      {/* Sent Applications Backend Boundary Note */}
      <div className="rounded-md border border-border-subtle bg-surface-tonal/70 p-3.5 flex items-start gap-2.5 text-xs text-ink-secondary">
        <Clock className="w-4 h-4 text-ink-muted flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1 leading-relaxed">
          <p className="font-semibold text-ink-primary">Submitted Applications Not Shown Here</p>
          <p>
            This panel displays incoming requests received by squads you lead. Tracking applications
            you submitted to other squads requires a dedicated{" "}
            <code className="bg-surface px-1 py-0.5 rounded border border-border-subtle">
              GET /api/v1/me/join-requests
            </code>{" "}
            endpoint, which is not yet exposed by the API.
          </p>
        </div>
      </div>
    </section>
  );
};
