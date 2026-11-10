import React, { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { apiAcceptInvitation, generateIdempotencyKey, ApiClientError } from "../lib/api";
import { AccessibleDialog } from "./AccessibleDialog";

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
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateIdempotencyKey());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTokenChange = (value: string) => {
    setToken(value);
    // Rotate key whenever the candidate token input changes so a different payload gets a fresh key
    setIdempotencyKey(generateIdempotencyKey());
  };

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
      setIdempotencyKey(generateIdempotencyKey());
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
    <AccessibleDialog
      isOpen={isOpen}
      onClose={onClose}
      titleId="redeem-invitation-title"
      descriptionId="redeem-invitation-description"
      allowClose={!loading}
      maxWidthClass="max-w-md"
    >
      <div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface">
          <div>
            <h2
              id="redeem-invitation-title"
              className="text-xl font-serif font-medium text-ink-primary"
            >
              Redeem Team Invitation
            </h2>
            <p className="text-xs text-ink-secondary mt-0.5">Enter secret token to join squad</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close redeem dialog"
            className="text-ink-muted hover:text-ink-primary p-1.5 rounded hover:bg-surface-tonal transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleRedeem} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3 bg-danger-bg border border-[#FCA5A5] rounded flex items-start gap-2 text-danger text-xs"
            >
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
              onChange={(e) => handleTokenChange(e.target.value)}
              placeholder="e.g. crew_7f8a9b..."
              className="form-input text-xs font-mono"
            />
            <span id="redeem-invitation-description" className="text-[11px] text-ink-muted block">
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
    </AccessibleDialog>
  );
};
