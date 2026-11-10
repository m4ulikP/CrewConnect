import React, { useEffect } from "react";
import { Trash2, LogOut, UserMinus } from "lucide-react";
import type { TeamRecord, TeamMemberRecord } from "../../lib/api";
import { EditTeamModal } from "../EditTeamModal";
import { TransferLeadershipModal } from "../TransferLeadershipModal";
import { JoinRequestModal } from "../JoinRequestModal";
import { CreateInvitationModal } from "../CreateInvitationModal";
import { RedeemInvitationModal } from "../RedeemInvitationModal";

interface WorkspaceModalsProps {
  team: TeamRecord;
  roster: TeamMemberRecord[];
  leaderIdStr: string;
  actionLoading: boolean;

  // Modal open states
  isEditModalOpen: boolean;
  isTransferModalOpen: boolean;
  isJoinRequestModalOpen: boolean;
  isCreateInviteModalOpen: boolean;
  isRedeemModalOpen: boolean;
  confirmDisband: boolean;
  confirmLeave: boolean;
  memberToRemove: { id: string; name: string } | null;

  // Close handlers
  onCloseEdit: () => void;
  onCloseTransfer: () => void;
  onCloseJoinRequest: () => void;
  onCloseCreateInvite: () => void;
  onCloseRedeem: () => void;
  onCancelDisband: () => void;
  onCancelLeave: () => void;
  onCancelRemoveMember: () => void;

  // Action handlers
  onTeamUpdated: (updatedTeam: TeamRecord) => void;
  onLeadershipTransferred: () => void;
  onJoinRequestSubmitted: () => void;
  onInviteCreated: () => void;
  onInvitationRedeemed: (teamId: string) => void;
  onConfirmDisband: () => void;
  onConfirmLeave: () => void;
  onConfirmRemoveMember: () => void;
}

export const WorkspaceModals: React.FC<WorkspaceModalsProps> = ({
  team,
  roster,
  leaderIdStr,
  actionLoading,

  isEditModalOpen,
  isTransferModalOpen,
  isJoinRequestModalOpen,
  isCreateInviteModalOpen,
  isRedeemModalOpen,
  confirmDisband,
  confirmLeave,
  memberToRemove,

  onCloseEdit,
  onCloseTransfer,
  onCloseJoinRequest,
  onCloseCreateInvite,
  onCloseRedeem,
  onCancelDisband,
  onCancelLeave,
  onCancelRemoveMember,

  onTeamUpdated,
  onLeadershipTransferred,
  onJoinRequestSubmitted,
  onInviteCreated,
  onInvitationRedeemed,
  onConfirmDisband,
  onConfirmLeave,
  onConfirmRemoveMember,
}) => {
  // ESC key handler for confirmation dialogs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmDisband) onCancelDisband();
        if (confirmLeave) onCancelLeave();
        if (memberToRemove) onCancelRemoveMember();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    confirmDisband,
    confirmLeave,
    memberToRemove,
    onCancelDisband,
    onCancelLeave,
    onCancelRemoveMember,
  ]);

  return (
    <>
      {/* Edit Team Modal */}
      {isEditModalOpen && (
        <EditTeamModal
          team={team}
          isOpen={isEditModalOpen}
          onClose={onCloseEdit}
          onTeamUpdated={onTeamUpdated}
        />
      )}

      {/* Transfer Leadership Modal */}
      {isTransferModalOpen && (
        <TransferLeadershipModal
          teamId={team.id}
          members={roster}
          currentLeaderId={leaderIdStr}
          isOpen={isTransferModalOpen}
          onClose={onCloseTransfer}
          onTransferred={onLeadershipTransferred}
        />
      )}

      {/* Join Request Modal */}
      {isJoinRequestModalOpen && (
        <JoinRequestModal
          isOpen={isJoinRequestModalOpen}
          onClose={onCloseJoinRequest}
          teamId={team.id}
          teamName={team.name}
          onSuccess={onJoinRequestSubmitted}
        />
      )}

      {/* Create Invitation Modal */}
      {isCreateInviteModalOpen && (
        <CreateInvitationModal
          isOpen={isCreateInviteModalOpen}
          onClose={onCloseCreateInvite}
          teamId={team.id}
          teamName={team.name}
          onSuccess={onInviteCreated}
        />
      )}

      {/* Redeem Invitation Modal */}
      {isRedeemModalOpen && (
        <RedeemInvitationModal
          isOpen={isRedeemModalOpen}
          onClose={onCloseRedeem}
          onSuccess={onInvitationRedeemed}
        />
      )}

      {/* Disband Squad Confirmation Dialog */}
      {confirmDisband && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="disband-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/40 pane-enter"
        >
          <div className="bg-surface border border-border-strong rounded-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-danger-bg border border-[#FCA5A5] text-danger shrink-0 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="disband-dialog-title"
                  className="text-lg font-serif font-medium text-ink-primary"
                >
                  Confirm Disband Squad
                </h3>
                <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                  Are you sure you want to permanently disband <strong>{team.name}</strong>? All
                  members will be released and capacity records vacated. This action cannot be
                  undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={onCancelDisband}
                disabled={actionLoading}
                className="btn btn-secondary text-xs h-9 px-4 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmDisband}
                disabled={actionLoading}
                className="btn btn-danger text-xs h-9 px-4 cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{actionLoading ? "Disbanding..." : "Confirm Disband"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Squad Confirmation Dialog */}
      {confirmLeave && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/40 pane-enter"
        >
          <div className="bg-surface border border-border-strong rounded-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-danger-bg border border-[#FCA5A5] text-danger shrink-0 flex items-center justify-center">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="leave-dialog-title"
                  className="text-lg font-serif font-medium text-ink-primary"
                >
                  Leave Squad
                </h3>
                <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                  Are you sure you want to leave <strong>{team.name}</strong>? Your seat allocation
                  will be immediately returned to the pool of open slots.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={onCancelLeave}
                disabled={actionLoading}
                className="btn btn-secondary text-xs h-9 px-4 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmLeave}
                disabled={actionLoading}
                className="btn btn-danger text-xs h-9 px-4 cursor-pointer inline-flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{actionLoading ? "Leaving..." : "Confirm Leave"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Dialog */}
      {memberToRemove && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-member-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/40 pane-enter"
        >
          <div className="bg-surface border border-border-strong rounded-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-danger-bg border border-[#FCA5A5] text-danger shrink-0 flex items-center justify-center">
                <UserMinus className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="remove-member-dialog-title"
                  className="text-lg font-serif font-medium text-ink-primary"
                >
                  Remove Member from Roster
                </h3>
                <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                  Remove <strong>{memberToRemove.name}</strong> from the squad? Their reserved seat
                  will be opened for recruitment.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={onCancelRemoveMember}
                disabled={actionLoading}
                className="btn btn-secondary text-xs h-9 px-4 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmRemoveMember}
                disabled={actionLoading}
                className="btn btn-danger text-xs h-9 px-4 cursor-pointer inline-flex items-center gap-1.5"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>{actionLoading ? "Removing..." : "Remove Member"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
