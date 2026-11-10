import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { AlertCircle, Plus, RefreshCw, Users } from "lucide-react";
import {
  REALTIME_EVENTS,
  type TeamCapacityUpdatedPayload,
  type TeamUpdatedPayload,
  type TeamDisbandedPayload,
} from "@crewconnect/shared";
import {
  apiGetHackathons,
  apiGetHackathonTeams,
  apiGetTeam,
  apiGetTeamRoster,
  apiGetMyTeam,
  apiJoinTeam,
  generateIdempotencyKey,
  getTeamListPaginationMeta,
  ApiClientError,
  type HackathonRecord,
  type TeamRecord,
  type TeamMemberRecord,
  type ApiPaginationMeta,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { CreateTeamModal } from "../components/CreateTeamModal";
import { JoinRequestModal } from "../components/JoinRequestModal";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { DiscoveryToolbar } from "../components/discovery/DiscoveryToolbar";
import { TeamDirectoryCard } from "../components/discovery/TeamDirectoryCard";
import { TeamDossierPanel } from "../components/discovery/TeamDossierPanel";
import { DirectoryPagination } from "../components/discovery/DirectoryPagination";

const DIRECTORY_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

function parsePositiveInt(raw: string | null, fallback = 1): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

function parseSkillsParam(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const TeamsPreview: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { socket, connectionState, joinHackathonRoom, leaveHackathonRoom } = useSocket();

  const initialHackathonParam = searchParams.get("hackathon") || "";
  const initialSearchParam = searchParams.get("q") || "";
  const initialVacanciesParam = searchParams.get("vacancies") === "true";
  const initialSkillsParam = parseSkillsParam(searchParams.get("skills"));
  const initialPageParam = parsePositiveInt(searchParams.get("page"), 1);
  const initialTeamParam = searchParams.get("team");

  const [hackathons, setHackathons] = useState<HackathonRecord[]>([]);
  const [hackathonsError, setHackathonsError] = useState<string | null>(null);
  const [loadingHackathons, setLoadingHackathons] = useState(true);
  const [selectedHackathonId, setSelectedHackathonId] = useState<string>(initialHackathonParam);

  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [paginationMeta, setPaginationMeta] = useState<ApiPaginationMeta>({
    page: initialPageParam,
    limit: DIRECTORY_PAGE_SIZE,
    total: 0,
  });
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(initialTeamParam);
  const [selectedTeamSnapshot, setSelectedTeamSnapshot] = useState<TeamRecord | null>(null);
  const [selectedTeamRoster, setSelectedTeamRoster] = useState<TeamMemberRecord[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [myTeam, setMyTeam] = useState<{ team: TeamRecord; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState(initialSearchParam);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearchParam);
  const [hasVacancies, setHasVacancies] = useState(initialVacanciesParam);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(initialSkillsParam);
  const [page, setPage] = useState<number>(initialPageParam);

  // Reservation UI states
  const [isJoining, setIsJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Modals & responsive inspection state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinRequestModalOpen, setIsJoinRequestModalOpen] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(Boolean(initialTeamParam));

  const wasDisconnectedRef = useRef(false);

  // Sync URL query params cleanly without polluting history per keystroke
  useEffect(() => {
    const next = new URLSearchParams();
    if (selectedHackathonId) next.set("hackathon", selectedHackathonId);
    if (debouncedSearch.trim()) next.set("q", debouncedSearch.trim());
    if (hasVacancies) next.set("vacancies", "true");
    if (selectedSkills.length > 0) next.set("skills", selectedSkills.join(","));
    if (page > 1) next.set("page", String(page));
    if (selectedTeamId) next.set("team", selectedTeamId);

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [
    selectedHackathonId,
    debouncedSearch,
    hasVacancies,
    selectedSkills,
    page,
    selectedTeamId,
    searchParams,
    setSearchParams,
  ]);

  // Debounce search input updates
  useEffect(() => {
    if (searchInput === debouncedSearch) return;
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, debouncedSearch]);

  // Load hackathons
  const loadHackathons = useCallback(async () => {
    setLoadingHackathons(true);
    setHackathonsError(null);
    try {
      const data = await apiGetHackathons();
      setHackathons(data);
      if (data.length > 0) {
        const preferred = data.find((h) => h.status === "ACTIVE") || data[0];
        setSelectedHackathonId((prev) => {
          if (prev && data.some((h) => h.id === prev)) return prev;
          return preferred.id;
        });
      } else {
        setLoading(false);
      }
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : "Unable to load hackathon directory. Verify your connection and retry.";
      setHackathonsError(msg);
      setLoading(false);
    } finally {
      setLoadingHackathons(false);
    }
  }, []);

  useEffect(() => {
    loadHackathons();
  }, [loadHackathons]);

  // Fetch teams & active membership for selected hackathon
  const loadTeams = useCallback(async () => {
    if (!selectedHackathonId) return;
    setLoading(true);
    setDirectoryError(null);

    try {
      const [teamsData, myTeamData] = await Promise.all([
        apiGetHackathonTeams(selectedHackathonId, {
          page,
          limit: DIRECTORY_PAGE_SIZE,
          search: debouncedSearch.trim() || undefined,
          hasVacancies: hasVacancies || undefined,
          skills: selectedSkills.length > 0 ? selectedSkills : undefined,
        }),
        user ? apiGetMyTeam(selectedHackathonId).catch(() => null) : Promise.resolve(null),
      ]);

      const meta = getTeamListPaginationMeta(teamsData, page, DIRECTORY_PAGE_SIZE);
      setTeams(teamsData);
      setPaginationMeta(meta);
      setMyTeam(myTeamData);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : "Unable to load squads for this hackathon. Please retry.";
      setDirectoryError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedHackathonId, page, debouncedSearch, hasVacancies, selectedSkills, user]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  // Fetch roster for the selected squad dossier
  const fetchSelectedRoster = useCallback(async (teamId: string) => {
    setLoadingRoster(true);
    setRosterError(null);
    try {
      const members = await apiGetTeamRoster(teamId);
      setSelectedTeamRoster(members);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to load confirmed roster.";
      setRosterError(msg);
      setSelectedTeamRoster([]);
    } finally {
      setLoadingRoster(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedTeamId) {
      setSelectedTeamRoster([]);
      setRosterError(null);
      setSelectedTeamSnapshot(null);
      return;
    }

    fetchSelectedRoster(selectedTeamId);

    const inList = teams.find((t) => t.id === selectedTeamId);
    if (inList) {
      setSelectedTeamSnapshot(inList);
    } else {
      apiGetTeam(selectedTeamId)
        .then((fetched) => setSelectedTeamSnapshot(fetched))
        .catch(() => setSelectedTeamSnapshot(null));
    }
  }, [selectedTeamId, teams, fetchSelectedRoster]);

  // Allow Escape to dismiss mobile inspection drawer cleanly
  useEffect(() => {
    if (!showMobileDetail) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMobileDetail(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showMobileDetail]);

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

  // Real-time Socket listeners
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

      if (selectedTeamId === payload.teamId) {
        apiGetTeamRoster(payload.teamId)
          .then((members) => setSelectedTeamRoster(members))
          .catch(() => {});
      }
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
        setShowMobileDetail(false);
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

  // Handle direct join without optimistic seat decrement
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
      setJoinSuccess(`Successfully joined ${team.name}! Your seat is confirmed.`);
      await loadTeams();
      const [freshTeam, freshRoster] = await Promise.all([
        apiGetTeam(team.id).catch(() => null),
        apiGetTeamRoster(team.id).catch(() => []),
      ]);
      if (freshTeam) setSelectedTeamSnapshot(freshTeam);
      if (selectedTeamId === team.id) setSelectedTeamRoster(freshRoster);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "ALREADY_IN_TEAM") {
          setJoinError("You are already committed to another team in this hackathon.");
          await loadTeams();
        } else if (err.statusCode === 409) {
          setJoinError(
            err.message || "Team is now full. The final seat was claimed by another participant."
          );
          await loadTeams();
          const [freshTeam, freshRoster] = await Promise.all([
            apiGetTeam(team.id).catch(() => null),
            apiGetTeamRoster(team.id).catch(() => []),
          ]);
          if (freshTeam) setSelectedTeamSnapshot(freshTeam);
          if (selectedTeamId === team.id) setSelectedTeamRoster(freshRoster);
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
      navigate("/login", { state: { from: "/teams-preview" } });
      return;
    }
    setIsCreateModalOpen(true);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setHasVacancies(false);
    setSelectedSkills([]);
    setPage(1);
  };

  const handleToggleSkill = (skill: string) => {
    setPage(1);
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((item) => item !== skill) : [...prev, skill]
    );
  };

  const handleAddCustomSkill = (skill: string) => {
    setPage(1);
    setSelectedSkills((prev) =>
      prev.some((item) => item.toLowerCase() === skill.toLowerCase()) ? prev : [...prev, skill]
    );
  };

  const suggestedSkills = useMemo(() => {
    const counts = new Map<string, number>();
    teams.forEach((t) => {
      t.skillsNeeded.forEach((s) => {
        counts.set(s, (counts.get(s) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([skill]) => skill)
      .slice(0, 6);
  }, [teams]);

  const activeHackathon = hackathons.find((h) => h.id === selectedHackathonId);
  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || selectedTeamSnapshot || null;
  const hasActiveFilters = Boolean(
    debouncedSearch.trim() || hasVacancies || selectedSkills.length > 0
  );

  const rangeStart = teams.length === 0 ? 0 : (paginationMeta.page - 1) * paginationMeta.limit + 1;
  const rangeEnd = (paginationMeta.page - 1) * paginationMeta.limit + teams.length;
  const effectiveTotal = Math.max(paginationMeta.total, rangeEnd);

  return (
    <div className="max-w-6xl mx-auto py-7 px-4 sm:px-6 lg:px-8 space-y-5">
      {/* Compact Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-[26px] font-bold text-ink-primary tracking-tight">
            Hackathon Teams Directory
          </h1>
          <p className="text-[13px] sm:text-sm text-ink-secondary">
            Browse verified hackathon squads, inspect open roles, and claim available seats
            atomically.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          {myTeam ? (
            <Link
              to={`/teams/${myTeam.team.id}`}
              className="btn btn-secondary text-[13px] h-10 px-4"
            >
              <span>Your Squad ({myTeam.team.name})</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleCreateTeamClick}
              disabled={activeHackathon?.status === "COMPLETED"}
              className="btn btn-primary text-[13px] h-10 px-4 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Create a Team</span>
            </button>
          )}
        </div>
      </div>

      {/* Hackathon load error state */}
      {hackathonsError && (
        <div
          role="alert"
          className="p-4 rounded-lg border border-border-strong bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]"
        >
          <div className="flex items-center gap-2 text-danger">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>{hackathonsError}</span>
          </div>
          <button
            type="button"
            onClick={loadHackathons}
            className="btn btn-secondary h-9 px-3.5 text-[13px] self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Search & Backend-Supported Filters */}
      {!hackathonsError && (hackathons.length > 0 || !loadingHackathons) && (
        <div className={showMobileDetail && selectedTeam ? "hidden lg:block" : "block"}>
          <DiscoveryToolbar
            hackathons={hackathons}
            selectedHackathonId={selectedHackathonId}
            onSelectHackathon={(nextHackathonId) => {
              setSelectedHackathonId(nextHackathonId);
              setSelectedTeamId(null);
              setShowMobileDetail(false);
              setPage(1);
            }}
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            onSearchSubmit={() => {
              setDebouncedSearch(searchInput);
              setPage(1);
            }}
            onClearSearch={() => {
              setSearchInput("");
              setDebouncedSearch("");
              setPage(1);
            }}
            hasVacancies={hasVacancies}
            onToggleVacancies={() => {
              setHasVacancies((prev) => !prev);
              setPage(1);
            }}
            selectedSkills={selectedSkills}
            suggestedSkills={suggestedSkills}
            onToggleSkill={handleToggleSkill}
            onAddCustomSkill={handleAddCustomSkill}
            onResetFilters={handleResetFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      )}

      {/* Directory Load Error State */}
      {!loading && directoryError && (
        <div
          role="alert"
          className="bg-surface border border-border-strong rounded-lg p-8 text-center space-y-3"
        >
          <div className="w-10 h-10 rounded-md bg-danger-bg text-danger flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
          </div>
          <h2 className="font-display text-base font-semibold text-ink-primary">
            Unable to Load Directory
          </h2>
          <p className="text-xs sm:text-sm text-ink-secondary max-w-md mx-auto">{directoryError}</p>
          <button
            type="button"
            onClick={loadTeams}
            className="btn btn-secondary text-xs h-9 px-4 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry Directory</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton State (Layout-faithful, flat mineral surfaces) */}
      {(loading || loadingHackathons) && !directoryError && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-3">
            <div className="h-4 w-32 rounded bg-surface-tonal" />
            <LoadingSkeleton rows={4} />
          </div>
          <div className="hidden lg:block lg:col-span-7 bg-surface border border-border-subtle rounded-lg p-6 space-y-4">
            <div className="h-6 w-56 rounded bg-surface-tonal" />
            <div className="h-4 w-full rounded bg-surface-tonal" />
            <div className="h-24 w-full rounded bg-surface-tonal" />
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading &&
        !loadingHackathons &&
        !directoryError &&
        !hackathonsError &&
        teams.length === 0 && (
          <div className="py-14 text-center space-y-4 bg-surface border border-border-subtle rounded-lg p-8">
            <div className="w-11 h-11 rounded-md bg-surface-tonal border border-border-subtle text-ink-secondary flex items-center justify-center mx-auto">
              <Users className="w-5 h-5" aria-hidden="true" />
            </div>
            <h2 className="font-display text-lg font-semibold text-ink-primary">No Teams Found</h2>
            <p className="text-xs sm:text-sm text-ink-secondary max-w-md mx-auto leading-relaxed">
              {hasActiveFilters
                ? "No squads matched your active search or skill filters. Broaden your criteria or clear filters to browse all teams."
                : "No squads have registered for this hackathon yet. Be the first builder to launch one."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn btn-secondary text-xs h-9 px-4 cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
              {!myTeam && activeHackathon?.status !== "COMPLETED" && (
                <button
                  type="button"
                  onClick={handleCreateTeamClick}
                  className="btn btn-primary text-xs h-9 px-4 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Create Team</span>
                </button>
              )}
            </div>
          </div>
        )}

      {/* Master-Detail Directory Workspace */}
      {!loading && !loadingHackathons && !directoryError && teams.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Master List Column (5 cols desktop) */}
          <div
            className={`lg:col-span-5 space-y-3 ${showMobileDetail ? "hidden lg:block" : "block"}`}
          >
            <div className="flex items-center justify-between text-xs text-ink-muted pb-1 tabular">
              <span>
                {effectiveTotal > teams.length
                  ? `Showing ${rangeStart}-${rangeEnd} of ${effectiveTotal} squads`
                  : `Showing ${teams.length} squad${teams.length === 1 ? "" : "s"}`}
              </span>
              {selectedSkills.length > 0 && <span>Matched skills: {selectedSkills.length}</span>}
            </div>

            <div className="space-y-3">
              {teams.map((team) => (
                <TeamDirectoryCard
                  key={team.id}
                  team={team}
                  isSelected={team.id === selectedTeamId}
                  isMyTeam={Boolean(myTeam && myTeam.team.id === team.id)}
                  onSelect={() => {
                    setSelectedTeamId(team.id);
                    setShowMobileDetail(true);
                    setJoinSuccess(null);
                    setJoinError(null);
                  }}
                />
              ))}
            </div>

            <DirectoryPagination
              page={paginationMeta.page}
              limit={paginationMeta.limit}
              total={effectiveTotal}
              visibleCount={teams.length}
              onPageChange={(nextPage) => {
                setPage(Math.max(1, nextPage));
                setSelectedTeamId(null);
                setShowMobileDetail(false);
              }}
            />
          </div>

          {/* Squad Dossier Column (7 cols desktop, full pane on mobile selection) */}
          <div className={`lg:col-span-7 ${showMobileDetail ? "block" : "hidden lg:block"}`}>
            <TeamDossierPanel
              team={selectedTeam}
              hackathonTitle={activeHackathon?.title}
              hackathonStatus={activeHackathon?.status}
              roster={selectedTeamRoster}
              loadingRoster={loadingRoster}
              rosterError={rosterError}
              onRetryRoster={() => {
                if (selectedTeamId) fetchSelectedRoster(selectedTeamId);
              }}
              myTeam={myTeam}
              isAuthenticated={Boolean(user)}
              isJoining={isJoining}
              joinSuccess={joinSuccess}
              joinError={joinError}
              onDirectJoin={handleDirectJoin}
              onOpenJoinRequest={() => {
                if (!user) {
                  navigate("/login", {
                    state: { from: selectedTeam ? `/teams/${selectedTeam.id}` : "/teams-preview" },
                  });
                  return;
                }
                setIsJoinRequestModalOpen(true);
              }}
              onCloseMobileDetail={() => setShowMobileDetail(false)}
            />
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
