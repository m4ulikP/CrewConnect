import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  REALTIME_EVENTS,
  type TeamMemberJoinedPayload,
  type TeamMemberLeftPayload,
  type TeamUpdatedPayload,
  type TeamCapacityUpdatedPayload,
  type TeamDisbandedPayload,
  type LeadershipTransferredPayload,
  type JoinRequestSubmittedPayload,
  type JoinRequestResolvedPayload,
} from "@crewconnect/shared";
import {
  Edit,
  DoorOpen,
  DoorClosed,
  Trash2,
  LogOut,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Key,
  Ticket,
  Send,
} from "lucide-react";
import {
  apiGetTeam,
  apiGetTeamRoster,
  apiGetTeamAuditLogs,
  apiOpenTeam,
  apiCloseTeam,
  apiLeaveTeam,
  apiRemoveMember,
  apiDisbandTeam,
  apiJoinTeam,
  apiGetJoinRequests,
  apiApproveJoinRequest,
  apiRejectJoinRequest,
  apiGetInvitations,
  apiRevokeInvitation,
  generateIdempotencyKey,
  ApiClientError,
  type TeamRecord,
  type TeamMemberRecord,
  type AuditLogRecord,
  type JoinRequestRecord,
  type InvitationRecord,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { EditTeamModal } from "../components/EditTeamModal";
import { TransferLeadershipModal } from "../components/TransferLeadershipModal";
import { JoinRequestModal } from "../components/JoinRequestModal";
import { CreateInvitationModal } from "../components/CreateInvitationModal";
import { RedeemInvitationModal } from "../components/RedeemInvitationModal";
import { Avatar } from "../components/Avatar";
import { CapacityBadge } from "../components/CapacityBadge";

export const TeamDetails: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    socket,
    connectionState,
    joinTeamRoom,
    leaveTeamRoom,
    joinHackathonRoom,
    leaveHackathonRoom,
  } = useSocket();
  const wasDisconnectedRef = useRef(false);

  const [team, setTeam] = useState<TeamRecord | null>(null);
  const [roster, setRoster] = useState<TeamMemberRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequestRecord[]>([]);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tabs state
  const [activeTab, setActiveTab] = useState<
    "roster" | "requests" | "invitations" | "history" | "settings"
  >("roster");

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isJoinRequestModalOpen, setIsJoinRequestModalOpen] = useState(false);
  const [isCreateInviteModalOpen, setIsCreateInviteModalOpen] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);

  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);
  const [confirmDisband, setConfirmDisband] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Idempotency keys (stable per user action)
  const [joinIdempotencyKey, setJoinIdempotencyKey] = useState<string>(() =>
    generateIdempotencyKey()
  );
  const [approveKeys, setApproveKeys] = useState<Record<string, string>>({});

  const fetchTeamData = useCallback(
    async (silent = false) => {
      if (!teamId) return;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const [teamData, rosterData] = await Promise.all([
          apiGetTeam(teamId),
          apiGetTeamRoster(teamId),
        ]);
        setTeam(teamData);
        setRoster(rosterData);

        // Fetch audit logs if permitted
        try {
          const logs = await apiGetTeamAuditLogs(teamId);
          setAuditLogs(logs);
        } catch {
          // Non-members cannot view audit logs
        }

        // If user is leader, fetch join requests and invitations
        const leaderId =
          typeof teamData.leaderId === "object" && teamData.leaderId !== null
            ? teamData.leaderId.id
            : String(teamData.leaderId);

        if (user && leaderId === user.id) {
          try {
            const [reqs, invites] = await Promise.all([
              apiGetJoinRequests(teamId),
              apiGetInvitations(teamId),
            ]);
            setJoinRequests(reqs);
            setInvitations(invites);
          } catch {
            // Ignore
          }
        }
      } catch (err) {
        if (!silent) {
          if (err instanceof ApiClientError) {
            setError(err.message);
          } else {
            setError("Failed to load team details.");
          }
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [teamId, user]
  );

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  // Join Hackathon & Team rooms when eligible
  useEffect(() => {
    if (!user || !team) return;
    const hId = team.hackathonId;
    if (hId) {
      joinHackathonRoom(hId);
    }

    const userIsMember = roster.some((m) => {
      const memUserId = typeof m.userId === "object" ? m.userId.id : m.userId;
      return memUserId === user.id && m.status === "ACTIVE";
    });

    if (userIsMember && teamId) {
      joinTeamRoom(teamId);
    }

    return () => {
      if (hId) leaveHackathonRoom(hId);
      if (teamId) leaveTeamRoom(teamId);
    };
  }, [
    user,
    team?.hackathonId,
    teamId,
    roster,
    joinHackathonRoom,
    leaveHackathonRoom,
    joinTeamRoom,
    leaveTeamRoom,
  ]);

  // Resync from REST API after Socket reconnects
  useEffect(() => {
    if (connectionState === "reconnecting" || connectionState === "disconnected") {
      wasDisconnectedRef.current = true;
    } else if (connectionState === "connected" && wasDisconnectedRef.current && teamId) {
      wasDisconnectedRef.current = false;
      fetchTeamData(true);
    }
  }, [connectionState, teamId, fetchTeamData]);

  // Real-time Socket Listeners
  useEffect(() => {
    if (!socket || !teamId) return;

    const handleMemberJoined = (payload: TeamMemberJoinedPayload) => {
      if (payload.teamId !== teamId) return;
      setTeam((prev) =>
        prev
          ? {
              ...prev,
              memberCount: payload.memberCount,
              maxCapacity: payload.maxCapacity,
              isOpen: payload.isOpen,
            }
          : prev
      );
      fetchTeamData(true);
    };

    const handleMemberLeft = (payload: TeamMemberLeftPayload) => {
      if (payload.teamId !== teamId) return;
      if (user?.id === payload.userId) {
        leaveTeamRoom(teamId);
      }
      setTeam((prev) =>
        prev
          ? {
              ...prev,
              memberCount: payload.memberCount,
              maxCapacity: payload.maxCapacity,
              isOpen: payload.isOpen,
            }
          : prev
      );
      fetchTeamData(true);
    };

    const handleTeamUpdated = (payload: TeamUpdatedPayload) => {
      if (payload.teamId !== teamId) return;
      setTeam((prev) =>
        prev
          ? {
              ...prev,
              name: payload.name,
              tagline: payload.tagline,
              description: payload.description,
              skillsNeeded: payload.skillsNeeded,
              isOpen: payload.isOpen,
              maxCapacity: payload.maxCapacity,
              memberCount: payload.memberCount,
            }
          : prev
      );
    };

    const handleCapacityUpdated = (payload: TeamCapacityUpdatedPayload) => {
      if (payload.teamId !== teamId) return;
      setTeam((prev) =>
        prev
          ? {
              ...prev,
              memberCount: payload.memberCount,
              maxCapacity: payload.maxCapacity,
              isOpen: payload.isOpen,
            }
          : prev
      );
    };

    const handleLeadershipTransferred = (payload: LeadershipTransferredPayload) => {
      if (payload.teamId !== teamId) return;
      fetchTeamData(true);
    };

    const handleTeamDisbanded = (payload: TeamDisbandedPayload) => {
      if (payload.teamId !== teamId) return;
      leaveTeamRoom(teamId);
      setTeam((prev) =>
        prev ? { ...prev, status: "DISBANDED", isOpen: false, memberCount: 0 } : prev
      );
      setRoster([]);
      setSuccessMessage("This team has been disbanded by its leader.");
    };

    const handleJoinRequestSubmitted = (payload: JoinRequestSubmittedPayload) => {
      if (payload.teamId !== teamId) return;
      fetchTeamData(true);
    };

    const handleJoinRequestResolved = (payload: JoinRequestResolvedPayload) => {
      if (payload.teamId !== teamId) return;
      if (payload.status === "APPROVED") {
        setSuccessMessage("Your join request was approved! Welcome to the squad.");
      }
      fetchTeamData(true);
    };

    socket.on(REALTIME_EVENTS.TEAM_MEMBER_JOINED, handleMemberJoined);
    socket.on(REALTIME_EVENTS.TEAM_MEMBER_LEFT, handleMemberLeft);
    socket.on(REALTIME_EVENTS.TEAM_UPDATED, handleTeamUpdated);
    socket.on(REALTIME_EVENTS.TEAM_CAPACITY_UPDATED, handleCapacityUpdated);
    socket.on(REALTIME_EVENTS.LEADERSHIP_TRANSFERRED, handleLeadershipTransferred);
    socket.on(REALTIME_EVENTS.TEAM_DISBANDED, handleTeamDisbanded);
    socket.on(REALTIME_EVENTS.JOIN_REQUEST_SUBMITTED, handleJoinRequestSubmitted);
    socket.on(REALTIME_EVENTS.JOIN_REQUEST_APPROVED, handleJoinRequestResolved);
    socket.on(REALTIME_EVENTS.JOIN_REQUEST_REJECTED, handleJoinRequestResolved);

    return () => {
      socket.off(REALTIME_EVENTS.TEAM_MEMBER_JOINED, handleMemberJoined);
      socket.off(REALTIME_EVENTS.TEAM_MEMBER_LEFT, handleMemberLeft);
      socket.off(REALTIME_EVENTS.TEAM_UPDATED, handleTeamUpdated);
      socket.off(REALTIME_EVENTS.TEAM_CAPACITY_UPDATED, handleCapacityUpdated);
      socket.off(REALTIME_EVENTS.LEADERSHIP_TRANSFERRED, handleLeadershipTransferred);
      socket.off(REALTIME_EVENTS.TEAM_DISBANDED, handleTeamDisbanded);
      socket.off(REALTIME_EVENTS.JOIN_REQUEST_SUBMITTED, handleJoinRequestSubmitted);
      socket.off(REALTIME_EVENTS.JOIN_REQUEST_APPROVED, handleJoinRequestResolved);
      socket.off(REALTIME_EVENTS.JOIN_REQUEST_REJECTED, handleJoinRequestResolved);
    };
  }, [socket, teamId, user?.id, leaveTeamRoom, fetchTeamData]);

  if (loading) {
    return (
      <div className="py-20 text-center space-y-4 max-w-5xl mx-auto px-4">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto" />
        <p className="text-xs text-ink-secondary">Loading squad workspace...</p>
      </div>
    );
  }

  if (error && !team) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto px-4">
        <div className="p-4 bg-danger-bg border border-[#FCA5A5] rounded text-danger text-sm">
          {error || "Team not found."}
        </div>
        <Link
          to="/teams-preview"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Teams</span>
        </Link>
      </div>
    );
  }

  if (!team) return null;

  const leaderIdStr =
    typeof team.leaderId === "object" && team.leaderId !== null
      ? team.leaderId.id
      : String(team.leaderId);

  const currentUserIdStr = user?.id || "";
  const isLeader = leaderIdStr === currentUserIdStr;
  const isMember = roster.some((m) => {
    const memUserId = typeof m.userId === "object" ? m.userId.id : m.userId;
    return memUserId === currentUserIdStr && m.status === "ACTIVE";
  });

  const isDisbanded = team.status === "DISBANDED";
  const hasAvailableSeats = team.memberCount < team.maxCapacity;

  // Direct join handler (uses stable idempotency key)
  const handleDirectJoin = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await apiJoinTeam(team.id, joinIdempotencyKey);
      setSuccessMessage("Joined team successfully! Welcome to the crew.");
      setJoinIdempotencyKey(generateIdempotencyKey());
      await fetchTeamData();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        if (err.statusCode === 409) {
          await fetchTeamData(true);
        }
      } else {
        setError("Failed to join team.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      let key = approveKeys[requestId];
      if (!key) {
        key = generateIdempotencyKey();
        setApproveKeys((prev) => ({ ...prev, [requestId]: key }));
      }
      await apiApproveJoinRequest(team.id, requestId, key);
      setSuccessMessage("Join request approved! Member added to the team.");
      await fetchTeamData();
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
      else setError("Failed to approve join request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await apiRejectJoinRequest(team.id, requestId);
      setSuccessMessage("Join request rejected.");
      await fetchTeamData();
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
      else setError("Failed to reject join request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await apiRevokeInvitation(team.id, invitationId);
      setSuccessMessage("Invitation revoked.");
      await fetchTeamData();
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
      else setError("Failed to revoke invitation.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleOpenStatus = async () => {
    setActionLoading(true);
    setError(null);
    try {
      if (team.isOpen) {
        const updated = await apiCloseTeam(team.id);
        setTeam(updated);
        setSuccessMessage("Team closed from accepting new members.");
      } else {
        const updated = await apiOpenTeam(team.id);
        setTeam(updated);
        setSuccessMessage("Team is now open for new members!");
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
      else setError("Failed to update open status.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiRemoveMember(team.id, memberToRemove.id);
      setSuccessMessage(`Removed ${memberToRemove.name} from the team.`);
      setMemberToRemove(null);
      await fetchTeamData();
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
      else setError("Failed to remove member.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveTeam = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const result = await apiLeaveTeam(team.id);
      if (result.disbanded) {
        setSuccessMessage("You left the team. As the sole member, the team was disbanded.");
        navigate("/teams-preview");
      } else {
        setSuccessMessage("You have left the team.");
        navigate("/teams-preview");
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
      else setError("Failed to leave team.");
    } finally {
      setActionLoading(false);
      setConfirmLeave(false);
    }
  };

  const handleDisbandTeam = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await apiDisbandTeam(team.id);
      setSuccessMessage("Team has been successfully disbanded.");
      setConfirmDisband(false);
      await fetchTeamData();
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
      else setError("Failed to disband team.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8 pane-enter">
      {/* Top Directory Backlink */}
      <div>
        <Link
          to="/teams-preview"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Teams Directory</span>
        </Link>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 bg-positive-bg border border-[#BBF7D0] rounded flex items-center justify-between text-positive text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-positive shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-positive hover:underline font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-danger-bg border border-[#FCA5A5] rounded flex items-center justify-between text-danger text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-danger hover:underline font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Team Header Dossier Banner */}
      <div className="bg-surface border border-border-strong rounded-lg p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-3xl sm:text-4xl font-serif font-medium text-ink-primary tracking-tight">
                {team.name}
              </h1>
              {isDisbanded ? (
                <span className="status-label status-danger">DISBANDED</span>
              ) : (
                <span className="status-label status-open">ACTIVE</span>
              )}
              {!isDisbanded && (
                <span className={`status-label ${team.isOpen ? "status-open" : "status-full"}`}>
                  {team.isOpen ? "RECRUITING" : "CLOSED"}
                </span>
              )}
            </div>

            {team.tagline && (
              <p className="text-sm text-ink-secondary font-medium">{team.tagline}</p>
            )}
            {team.description && (
              <p className="text-xs text-ink-secondary max-w-3xl leading-relaxed pt-1">
                {team.description}
              </p>
            )}
            {team.skillsNeeded && team.skillsNeeded.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2">
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

          <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
            <CapacityBadge
              memberCount={team.memberCount}
              maxCapacity={team.maxCapacity}
              isOpen={team.isOpen}
              variant="indicator"
            />
            {isLeader && (
              <span className="text-[11px] font-semibold text-accent bg-accent-tint px-2 py-0.5 rounded">
                Leader permissions active
              </span>
            )}
          </div>
        </div>

        {/* Action Toolbar for Members / Leaders */}
        {!isDisbanded && (
          <div className="pt-4 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {isLeader && (
                <>
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="btn btn-secondary text-xs h-9 px-3.5 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Team</span>
                  </button>

                  <button
                    onClick={handleToggleOpenStatus}
                    disabled={
                      actionLoading || (team.memberCount >= team.maxCapacity && !team.isOpen)
                    }
                    className="btn btn-secondary text-xs h-9 px-3.5 cursor-pointer"
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

                  <button
                    onClick={() => setIsCreateInviteModalOpen(true)}
                    className="btn btn-primary text-xs h-9 px-3.5 cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Create Invite Link</span>
                  </button>
                </>
              )}

              {!isMember && (
                <>
                  <button
                    onClick={handleDirectJoin}
                    disabled={actionLoading || !team.isOpen || !hasAvailableSeats}
                    className="btn btn-primary text-xs h-9 px-4 cursor-pointer"
                  >
                    {actionLoading ? "Claiming seat..." : "Instant direct join"}
                  </button>

                  <button
                    onClick={() => {
                      if (!user) {
                        navigate("/login", { state: { from: `/teams/${team.id}` } });
                        return;
                      }
                      setIsJoinRequestModalOpen(true);
                    }}
                    disabled={actionLoading || !team.isOpen || !hasAvailableSeats}
                    className="btn btn-secondary text-xs h-9 px-4 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Request to join</span>
                  </button>

                  <button
                    onClick={() => {
                      if (!user) {
                        navigate("/login", { state: { from: `/teams/${team.id}` } });
                        return;
                      }
                      setIsRedeemModalOpen(true);
                    }}
                    className="btn btn-ghost text-xs h-9 px-3 cursor-pointer"
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    <span>Redeem token</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isMember && !isLeader && (
                <button
                  onClick={() => setConfirmLeave(true)}
                  className="btn btn-secondary text-xs h-9 px-3.5 cursor-pointer text-danger hover:border-danger hover:text-danger"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Leave Team</span>
                </button>
              )}

              {isLeader && (
                <button
                  onClick={() => setConfirmDisband(true)}
                  className="btn btn-secondary text-xs h-9 px-3.5 cursor-pointer text-danger hover:border-danger hover:text-danger"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Disband Squad</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-6 border-b border-border-subtle overflow-x-auto text-sm font-medium">
        <button
          onClick={() => setActiveTab("roster")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "roster"
              ? "border-accent text-ink-primary font-semibold"
              : "border-transparent text-ink-secondary hover:text-ink-primary"
          }`}
        >
          Roster & Mission
        </button>

        {isLeader && (
          <>
            <button
              onClick={() => setActiveTab("requests")}
              className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "requests"
                  ? "border-accent text-ink-primary font-semibold"
                  : "border-transparent text-ink-secondary hover:text-ink-primary"
              }`}
            >
              <span>Join Requests</span>
              {joinRequests.length > 0 && (
                <span className="text-[10px] bg-accent-tint text-accent px-1.5 py-0.2 rounded-full tabular">
                  {joinRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("invitations")}
              className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "invitations"
                  ? "border-accent text-ink-primary font-semibold"
                  : "border-transparent text-ink-secondary hover:text-ink-primary"
              }`}
            >
              <span>Invitations</span>
              {invitations.length > 0 && (
                <span className="text-[10px] bg-surface-tonal text-ink-secondary px-1.5 py-0.2 rounded-full tabular">
                  {invitations.length}
                </span>
              )}
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "history"
              ? "border-accent text-ink-primary font-semibold"
              : "border-transparent text-ink-secondary hover:text-ink-primary"
          }`}
        >
          Activity History
        </button>

        {isLeader && (
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "settings"
                ? "border-accent text-ink-primary font-semibold"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            Settings
          </button>
        )}
      </div>

      {/* Tab Panels */}
      {activeTab === "roster" && (
        <div className="space-y-6 pane-enter">
          <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h2 className="text-base font-serif font-medium text-ink-primary">
                Squad Members ({roster.length} / {team.maxCapacity})
              </h2>
              {isLeader && hasAvailableSeats && (
                <button
                  onClick={() => setIsCreateInviteModalOpen(true)}
                  className="btn btn-secondary text-xs h-8 px-3 cursor-pointer"
                >
                  <Key className="w-3 h-3" />
                  <span>Create invite link</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-border-subtle">
              {roster.map((member) => {
                const mUser = typeof member.userId === "object" ? member.userId : null;
                const mId = mUser ? mUser.id : String(member.userId);
                const mName = mUser ? mUser.displayName : "Member";
                const isMemberLeader = member.role === "LEADER";

                return (
                  <div
                    key={member.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5">
                      <Avatar name={mName} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-ink-primary">{mName}</span>
                          {isMemberLeader && (
                            <span className="text-[10px] font-semibold text-accent bg-accent-tint px-2 py-0.5 rounded">
                              Leader
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-ink-secondary mt-0.5">
                          {mUser?.skills && mUser.skills.length > 0 ? (
                            <span>{mUser.skills.join(", ")}</span>
                          ) : (
                            <span className="text-ink-muted italic">No public skills listed</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <span className="text-xs text-ink-muted tabular">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </span>

                      {isLeader && !isMemberLeader && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setIsTransferModalOpen(true)}
                            className="text-xs text-ink-secondary hover:text-accent font-medium cursor-pointer"
                          >
                            Transfer leadership
                          </button>
                          <button
                            onClick={() => setMemberToRemove({ id: mId, name: mName })}
                            className="text-xs text-danger hover:underline font-medium cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vacancy Callout */}
            {hasAvailableSeats && !isDisbanded && (
              <div className="p-4 rounded border border-dashed border-border-control bg-ground/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
                <div>
                  <span className="text-xs font-semibold text-accent block">
                    Open Seat {roster.length + 1} — Seeking Collaborator
                  </span>
                  <p className="text-[11px] text-ink-secondary mt-0.5">
                    Share an invite token or open direct join to allow teammates to claim this
                    vacancy.
                  </p>
                </div>
                {isLeader && (
                  <button
                    onClick={() => setIsCreateInviteModalOpen(true)}
                    className="btn btn-primary text-xs h-8 px-3 cursor-pointer shrink-0"
                  >
                    Create invite link
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Join Requests Tab */}
      {activeTab === "requests" && isLeader && (
        <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-4 pane-enter">
          <h2 className="text-base font-serif font-medium text-ink-primary">
            Pending Join Applications ({joinRequests.length})
          </h2>

          {joinRequests.length === 0 ? (
            <p className="text-xs text-ink-muted py-6 text-center italic">
              No pending join requests awaiting review.
            </p>
          ) : (
            <div className="divide-y divide-border-subtle">
              {joinRequests.map((req) => {
                const reqUser = typeof req.userId === "object" ? req.userId : null;
                const reqName = reqUser ? reqUser.displayName : "Applicant";

                return (
                  <div key={req.id} className="py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar name={reqName} size="sm" />
                        <div>
                          <span className="font-semibold text-sm text-ink-primary">{reqName}</span>
                          {reqUser?.email && (
                            <span className="text-xs text-ink-muted ml-2">{reqUser.email}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-ink-muted tabular">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {req.message && (
                      <p className="text-xs text-ink-secondary bg-surface-tonal p-3 rounded border border-border-subtle leading-relaxed">
                        "{req.message}"
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleRejectRequest(req.id)}
                        disabled={actionLoading}
                        className="btn btn-secondary text-xs h-8 px-3 cursor-pointer text-ink-secondary hover:text-danger"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleApproveRequest(req.id)}
                        disabled={actionLoading || !hasAvailableSeats}
                        className="btn btn-primary text-xs h-8 px-3 cursor-pointer"
                      >
                        {actionLoading ? "Processing..." : "Approve & add to roster"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === "invitations" && isLeader && (
        <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-4 pane-enter">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <h2 className="text-base font-serif font-medium text-ink-primary">
              Active Invitation Links ({invitations.length})
            </h2>
            <button
              onClick={() => setIsCreateInviteModalOpen(true)}
              className="btn btn-primary text-xs h-8 px-3 cursor-pointer"
            >
              <Key className="w-3 h-3" />
              <span>Create Token</span>
            </button>
          </div>

          {invitations.length === 0 ? (
            <p className="text-xs text-ink-muted py-6 text-center italic">
              No active invitations generated yet.
            </p>
          ) : (
            <div className="divide-y divide-border-subtle text-xs">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <span className="font-mono text-ink-primary font-semibold block">{inv.id}</span>
                    <span className="text-[11px] text-ink-muted mt-0.5 block tabular">
                      Uses: {inv.usesCount} / {inv.maxUses} • Expires:{" "}
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-accent-tint text-accent">
                      {inv.status}
                    </span>
                    <button
                      onClick={() => handleRevokeInvitation(inv.id)}
                      disabled={actionLoading}
                      className="text-danger hover:underline text-xs cursor-pointer font-medium ml-2"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity History Tab */}
      {activeTab === "history" && (
        <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-4 pane-enter">
          <h2 className="text-base font-serif font-medium text-ink-primary">
            Audit Activity Log ({auditLogs.length})
          </h2>
          <p className="text-xs text-ink-muted">
            Immutable log trail recorded with transactional guarantees.
          </p>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-ink-secondary py-6 text-center italic">
              No audit logs recorded for this squad.
            </p>
          ) : (
            <div className="divide-y divide-border-subtle text-xs">
              {auditLogs.map((log) => {
                const actorName =
                  typeof log.actorId === "object" ? log.actorId.displayName : "Member";

                return (
                  <div key={log.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Avatar name={actorName} size="sm" />
                      <div>
                        <span className="font-medium text-ink-primary">{actorName}</span>{" "}
                        <span className="text-ink-secondary">
                          {log.action.toLowerCase().replace(/_/g, " ")}
                        </span>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <span className="text-[11px] text-ink-muted block mt-0.5 font-mono">
                            {JSON.stringify(log.metadata)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-ink-muted tabular text-[11px] flex-shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && isLeader && (
        <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-6 pane-enter">
          <h2 className="text-base font-serif font-medium text-ink-primary pb-3 border-b border-border-subtle">
            Squad Settings & Control
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary">Recruiting Status</h3>
                <p className="text-xs text-ink-secondary mt-0.5">
                  When open, other participants can request or claim seats.
                </p>
              </div>
              <button
                onClick={handleToggleOpenStatus}
                disabled={actionLoading}
                className={`btn text-xs h-9 px-4 cursor-pointer ${
                  team.isOpen ? "btn-secondary" : "btn-primary"
                }`}
              >
                {team.isOpen ? "Close Recruiting" : "Open Recruiting"}
              </button>
            </div>

            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary">
                  Transfer Squad Leadership
                </h3>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Appoint another active member as the primary leader.
                </p>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="btn btn-secondary text-xs h-9 px-4 cursor-pointer"
              >
                Transfer Leadership
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <h3 className="text-sm font-semibold text-danger">Disband Squad</h3>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Permanently disbands the squad and releases all allocated seats.
                </p>
              </div>
              <button
                onClick={() => setConfirmDisband(true)}
                className="btn btn-danger text-xs h-9 px-4 cursor-pointer"
              >
                Disband Squad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialogs */}
      {confirmDisband && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/40 backdrop-blur-xs pane-enter"
        >
          <div className="bg-surface border border-border-strong rounded-lg w-full max-w-md p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-serif font-medium text-ink-primary">
              Confirm Disbanding Squad
            </h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Are you sure you want to disband <strong>{team.name}</strong>? This action cannot be
              reversed, and all members will be released.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDisband(false)}
                className="btn btn-secondary text-xs h-9 px-4 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDisbandTeam}
                disabled={actionLoading}
                className="btn btn-danger text-xs h-9 px-4 cursor-pointer"
              >
                {actionLoading ? "Disbanding..." : "Confirm Disband"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmLeave && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/40 backdrop-blur-xs pane-enter"
        >
          <div className="bg-surface border border-border-strong rounded-lg w-full max-w-md p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-serif font-medium text-ink-primary">Leave Squad</h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Are you sure you want to leave <strong>{team.name}</strong>? Your allocated seat will
              immediately become vacant.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmLeave(false)}
                className="btn btn-secondary text-xs h-9 px-4 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveTeam}
                disabled={actionLoading}
                className="btn btn-danger text-xs h-9 px-4 cursor-pointer"
              >
                {actionLoading ? "Leaving..." : "Confirm Leave"}
              </button>
            </div>
          </div>
        </div>
      )}

      {memberToRemove && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/40 backdrop-blur-xs pane-enter"
        >
          <div className="bg-surface border border-border-strong rounded-lg w-full max-w-md p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-serif font-medium text-ink-primary">Remove Member</h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Remove <strong>{memberToRemove.name}</strong> from the squad? Their reserved seat will
              be opened.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setMemberToRemove(null)}
                className="btn btn-secondary text-xs h-9 px-4 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                disabled={actionLoading}
                className="btn btn-danger text-xs h-9 px-4 cursor-pointer"
              >
                {actionLoading ? "Removing..." : "Remove Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {isEditModalOpen && team && (
        <EditTeamModal
          team={team}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onTeamUpdated={(updatedTeam) => {
            setTeam(updatedTeam);
            setSuccessMessage("Team details updated successfully.");
          }}
        />
      )}

      {isTransferModalOpen && team && (
        <TransferLeadershipModal
          teamId={team.id}
          members={roster}
          currentLeaderId={leaderIdStr}
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          onTransferred={() => {
            setSuccessMessage("Leadership transferred successfully.");
            fetchTeamData();
          }}
        />
      )}

      {isJoinRequestModalOpen && team && (
        <JoinRequestModal
          isOpen={isJoinRequestModalOpen}
          onClose={() => setIsJoinRequestModalOpen(false)}
          teamId={team.id}
          teamName={team.name}
          onSuccess={() => {
            setSuccessMessage("Join request submitted to squad leader.");
          }}
        />
      )}

      {isCreateInviteModalOpen && team && (
        <CreateInvitationModal
          isOpen={isCreateInviteModalOpen}
          onClose={() => setIsCreateInviteModalOpen(false)}
          teamId={team.id}
          teamName={team.name}
          onSuccess={() => {
            fetchTeamData();
          }}
        />
      )}

      {isRedeemModalOpen && (
        <RedeemInvitationModal
          isOpen={isRedeemModalOpen}
          onClose={() => setIsRedeemModalOpen(false)}
          onSuccess={(newTeamId) => {
            setSuccessMessage("Invitation redeemed successfully!");
            navigate(`/teams/${newTeamId}`);
          }}
        />
      )}
    </div>
  );
};
