import React, { useState } from "react";
import { X, ShieldAlert, AlertCircle } from "lucide-react";
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 id="transfer-leadership-title" className="text-base font-bold text-white">
                Transfer Leadership
              </h2>
              <p className="text-xs text-slate-400">Hand over team management authority</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close transfer leadership dialog"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl flex items-start space-x-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 bg-amber-950/30 border border-amber-800/50 rounded-xl text-xs text-amber-200 space-y-1">
            <p className="font-semibold">Irreversible Administrative Action:</p>
            <p className="text-amber-300/80 leading-relaxed">
              You will be demoted to regular <strong>Member</strong>. The selected user will gain
              full leadership permissions including team editing, member removal, and disbanding.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-leader-select" className="text-xs font-semibold text-slate-300">
              Choose New Leader
            </label>
            {eligibleMembers.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No other active members in the team to transfer to.
              </p>
            ) : (
              <select
                id="new-leader-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                {eligibleMembers.map((m) => {
                  const uId = typeof m.userId === "object" ? m.userId.id : m.userId;
                  const uName = typeof m.userId === "object" ? m.userId.displayName : uId;
                  const uEmail = typeof m.userId === "object" ? m.userId.email : "";
                  return (
                    <option key={uId} value={uId}>
                      {uName} ({uEmail || uId})
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || eligibleMembers.length === 0}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
            >
              {loading ? "Transferring..." : "Confirm Transfer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
