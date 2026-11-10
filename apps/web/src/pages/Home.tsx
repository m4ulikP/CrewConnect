import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
  Database,
  Server,
  Plus,
  Users,
} from "lucide-react";
import {
  fetchHealth,
  apiGetHackathons,
  apiGetHackathonTeams,
  apiGetMyTeam,
  apiGetTeamAuditLogs,
  type HackathonRecord,
  type TeamRecord,
  type AuditLogRecord,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { CapacityBadge } from "../components/CapacityBadge";
import { CreateTeamModal } from "../components/CreateTeamModal";

export const Home: React.FC = () => {
  const { user } = useAuth();

  const [health, setHealth] = useState<{
    status: string;
    uptime: number;
    timestamp: string;
    environment: string;
  } | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  // Authenticated dashboard state
  const [hackathons, setHackathons] = useState<HackathonRecord[]>([]);
  const [selectedHackathon, setSelectedHackathon] = useState<HackathonRecord | null>(null);
  const [myTeam, setMyTeam] = useState<{ team: TeamRecord; role: string } | null>(null);
  const [recentAudit, setRecentAudit] = useState<AuditLogRecord[]>([]);
  const [featuredTeams, setFeaturedTeams] = useState<TeamRecord[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch health probe (for public telemetry)
  useEffect(() => {
    fetchHealth()
      .then((data) => {
        setHealth({
          status: data.status,
          uptime: Math.round(data.uptime),
          timestamp: data.timestamp,
          environment: "Phase 2 Scaffolding",
        });
      })
      .catch(() => {
        setHealth(null);
      })
      .finally(() => setLoadingHealth(false));
  }, []);

  // Fetch hackathons and user team context
  useEffect(() => {
    let mounted = true;
    apiGetHackathons()
      .then(async (data) => {
        if (!mounted) return;
        setHackathons(data);
        if (data.length > 0) {
          const activeH = data[0];
          setSelectedHackathon(activeH);

          const teams = await apiGetHackathonTeams(activeH.id, { limit: 3 }).catch(() => []);
          if (mounted) setFeaturedTeams(teams);

          if (user) {
            const userTeam = await apiGetMyTeam(activeH.id).catch(() => null);
            if (mounted) {
              setMyTeam(userTeam);
              if (userTeam?.team?.id) {
                const logs = await apiGetTeamAuditLogs(userTeam.team.id).catch(() => []);
                if (mounted) setRecentAudit(logs.slice(0, 4));
              }
            }
          }
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [user]);

  // If user is authenticated, render the Overview / Dashboard view
  if (user) {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    return (
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-10 pane-enter">
        {/* Header Greeting */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-border-subtle pb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif font-medium text-ink-primary tracking-tight">
              {timeGreeting}, {user.displayName}
            </h1>
            <p className="text-sm text-ink-secondary mt-1">
              {selectedHackathon ? `${selectedHackathon.title} • Active recruitment window` : "Active recruitment window"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/teams-preview" className="btn btn-secondary text-xs h-9">
              Browse all teams →
            </Link>
            {!myTeam && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="btn btn-primary text-xs h-9 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create a Team</span>
              </button>
            )}
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Left Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {myTeam ? (
              <div className="bg-surface border border-border-strong rounded-lg p-6 space-y-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">
                    Your Active Squad
                  </span>
                  <CapacityBadge
                    memberCount={myTeam.team.memberCount}
                    maxCapacity={myTeam.team.maxCapacity}
                    isOpen={myTeam.team.isOpen}
                    variant="indicator"
                  />
                </div>

                <div>
                  <h2 className="text-2xl font-serif text-ink-primary font-medium">
                    {myTeam.team.name}
                  </h2>
                  {myTeam.team.tagline && (
                    <p className="text-sm text-ink-secondary mt-1 leading-relaxed">
                      {myTeam.team.tagline}
                    </p>
                  )}
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-muted">Role:</span>
                    <span className="text-xs font-semibold text-accent bg-accent-tint px-2 py-0.5 rounded">
                      {myTeam.role}
                    </span>
                  </div>

                  <Link
                    to={`/teams/${myTeam.team.id}`}
                    className="btn btn-primary text-xs h-9 px-4"
                  >
                    <span>Open workspace →</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-border-subtle rounded-lg p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-accent-tint text-accent flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-serif text-ink-primary">No active squad yet</h2>
                  <p className="text-sm text-ink-secondary max-w-md mx-auto leading-relaxed">
                    You haven't formed or joined a squad for this hackathon. Explore open squads with remaining seats or initialize your own team.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Link to="/teams-preview" className="btn btn-primary text-xs h-9 px-4">
                    Explore open teams →
                  </Link>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="btn btn-secondary text-xs h-9 px-4 cursor-pointer"
                  >
                    Create a Team
                  </button>
                </div>
              </div>
            )}

            {/* Quick Discover Section */}
            <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-serif text-ink-primary">Open Squads Seeking Members</h3>
                <Link to="/teams-preview" className="text-xs font-medium text-accent hover:underline">
                  View all
                </Link>
              </div>

              {featuredTeams.length === 0 ? (
                <p className="text-xs text-ink-muted">No other teams found in this hackathon.</p>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {featuredTeams.map((t) => (
                    <div key={t.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-ink-primary">{t.name}</h4>
                        <p className="text-xs text-ink-secondary line-clamp-1">{t.tagline || t.description || "Building hackathon project"}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <CapacityBadge memberCount={t.memberCount} maxCapacity={t.maxCapacity} />
                        <Link to={`/teams/${t.id}`} className="text-xs font-medium text-accent hover:underline">
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 cols): Activity & Events */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-4">
              <h3 className="text-base font-serif text-ink-primary">Recent Persistent Activity</h3>
              <p className="text-xs text-ink-muted">
                Audit trail recorded with atomic database transactions.
              </p>

              {recentAudit.length === 0 ? (
                <p className="text-xs text-ink-secondary py-4 italic text-center">
                  No squad activity recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-border-subtle text-xs">
                  {recentAudit.map((log) => (
                    <div key={log.id} className="py-2.5 flex items-start justify-between gap-2">
                      <div>
                        <span className="font-medium text-ink-primary">
                          {typeof log.actorId === "object" ? log.actorId.displayName : "Member"}
                        </span>{" "}
                        <span className="text-ink-secondary">{log.action.toLowerCase().replace(/_/g, " ")}</span>
                      </div>
                      <span className="tabular text-ink-muted text-[11px] flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Event Details */}
            <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-3">
              <h3 className="text-base font-serif text-ink-primary">Active Hackathon</h3>
              {selectedHackathon ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-secondary">Event:</span>
                    <span className="font-semibold text-ink-primary">{selectedHackathon.title}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-secondary">Team Capacity:</span>
                    <span className="font-semibold text-ink-primary tabular">
                      {selectedHackathon.minTeamSize} to {selectedHackathon.maxTeamSize} members
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-secondary">Status:</span>
                    <span className="font-semibold text-positive bg-positive-bg px-2 py-0.5 rounded text-[11px]">
                      {selectedHackathon.status}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ink-muted">Loading hackathon information...</p>
              )}
            </div>
          </div>
        </div>

        {/* Modal */}
        {isCreateModalOpen && (
          <CreateTeamModal
            hackathons={hackathons}
            defaultHackathonId={selectedHackathon?.id}
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onTeamCreated={(newTeam) => {
              window.location.href = `/teams/${newTeam.id}`;
            }}
          />
        )}
      </div>
    );
  }

  // If user is NOT authenticated, render the Public Landing Page
  return (
    <div className="space-y-16 pb-20">
      {/* Editorial Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 space-y-8">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-ink-muted">
            Hack4Hack 2026 · Problem Statement 1
          </span>
          <span className="text-border-control">•</span>
          <span className="text-xs font-medium text-accent">Race-Proof Team Formation</span>
        </div>

        <div className="space-y-6 max-w-4xl">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-serif font-normal text-ink-primary tracking-tight leading-[1.08] reveal-line">
            Race-proof squads, formed cleanly.
          </h1>

          <p className="text-lg sm:text-xl text-ink-secondary max-w-2xl leading-relaxed reveal-line reveal-delay-1">
            CrewConnect helps hackathon participants find balanced teammates, align on project
            vision, and claim open squad seats with atomic database reservation — eliminating
            double-bookings and phantom memberships.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-border-subtle reveal-line reveal-delay-2">
          <Link to="/teams-preview" className="btn btn-primary h-11 px-6 text-sm">
            <span>Explore Team Board</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/register" className="btn btn-secondary h-11 px-6 text-sm">
            <span>Create account</span>
          </Link>
          <a
            href="https://github.com/m4ulikP/CrewConnect"
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost h-11 px-4 text-sm"
          >
            <span>Architecture Specs</span>
          </a>
        </div>
      </section>

      {/* Process / Pillars Grid */}
      <section className="bg-surface border-y border-border-subtle py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
          <div className="md:col-span-5 space-y-3">
            <h2 className="text-2xl sm:text-3xl font-serif text-ink-primary">
              Calm team collaboration
            </h2>
            <p className="text-sm text-ink-secondary leading-relaxed">
              Designed around mathematical guarantees rather than optimistic guesses. How
              high-concurrency squad formation works under heavy submission deadlines.
            </p>
          </div>

          <div className="md:col-span-7 divide-y divide-border-subtle">
            <div className="pb-6 space-y-1">
              <span className="font-mono text-xs text-accent">01 — Discovery</span>
              <h3 className="text-base font-semibold text-ink-primary">Find the right people</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Filter squads across upcoming and active hackathons by technical stack, shared
                timezones, and remaining open positions.
              </p>
            </div>

            <div className="py-6 space-y-1">
              <span className="font-mono text-xs text-accent">02 — Reservation</span>
              <h3 className="text-base font-semibold text-ink-primary">Atomic seat claims</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Database-level conditional writes guarantee only one applicant wins the final seat.
                Zero phantom memberships or counter drift.
              </p>
            </div>

            <div className="pt-6 space-y-1">
              <span className="font-mono text-xs text-accent">03 — Real-Time</span>
              <h3 className="text-base font-semibold text-ink-primary">Instant roster sync</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                WebSocket rooms broadcast authoritative capacity changes so every participant sees
                accurate vacancy counts instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Platform & Concurrency Infrastructure Telemetry Card */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-surface border border-border-strong rounded-lg p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-border-subtle gap-4">
            <div>
              <h2 className="text-lg font-serif font-semibold text-ink-primary flex items-center gap-2">
                <Server className="w-4 h-4 text-accent" />
                <span>Infrastructure Telemetry</span>
              </h2>
              <p className="text-xs text-ink-secondary mt-1">
                Authoritative runtime health from the Express backend and containerized environment.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-positive animate-pulse"></span>
              <span className="text-positive font-medium">
                {loadingHealth ? "Probing..." : health ? "API Online (200 OK)" : "API Standby"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded border border-border-subtle bg-ground/50">
              <span className="text-xs text-ink-muted block">Transaction Engine</span>
              <span className="text-sm font-semibold text-ink-primary mt-1 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-accent" />
                <span>MongoDB 7.0 (rs0)</span>
              </span>
              <span className="text-[11px] text-ink-secondary mt-1 block">ACID Session Support</span>
            </div>

            <div className="p-4 rounded border border-border-subtle bg-ground/50">
              <span className="text-xs text-ink-muted block">Concurrency Control</span>
              <span className="text-sm font-semibold text-ink-primary mt-1 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-accent" />
                <span>Two-Tier Reservation</span>
              </span>
              <span className="text-[11px] text-ink-secondary mt-1 block">Atomic $inc + Fencing</span>
            </div>

            <div className="p-4 rounded border border-border-subtle bg-ground/50">
              <span className="text-xs text-ink-muted block">Idempotency Protocol</span>
              <span className="text-sm font-semibold text-ink-primary mt-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                <span>In-Txn Completion</span>
              </span>
              <span className="text-[11px] text-ink-secondary mt-1 block">
                Crash-Consistent Guarantee
              </span>
            </div>

            <div className="p-4 rounded border border-border-subtle bg-ground/50">
              <span className="text-xs text-ink-muted block">Architecture Style</span>
              <span className="text-sm font-semibold text-ink-primary mt-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-accent" />
                <span>Modular Monolith</span>
              </span>
              <span className="text-[11px] text-ink-secondary mt-1 block">TypeScript Workspaces</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
