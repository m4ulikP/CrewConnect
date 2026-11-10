import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, Filter, Search, Plus, ExternalLink, ArrowRight } from "lucide-react";
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
  type HackathonRecord,
  type TeamRecord,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { CreateTeamModal } from "../components/CreateTeamModal";

export const TeamsPreview: React.FC = () => {
  const { user } = useAuth();
  const { socket, connectionState, joinHackathonRoom, leaveHackathonRoom } = useSocket();
  const navigate = useNavigate();

  const [hackathons, setHackathons] = useState<HackathonRecord[]>([]);
  const [selectedHackathonId, setSelectedHackathonId] = useState<string>("");
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [myTeam, setMyTeam] = useState<{ team: TeamRecord; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hasVacancies, setHasVacancies] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const wasDisconnectedRef = useRef(false);

  // Initial load: fetch hackathons
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
      .catch(() => {
        // Fallback or empty
      });
    return () => {
      mounted = false;
    };
  }, []);

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

  // Real-time room subscription & REST resync on reconnect
  useEffect(() => {
    if (!selectedHackathonId || !user) return;
    joinHackathonRoom(selectedHackathonId);
    return () => {
      leaveHackathonRoom(selectedHackathonId);
    };
  }, [selectedHackathonId, user, joinHackathonRoom, leaveHackathonRoom]);

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

  useEffect(() => {
    if (!socket || !selectedHackathonId) return;

    const handleCapacityUpdated = (payload: TeamCapacityUpdatedPayload) => {
      if (payload.hackathonId !== selectedHackathonId) return;
      setTeams((prev) => {
        const exists = prev.some((t) => t.id === payload.teamId);
        if (!exists) {
          // A newly created team appeared in this hackathon — re-sync via REST
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
  }, [socket, selectedHackathonId, loadTeams]);

  const handleCreateTeamClick = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setIsCreateModalOpen(true);
  };

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center space-x-3">
            <Users className="w-7 h-7 text-indigo-400" />
            <span>Hackathon Teams Directory</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Browse active teams, manage memberships, and initialize your team.
          </p>
        </div>

        {/* Action Button: Create Team or View My Team */}
        <div className="flex items-center space-x-3">
          {myTeam ? (
            <Link
              to={`/teams/${myTeam.team.id}`}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
            >
              <span>View My Team ({myTeam.team.name})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <button
              onClick={handleCreateTeamClick}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
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
            onChange={(e) => setSelectedHackathonId(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {hackathons.map((h) => (
              <option key={h.id} value={h.id}>
                {h.title}
              </option>
            ))}
          </select>
        )}

        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search teams by name, tagline or technology..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => setHasVacancies(!hasVacancies)}
          className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
            hasVacancies
              ? "bg-indigo-950/60 border-indigo-700 text-indigo-300"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Vacancies Only</span>
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-20 text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-xs text-slate-400">Loading teams...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && teams.length === 0 && (
        <div className="py-16 text-center space-y-4 bg-slate-900/40 rounded-3xl border border-slate-800/60 p-8">
          <div className="p-3 bg-slate-800/80 rounded-2xl w-fit mx-auto text-slate-400">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-base font-bold text-white">No Teams Found</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {search || hasVacancies
              ? "No teams match your search or filter criteria. Try broadening your parameters."
              : "No teams have registered for this hackathon yet. Be the first to launch one!"}
          </p>
          {!myTeam && (
            <button
              onClick={handleCreateTeamClick}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Team</span>
            </button>
          )}
        </div>
      )}

      {/* Team Cards Grid */}
      {!loading && teams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => {
            const isFull = team.memberCount >= team.maxCapacity;
            return (
              <div
                key={team.id}
                className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h2 className="font-bold text-white text-base leading-tight">{team.name}</h2>
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                        !isFull && team.isOpen
                          ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/60"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {team.memberCount} / {team.maxCapacity} seats
                    </span>
                  </div>
                  {team.tagline && (
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {team.tagline}
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-800/60">
                  <div className="flex flex-wrap gap-1.5">
                    {team.skillsNeeded && team.skillsNeeded.length > 0 ? (
                      team.skillsNeeded.map((skill) => (
                        <span
                          key={skill}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">No skill tags</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 text-[11px]">
                    <span
                      className={`font-semibold ${
                        team.isOpen && !isFull ? "text-emerald-400" : "text-slate-500"
                      }`}
                    >
                      {team.isOpen && !isFull ? "Open for Join" : "Closed"}
                    </span>

                    <Link
                      to={`/teams/${team.id}`}
                      className="inline-flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                      <span>Workspace</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Team Modal */}
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
    </div>
  );
};
