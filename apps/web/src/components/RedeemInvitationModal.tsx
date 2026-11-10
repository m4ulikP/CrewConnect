import React, { useState } from "react";
import { X, AlertCircle } from "lucide-react";
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
  const [idempotencyKey] = useState(() => generateIdempotencyKey());
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="redeem-invitation-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/40 backdrop-blur-xs pane-enter"
    >
      <div className="relative w-full max-w-md bg-surface border border-border-strong rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface">
          <div>
            <h2 id="redeem-invitation-title" className="text-xl font-serif font-medium text-ink-primary">
              Redeem Team Invitation
            </h2>
            <p className="text-xs text-ink-secondary mt-0.5">Enter secret token to join squad</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close redeem dialog"
            className="text-ink-muted hover:text-ink-primary p-1.5 rounded hover:bg-surface-tonal transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleRedeem} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-danger-bg border border-[#FCA5A5] rounded flex items-start gap-2 text-danger text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="invitation-token" className="form-label">
              Invitation Token
            </label>
            <input
              id="invitation-token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="e.g. crew_7f8a9b..."
              className="form-input text-xs font-mono"
            />
            <span className="text-[11px] text-ink-muted block">
              Redemption verifies vacancy and claims the reserved seat deterministically.
            </span>
          </div>

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
              disabled={loading}
              className="btn btn-primary text-xs h-9 px-4 cursor-pointer"
            >
              {loading ? "Claiming seat..." : "Accept & Join"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
