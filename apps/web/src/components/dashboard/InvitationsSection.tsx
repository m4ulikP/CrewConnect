import React from "react";
import { Key, Mail } from "lucide-react";
import type { HackathonRecord, TeamRecord } from "../../lib/api";

interface InvitationsSectionProps {
  myTeam: { team: TeamRecord; role: string } | null;
  selectedHackathon: HackathonRecord | null;
  onOpenRedeemModal: () => void;
}

export const InvitationsSection: React.FC<InvitationsSectionProps> = ({
  myTeam,
  selectedHackathon,
  onOpenRedeemModal,
}) => {
  const isCompleted = selectedHackathon?.status === "COMPLETED";
  const alreadyInTeam = Boolean(myTeam);

  return (
    <section
      aria-labelledby="invitations-heading"
      className="bg-surface border border-border-subtle rounded-lg p-5 space-y-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="invitations-heading" className="text-base font-semibold text-ink-primary">
          Invitations
        </h2>
        <span className="text-xs text-ink-muted">Token protocol</span>
      </div>

      <div className="rounded-md border border-border-subtle bg-surface-tonal/70 p-3.5 flex items-start gap-2.5 text-xs text-ink-secondary">
        <Mail className="w-4 h-4 text-ink-muted flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1 leading-relaxed">
          <p className="font-semibold text-ink-primary">Recipient Inbox Not Exposed</p>
          <p>
            Incoming user-scoped invitation listings (
            <code className="bg-surface px-1 py-0.5 rounded border border-border-subtle">
              GET /api/v1/me/invitations
            </code>
            ) are not yet available in the backend API. If a squad leader shares an invite token
            with you, redeem it directly with idempotent seat verification below.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <span className="text-xs text-ink-muted">
          {alreadyInTeam
            ? `Committed to ${myTeam?.team.name} in this hackathon`
            : isCompleted
              ? "Hackathon completed"
              : "Verify token & claim seat atomically"}
        </span>
        <button
          type="button"
          onClick={onOpenRedeemModal}
          disabled={alreadyInTeam || isCompleted}
          className="btn btn-secondary h-9 px-3.5 text-xs"
        >
          <Key className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Redeem Invitation Token</span>
        </button>
      </div>
    </section>
  );
};
