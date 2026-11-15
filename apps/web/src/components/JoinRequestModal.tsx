import React, { useState } from "react";
import { X, AlertCircle, UserPlus, ShieldCheck, Send, Loader2 } from "lucide-react";
import { apiCreateJoinRequest, ApiClientError } from "../lib/api";
import { AccessibleDialog } from "./AccessibleDialog";

interface JoinRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  onSuccess: () => void;
}

export const JoinRequestModal: React.FC<JoinRequestModalProps> = ({
  isOpen,
  onClose,
  teamId,
  teamName,
  onSuccess,
}) => {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiCreateJoinRequest(teamId, message.trim() || undefined);
      setMessage("");
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to submit join request. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccessibleDialog
      isOpen={isOpen}
      onClose={onClose}
      titleId="join-request-title"
      descriptionId="join-request-description"
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
              <UserPlus className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="join-request-title"
                className="font-display font-bold text-xl sm:text-2xl text-ink-primary tracking-tight"
              >
                Request to Join
              </h2>
              <p className="text-xs sm:text-sm text-ink-secondary mt-1">
                Submit an application to become a confirmed squad member
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close request dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink-primary hover:bg-surface-tonal transition-colors cursor-pointer disabled:opacity-50 -mr-1 -mt-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
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

          {/* Target Squad Overview Card */}
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-surface-tonal/60 border border-border-subtle">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-accent-tint border border-accent/15 flex items-center justify-center text-accent text-xs font-bold font-mono shrink-0">
                {teamName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold block">
                  Target Squad
                </span>
                <span className="text-sm font-semibold text-ink-primary truncate block">
                  {teamName}
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-accent-tint text-accent border border-accent/20 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Active Recruitment</span>
            </span>
          </div>

          {/* Application Note Field */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="join-message" className="form-label !mb-0 text-xs font-semibold">
                Application Note <span className="text-ink-muted font-normal">(Optional)</span>
              </label>
              <span className="text-[11px] text-ink-muted font-mono">{message.length}/500</span>
            </div>
            <textarea
              id="join-message"
              rows={4}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell the leader about your skills and what you'd like to build together..."
              disabled={loading}
              className="form-input text-sm p-3.5 rounded-lg border border-border focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all resize-y min-h-[110px] leading-relaxed"
            />
          </div>

          {/* Informational Callout */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-tonal border border-border-subtle text-xs text-ink-secondary">
            <ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <span id="join-request-description" className="leading-relaxed">
              The squad leader will review your application before admitting you to the roster.
            </span>
          </div>

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
              disabled={loading}
              className="btn btn-primary text-sm h-10 px-5 gap-2 cursor-pointer font-medium shadow-sm hover:shadow"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AccessibleDialog>
  );
};
