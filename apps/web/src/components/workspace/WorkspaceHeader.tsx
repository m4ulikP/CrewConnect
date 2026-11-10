import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Edit,
  DoorOpen,
  DoorClosed,
  Key,
  Trash2,
  LogOut,
  Send,
  Ticket,
  Shield,
  UserCheck,
  Radio,
  LogIn,
} from "lucide-react";
import type { TeamRecord, TeamMemberRecord } from "../../lib/api";
import { SeatSlotStrip } from "../discovery/SeatSlotStrip";
import { CapacityBadge } from "../CapacityBadge";

export type WorkspaceUserRole = "leader" | "member" | "non-member" | "unauthenticated";

interface WorkspaceHeaderProps {
  team: TeamRecord;
  roster: TeamMemberRecord[];
  userRole: WorkspaceUserRole;
  actionLoading: boolean;
  connectionState: string;
  onEditTeam: () => void;
  onToggleOpenStatus: () => void;
  onCreateInvite: () => void;
  onDirectJoin: () => void;
  onRequestJoin: () => void;
  onRedeemToken: () => void;
  onLeaveTeam: () => void;
  onDisbandTeam: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  team,
  userRole,
  actionLoading,
  connectionState,
  onEditTeam,
  onToggleOpenStatus,
  onCreateInvite,
  onDirectJoin,
  onRequestJoin,
  onRedeemToken,
  onLeaveTeam,
  onDisbandTeam,
}) => {
  const isDisbanded = team.status === "DISBANDED";
  const hasAvailableSeats = team.memberCount < team.maxCapacity;
  const isLeader = userRole === "leader";
  const isMember = userRole === "member";
  const isVisitor = userRole === "non-member";
  const isUnauthenticated = userRole === "unauthenticated";

  return (
    <header className="space-y-4">
      {/* Top Directory Backlink & Realtime Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <Link
          to="/teams-preview"
          className="inline-flex items-center gap-1.5 font-semibold text-ink-secondary hover:text-ink-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Teams Directory</span>
        </Link>

        <div className="flex items-center gap-2 text-[11px] text-ink-muted">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connectionState === "connected"
                ? "bg-positive"
                : connectionState === "reconnecting"
                  ? "bg-warning"
                  : "bg-ink-muted"
            }`}
            aria-hidden="true"
          />
          <span>
            {connectionState === "connected"
              ? "Live Squad Stream"
              : connectionState === "reconnecting"
                ? "Reconnecting stream..."
                : "Offline"}
          </span>
        </div>
      </div>

      {/* Main Dossier Header Banner */}
      <div className="bg-surface border border-border-strong rounded-lg p-5 sm:p-7 space-y-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 flex-1 min-w-0">
            {/* Status Pills Row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] tracking-wider uppercase px-2 py-0.5 rounded bg-surface-tonal text-ink-secondary border border-border-subtle font-medium">
                Squad Workspace
              </span>

              {isDisbanded ? (
                <span className="status-label status-danger">DISBANDED</span>
              ) : (
                <span className="status-label status-open">ACTIVE</span>
              )}

              {!isDisbanded && (
                <span
                  className={`status-label ${team.isOpen && hasAvailableSeats ? "status-open" : "status-full"}`}
                >
                  {team.isOpen && hasAvailableSeats ? "RECRUITING" : "CLOSED"}
                </span>
              )}

              {/* Role badge */}
              {isLeader && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent bg-accent-tint border border-[#C5E0DC] px-2 py-0.5 rounded">
                  <Shield className="w-3 h-3" />
                  <span>Leader Access</span>
                </span>
              )}
              {isMember && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-positive bg-positive-bg border border-[#BBF7D0] px-2 py-0.5 rounded">
                  <UserCheck className="w-3 h-3" />
                  <span>Confirmed Member</span>
                </span>
              )}
              {isVisitor && (
                <span className="text-[11px] font-medium text-ink-muted bg-surface-tonal border border-border-subtle px-2 py-0.5 rounded">
                  Candidate Visitor
                </span>
              )}
              {isUnauthenticated && (
                <span className="text-[11px] font-medium text-ink-muted bg-surface-tonal border border-border-subtle px-2 py-0.5 rounded">
                  Public Preview
                </span>
              )}
            </div>

            {/* Squad Name */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-medium text-ink-primary tracking-tight break-words">
              {team.name}
            </h1>

            {/* Tagline */}
            {team.tagline && (
              <p className="text-sm sm:text-base text-ink-secondary font-medium">{team.tagline}</p>
            )}

            {/* Description */}
            {team.description && (
              <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed max-w-3xl pt-1">
                {team.description}
              </p>
            )}

            {/* Seeking Skills Tags */}
            {team.skillsNeeded && team.skillsNeeded.length > 0 && (
              <div className="pt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-ink-muted font-medium mr-1">Seeking:</span>
                {team.skillsNeeded.map((skill) => (
                  <span
                    key={skill}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-sm bg-surface-tonal border border-border-subtle text-ink-secondary"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right Metrics: Capacity & Slot Strip */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between sm:justify-start gap-3 p-4 bg-ground/70 border border-border-subtle rounded-md shrink-0 lg:min-w-[220px]">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-ink-muted block font-medium">
                Occupancy Meter
              </span>
              <CapacityBadge
                memberCount={team.memberCount}
                maxCapacity={team.maxCapacity}
                isOpen={team.isOpen && !isDisbanded}
                variant="indicator"
              />
            </div>
            <SeatSlotStrip
              memberCount={team.memberCount}
              maxCapacity={team.maxCapacity}
              isOpen={team.isOpen && !isDisbanded}
            />
          </div>
        </div>

        {/* Action Toolbar */}
        {!isDisbanded ? (
          <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {isLeader && (
                <>
                  <button
                    onClick={onEditTeam}
                    className="btn btn-secondary text-xs h-9 px-3.5 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Team</span>
                  </button>

                  <button
                    onClick={onToggleOpenStatus}
                    disabled={
                      actionLoading || (team.memberCount >= team.maxCapacity && !team.isOpen)
                    }
                    className="btn btn-secondary text-xs h-9 px-3.5 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {team.isOpen ? (
                      <>
                        <DoorClosed className="w-3.5 h-3.5 text-ink-secondary" />
                        <span>Close Recruiting</span>
                      </>
                    ) : (
                      <>
                        <DoorOpen className="w-3.5 h-3.5 text-accent" />
                        <span>Open Recruiting</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={onCreateInvite}
                    className="btn btn-primary text-xs h-9 px-3.5 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Create Invite Link</span>
                  </button>
                </>
              )}

              {isVisitor && (
                <>
                  <button
                    onClick={onDirectJoin}
                    disabled={actionLoading || !team.isOpen || !hasAvailableSeats}
                    className="btn btn-primary text-xs h-9 px-4 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{actionLoading ? "Claiming seat..." : "Instant direct join"}</span>
                  </button>

                  <button
                    onClick={onRequestJoin}
                    disabled={actionLoading || !team.isOpen || !hasAvailableSeats}
                    className="btn btn-secondary text-xs h-9 px-4 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Request to join</span>
                  </button>

                  <button
                    onClick={onRedeemToken}
                    className="btn btn-ghost text-xs h-9 px-3 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    <span>Redeem token</span>
                  </button>
                </>
              )}

              {isUnauthenticated && (
                <>
                  <button
                    onClick={onRequestJoin}
                    className="btn btn-primary text-xs h-9 px-4 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign in to Join</span>
                  </button>

                  <button
                    onClick={onRedeemToken}
                    className="btn btn-secondary text-xs h-9 px-3.5 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    <span>Redeem Token</span>
                  </button>
                </>
              )}
            </div>

            {/* Destructive Actions (Leave / Disband) */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {isMember && !isLeader && (
                <button
                  onClick={onLeaveTeam}
                  disabled={actionLoading}
                  className="btn btn-secondary text-xs h-9 px-3.5 inline-flex items-center gap-1.5 cursor-pointer text-danger hover:border-danger hover:text-danger"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Leave Team</span>
                </button>
              )}

              {isLeader && (
                <button
                  onClick={onDisbandTeam}
                  disabled={actionLoading}
                  className="btn btn-secondary text-xs h-9 px-3.5 inline-flex items-center gap-1.5 cursor-pointer text-danger hover:border-danger hover:text-danger"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Disband Squad</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3.5 bg-danger-bg border border-[#FCA5A5] rounded text-danger text-xs flex items-center gap-2">
            <Radio className="w-4 h-4 shrink-0" />
            <span>
              This squad has been disbanded by its leader. All memberships and reservations are
              closed.
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
