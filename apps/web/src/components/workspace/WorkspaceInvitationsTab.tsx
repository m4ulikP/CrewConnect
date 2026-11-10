import React from "react";
import { Key, ShieldAlert, AlertCircle, Trash2 } from "lucide-react";
import type { InvitationRecord } from "../../lib/api";
import type { WorkspaceUserRole } from "./WorkspaceHeader";

interface WorkspaceInvitationsTabProps {
  userRole: WorkspaceUserRole;
  invitations: InvitationRecord[];
  actionLoading: boolean;
  onCreateInvite: () => void;
  onRevokeInvitation: (invitationId: string) => void;
}

export const WorkspaceInvitationsTab: React.FC<WorkspaceInvitationsTabProps> = ({
  userRole,
  invitations,
  actionLoading,
  onCreateInvite,
  onRevokeInvitation,
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
          Squad invitation tokens and redemption keys can only be issued, tracked, and revoked by
          the squad leader.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-6 pane-enter shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <h2 className="text-base font-serif font-medium text-ink-primary">
            Squad Invitation Tokens (<span className="tabular">{invitations.length}</span>)
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Cryptographic access keys granting direct admission to open squad seats.
          </p>
        </div>

        <button
          onClick={onCreateInvite}
          className="btn btn-primary text-xs h-8 px-3.5 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Key className="w-3.5 h-3.5" />
          <span>Generate New Token</span>
        </button>
      </div>

      {/* Security Note Banner */}
      <div className="p-3.5 bg-ground border border-border-subtle rounded text-xs text-ink-secondary flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-ink-primary block">Cryptographic Token Security</span>
          <p className="leading-relaxed">
            Invitation tokens are hashed with SHA-256 before database persistence. Raw tokens are
            only revealed once upon creation for copying.
          </p>
        </div>
      </div>

      {/* Invitations List */}
      {invitations.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Key className="w-8 h-8 text-ink-muted mx-auto stroke-1" />
          <h3 className="text-sm font-medium text-ink-primary">No active invitation tokens</h3>
          <p className="text-xs text-ink-secondary max-w-xs mx-auto">
            Generate an invitation token to invite trusted collaborators directly onto your squad
            roster.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle text-xs">
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-ink-primary">
                    {" "}
                    {/* taste-skill-ignore */}
                    Token ID: {inv.id}
                  </span>
                  <span
                    className={`text-[10px] uppercase px-2 py-0.5 rounded font-medium ${
                      inv.status === "ACTIVE"
                        ? "bg-positive-bg text-positive border border-[#BBF7D0]"
                        : "bg-surface-tonal text-ink-muted border border-border-subtle"
                    }`}
                  >
                    {inv.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-secondary text-[11px]">
                  <span>
                    Redemptions:{" "}
                    <strong className="tabular font-medium text-ink-primary">
                      {inv.usesCount}
                    </strong>{" "}
                    / <span className="tabular">{inv.maxUses}</span>
                  </span>
                  <span>
                    Expires:{" "}
                    <span className="tabular">{new Date(inv.expiresAt).toLocaleDateString()}</span>
                  </span>
                  {inv.inviteeId && (
                    <span className="font-mono text-[10px]">
                      {" "}
                      {/* taste-skill-ignore */}
                      Restricted to User: {String(inv.inviteeId)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  onClick={() => onRevokeInvitation(inv.id)}
                  disabled={actionLoading || inv.status !== "ACTIVE"}
                  className="btn btn-ghost text-xs h-8 px-2.5 inline-flex items-center gap-1 cursor-pointer text-danger hover:bg-danger-bg/50 disabled:opacity-50"
                  title="Revoke this invitation token"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Revoke</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
