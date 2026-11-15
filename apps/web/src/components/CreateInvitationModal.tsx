import React, { useState } from "react";
import { X, Copy, Check, AlertCircle, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { apiCreateInvitation, ApiClientError } from "../lib/api";
import { AccessibleDialog } from "./AccessibleDialog";

interface CreateInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  onSuccess: () => void;
}

export const CreateInvitationModal: React.FC<CreateInvitationModalProps> = ({
  isOpen,
  onClose,
  teamId,
  teamName,
  onSuccess,
}) => {
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [inviteeId, setInviteeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await apiCreateInvitation(teamId, {
        inviteeId: inviteeId.trim() || undefined,
        maxUses: Number(maxUses),
        expiresInHours: Number(expiresInHours),
      });

      setCreatedToken(result.token);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to create invitation. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setCreatedToken(null);
    setCopied(false);
    setError(null);
    onClose();
  };

  return (
    <AccessibleDialog
      isOpen={isOpen}
      onClose={handleClose}
      titleId="create-invitation-title"
      descriptionId="create-invitation-description"
      allowClose={!loading && !createdToken}
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
                id="create-invitation-title"
                className="font-display font-bold text-xl sm:text-2xl text-ink-primary tracking-tight"
              >
                Generate Invitation Token
              </h2>
              <p
                id="create-invitation-description"
                className="text-xs sm:text-sm text-ink-secondary mt-1"
              >
                Generate a single-reveal token for{" "}
                <span className="font-semibold text-ink-primary">{teamName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            aria-label="Close invitation dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink-primary hover:bg-surface-tonal transition-colors cursor-pointer disabled:opacity-50 -mr-1 -mt-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
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

          {createdToken ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 text-xs sm:text-sm space-y-2">
                <div className="flex items-center gap-2 font-semibold text-accent">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  <span>Invitation Token Generated</span>
                </div>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Copy this token now. Only its SHA-256 hash is persisted on the server, so it will
                  not be shown again once this dialog closes.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="generated-invitation-token"
                  className="form-label !mb-0 text-xs font-semibold"
                >
                  Single-Reveal Secret Token
                </label>
                <div className="flex gap-2">
                  <input
                    id="generated-invitation-token"
                    type="text"
                    readOnly
                    value={createdToken}
                    className="form-input text-sm font-mono select-all flex-1 bg-surface-tonal"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="btn btn-secondary text-sm h-11 px-4 cursor-pointer gap-2 shrink-0 font-medium"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-accent" />
                        <span className="text-accent">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Token</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border-subtle bg-surface-tonal/40 -mx-6 -mb-6 px-6 py-4 rounded-b-xl">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn btn-primary text-sm h-10 px-5 cursor-pointer font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="max-uses" className="form-label !mb-0 text-xs font-semibold">
                    Max Redemptions
                  </label>
                  <input
                    id="max-uses"
                    type="number"
                    min="1"
                    max="10"
                    value={maxUses}
                    onChange={(e) => setMaxUses(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="form-input text-sm"
                  />
                  <span className="text-[11px] text-ink-muted">Allowed: 1–10 seats</span>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="expires-in" className="form-label !mb-0 text-xs font-semibold">
                    Expiry (Hours)
                  </label>
                  <input
                    id="expires-in"
                    type="number"
                    min="1"
                    max="168"
                    value={expiresInHours}
                    onChange={(e) =>
                      setExpiresInHours(Math.max(1, parseInt(e.target.value, 10) || 24))
                    }
                    className="form-input text-sm"
                  />
                  <span className="text-[11px] text-ink-muted">Default: 24h (Max: 168h)</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="invitee-id" className="form-label !mb-0 text-xs font-semibold">
                  Specific User ID <span className="text-ink-muted font-normal">(Optional)</span>
                </label>
                <input
                  id="invitee-id"
                  type="text"
                  placeholder="Leave empty for an open invitation token"
                  value={inviteeId}
                  onChange={(e) => setInviteeId(e.target.value)}
                  className="form-input text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle bg-surface-tonal/40 -mx-6 -mb-6 px-6 py-4 rounded-b-xl">
                <button
                  type="button"
                  onClick={handleClose}
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
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Generate Token</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </AccessibleDialog>
  );
};
