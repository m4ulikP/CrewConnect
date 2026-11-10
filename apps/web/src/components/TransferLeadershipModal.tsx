import React, { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { apiTransferLeadership, ApiClientError, type TeamMemberRecord } from "../lib/api";

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-leadership-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/40 backdrop-blur-xs pane-enter"
    >
      <div className="bg-surface border border-border-strong rounded-lg w-full max-w-md overflow-hidden shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface">
          <div>
            <h2
              id="transfer-leadership-title"
              className="text-xl font-serif font-medium text-ink-primary"
            >
              Transfer Leadership
            </h2>
            <p className="text-xs text-ink-secondary">Hand over squad admin rights to a confirmed member</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close transfer dialog"
            className="text-ink-muted hover:text-ink-primary p-1.5 rounded hover:bg-surface-tonal transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-danger-bg border border-[#FCA5A5] rounded flex items-start gap-2 text-danger text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-xs text-ink-secondary leading-relaxed">
            Transferring leadership will demote you to a regular squad member and grant full management rights to the selected participant.
          </p>

          {eligibleMembers.length === 0 ? (
            <p className="text-xs text-ink-muted italic py-2">
              No eligible members found. To transfer leadership, your squad must have other active members.
            </p>
          ) : (
            <div className="space-y-2">
              <label htmlFor="successor-select" className="form-label">
                Select Successor
              </label>
              <select
                id="successor-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="form-input text-xs"
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
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-secondary text-xs h-9 px-4 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || eligibleMembers.length === 0}
              className="btn btn-primary text-xs h-9 px-4 cursor-pointer"
            >
              {loading ? "Transferring..." : "Confirm Transfer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
