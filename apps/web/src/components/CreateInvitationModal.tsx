import React, { useState } from "react";
import { X, Copy, Check, Key, AlertCircle, ShieldAlert } from "lucide-react";
import { apiCreateInvitation, ApiClientError } from "../lib/api";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <Key className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Generate Invitation Token</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{teamName}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdToken ? (
          <div className="p-6 space-y-5">
            <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-2xl flex items-start space-x-3 text-amber-200 text-xs">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">Copy this token now!</p>
                <p className="text-amber-200/80 mt-1">
                  For cryptographic security, only the SHA-256 hash is stored in the database. This
                  raw token is shown once and cannot be recovered after closing this window.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Secret Token</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={createdToken}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 select-all"
                />
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center space-x-1 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="invitee-id" className="block text-xs font-medium text-slate-300">
                Direct Invitee User ID (Optional)
              </label>
              <input
                id="invitee-id"
                type="text"
                placeholder="Leave blank for open invite"
                value={inviteeId}
                onChange={(e) => setInviteeId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500">
                If specified, only this user ID can redeem this invitation.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="max-uses" className="block text-xs font-medium text-slate-300">
                Max Allowed Uses
              </label>
              <input
                id="max-uses"
                type="number"
                min={1}
                max={10}
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500">
                Default: 1 (single-use one-time invitation)
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="expires-hours" className="block text-xs font-medium text-slate-300">
                Valid Duration (Hours)
              </label>
              <input
                id="expires-hours"
                type="number"
                min={1}
                max={168}
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500">
                Default: 24 hours (maximum 168 hours / 7 days)
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
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
                <Key className="w-3.5 h-3.5" />
                <span>{loading ? "Generating..." : "Generate Token"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
