import React, { useState } from "react";
import { X, CheckCircle, Ticket, AlertCircle } from "lucide-react";
import { apiAcceptInvitation, generateIdempotencyKey, ApiClientError } from "../lib/api";

interface RedeemInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (teamId: string) => void;
}

export const RedeemInvitationModal: React.FC<RedeemInvitationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [token, setToken] = useState("");
  const [idempotencyKey] = useState(() => generateIdempotencyKey()); // Stable per user action!
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError("Please enter your invitation token");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiAcceptInvitation(token.trim(), idempotencyKey);
      setToken("");
      onSuccess(result.teamId);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to accept invitation. Please check the token.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Ticket className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Redeem Team Invitation</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleRedeem} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="invitation-token" className="block text-xs font-medium text-slate-300">
              Paste Your Secret Invitation Token
            </label>
            <input
              id="invitation-token"
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="e.g. crew_7f8a9b..."
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-500">
              Your token will be atomically validated and consumed by the reservation engine.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-600/20"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{loading ? "Redeeming..." : "Accept & Join"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
