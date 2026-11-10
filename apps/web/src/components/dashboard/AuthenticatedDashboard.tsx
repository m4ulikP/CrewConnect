import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";
import {
  REALTIME_EVENTS,
  type TeamCapacityUpdatedPayload,
  type TeamUpdatedPayload,
  type TeamDisbandedPayload,
  type TeamMemberJoinedPayload,
  type TeamMemberLeftPayload,
  type JoinRequestSubmittedPayload,
  type JoinRequestResolvedPayload,
} from "@crewconnect/shared";
import {
  apiApproveJoinRequest,
  apiGetHackathons,
  apiGetHackathonTeams,
  apiGetJoinRequests,
  apiGetMyTeam,
  apiGetTeamAuditLogs,
  apiGetTeamRoster,
  apiRejectJoinRequest,
  ApiClientError,
  generateIdempotencyKey,
  type HackathonRecord,
} from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { CreateTeamModal } from "../CreateTeamModal";
import { RedeemInvitationModal } from "../RedeemInvitationModal";
import { DashboardHeader } from "./DashboardHeader";
import { MySquadsSection } from "./MySquadsSection";
import { PendingRequestsSection } from "./PendingRequestsSection";
import { InvitationsSection } from "./InvitationsSection";
import { RecentActivitySection } from "./RecentActivitySection";
import { DashboardQuickActions } from "./DashboardQuickActions";

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const AuthenticatedDashboard: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    socket,
    connectionState,
    joinHackathonRoom,
    leaveHackathonRoom,
    joinTeamRoom,
    leaveTeamRoom,
  } = useSocket();

  const [selectedHackathonId, setSelectedHackathonId] = useState<string>("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [requestFeedback, setRequestFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [redeemSuccessBanner, setRedeemSuccessBanner] = useState<string | null>(null);

  const idempotencyKeysRef = useRef<Record<string, string>>({});
  const wasDisconnectedRef = useRef(false);

  const userId = user?.id || "";

  // Reconcile expired session cleanly when any authenticated endpoint returns 401
  const handlePossibleAuthError = (err: unknown) => {
    if (err instanceof ApiClientError && err.statusCode === 401) {
      refreshUser();
    }
  };

  // Isolate user-scoped private cache: purge on unmount or identity change
  useEffect(() => {
    return () => {
      if (userId) {
        queryClient.removeQueries({ queryKey: ["dashboard", userId] });
      }
    };
  }, [queryClient, userId]);

  const hackathonsQuery = useQuery<HackathonRecord[]>({
    queryKey: ["dashboard", userId, "hackathons"],
    queryFn: () => apiGetHackathons(),
    enabled: Boolean(userId),
  });

  const hackathons = hackathonsQuery.data || [];
  const selectedHackathon =
    hackathons.find((h) => h.id === selectedHackathonId) ||
    hackathons.find((h) => h.status === "ACTIVE") ||
    hackathons[0] ||
    null;
  const activeHackathonId = selectedHackathon?.id || "";

  const myTeamQuery = useQuery({
    queryKey: ["dashboard", userId, "my-team", activeHackathonId],
    queryFn: async () => {
      try {
        return await apiGetMyTeam(activeHackathonId);
      } catch (err) {
        handlePossibleAuthError(err);
        throw err;
      }
    },
    enabled: Boolean(userId && activeHackathonId),
  });

  const myTeam = myTeamQuery.data ?? null;
  const activeTeamId = myTeam?.team?.id || "";
  const isLeader = myTeam?.role === "LEADER";

  const rosterQuery = useQuery({
    queryKey: ["dashboard", userId, "team-roster", activeTeamId],
    queryFn: async () => {
      try {
        return await apiGetTeamRoster(activeTeamId);
      } catch (err) {
        handlePossibleAuthError(err);
        throw err;
      }
    },
    enabled: Boolean(userId && activeTeamId),
  });

  const joinRequestsQuery = useQuery({
    queryKey: ["dashboard", userId, "join-requests", activeTeamId],
    queryFn: async () => {
      try {
        return await apiGetJoinRequests(activeTeamId);
      } catch (err) {
        handlePossibleAuthError(err);
        throw err;
      }
    },
    enabled: Boolean(userId && activeTeamId && isLeader),
  });

  const auditLogsQuery = useQuery({
    queryKey: ["dashboard", userId, "audit-logs", activeTeamId],
    queryFn: async () => {
      try {
        const logs = await apiGetTeamAuditLogs(activeTeamId);
        return logs.slice(0, 6);
      } catch (err) {
        handlePossibleAuthError(err);
        throw err;
      }
    },
    enabled: Boolean(userId && activeTeamId),
  });

  const openSquadsQuery = useQuery({
    queryKey: ["dashboard", userId, "open-squads", activeHackathonId],
    queryFn: () =>
      apiGetHackathonTeams(activeHackathonId, {
        limit: 4,
        hasVacancies: true,
      }),
    enabled: Boolean(userId && activeHackathonId),
  });

  const invalidateDashboard = () => {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
  };

  // Socket room lifecycle + authoritative REST reconciliation on hints
  useEffect(() => {
    if (!userId || !activeHackathonId) return;
    joinHackathonRoom(activeHackathonId);
    if (activeTeamId) {
      joinTeamRoom(activeTeamId);
    }
    return () => {
      leaveHackathonRoom(activeHackathonId);
      if (activeTeamId) leaveTeamRoom(activeTeamId);
    };
  }, [
    userId,
    activeHackathonId,
    activeTeamId,
    joinHackathonRoom,
    leaveHackathonRoom,
    joinTeamRoom,
    leaveTeamRoom,
  ]);

  useEffect(() => {
    if (connectionState === "reconnecting" || connectionState === "disconnected") {
      wasDisconnectedRef.current = true;
    } else if (connectionState === "connected" && wasDisconnectedRef.current && userId) {
      wasDisconnectedRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
    }
  }, [connectionState, userId, queryClient]);

  useEffect(() => {
    if (!socket || !userId) return;

    const handleReconcile = (
      _payload?:
        | TeamCapacityUpdatedPayload
        | TeamUpdatedPayload
        | TeamDisbandedPayload
        | TeamMemberJoinedPayload
        | TeamMemberLeftPayload
        | JoinRequestSubmittedPayload
        | JoinRequestResolvedPayload
    ) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
    };

    socket.on(REALTIME_EVENTS.TEAM_CAPACITY_UPDATED, handleReconcile);
    socket.on(REALTIME_EVENTS.TEAM_UPDATED, handleReconcile);
    socket.on(REALTIME_EVENTS.TEAM_DISBANDED, handleReconcile);
    socket.on(REALTIME_EVENTS.TEAM_MEMBER_JOINED, handleReconcile);
    socket.on(REALTIME_EVENTS.TEAM_MEMBER_LEFT, handleReconcile);
    socket.on(REALTIME_EVENTS.JOIN_REQUEST_SUBMITTED, handleReconcile);
    socket.on(REALTIME_EVENTS.JOIN_REQUEST_APPROVED, handleReconcile);
    socket.on(REALTIME_EVENTS.JOIN_REQUEST_REJECTED, handleReconcile);

    return () => {
      socket.off(REALTIME_EVENTS.TEAM_CAPACITY_UPDATED, handleReconcile);
      socket.off(REALTIME_EVENTS.TEAM_UPDATED, handleReconcile);
      socket.off(REALTIME_EVENTS.TEAM_DISBANDED, handleReconcile);
      socket.off(REALTIME_EVENTS.TEAM_MEMBER_JOINED, handleReconcile);
      socket.off(REALTIME_EVENTS.TEAM_MEMBER_LEFT, handleReconcile);
      socket.off(REALTIME_EVENTS.JOIN_REQUEST_SUBMITTED, handleReconcile);
      socket.off(REALTIME_EVENTS.JOIN_REQUEST_APPROVED, handleReconcile);
      socket.off(REALTIME_EVENTS.JOIN_REQUEST_REJECTED, handleReconcile);
    };
  }, [socket, userId, queryClient]);

  if (!user) return null;

  const handleApproveRequest = async (requestId: string) => {
    if (!activeTeamId || processingRequestId) return;
    setProcessingRequestId(requestId);
    setRequestFeedback(null);

    try {
      let key = idempotencyKeysRef.current[requestId];
      if (!key) {
        key = generateIdempotencyKey();
        idempotencyKeysRef.current[requestId] = key;
      }

      await apiApproveJoinRequest(activeTeamId, requestId, key);
      delete idempotencyKeysRef.current[requestId];
      setRequestFeedback({
        type: "success",
        message: "Join request approved. Roster and seat count updated from server confirmation.",
      });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
    } catch (err) {
      handlePossibleAuthError(err);
      setRequestFeedback({
        type: "error",
        message: getErrorMessage(err, "Failed to approve join request."),
      });
      if (err instanceof ApiClientError && err.statusCode === 409) {
        await queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
      }
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!activeTeamId || processingRequestId) return;
    setProcessingRequestId(requestId);
    setRequestFeedback(null);

    try {
      await apiRejectJoinRequest(activeTeamId, requestId);
      setRequestFeedback({
        type: "success",
        message: "Join request declined.",
      });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
    } catch (err) {
      handlePossibleAuthError(err);
      setRequestFeedback({
        type: "error",
        message: getErrorMessage(err, "Failed to decline join request."),
      });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const isRefreshing =
    hackathonsQuery.isFetching ||
    myTeamQuery.isFetching ||
    rosterQuery.isFetching ||
    openSquadsQuery.isFetching;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      <DashboardHeader
        user={user}
        hackathons={hackathons}
        selectedHackathon={selectedHackathon}
        onSelectHackathon={(nextId) => {
          setSelectedHackathonId(nextId);
          setRequestFeedback(null);
        }}
        myTeam={myTeam}
        loadingTeam={hackathonsQuery.isLoading || myTeamQuery.isLoading}
        onOpenCreateTeam={() => setIsCreateModalOpen(true)}
        onRefresh={invalidateDashboard}
        isRefreshing={isRefreshing}
      />

      {redeemSuccessBanner && (
        <div
          role="status"
          className="p-3.5 rounded-lg border border-[#BBF7D0] bg-positive-bg text-positive text-[13px] flex items-center justify-between gap-3"
        >
          <span>{redeemSuccessBanner}</span>
          <button
            type="button"
            onClick={() => setRedeemSuccessBanner(null)}
            className="font-semibold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hackathon directory failure guard */}
      {hackathonsQuery.isError && (
        <div
          role="alert"
          className="p-4 rounded-lg border border-border-strong bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]"
        >
          <div className="flex items-center gap-2 text-danger">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>
              {getErrorMessage(
                hackathonsQuery.error,
                "Unable to load hackathons. Retry to inspect your active memberships."
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => hackathonsQuery.refetch()}
            className="btn btn-secondary h-9 px-3.5 text-[13px] self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Main 12-Column Editorial Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Primary Column (7 cols): My Squads + Open Discovery Preview */}
        <div className="lg:col-span-7 space-y-6">
          <MySquadsSection
            selectedHackathon={selectedHackathon}
            myTeam={myTeam}
            loadingTeam={
              hackathonsQuery.isLoading || (Boolean(activeHackathonId) && myTeamQuery.isLoading)
            }
            teamError={
              myTeamQuery.isError
                ? getErrorMessage(
                    myTeamQuery.error,
                    "Unable to verify your active squad membership."
                  )
                : null
            }
            onRetryTeam={() => myTeamQuery.refetch()}
            roster={rosterQuery.data || []}
            loadingRoster={Boolean(activeTeamId) && rosterQuery.isLoading}
            rosterError={
              rosterQuery.isError
                ? getErrorMessage(rosterQuery.error, "Unable to load confirmed roster.")
                : null
            }
            onRetryRoster={() => rosterQuery.refetch()}
            openSquads={openSquadsQuery.data || []}
            loadingOpenSquads={
              hackathonsQuery.isLoading || (Boolean(activeHackathonId) && openSquadsQuery.isLoading)
            }
            openSquadsError={
              openSquadsQuery.isError
                ? getErrorMessage(openSquadsQuery.error, "Unable to load open squads preview.")
                : null
            }
            onRetryOpenSquads={() => openSquadsQuery.refetch()}
            onOpenCreateTeam={() => setIsCreateModalOpen(true)}
            onOpenRedeemInvite={() => setIsRedeemModalOpen(true)}
          />

          <DashboardQuickActions
            selectedHackathon={selectedHackathon}
            myTeam={myTeam}
            onOpenCreateTeam={() => setIsCreateModalOpen(true)}
            onOpenRedeemInvite={() => setIsRedeemModalOpen(true)}
          />
        </div>

        {/* Right Secondary Column (5 cols): Requests, Invitations, Persisted Activity */}
        <div className="lg:col-span-5 space-y-6">
          <PendingRequestsSection
            myTeam={myTeam}
            requests={joinRequestsQuery.data || []}
            loading={Boolean(activeTeamId && isLeader) && joinRequestsQuery.isLoading}
            error={
              joinRequestsQuery.isError
                ? getErrorMessage(joinRequestsQuery.error, "Unable to load join requests.")
                : null
            }
            onRetry={() => joinRequestsQuery.refetch()}
            processingRequestId={processingRequestId}
            actionFeedback={requestFeedback}
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
          />

          <InvitationsSection
            myTeam={myTeam}
            selectedHackathon={selectedHackathon}
            onOpenRedeemModal={() => setIsRedeemModalOpen(true)}
          />

          <RecentActivitySection
            myTeam={myTeam}
            logs={auditLogsQuery.data || []}
            loading={Boolean(activeTeamId) && auditLogsQuery.isLoading}
            error={
              auditLogsQuery.isError
                ? getErrorMessage(auditLogsQuery.error, "Unable to load squad activity history.")
                : null
            }
            onRetry={() => auditLogsQuery.refetch()}
          />
        </div>
      </div>

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateTeamModal
          hackathons={hackathons}
          defaultHackathonId={activeHackathonId}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onTeamCreated={(newTeam) => {
            invalidateDashboard();
            navigate(`/teams/${newTeam.id}`);
          }}
        />
      )}

      {isRedeemModalOpen && (
        <RedeemInvitationModal
          isOpen={isRedeemModalOpen}
          onClose={() => setIsRedeemModalOpen(false)}
          onSuccess={async (joinedTeamId) => {
            setRedeemSuccessBanner(
              "Invitation redeemed! Redirecting or refreshing your squad membership."
            );
            await queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
            navigate(`/teams/${joinedTeamId}`);
          }}
        />
      )}
    </div>
  );
};
