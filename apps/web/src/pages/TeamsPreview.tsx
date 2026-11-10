import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  Filter,
  Search,
  Plus,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Send,
} from "lucide-react";
import {
  REALTIME_EVENTS,
  type TeamCapacityUpdatedPayload,
  type TeamUpdatedPayload,
  type TeamDisbandedPayload,
} from "@crewconnect/shared";
import {
  apiGetHackathons,
  apiGetHackathonTeams,
  apiGetMyTeam,
  apiGetTeamRoster,
  apiJoinTeam,
  generateIdempotencyKey,
  ApiClientError,
  type HackathonRecord,
  type TeamRecord,
  type TeamMemberRecord,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { CreateTeamModal } from "../components/CreateTeamModal";
import { JoinRequestModal } from "../components/JoinRequestModal";
import { Avatar } from "../components/Avatar";
import { CapacityBadge } from "../components/CapacityBadge";

export const TeamsPreview: React.FC = () => {
  const { user } = useAuth();
  const { socket, connectionState, joinHackathonRoom, leaveHackathonRoom } = useSocket();
  const navigate = useNavigate();

  const [hackathons, setHackathons] = useState<HackathonRecord[]>([]);
  const [selectedHackathonId, setSelectedHackathonId] = useState<string>("");
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeamRoster, setSelectedTeamRoster] = useState<TeamMemberRecord[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const [myTeam, setMyTeam] = useState<{ team: TeamRecord; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hasVacancies, setHasVacancies] = useState(false);

  // Reservation UI States
  const [isJoining, setIsJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinRequestModalOpen, setIsJoinRequestModalOpen] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  const wasDisconnectedRef = useRef(false);

  // Load hackathons on mount
  useEffect(() => {
    let mounted = true;
    apiGetHackathons()
      .then((data) => {
        if (!mounted) return;
        setHackathons(data);
        if (data.length > 0) {
          setSelectedHackathonId(data[0].id);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch teams for selected hackathon
  const loadTeams = useCallback(async () => {
    if (!selectedHackathonId) return;
    setLoading(true);
    try {
      const [teamsData, myTeamData] = await Promise.all([
        apiGetHackathonTeams(selectedHackathonId, {
          search: search.trim() || undefined,
          hasVacancies: hasVacancies || undefined,
        }),
        user ? apiGetMyTeam(selectedHackathonId).catch(() => null) : Promise.resolve(null),
      ]);
      setTeams(teamsData);
      setMyTeam(myTeamData);
    } catch {
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, [selectedHackathonId, search, hasVacancies, user]);

  useEffect(() => {
    if (selectedHackathonId) {
      loadTeams();
    }
  }, [loadTeams, selectedHackathonId]);

  // Load selected team roster
  useEffect(() => {
    if (!selectedTeamId) {
      setSelectedTeamRoster([]);
      return;
    }
    let mounted = true;
    setLoadingRoster(true);
    apiGetTeamRoster(selectedTeamId)
      .then((members) => {
        if (mounted) setSelectedTeamRoster(members);
      })
      .catch(() => {
        if (mounted) setSelectedTeamRoster([]);
      })
      .finally(() => {
        if (mounted) setLoadingRoster(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedTeamId]);

  // Socket room subscription
  useEffect(() => {
    if (!selectedHackathonId || !user) return;
    joinHackathonRoom(selectedHackathonId);
    return () => {
      leaveHackathonRoom(selectedHackathonId);
    };
  }, [selectedHackathonId, user, joinHackathonRoom, leaveHackathonRoom]);

  // Re-sync on reconnect
  useEffect(() => {
    if (connectionState === "reconnecting" || connectionState === "disconnected") {
      wasDisconnectedRef.current = true;
    } else if (
      connectionState === "connected" &&
      wasDisconnectedRef.current &&
      selectedHackathonId
    ) {
      wasDisconnectedRef.current = false;
      loadTeams();
    }
  }, [connectionState, selectedHackathonId, loadTeams]);

  // Real-time events
  useEffect(() => {
    if (!socket || !selectedHackathonId) return;

    const handleCapacityUpdated = (payload: TeamCapacityUpdatedPayload) => {
      if (payload.hackathonId !== selectedHackathonId) return;
      setTeams((prev) => {
        const exists = prev.some((t) => t.id === payload.teamId);
        if (!exists) {
          loadTeams();
          return prev;
        }
        return prev.map((t) =>
          t.id === payload.teamId
            ? {
                ...t,
                memberCount: payload.memberCount,
                maxCapacity: payload.maxCapacity,
                isOpen: payload.isOpen,
              }
            : t
        );
      });
    };

    const handleTeamUpdated = (payload: TeamUpdatedPayload) => {
      if (payload.hackathonId !== selectedHackathonId) return;
      setTeams((prev) =>
        prev.map((t) =>
          t.id === payload.teamId
            ? {
                ...t,
                name: payload.name,
                tagline: payload.tagline,
                description: payload.description,
                skillsNeeded: payload.skillsNeeded,
                isOpen: payload.isOpen,
                maxCapacity: payload.maxCapacity,
                memberCount: payload.memberCount,
              }
            : t
        )
      );
    };

    const handleTeamDisbanded = (payload: TeamDisbandedPayload) => {
      if (payload.hackathonId !== selectedHackathonId) return;
      setTeams((prev) => prev.filter((t) => t.id !== payload.teamId));
      if (selectedTeamId === payload.teamId) {
        setSelectedTeamId(null);
      }
      setMyTeam((prev) => (prev && prev.team.id === payload.teamId ? null : prev));
    };

    socket.on(REALTIME_EVENTS.TEAM_CAPACITY_UPDATED, handleCapacityUpdated);
    socket.on(REALTIME_EVENTS.TEAM_UPDATED, handleTeamUpdated);
    socket.on(REALTIME_EVENTS.TEAM_DISBANDED, handleTeamDisbanded);

    return () => {
      socket.off(REALTIME_EVENTS.TEAM_CAPACITY_UPDATED, handleCapacityUpdated);
      socket.off(REALTIME_EVENTS.TEAM_UPDATED, handleTeamUpdated);
      socket.off(REALTIME_EVENTS.TEAM_DISBANDED, handleTeamDisbanded);
    };
  }, [socket, selectedHackathonId, loadTeams, selectedTeamId]);

  // Handle direct join adhering to strict 7-step sequence
  const handleDirectJoin = async (team: TeamRecord) => {
    if (!user) {
      navigate("/login", { state: { from: `/teams/${team.id}` } });
      return;
    }

    setIsJoining(true);
    setJoinSuccess(null);
    setJoinError(null);

    const idempotencyKey = generateIdempotencyKey();

    try {
      await apiJoinTeam(team.id, idempotencyKey);
      setJoinSuccess(`Successfully joined ${team.name}! You are now confirmed.`);
      // Reconcile client data with server response
      await loadTeams();
      if (selectedTeamId === team.id) {
        const roster = await apiGetTeamRoster(team.id).catch(() => []);
        setSelectedTeamRoster(roster);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 409) {
          setJoinError("Team is now full. The final seat was claimed by another participant.");
          await loadTeams();
        } else if (err.statusCode === 400 && err.code === "ALREADY_IN_TEAM") {
          setJoinError("You are already committed to another team in this hackathon.");
        } else {
          setJoinError(err.message || "Failed to claim seat. Please try again.");
        }
      } else {
        setJoinError("Network error claiming seat. Please verify your connection.");
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateTeamClick = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setIsCreateModalOpen(true);
  };

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || null;
  const isSelectedFull = selectedTeam ? selectedTeam.memberCount >= selectedTeam.maxCapacity : false;
  const isUserInSelected = selectedTeam && myTeam && myTeam.team.id === selectedTeam.id;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6 pane-enter">
      {/* Top Banner / Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-medium text-ink-primary flex items-center gap-3">
            <span>Hackathon Teams Directory</span>
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary mt-1">
            Browse active squads, discover complementary teammates, and claim verified open seats.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {myTeam ? (
            <Link
              to={`/teams/${myTeam.team.id}`}
              className="btn btn-secondary text-xs h-9 px-4"
            >
              <span>View My Team ({myTeam.team.name})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <button
              onClick={handleCreateTeamClick}
              className="btn btn-primary text-xs h-9 px-4 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create a Team</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {hackathons.length > 1 && (
          <select
            value={selectedHackathonId}
            onChange={(e) => {
              setSelectedHackathonId(e.target.value);
              setSelectedTeamId(null);
            }}
            className="form-input sm:w-64 text-xs h-10"
          >
            {hackathons.map((h) => (
              <option key={h.id} value={h.id}>
                {h.title}
              </option>
            ))}
          </select>
        )}

        <div className="relative flex-1">
          <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search teams by name, tagline or technology..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-10 text-xs h-10"
          />
        </div>

        <button
          type="button"
          onClick={() => setHasVacancies(!hasVacancies)}
          className={`btn text-xs h-10 px-4 cursor-pointer ${
            hasVacancies ? "btn-primary" : "btn-secondary"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Vacancies Only</span>
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-20 text-center space-y-3">
          <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full mx-auto" />
          <p className="text-xs text-ink-secondary">Loading teams...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && teams.length === 0 && (
        <div className="py-16 text-center space-y-4 bg-surface border border-border-subtle rounded-lg p-8">
          <div className="w-12 h-12 rounded-full bg-surface-tonal text-ink-secondary flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-serif text-ink-primary font-medium">No Teams Found</h2>
          <p className="text-xs sm:text-sm text-ink-secondary max-w-sm mx-auto leading-relaxed">
            {search || hasVacancies
              ? "No teams match your search or filter criteria. Try broadening your parameters."
              : "No teams have registered for this hackathon yet. Be the first to launch one!"}
          </p>
          {!myTeam && (
            <button
              onClick={handleCreateTeamClick}
              className="btn btn-primary text-xs h-9 px-4 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Team</span>
            </button>
          )}
        </div>
      )}

      {/* Master-Detail Layout */}
      {!loading && teams.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Master Team List (5 cols on desktop, hidden on mobile if detail active) */}
          <div
            className={`lg:col-span-5 space-y-3 ${
              showMobileDetail ? "hidden lg:block" : "block"
            }`}
          >
            <div className="text-xs text-ink-muted pb-1 tabular">
              Showing {teams.length} squad{teams.length === 1 ? "" : "s"}
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[750px] pr-1">
              {teams.map((team) => {
                const isFull = team.memberCount >= team.maxCapacity;
                const isSelected = team.id === selectedTeamId;

                return (
                  <div
                    key={team.id}
                    onClick={() => {
                      setSelectedTeamId(team.id);
                      setShowMobileDetail(true);
                      setJoinSuccess(null);
                      setJoinError(null);
                    }}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-surface border-accent shadow-xs ring-1 ring-accent"
                        : "bg-surface border-border-subtle hover:border-border-strong hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-ink-primary text-sm leading-tight">
                          {team.name}
                        </h2>
                        {team.tagline && (
                          <p className="text-xs text-ink-secondary mt-1 line-clamp-2 leading-relaxed">
                            {team.tagline}
                          </p>
                        )}
                      </div>
                      <CapacityBadge memberCount={team.memberCount} maxCapacity={team.maxCapacity} />
                    </div>

                    <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
                      <span
                        className={`font-semibold ${
                          team.isOpen && !isFull ? "text-positive" : "text-ink-muted"
                        }`}
                      >
                        {team.isOpen && !isFull ? "Open for Join" : "Closed"}
                      </span>

                      <span className="text-[11px] text-accent font-medium">
                        View Dossier →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail Column (7 cols on desktop, full on mobile when active) */}
          <div
            className={`lg:col-span-7 ${
              showMobileDetail ? "block" : "hidden lg:block"
            }`}
          >
            {selectedTeam ? (
              <div className="bg-surface border border-border-strong rounded-lg p-6 sm:p-8 space-y-6 shadow-xs sticky top-24">
                {/* Mobile back button */}
                <button
                  type="button"
                  onClick={() => setShowMobileDetail(false)}
                  className="lg:hidden flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary mb-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to team list</span>
                </button>

                {/* Team Header */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 pb-4 border-b border-border-subtle">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">
                      Squad Dossier
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-serif font-medium text-ink-primary mt-1">
                      {selectedTeam.name}
                    </h2>
                  </div>

                  <CapacityBadge
                    memberCount={selectedTeam.memberCount}
                    maxCapacity={selectedTeam.maxCapacity}
                    isOpen={selectedTeam.isOpen}
                    variant="indicator"
                  />
                </div>

                {/* Description & Mission */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    Mission & Focus
                  </h3>
                  <p className="text-sm text-ink-secondary leading-relaxed">
                    {selectedTeam.description || selectedTeam.tagline || "No mission statement specified for this team yet."}
                  </p>
                </div>

                {/* Skills needed */}
                {selectedTeam.skillsNeeded && selectedTeam.skillsNeeded.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Seeking Capabilities
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTeam.skillsNeeded.map((skill) => (
                        <span
                          key={skill}
                          className="text-xs px-2.5 py-1 rounded bg-surface-tonal border border-border-subtle font-medium text-ink-primary"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confirmed Roster */}
                <div className="space-y-3 pt-2 border-t border-border-subtle">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    Confirmed Roster ({selectedTeamRoster.length} / {selectedTeam.maxCapacity})
                  </h3>

                  {loadingRoster ? (
                    <div className="py-4 text-xs text-ink-muted">Loading confirmed roster...</div>
                  ) : selectedTeamRoster.length === 0 ? (
                    <p className="text-xs text-ink-muted italic">Roster details synchronizing...</p>
                  ) : (
                    <div className="divide-y divide-border-subtle">
                      {selectedTeamRoster.map((member) => {
                        const mUser = typeof member.userId === "object" ? member.userId : null;
                        const mName = mUser ? mUser.displayName : "Squad Member";
                        const isLeader = member.role === "LEADER";

                        return (
                          <div key={member.id} className="py-2.5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <Avatar name={mName} size="sm" />
                              <div>
                                <span className="font-medium text-ink-primary">{mName}</span>
                                {isLeader && (
                                  <span className="ml-2 text-[10px] font-semibold text-accent bg-accent-tint px-1.5 py-0.5 rounded">
                                    Lead
                                  </span>
                                )}
                              </div>
                            </div>

                            <span className="text-ink-muted tabular text-[11px]">
                              Joined {new Date(member.joinedAt).toLocaleDateString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Reservation Box with Exact 7-Step Sequence */}
                <div className="p-5 rounded-lg border border-border-strong bg-ground/50 space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ink-primary">Seat Allocation</span>
                    <span className="font-mono text-ink-muted tabular">
                      Server confirmed: {selectedTeam.memberCount} / {selectedTeam.maxCapacity}
                    </span>
                  </div>

                  {/* Feedback alerts */}
                  {joinSuccess && (
                    <div className="p-3 rounded border border-[#BBF7D0] bg-positive-bg flex items-start gap-2 text-xs text-positive">
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>{joinSuccess}</div>
                    </div>
                  )}

                  {joinError && (
                    <div className="p-3 rounded border border-[#FCA5A5] bg-danger-bg flex items-start gap-2 text-xs text-danger">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>{joinError}</div>
                    </div>
                  )}

                  {/* Actions */}
                  {isUserInSelected ? (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-semibold text-accent">
                        You are a confirmed member of this squad.
                      </span>
                      <Link
                        to={`/teams/${selectedTeam.id}`}
                        className="btn btn-primary text-xs h-9 px-4"
                      >
                        Open Workspace
                      </Link>
                    </div>
                  ) : myTeam ? (
                    <p className="text-xs text-ink-secondary">
                      You are already committed to <strong>{myTeam.team.name}</strong> for this hackathon.
                    </p>
                  ) : isSelectedFull ? (
                    <p className="text-xs text-ink-muted italic">
                      This squad has reached maximum capacity ({selectedTeam.maxCapacity} seats filled).
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDirectJoin(selectedTeam)}
                        disabled={isJoining || !selectedTeam.isOpen}
                        className="btn btn-primary text-xs h-10 px-4 cursor-pointer"
                      >
                        {isJoining ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Claiming seat...</span>
                          </>
                        ) : (
                          <span>Instant direct join</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!user) {
                            navigate("/login");
                            return;
                          }
                          setIsJoinRequestModalOpen(true);
                        }}
                        className="btn btn-secondary text-xs h-10 px-4 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Request to join</span>
                      </button>

                      <Link
                        to={`/teams/${selectedTeam.id}`}
                        className="btn btn-ghost text-xs h-10 px-3"
                      >
                        <span>Workspace</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}

                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    Direct join sends an Idempotency-Key and awaits server transaction confirmation (HTTP 201) without optimistic seat decrement.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-border-subtle rounded-lg p-12 text-center text-ink-secondary text-sm">
                Select a squad from the directory to review its roster, vision, and vacancy status.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateTeamModal
          hackathons={hackathons}
          defaultHackathonId={selectedHackathonId}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onTeamCreated={(newTeam) => {
            navigate(`/teams/${newTeam.id}`);
          }}
        />
      )}

      {isJoinRequestModalOpen && selectedTeam && (
        <JoinRequestModal
          isOpen={isJoinRequestModalOpen}
          onClose={() => setIsJoinRequestModalOpen(false)}
          teamId={selectedTeam.id}
          teamName={selectedTeam.name}
          onSuccess={() => {
            setJoinSuccess("Your join request has been delivered to the squad leader.");
          }}
        />
      )}
    </div>
  );
};
