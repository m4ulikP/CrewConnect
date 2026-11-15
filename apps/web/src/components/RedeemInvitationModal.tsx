import React, { useState } from "react";
import { X, AlertCircle, KeyRound, ShieldCheck, Loader2, UserCheck } from "lucide-react";
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
      maxWidthClass="max-w-lg"
    >
      <div className="flex flex-col">
        {/* Brand Accent Top Stripe */}
        <div className="h-1.5 w-full bg-accent flex-shrink-0" />

        {/* Modal Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border-subtle bg-surface flex-shrink-0">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-accent-tint border border-accent/20 flex items-center justify-center text-accent flex-shrink-0 mt-0.5">
              <KeyRound className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="redeem-invitation-title"
                className="font-display font-bold text-xl sm:text-2xl text-ink-primary tracking-tight"
              >
                Redeem Team Invitation
              </h2>
              <p className="text-xs sm:text-sm text-ink-secondary mt-1">
                Enter your secret token to claim your reserved squad seat
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close redeem dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink-primary hover:bg-surface-tonal transition-colors cursor-pointer disabled:opacity-50 -mr-1 -mt-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleRedeem} className="p-6 space-y-5">
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

          <div className="space-y-1.5">
            <label htmlFor="invitation-token" className="form-label !mb-0 text-xs font-semibold">
              Invitation Token <span className="text-danger">*</span>
            </label>
            <input
              id="invitation-token"
              type="text"
              value={token}
              onChange={(e) => handleTokenChange(e.target.value)}
              placeholder="e.g. crew_7f8a9b..."
              disabled={loading}
              className="form-input text-sm font-mono p-3 rounded-lg border border-border focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
            />
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-tonal border border-border-subtle text-xs text-ink-secondary">
            <ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <span id="redeem-invitation-description" className="leading-relaxed">
              Redemption verifies real-time vacancy and claims the reserved seat deterministically
              through an atomic transaction.
            </span>
          </div>

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
              disabled={loading}
              className="btn btn-primary text-sm h-10 px-5 gap-2 cursor-pointer font-medium shadow-sm hover:shadow"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Claiming seat...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Accept & Join</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AccessibleDialog>
  );
};
