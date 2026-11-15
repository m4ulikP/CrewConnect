import React, { useState } from "react";
import { X, AlertCircle, ShieldAlert, Loader2, ArrowRightLeft } from "lucide-react";
import { apiTransferLeadership, ApiClientError, type TeamMemberRecord } from "../lib/api";
import { AccessibleDialog } from "./AccessibleDialog";

interface TransferLeadershipModalProps {
  teamId: string;
  members: TeamMemberRecord[];
  currentLeaderId: string;
  isOpen: boolean;
  onClose: () => void;
  onTransferred: () => void;
}

export const TransferLeadershipModal: React.FC<TransferLeadershipModalProps> = ({
  teamId,
  members,
  currentLeaderId,
  isOpen,
  onClose,
  onTransferred,
}) => {
  const eligibleMembers = members.filter((m) => {
    const memUserId = typeof m.userId === "object" ? m.userId.id : m.userId;
    return memUserId !== currentLeaderId && m.status === "ACTIVE";
  });

  const [selectedUserId, setSelectedUserId] = useState<string>(
    eligibleMembers[0]
      ? typeof eligibleMembers[0].userId === "object"
        ? eligibleMembers[0].userId.id
        : eligibleMembers[0].userId
      : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError("Please select a target team member.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiTransferLeadership(teamId, selectedUserId);
      onTransferred();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to transfer leadership.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccessibleDialog
      isOpen={isOpen}
      onClose={onClose}
      titleId="transfer-leadership-title"
      descriptionId="transfer-leadership-description"
      allowClose={!loading}
      maxWidthClass="max-w-lg"
    >
      <div className="flex flex-col">
        {/* Brand Accent Top Stripe */}
        <div className="h-1.5 w-full bg-accent flex-shrink-0" />

        {/* Modal Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border-subtle bg-surface flex-shrink-0">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="transfer-leadership-title"
                className="font-display font-bold text-xl sm:text-2xl text-ink-primary tracking-tight"
              >
                Transfer Leadership
              </h2>
              <p className="text-xs sm:text-sm text-ink-secondary mt-1">
                Hand over squad administration rights to a confirmed active member
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close transfer dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink-primary hover:bg-surface-tonal transition-colors cursor-pointer disabled:opacity-50 -mr-1 -mt-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3.5 bg-danger-bg border border-danger/30 rounded-lg flex items-start gap-2.5 text-danger text-xs sm:text-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p id="transfer-leadership-description" className="leading-relaxed">
              Transferring leadership will immediately assign squad ownership to the selected
              teammate and demote you to a standard active member. This action is atomic and
              irreversible without their consent.
            </p>
          </div>

          {eligibleMembers.length === 0 ? (
            <div className="p-4 rounded-lg bg-surface-tonal border border-border-subtle text-xs text-ink-muted text-center italic">
              No eligible teammates available. To transfer leadership, your squad must have other
              confirmed active members.
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="successor-select" className="form-label !mb-0 text-xs font-semibold">
                Select Successor Teammate <span className="text-danger">*</span>
              </label>
              <select
                id="successor-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={loading}
                className="form-input text-sm cursor-pointer p-3 rounded-lg border border-border focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
              >
                {eligibleMembers.map((m) => {
                  const mId = typeof m.userId === "object" ? m.userId.id : m.userId;
                  const mName = typeof m.userId === "object" ? m.userId.displayName : mId;
                  const mEmail = typeof m.userId === "object" ? m.userId.email : "";
                  return (
                    <option key={m.id} value={mId}>
                      {mName} {mEmail ? `(${mEmail})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle bg-surface-tonal/40 -mx-6 -mb-6 px-6 py-4 rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-secondary text-sm h-10 px-4 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || eligibleMembers.length === 0}
              className="btn btn-primary text-sm h-10 px-5 gap-2 cursor-pointer font-medium shadow-sm hover:shadow"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Transferring...</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Confirm Transfer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AccessibleDialog>
  );
};
