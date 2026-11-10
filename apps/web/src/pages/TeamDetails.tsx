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
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  LayoutDashboard,
  Users,
  Inbox,
  Key,
  History,
  Settings,
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
import { WorkspaceHeader, type WorkspaceUserRole } from "../components/workspace/WorkspaceHeader";
import { WorkspaceOverviewTab } from "../components/workspace/WorkspaceOverviewTab";
import { WorkspaceRosterTab } from "../components/workspace/WorkspaceRosterTab";
import { WorkspaceRequestsTab } from "../components/workspace/WorkspaceRequestsTab";
import { WorkspaceInvitationsTab } from "../components/workspace/WorkspaceInvitationsTab";
import { WorkspaceActivityTab } from "../components/workspace/WorkspaceActivityTab";
import { WorkspaceSettingsTab } from "../components/workspace/WorkspaceSettingsTab";
import { WorkspaceModals } from "../components/workspace/WorkspaceModals";

export type WorkspaceTab =
  "overview" | "roster" | "requests" | "invitations" | "activity" | "settings";

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

  // Core squad state
  const [team, setTeam] = useState<TeamRecord | null>(null);
  const [roster, setRoster] = useState<TeamMemberRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequestRecord[]>([]);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);

  // Loading & notification states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isJoinRequestModalOpen, setIsJoinRequestModalOpen] = useState(false);
  const [isCreateInviteModalOpen, setIsCreateInviteModalOpen] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);

  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);
  const [confirmDisband, setConfirmDisband] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Idempotency keys for mutations
  const [joinIdempotencyKey, setJoinIdempotencyKey] = useState<string>(() =>
    generateIdempotencyKey()
  );
  const [approveKeys, setApproveKeys] = useState<Record<string, string>>({});

  // Determine user role
  const leaderIdStr =
    team?.leaderId && typeof team.leaderId === "object"
      ? team.leaderId.id
      : String(team?.leaderId || "");

  const currentUserIdStr = user?.id || "";
  const isLeader = Boolean(user && leaderIdStr && leaderIdStr === currentUserIdStr);
  const isMember = roster.some((m) => {
    const memUserId = typeof m.userId === "object" ? m.userId.id : m.userId;
    return memUserId === currentUserIdStr && m.status === "ACTIVE";
  });

  const userRole: WorkspaceUserRole = !user
    ? "unauthenticated"
    : isLeader
      ? "leader"
      : isMember
        ? "member"
        : "non-member";

  // Data fetching
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

        // Fetch audit logs if user is confirmed member
        try {
          const logs = await apiGetTeamAuditLogs(teamId);
          setAuditLogs(logs);
        } catch {
          // Non-members receive 403 Forbidden on audit logs
        }

        // Fetch join requests & invitations if user is squad leader
        const effectiveLeaderId =
          typeof teamData.leaderId === "object" && teamData.leaderId !== null
            ? teamData.leaderId.id
            : String(teamData.leaderId);

        if (user && effectiveLeaderId === user.id) {
          try {
            const [reqs, invites] = await Promise.all([
              apiGetJoinRequests(teamId),
              apiGetInvitations(teamId),
            ]);
            setJoinRequests(reqs);
            setInvitations(invites);
          } catch {
            // Non-leaders are rejected
          }
        }
      } catch (err) {
        if (!silent) {
          if (err instanceof ApiClientError) {
            setError(err.message);
          } else {
            setError("Failed to load team workspace.");
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

  // Join Hackathon & Team socket rooms when eligible
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
      setSuccessMessage("This squad has been disbanded by its leader.");
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

  // Loading skeleton
  if (loading) {
    return (
      <div className="py-24 text-center space-y-4 max-w-5xl mx-auto px-4">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto" />
        <p className="text-xs text-ink-secondary">Loading squad workspace...</p>
      </div>
    );
  }

  // Not found or network error state
  if (error && !team) {
    return (
      <div className="py-24 text-center space-y-4 max-w-md mx-auto px-4">
        <div className="p-4 bg-danger-bg border border-[#FCA5A5] rounded text-danger text-sm">
          {error || "Squad workspace not found."}
        </div>
        <Link
          to="/teams-preview"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Teams Directory</span>
        </Link>
      </div>
    );
  }

  if (!team) return null;

  const hasAvailableSeats = team.memberCount < team.maxCapacity;

  // Mutation Handlers
  const handleDirectJoin = async () => {
    if (!user) {
      navigate("/login", { state: { from: `/teams/${team.id}` } });
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await apiJoinTeam(team.id, joinIdempotencyKey);
      setSuccessMessage("Joined squad successfully! Welcome to the crew.");
      setJoinIdempotencyKey(generateIdempotencyKey());
      await fetchTeamData();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        if (err.statusCode === 409) {
          await fetchTeamData(true);
        }
      } else {
        setError("Failed to join squad.");
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
      setSuccessMessage("Join application approved! Candidate admitted to the roster.");
      await fetchTeamData();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        if (err.statusCode === 409) {
          await fetchTeamData(true);
        }
      } else {
        setError("Failed to approve join request.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await apiRejectJoinRequest(team.id, requestId);
      setSuccessMessage("Join application declined.");
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
      setSuccessMessage("Invitation token revoked.");
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
        setSuccessMessage("Squad recruitment closed. Direct joins paused.");
      } else {
        const updated = await apiOpenTeam(team.id);
        setTeam(updated);
        setSuccessMessage("Squad recruitment opened! Teammates may now join.");
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
      else setError("Failed to update recruitment status.");
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
      setSuccessMessage(`Removed ${memberToRemove.name} from the squad.`);
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
        setSuccessMessage("You left the squad. As the sole member, the squad was disbanded.");
        navigate("/teams-preview");
      } else {
        setSuccessMessage("You have left the squad.");
        navigate("/teams-preview");
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
      else setError("Failed to leave squad.");
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
      setSuccessMessage("Squad has been successfully disbanded.");
      setConfirmDisband(false);
      await fetchTeamData();
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
      else setError("Failed to disband squad.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8 pane-enter">
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

      {/* Dossier Header */}
      <WorkspaceHeader
        team={team}
        roster={roster}
        userRole={userRole}
        actionLoading={actionLoading}
        connectionState={connectionState}
        onEditTeam={() => setIsEditModalOpen(true)}
        onToggleOpenStatus={handleToggleOpenStatus}
        onCreateInvite={() => setIsCreateInviteModalOpen(true)}
        onDirectJoin={handleDirectJoin}
        onRequestJoin={() => {
          if (!user) {
            navigate("/login", { state: { from: `/teams/${team.id}` } });
            return;
          }
          setIsJoinRequestModalOpen(true);
        }}
        onRedeemToken={() => {
          if (!user) {
            navigate("/login", { state: { from: `/teams/${team.id}` } });
            return;
          }
          setIsRedeemModalOpen(true);
        }}
        onLeaveTeam={() => setConfirmLeave(true)}
        onDisbandTeam={() => setConfirmDisband(true)}
      />

      {/* Workspace Tabs Navigation Bar */}
      <div className="flex items-center gap-6 border-b border-border-subtle overflow-x-auto text-sm font-medium scrollbar-none">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
            activeTab === "overview"
              ? "border-accent text-ink-primary font-semibold"
              : "border-transparent text-ink-secondary hover:text-ink-primary"
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab("roster")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
            activeTab === "roster"
              ? "border-accent text-ink-primary font-semibold"
              : "border-transparent text-ink-secondary hover:text-ink-primary"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Roster</span>
          <span className="text-[10px] bg-surface-tonal text-ink-secondary px-1.5 py-0.2 rounded-full tabular">
            {roster.length}/{team.maxCapacity}
          </span>
        </button>

        {isLeader && (
          <>
            <button
              onClick={() => setActiveTab("requests")}
              className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                activeTab === "requests"
                  ? "border-accent text-ink-primary font-semibold"
                  : "border-transparent text-ink-secondary hover:text-ink-primary"
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>Join Requests</span>
              {joinRequests.length > 0 && (
                <span className="text-[10px] bg-accent-tint text-accent font-semibold px-1.5 py-0.2 rounded-full tabular">
                  {joinRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("invitations")}
              className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                activeTab === "invitations"
                  ? "border-accent text-ink-primary font-semibold"
                  : "border-transparent text-ink-secondary hover:text-ink-primary"
              }`}
            >
              <Key className="w-4 h-4" />
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
          onClick={() => setActiveTab("activity")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
            activeTab === "activity"
              ? "border-accent text-ink-primary font-semibold"
              : "border-transparent text-ink-secondary hover:text-ink-primary"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Log</span>
          {auditLogs.length > 0 && (
            <span className="text-[10px] bg-surface-tonal text-ink-muted px-1.5 py-0.2 rounded-full tabular">
              {auditLogs.length}
            </span>
          )}
        </button>

        {isLeader && (
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
              activeTab === "settings"
                ? "border-accent text-ink-primary font-semibold"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        )}
      </div>

      {/* Active Tab Panel */}
      {activeTab === "overview" && (
        <WorkspaceOverviewTab
          team={team}
          roster={roster}
          auditLogs={auditLogs}
          userRole={userRole}
          onSwitchTab={(tab) => setActiveTab(tab)}
          onCreateInvite={() => setIsCreateInviteModalOpen(true)}
          onRequestJoin={() => {
            if (!user) {
              navigate("/login", { state: { from: `/teams/${team.id}` } });
              return;
            }
            setIsJoinRequestModalOpen(true);
          }}
          onDirectJoin={handleDirectJoin}
        />
      )}

      {activeTab === "roster" && (
        <WorkspaceRosterTab
          team={team}
          roster={roster}
          userRole={userRole}
          currentUserId={user?.id}
          onTransferLeadership={() => setIsTransferModalOpen(true)}
          onRemoveMember={(member) => setMemberToRemove(member)}
          onCreateInvite={() => setIsCreateInviteModalOpen(true)}
          onDirectJoin={handleDirectJoin}
          onRequestJoin={() => {
            if (!user) {
              navigate("/login", { state: { from: `/teams/${team.id}` } });
              return;
            }
            setIsJoinRequestModalOpen(true);
          }}
        />
      )}

      {activeTab === "requests" && (
        <WorkspaceRequestsTab
          userRole={userRole}
          joinRequests={joinRequests}
          hasAvailableSeats={hasAvailableSeats}
          actionLoading={actionLoading}
          onApproveRequest={handleApproveRequest}
          onRejectRequest={handleRejectRequest}
        />
      )}

      {activeTab === "invitations" && (
        <WorkspaceInvitationsTab
          userRole={userRole}
          invitations={invitations}
          actionLoading={actionLoading}
          onCreateInvite={() => setIsCreateInviteModalOpen(true)}
          onRevokeInvitation={handleRevokeInvitation}
        />
      )}

      {activeTab === "activity" && (
        <WorkspaceActivityTab userRole={userRole} auditLogs={auditLogs} />
      )}

      {activeTab === "settings" && (
        <WorkspaceSettingsTab
          userRole={userRole}
          team={team}
          actionLoading={actionLoading}
          onToggleOpenStatus={handleToggleOpenStatus}
          onEditTeam={() => setIsEditModalOpen(true)}
          onTransferLeadership={() => setIsTransferModalOpen(true)}
          onDisbandTeam={() => setConfirmDisband(true)}
        />
      )}

      {/* Modals & Confirmation Dialogs */}
      <WorkspaceModals
        team={team}
        roster={roster}
        leaderIdStr={leaderIdStr}
        actionLoading={actionLoading}
        isEditModalOpen={isEditModalOpen}
        isTransferModalOpen={isTransferModalOpen}
        isJoinRequestModalOpen={isJoinRequestModalOpen}
        isCreateInviteModalOpen={isCreateInviteModalOpen}
        isRedeemModalOpen={isRedeemModalOpen}
        confirmDisband={confirmDisband}
        confirmLeave={confirmLeave}
        memberToRemove={memberToRemove}
        onCloseEdit={() => setIsEditModalOpen(false)}
        onCloseTransfer={() => setIsTransferModalOpen(false)}
        onCloseJoinRequest={() => setIsJoinRequestModalOpen(false)}
        onCloseCreateInvite={() => setIsCreateInviteModalOpen(false)}
        onCloseRedeem={() => setIsRedeemModalOpen(false)}
        onCancelDisband={() => setConfirmDisband(false)}
        onCancelLeave={() => setConfirmLeave(false)}
        onCancelRemoveMember={() => setMemberToRemove(null)}
        onTeamUpdated={(updatedTeam) => {
          setTeam(updatedTeam);
          setSuccessMessage("Squad details updated successfully.");
        }}
        onLeadershipTransferred={() => {
          setSuccessMessage("Leadership transferred successfully.");
          fetchTeamData();
        }}
        onJoinRequestSubmitted={() => {
          setSuccessMessage("Join application submitted to squad leader.");
        }}
        onInviteCreated={() => {
          fetchTeamData();
        }}
        onInvitationRedeemed={(newTeamId) => {
          setSuccessMessage("Invitation redeemed successfully!");
          navigate(`/teams/${newTeamId}`);
        }}
        onConfirmDisband={handleDisbandTeam}
        onConfirmLeave={handleLeaveTeam}
        onConfirmRemoveMember={handleRemoveMember}
      />
    </div>
  );
};
