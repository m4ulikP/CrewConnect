import React from "react";
import { Users, Target, ShieldCheck, Sparkles, ArrowRight, Clock, Key } from "lucide-react";
import type { TeamRecord, TeamMemberRecord, AuditLogRecord } from "../../lib/api";
import { Avatar } from "../Avatar";
import type { WorkspaceUserRole } from "./WorkspaceHeader";

interface WorkspaceOverviewTabProps {
  team: TeamRecord;
  roster: TeamMemberRecord[];
  auditLogs: AuditLogRecord[];
  userRole: WorkspaceUserRole;
  onSwitchTab: (tab: "roster" | "requests" | "invitations" | "activity" | "settings") => void;
  onCreateInvite: () => void;
  onRequestJoin: () => void;
  onDirectJoin: () => void;
}

export const WorkspaceOverviewTab: React.FC<WorkspaceOverviewTabProps> = ({
  team,
  roster,
  auditLogs,
  userRole,
  onSwitchTab,
  onCreateInvite,
  onRequestJoin,
  onDirectJoin,
}) => {
  const isLeader = userRole === "leader";
  const isMember = userRole === "member";
  const isVisitor = userRole === "non-member" || userRole === "unauthenticated";
  const hasAvailableSeats = team.memberCount < team.maxCapacity;
  const isDisbanded = team.status === "DISBANDED";

  return (
    <div className="space-y-6 pane-enter">
      {/* 3-Col Vital Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Capacity */}
        <div className="bg-surface border border-border-subtle rounded-lg p-4 space-y-1">
          <div className="flex items-center justify-between text-ink-muted text-xs">
            <span className="uppercase tracking-wider text-[10px] font-medium">
              Roster Allocation
            </span>
            <Users className="w-4 h-4 text-accent" />
          </div>
          <div className="text-2xl font-serif font-medium text-ink-primary tabular">
            {team.memberCount}{" "}
            <span className="text-sm font-sans text-ink-muted">/ {team.maxCapacity} seats</span>
          </div>
          <p className="text-[11px] text-ink-secondary">
            {hasAvailableSeats
              ? `${team.maxCapacity - team.memberCount} vacant seat${team.maxCapacity - team.memberCount === 1 ? "" : "s"} ready to claim`
              : "All squad seats currently filled"}
          </p>
        </div>

        {/* Metric 2: Recruitment */}
        <div className="bg-surface border border-border-subtle rounded-lg p-4 space-y-1">
          <div className="flex items-center justify-between text-ink-muted text-xs">
            <span className="uppercase tracking-wider text-[10px] font-medium">
              Recruitment Mode
            </span>
            <Target className="w-4 h-4 text-ink-secondary" />
          </div>
          <div className="text-2xl font-serif font-medium text-ink-primary">
            {isDisbanded ? (
              <span className="text-danger">Disbanded</span>
            ) : team.isOpen && hasAvailableSeats ? (
              <span className="text-positive">Open</span>
            ) : (
              <span className="text-ink-secondary">Closed</span>
            )}
          </div>
          <p className="text-[11px] text-ink-secondary">
            {isDisbanded
              ? "Squad is permanently disbanded"
              : team.isOpen && hasAvailableSeats
                ? "Accepting direct joins and applicant notes"
                : "Recruitment is currently locked"}
          </p>
        </div>

        {/* Metric 3: Squad Authority */}
        <div className="bg-surface border border-border-subtle rounded-lg p-4 space-y-1">
          <div className="flex items-center justify-between text-ink-muted text-xs">
            <span className="uppercase tracking-wider text-[10px] font-medium">
              Squad Leadership
            </span>
            <ShieldCheck className="w-4 h-4 text-accent" />
          </div>
          <div className="text-base font-serif font-medium text-ink-primary truncate">
            {team.leader?.displayName || "Squad Leader"}
          </div>
          <p className="text-[11px] text-ink-secondary truncate">
            {team.leader?.email ? team.leader.email : "Primary organizer"}
          </p>
        </div>
      </div>

      {/* Two Column Layout: Mission & Focus on Left, Roster Preview & Activity on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Mission, Objectives & Seeking Skills (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
              <Sparkles className="w-4 h-4 text-accent shrink-0" />
              <h2 className="text-base font-serif font-medium text-ink-primary">
                Squad Mission & Focus
              </h2>
            </div>

            <div className="prose prose-sm max-w-none text-ink-secondary space-y-3">
              <p className="leading-relaxed text-sm">
                {team.description || "No squad mission description provided yet."}
              </p>
            </div>

            {/* Skills Sought Section */}
            <div className="pt-4 border-t border-border-subtle space-y-2">
              <span className="text-xs font-semibold text-ink-primary block">
                Targeted Technical Proficiencies
              </span>
              {team.skillsNeeded && team.skillsNeeded.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {team.skillsNeeded.map((skill) => (
                    <span
                      key={skill}
                      className="text-xs px-2.5 py-1 rounded bg-surface-tonal border border-border-subtle text-ink-secondary font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-muted italic">
                  No specific skill proficiencies requested. All backgrounds welcome.
                </p>
              )}
            </div>
          </div>

          {/* Visitor or Member Collaboration Callout */}
          {!isDisbanded && (
            <div className="bg-ground/70 border border-border-strong rounded-lg p-5 space-y-3">
              <h3 className="text-sm font-serif font-medium text-ink-primary">
                {isVisitor
                  ? "Interested in building with this squad?"
                  : isLeader
                    ? "Expand squad capabilities"
                    : "Squad Collaboration"}
              </h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                {isVisitor
                  ? team.isOpen && hasAvailableSeats
                    ? "This squad is actively recruiting contributors. You can submit an application with a note or claim an open seat directly."
                    : "Recruitment is currently closed for this squad. You can check back later or browse other active squads."
                  : isLeader
                    ? "Generate an invitation token to bring specific collaborators directly onto the roster, or review incoming applications in the Join Requests tab."
                    : "Collaborate with your teammates on hackathon architecture and deliverables."}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {isVisitor && team.isOpen && hasAvailableSeats && (
                  <>
                    <button
                      onClick={onDirectJoin}
                      className="btn btn-primary text-xs h-8 px-3.5 cursor-pointer"
                    >
                      Instant Direct Join
                    </button>
                    <button
                      onClick={onRequestJoin}
                      className="btn btn-secondary text-xs h-8 px-3.5 cursor-pointer"
                    >
                      Request to Join
                    </button>
                  </>
                )}
                {isLeader && hasAvailableSeats && (
                  <button
                    onClick={onCreateInvite}
                    className="btn btn-secondary text-xs h-8 px-3.5 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Generate Invite Token</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Roster Preview & Recent Audit Log Stream (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Confirmed Roster Summary */}
          <div className="bg-surface border border-border-subtle rounded-lg p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h3 className="text-sm font-serif font-medium text-ink-primary">
                Active Crew ({roster.length} / {team.maxCapacity})
              </h3>
              <button
                onClick={() => onSwitchTab("roster")}
                className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>View Full Roster</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-border-subtle">
              {roster.slice(0, 4).map((member) => {
                const mUser = typeof member.userId === "object" ? member.userId : null;
                const mName = mUser ? mUser.displayName : "Squad Member";
                const isMemberLeader = member.role === "LEADER";

                return (
                  <div key={member.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={mName} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-xs text-ink-primary truncate">
                            {mName}
                          </span>
                          {isMemberLeader && (
                            <span className="text-[9px] font-semibold text-accent bg-accent-tint px-1.5 py-0.2 rounded">
                              Leader
                            </span>
                          )}
                        </div>
                        {mUser?.skills && mUser.skills.length > 0 && (
                          <p className="text-[10px] text-ink-muted truncate">
                            {mUser.skills.slice(0, 2).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-ink-muted tabular shrink-0">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Squad Activity Stream */}
          <div className="bg-surface border border-border-subtle rounded-lg p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-ink-secondary" />
                <h3 className="text-sm font-serif font-medium text-ink-primary">
                  Recent Squad Activity
                </h3>
              </div>
              {(isMember || isLeader) && (
                <button
                  onClick={() => onSwitchTab("activity")}
                  className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>All Events</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {isMember || isLeader ? (
              auditLogs.length > 0 ? (
                <div className="space-y-3">
                  {auditLogs.slice(0, 3).map((log) => {
                    const actorName =
                      typeof log.actorId === "object" ? log.actorId.displayName : "Member";

                    return (
                      <div key={log.id} className="text-xs flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-medium text-ink-primary">{actorName}</span>{" "}
                          <span className="text-ink-secondary">
                            {log.action.toLowerCase().replace(/_/g, " ")}
                          </span>
                        </div>
                        <span className="text-[10px] text-ink-muted tabular shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-ink-muted italic py-2">No activity logs recorded yet.</p>
              )
            ) : (
              <p className="text-xs text-ink-muted italic py-2">
                Detailed audit stream is restricted to confirmed squad members.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
