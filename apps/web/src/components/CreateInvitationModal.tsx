import React, { useState } from "react";
import { X, Copy, Check, AlertCircle } from "lucide-react";
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
      maxWidthClass="max-w-md"
    >
      <div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface">
          <div>
            <h2
              id="create-invitation-title"
              className="text-xl font-serif font-medium text-ink-primary"
            >
              Generate Invitation Token
            </h2>
            <p id="create-invitation-description" className="text-xs text-ink-secondary mt-0.5">
              {teamName}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            aria-label="Close invitation dialog"
            className="text-ink-muted hover:text-ink-primary p-1.5 rounded hover:bg-surface-tonal transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
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

          {createdToken ? (
            <div className="space-y-4">
              <div className="p-4 rounded border border-[#BBF7D0] bg-positive-bg text-positive text-xs space-y-2">
                <span className="font-semibold block">Invitation Token Generated</span>
                <p className="text-[11px] leading-relaxed">
                  Copy this token now. Only its SHA-256 hash is persisted on the server, so it will
                  not be shown again once this dialog closes.
                </p>
              </div>

              <div>
                <label htmlFor="generated-invitation-token" className="form-label">
                  Single-Reveal Token
                </label>
                <div className="flex gap-2">
                  <input
                    id="generated-invitation-token"
                    type="text"
                    readOnly
                    value={createdToken}
                    className="form-input text-xs font-mono select-all flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="btn btn-secondary text-xs h-11 px-3 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-positive" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Token</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn btn-primary text-xs h-9 px-4 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="max-uses" className="form-label">
                    Max Redemptions
                  </label>
                  <input
                    id="max-uses"
                    type="number"
                    min="1"
                    max="10"
                    value={maxUses}
                    onChange={(e) => setMaxUses(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="form-input text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="expires-in" className="form-label">
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
                    className="form-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="invitee-id" className="form-label">
                  Specific User ID (Optional)
                </label>
                <input
                  id="invitee-id"
                  type="text"
                  placeholder="Leave empty for open token"
                  value={inviteeId}
                  onChange={(e) => setInviteeId(e.target.value)}
                  className="form-input text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={handleClose}
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
                  {loading ? "Generating..." : "Generate Token"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </AccessibleDialog>
  );
};
