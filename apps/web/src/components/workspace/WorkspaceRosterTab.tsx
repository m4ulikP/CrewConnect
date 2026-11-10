import React from "react";
import { Key, Shield, UserMinus, ArrowRightLeft, ExternalLink } from "lucide-react";
import type { TeamRecord, TeamMemberRecord } from "../../lib/api";
import { Avatar } from "../Avatar";
import type { WorkspaceUserRole } from "./WorkspaceHeader";

interface WorkspaceRosterTabProps {
  team: TeamRecord;
  roster: TeamMemberRecord[];
  userRole: WorkspaceUserRole;
  currentUserId?: string;
  onTransferLeadership: () => void;
  onRemoveMember: (member: { id: string; name: string }) => void;
  onCreateInvite: () => void;
  onDirectJoin: () => void;
  onRequestJoin: () => void;
}

export const WorkspaceRosterTab: React.FC<WorkspaceRosterTabProps> = ({
  team,
  roster,
  userRole,
  onTransferLeadership,
  onRemoveMember,
  onCreateInvite,
  onDirectJoin,
  onRequestJoin,
}) => {
  const isLeader = userRole === "leader";
  const isVisitor = userRole === "non-member" || userRole === "unauthenticated";
  const hasAvailableSeats = team.memberCount < team.maxCapacity;
  const isDisbanded = team.status === "DISBANDED";
  const vacantSeatCount = Math.max(0, team.maxCapacity - roster.length);

  return (
    <div className="space-y-6 pane-enter">
      {/* Header bar */}
      <div className="bg-surface border border-border-subtle rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-base font-serif font-medium text-ink-primary">
            Squad Roster (<span className="tabular">{roster.length}</span> /{" "}
            <span className="tabular">{team.maxCapacity}</span> seats filled)
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Confirmed members registered with verified platform credentials.
          </p>
        </div>

        {isLeader && hasAvailableSeats && !isDisbanded && (
          <button
            onClick={onCreateInvite}
            className="btn btn-secondary text-xs h-8 px-3 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Key className="w-3.5 h-3.5 text-accent" />
            <span>Create Invite Link</span>
          </button>
        )}
      </div>

      {/* Roster Cards List */}
      <div className="space-y-3">
        {roster.map((member, index) => {
          const mUser = typeof member.userId === "object" ? member.userId : null;
          const mId = mUser ? mUser.id : String(member.userId);
          const mName = mUser ? mUser.displayName : `Member ${index + 1}`;
          const isMemberLeader = member.role === "LEADER";

          return (
            <div
              key={member.id}
              className="bg-surface border border-border-subtle rounded-lg p-5 transition-colors hover:border-border-strong space-y-3 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Member Identity Info */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <Avatar name={mName} size="md" />
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-ink-primary break-words">
                        {mName}
                      </span>
                      {isMemberLeader && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent bg-accent-tint border border-[#C5E0DC] px-2 py-0.5 rounded">
                          <Shield className="w-3 h-3" />
                          <span>Squad Leader</span>
                        </span>
                      )}
                      {mUser?.experienceLevel && (
                        <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted bg-surface-tonal border border-border-subtle px-1.5 py-0.2 rounded">
                          {mUser.experienceLevel}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-secondary">
                      {mUser?.email && <span>{mUser.email}</span>}
                      {mUser?.githubUrl && (
                        <a
                          href={mUser.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          <span>GitHub</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <span className="text-ink-muted tabular">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Leader actions on member */}
                {isLeader && !isMemberLeader && !isDisbanded && (
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-subtle w-full sm:w-auto justify-end">
                    <button
                      onClick={onTransferLeadership}
                      className="btn btn-ghost text-xs h-8 px-2.5 inline-flex items-center gap-1 cursor-pointer text-ink-secondary hover:text-ink-primary"
                      title="Transfer squad leadership to this member"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Transfer Leader</span>
                    </button>

                    <button
                      onClick={() => onRemoveMember({ id: mId, name: mName })}
                      className="btn btn-ghost text-xs h-8 px-2.5 inline-flex items-center gap-1 cursor-pointer text-danger hover:bg-danger-bg/50"
                      title="Remove member from squad roster"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Bio & Skills */}
              {(mUser?.bio || (mUser?.skills && mUser.skills.length > 0)) && (
                <div className="pt-2 border-t border-border-subtle text-xs space-y-2">
                  {mUser.bio && (
                    <p className="text-ink-secondary italic leading-relaxed">"{mUser.bio}"</p>
                  )}
                  {mUser.skills && mUser.skills.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {mUser.skills.map((skill) => (
                        <span
                          key={skill}
                          className="text-[11px] font-medium px-2 py-0.5 rounded-sm bg-surface-tonal text-ink-secondary border border-border-subtle"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Vacancy Callout Cards */}
      {hasAvailableSeats && !isDisbanded && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="uppercase tracking-wider text-[10px] font-medium">
              Available Seat Slots ({vacantSeatCount})
            </span>
          </div>

          {Array.from({ length: vacantSeatCount }).map((_, idx) => {
            const seatNumber = roster.length + idx + 1;
            return (
              <div
                key={`vacancy-${seatNumber}`}
                className="p-4 rounded-lg border border-dashed border-border-control bg-ground/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full border border-dashed border-border-strong flex items-center justify-center text-xs text-ink-muted bg-surface shrink-0 font-medium tabular">
                    {seatNumber}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-accent block">
                      Open Seat {seatNumber} — Seeking Contributor
                    </span>
                    <p className="text-[11px] text-ink-secondary mt-0.5">
                      This vacancy is ready to be claimed by a collaborator matching squad skills.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {isLeader ? (
                    <button
                      onClick={onCreateInvite}
                      className="btn btn-secondary text-xs h-8 px-3 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Key className="w-3 h-3 text-accent" />
                      <span>Invite To Seat</span>
                    </button>
                  ) : isVisitor && team.isOpen ? (
                    <>
                      <button
                        onClick={onDirectJoin}
                        className="btn btn-primary text-xs h-8 px-3 cursor-pointer"
                      >
                        Claim Seat
                      </button>
                      <button
                        onClick={onRequestJoin}
                        className="btn btn-secondary text-xs h-8 px-3 cursor-pointer"
                      >
                        Request Seat
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
