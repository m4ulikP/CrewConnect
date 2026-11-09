import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Users,
  Shield,
  Clock,
  Edit,
  DoorOpen,
  DoorClosed,
  Trash2,
  LogOut,
  UserX,
  History,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  UserPlus,
  Mail,
  Key,
  Ticket,
  Check,
  X,
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
import { EditTeamModal } from "../components/EditTeamModal";
import { TransferLeadershipModal } from "../components/TransferLeadershipModal";
import { JoinRequestModal } from "../components/JoinRequestModal";
import { CreateInvitationModal } from "../components/CreateInvitationModal";
import { RedeemInvitationModal } from "../components/RedeemInvitationModal";

export const TeamDetails: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

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
  const [activeTab, setActiveTab] = useState<"roster" | "requests" | "invitations" | "history">(
    "roster"
  );

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isJoinRequestModalOpen, setIsJoinRequestModalOpen] = useState(false);
  const [isCreateInviteModalOpen, setIsCreateInviteModalOpen] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);

  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);
  const [confirmDisband, setConfirmDisband] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Idempotency keys (stable per user action, reused across network retries!)
  const [joinIdempotencyKey, setJoinIdempotencyKey] = useState<string>(() =>
    generateIdempotencyKey()
  );
  const [approveKeys, setApproveKeys] = useState<Record<string, string>>({});

  const fetchTeamData = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError(null);
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
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to load team details.");
      }
    } finally {
      setLoading(false);
    }
  }, [teamId, user]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  if (loading) {
    return (
      <div className="py-20 text-center space-y-4 max-w-5xl mx-auto px-4">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-xs text-slate-400">Loading team workspace...</p>
      </div>
    );
  }

  if (error && !team) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto px-4">
        <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-2xl text-rose-300 text-sm">
          {error || "Team not found."}
        </div>
        <Link
          to="/teams-preview"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
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

  const isSoleMember = team.memberCount === 1 && isLeader;
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
      setJoinIdempotencyKey(generateIdempotencyKey()); // fresh key for future actions
      await fetchTeamData();
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
      else setError("Failed to join team.");
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
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Back button */}
      <div>
        <Link
          to="/teams-preview"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Teams Directory</span>
        </Link>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex items-center justify-between text-emerald-300 text-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl flex items-center justify-between text-rose-300 text-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Team Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{team.name}</h1>
              {isDisbanded ? (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800">
                  DISBANDED
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                  ACTIVE
                </span>
              )}
              {!isDisbanded && (
                <span
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    team.isOpen
                      ? "bg-indigo-950/80 text-indigo-300 border-indigo-800"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {team.isOpen ? "OPEN FOR MEMBERS" : "CLOSED"}
                </span>
              )}
            </div>

            {team.tagline && <p className="text-sm text-slate-300 font-medium">{team.tagline}</p>}
            {team.description && (
              <p className="text-xs text-slate-400 max-w-3xl leading-relaxed pt-1">
                {team.description}
              </p>
            )}
          </div>

          {/* Leader action buttons toolbar */}
          {!isDisbanded && isLeader && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Team</span>
              </button>

              <button
                onClick={handleToggleOpenStatus}
                disabled={actionLoading || (team.memberCount >= team.maxCapacity && !team.isOpen)}
                className={`inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  team.isOpen
                    ? "bg-amber-950/40 text-amber-300 border-amber-800 hover:bg-amber-900/60"
                    : "bg-emerald-950/40 text-emerald-300 border-emerald-800 hover:bg-emerald-900/60"
                }`}
              >
                {team.isOpen ? (
                  <>
                    <DoorClosed className="w-3.5 h-3.5" />
                    <span>Close Team</span>
                  </>
                ) : (
                  <>
                    <DoorOpen className="w-3.5 h-3.5" />
                    <span>Open Team</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setConfirmDisband(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold rounded-xl border border-rose-800 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Disband</span>
              </button>
            </div>
          )}
        </div>

        {/* Capacity Bar & Skills */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Team Roster Capacity</span>
              <span className="font-mono text-white font-bold">
                {team.memberCount} / {team.maxCapacity} Members
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  team.memberCount >= team.maxCapacity ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${(team.memberCount / team.maxCapacity) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs text-slate-400 font-medium">Skills Needed</span>
            <div className="flex flex-wrap gap-1.5">
              {team.skillsNeeded.length > 0 ? (
                team.skillsNeeded.map((skill) => (
                  <span
                    key={skill}
                    className="text-[11px] font-medium px-2.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500 italic">No specific skills listed</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Non-member Join & Invitation Actions Banner */}
      {!isDisbanded && !isMember && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-900/50 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <UserPlus className="w-4 h-4 text-indigo-400" />
              <span>Looking to join this crew?</span>
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              {team.isOpen && hasAvailableSeats
                ? "This team is currently open for direct join. Secure your seat through the race-proof reservation engine."
                : "This team is full or closed, but you can still request to join or redeem a secret invitation."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {team.isOpen && hasAvailableSeats && (
              <button
                onClick={handleDirectJoin}
                disabled={actionLoading}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-emerald-600/20"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{actionLoading ? "Reserving..." : "Join Team Directly"}</span>
              </button>
            )}

            <button
              onClick={() => setIsJoinRequestModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-600/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Request to Join</span>
            </button>

            <button
              onClick={() => setIsRedeemModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
            >
              <Ticket className="w-3.5 h-3.5 text-indigo-400" />
              <span>Redeem Invitation</span>
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs (Roster, Join Requests, Invitations, Audit Trail) */}
      <div className="border-b border-slate-800 flex items-center space-x-2">
        <button
          onClick={() => setActiveTab("roster")}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === "roster"
              ? "border-indigo-500 text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Active Roster ({roster.length})</span>
        </button>

        {isLeader && (
          <>
            <button
              onClick={() => setActiveTab("requests")}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
                activeTab === "requests"
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Pending Requests</span>
              {joinRequests.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-600 text-white font-mono">
                  {joinRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("invitations")}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
                activeTab === "invitations"
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Key className="w-4 h-4" />
              <span>Invitations</span>
              {invitations.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                  {invitations.length}
                </span>
              )}
            </button>
          </>
        )}

        {auditLogs.length > 0 && (
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === "history"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Trail</span>
          </button>
        )}
      </div>

      {/* TAB 1: Roster */}
      {activeTab === "roster" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Team Members ({roster.length})
            </h2>

            {!isDisbanded && isMember && (
              <button
                onClick={() => setConfirmLeave(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>{isSoleMember ? "Leave & Disband Team" : "Leave Team"}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roster.map((member) => {
              const memUser = typeof member.userId === "object" ? member.userId : null;
              const memUserId = memUser ? memUser.id : String(member.userId);
              const isMemberLeader = member.role === "LEADER";
              const isCurrentUser = memUserId === currentUserIdStr;

              return (
                <div
                  key={member.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-indigo-400 border border-slate-700">
                        {memUser?.displayName?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-sm">
                            {memUser?.displayName || "Unknown Member"}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">{memUser?.email}</span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isMemberLeader
                          ? "bg-amber-950 text-amber-300 border-amber-800 flex items-center space-x-1"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {isMemberLeader && <Shield className="w-2.5 h-2.5 inline mr-1" />}
                      <span>{member.role}</span>
                    </span>
                  </div>

                  {memUser?.skills && memUser.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {memUser.skills.map((s) => (
                        <span
                          key={s}
                          className="text-[10px] font-medium px-2 py-0.5 bg-slate-950 text-slate-400 rounded-md border border-slate-800"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                    <div className="flex items-center space-x-1 text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                    </div>

                    {isLeader && !isMemberLeader && !isDisbanded && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setIsTransferModalOpen(true)}
                          className="text-amber-400 hover:text-amber-300 font-semibold text-[11px]"
                        >
                          Make Leader
                        </button>
                        <button
                          onClick={() =>
                            setMemberToRemove({
                              id: memUserId,
                              name: memUser?.displayName || "this member",
                            })
                          }
                          className="text-rose-400 hover:text-rose-300 font-semibold text-[11px] inline-flex items-center space-x-0.5"
                        >
                          <UserX className="w-3 h-3 inline" />
                          <span>Remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Leader Join Requests Review */}
      {activeTab === "requests" && isLeader && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Pending Join Requests ({joinRequests.length})
            </h2>
          </div>

          {joinRequests.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
              No pending join requests for this team.
            </div>
          ) : (
            <div className="space-y-3">
              {joinRequests.map((req) => {
                const reqUser = typeof req.userId === "object" ? req.userId : null;
                return (
                  <div
                    key={req.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-sm">
                          {reqUser?.displayName || "Applicant"}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">{reqUser?.email}</span>
                      </div>
                      {req.message && (
                        <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 italic">
                          "{req.message}"
                        </p>
                      )}
                      {reqUser?.skills && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {reqUser.skills.map((s) => (
                            <span
                              key={s}
                              className="text-[10px] font-medium px-2 py-0.5 bg-slate-800 text-indigo-300 rounded"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => handleApproveRequest(req.id)}
                        disabled={actionLoading || !hasAvailableSeats}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req.id)}
                        disabled={actionLoading}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Leader Invitations Management */}
      {activeTab === "invitations" && isLeader && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Active Team Invitations ({invitations.length})
            </h2>
            <button
              onClick={() => setIsCreateInviteModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-600/20"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Generate Invitation Token</span>
            </button>
          </div>

          {invitations.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
              No invitations created yet. Generate a secure token to invite specific teammates.
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/60">
              {invitations.map((inv) => (
                <div key={inv.id} className="p-4 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          inv.status === "ACTIVE"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {inv.status}
                      </span>
                      <span className="text-slate-300 font-mono">
                        Uses: {inv.usesCount} / {inv.maxUses}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Expires: {new Date(inv.expiresAt).toLocaleString()}
                    </p>
                  </div>

                  {inv.status === "ACTIVE" && (
                    <button
                      onClick={() => handleRevokeInvitation(inv.id)}
                      disabled={actionLoading}
                      className="text-rose-400 hover:text-rose-300 font-semibold text-xs px-2.5 py-1 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-900/50 rounded-lg transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Audit Logs */}
      {activeTab === "history" && auditLogs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Activity History & Audit Events
          </h2>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/60">
            {auditLogs.map((log) => {
              const actor = typeof log.actorId === "object" ? log.actorId : null;
              const target = typeof log.targetUserId === "object" ? log.targetUserId : null;
              return (
                <div key={log.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="font-mono text-indigo-400 font-semibold">
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <p className="text-slate-400 text-[11px]">
                      Triggered by{" "}
                      <span className="text-white font-medium">
                        {actor?.displayName || "System"}
                      </span>
                      {target && (
                        <>
                          {" "}
                          → Target:{" "}
                          <span className="text-white font-medium">{target.displayName}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="text-slate-400 text-[11px] font-mono">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {isEditModalOpen && (
        <EditTeamModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          team={team}
          onTeamUpdated={setTeam}
        />
      )}

      {isTransferModalOpen && (
        <TransferLeadershipModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          teamId={team.id}
          members={roster}
          currentLeaderId={leaderIdStr}
          onTransferred={() => fetchTeamData()}
        />
      )}

      {isJoinRequestModalOpen && (
        <JoinRequestModal
          isOpen={isJoinRequestModalOpen}
          onClose={() => setIsJoinRequestModalOpen(false)}
          teamId={team.id}
          teamName={team.name}
          onSuccess={() => {
            setSuccessMessage("Join request submitted to the team leader.");
            fetchTeamData();
          }}
        />
      )}

      {isCreateInviteModalOpen && (
        <CreateInvitationModal
          isOpen={isCreateInviteModalOpen}
          onClose={() => setIsCreateInviteModalOpen(false)}
          teamId={team.id}
          teamName={team.name}
          onSuccess={() => {
            setSuccessMessage("Invitation token generated.");
            fetchTeamData();
          }}
        />
      )}

      {isRedeemModalOpen && (
        <RedeemInvitationModal
          isOpen={isRedeemModalOpen}
          onClose={() => setIsRedeemModalOpen(false)}
          onSuccess={() => {
            setSuccessMessage("Invitation accepted! You have joined the crew.");
            fetchTeamData();
          }}
        />
      )}

      {/* Remove Member Confirmation Modal */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-white">Remove Team Member?</h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to remove{" "}
              <span className="font-semibold text-white">{memberToRemove.name}</span> from the team?
              Their seat will be freed up for other candidates.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setMemberToRemove(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl"
              >
                {actionLoading ? "Removing..." : "Confirm Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Team Confirmation Modal */}
      {confirmLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-white">Leave Team?</h3>
            <p className="text-xs text-slate-300">
              {isSoleMember
                ? "You are the sole remaining member. Leaving now will atomically disband the team and free the team name."
                : "Are you sure you want to leave this team? You will surrender your seat on the roster."}
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setConfirmLeave(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveTeam}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl"
              >
                {actionLoading ? "Leaving..." : "Confirm Leave"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disband Team Confirmation Modal */}
      {confirmDisband && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-rose-400 flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              <span>Disband Entire Team?</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              This action is permanent and immediate. All active memberships will be terminated, the
              roster count will be reset to 0, and the team will be permanently closed.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setConfirmDisband(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDisbandTeam}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl"
              >
                {actionLoading ? "Disbanding..." : "Confirm Disband"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
