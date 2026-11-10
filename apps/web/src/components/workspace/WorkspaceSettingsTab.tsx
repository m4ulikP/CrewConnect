import React from "react";
import { ShieldAlert, DoorOpen, DoorClosed, Edit, ArrowRightLeft, Trash2 } from "lucide-react";
import type { TeamRecord } from "../../lib/api";
import type { WorkspaceUserRole } from "./WorkspaceHeader";

interface WorkspaceSettingsTabProps {
  userRole: WorkspaceUserRole;
  team: TeamRecord;
  actionLoading: boolean;
  onToggleOpenStatus: () => void;
  onEditTeam: () => void;
  onTransferLeadership: () => void;
  onDisbandTeam: () => void;
}

export const WorkspaceSettingsTab: React.FC<WorkspaceSettingsTabProps> = ({
  userRole,
  team,
  actionLoading,
  onToggleOpenStatus,
  onEditTeam,
  onTransferLeadership,
  onDisbandTeam,
}) => {
  const isLeader = userRole === "leader";
  const isDisbanded = team.status === "DISBANDED";

  if (!isLeader) {
    return (
      <div className="bg-surface border border-border-subtle rounded-lg p-8 text-center space-y-3 pane-enter">
        <div className="w-10 h-10 rounded-full bg-surface-tonal border border-border-strong text-ink-secondary mx-auto flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-ink-muted" />
        </div>
        <h3 className="text-base font-serif font-medium text-ink-primary">
          Restricted to Squad Leader
        </h3>
        <p className="text-xs text-ink-secondary max-w-sm mx-auto">
          Administrative parameters, recruitment status, and lifecycle controls can only be adjusted
          by the squad leader.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-6 pane-enter shadow-xs">
      {/* Header */}
      <div className="pb-4 border-b border-border-subtle">
        <h2 className="text-base font-serif font-medium text-ink-primary">
          Squad Administrative Settings
        </h2>
        <p className="text-xs text-ink-secondary mt-0.5">
          Configure recruitment visibility, squad properties, and lifecycle state.
        </p>
      </div>

      <div className="space-y-6 divide-y divide-border-subtle text-xs">
        {/* Setting 1: Recruitment Mode */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-ink-primary">Recruiting Status</h3>
            <p className="text-ink-secondary">
              When recruitment is open, eligible hackathon participants can submit join applications
              or claim open seats.
            </p>
          </div>

          <button
            onClick={onToggleOpenStatus}
            disabled={
              actionLoading || isDisbanded || (team.memberCount >= team.maxCapacity && !team.isOpen)
            }
            className={`btn text-xs h-9 px-4 inline-flex items-center gap-1.5 cursor-pointer shrink-0 ${
              team.isOpen ? "btn-secondary" : "btn-primary"
            }`}
          >
            {team.isOpen ? (
              <>
                <DoorClosed className="w-3.5 h-3.5" />
                <span>Close Recruiting</span>
              </>
            ) : (
              <>
                <DoorOpen className="w-3.5 h-3.5" />
                <span>Open Recruiting</span>
              </>
            )}
          </button>
        </div>

        {/* Setting 2: Edit Metadata */}
        <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-ink-primary">Squad Metadata & Capacity</h3>
            <p className="text-ink-secondary">
              Update the squad title, mission description, sought technical proficiencies, or total
              capacity.
            </p>
          </div>

          <button
            onClick={onEditTeam}
            disabled={isDisbanded}
            className="btn btn-secondary text-xs h-9 px-4 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Team Details</span>
          </button>
        </div>

        {/* Setting 3: Transfer Leadership */}
        <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-ink-primary">Transfer Squad Leadership</h3>
            <p className="text-ink-secondary">
              Hand over primary administrative authority to another confirmed active member of the
              squad.
            </p>
          </div>

          <button
            onClick={onTransferLeadership}
            disabled={isDisbanded}
            className="btn btn-secondary text-xs h-9 px-4 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transfer Leadership</span>
          </button>
        </div>

        {/* Setting 4: Danger Zone */}
        <div className="pt-6">
          <div className="p-4 rounded-lg border border-danger/30 bg-danger-bg/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-danger">Danger Zone: Disband Squad</h3>
              <p className="text-ink-secondary leading-relaxed">
                Permanently dissolves this squad. All member seat reservations will be atomically
                released and the squad will be marked disbanded.
              </p>
            </div>

            <button
              onClick={onDisbandTeam}
              disabled={actionLoading || isDisbanded}
              className="btn btn-danger text-xs h-9 px-4 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Disband Squad</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
