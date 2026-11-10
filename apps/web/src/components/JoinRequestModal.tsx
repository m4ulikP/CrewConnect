import React, { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { apiCreateJoinRequest, ApiClientError } from "../lib/api";

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-request-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/40 backdrop-blur-xs pane-enter"
    >
      <div className="relative w-full max-w-md bg-surface border border-border-strong rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface">
          <div>
            <h2 id="join-request-title" className="text-xl font-serif font-medium text-ink-primary">
              Request to Join
            </h2>
            <p className="text-xs text-ink-secondary mt-0.5">{teamName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close request dialog"
            className="text-ink-muted hover:text-ink-primary p-1.5 rounded hover:bg-surface-tonal transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-danger-bg border border-[#FCA5A5] rounded flex items-start gap-2 text-danger text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="join-message" className="form-label">
              Application Note (Optional)
            </label>
            <textarea
              id="join-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell the leader about your skills and what you'd like to build together..."
              className="form-input text-xs py-2 h-auto"
            />
            <span className="text-[11px] text-ink-muted block">
              The squad leader will review your application before admitting you to the roster.
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
              {loading ? "Sending..." : "Send Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
