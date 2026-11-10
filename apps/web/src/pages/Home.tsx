import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, Users } from "lucide-react";
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
import { SquadConstellation } from "../components/landing/SquadConstellation";
import { LiveSquadShowcase } from "../components/landing/LiveSquadShowcase";
import { WorkflowShowcase } from "../components/landing/WorkflowShowcase";
import { ReservationEngineDemo } from "../components/landing/ReservationEngineDemo";
import { useInViewOnce } from "../hooks/useInViewOnce";

const PublicLanding: React.FC<{ apiOnline: boolean; loadingHealth: boolean }> = ({
  apiOnline,
  loadingHealth,
}) => {
  const showcaseReveal = useInViewOnce<HTMLDivElement>(0.15);
  const ctaReveal = useInViewOnce<HTMLDivElement>(0.15);

  return (
    <div>
      {/* 1. Editorial Hero + Squad Formation Constellation */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-20 sm:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* Left Copy & Actions */}
          <div className="lg:col-span-6 space-y-6">
            <h1 className="text-[36px] sm:text-5xl lg:text-[62px] font-serif font-normal text-ink-primary tracking-tight leading-[1.06]">
              <span className="hero-line-mask">
                <span className="hero-line-inner">Race-proof squads,</span>
              </span>
              <span className="hero-line-mask">
                <span className="hero-line-inner" style={{ animationDelay: "90ms" }}>
                  formed cleanly.
                </span>
              </span>
            </h1>

            <p className="text-base sm:text-lg text-ink-secondary max-w-[54ch] leading-relaxed reveal-line reveal-delay-1">
              CrewConnect brings hackathon builders together around real project missions. Match by technical skills, inspect remaining capacity, and claim open seats backed by atomic database reservations.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2 reveal-line reveal-delay-2">
              <Link to="/teams-preview" className="btn btn-primary h-11 px-6 text-sm">
                <span>Explore Team Board</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/register" className="btn btn-secondary h-11 px-6 text-sm">
                <span>Create account</span>
              </Link>
            </div>
          </div>

          {/* Right Bespoke Visual Signature */}
          <div className="lg:col-span-6 reveal-line reveal-delay-2">
            <SquadConstellation />
          </div>
        </div>
      </section>

      {/* 2. Interactive Product Demonstration */}
      <section className="bg-surface py-20 sm:py-28">
        <div
          ref={showcaseReveal.ref}
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start"
        >
          <div
            className={`lg:col-span-4 space-y-5 lg:sticky lg:top-24 transition-[transform,opacity] duration-500 ease-out ${
              showcaseReveal.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <h2 className="font-serif text-[28px] sm:text-4xl font-medium text-ink-primary tracking-tight leading-tight">
              Inspect a squad before you claim a seat.
            </h2>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[60ch]">
              Every squad dossier displays current members, project scope, exact skills sought, and remaining seat capacity in real time.
            </p>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[60ch]">
              Try reserving the remaining fourth slot on the interactive preview to observe how CrewConnect locks capacity cleanly without client-side guesswork.
            </p>
          </div>

          <div
            style={{ transitionDelay: "90ms" }}
            className={`lg:col-span-8 transition-[transform,opacity] duration-500 ease-out ${
              showcaseReveal.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <LiveSquadShowcase />
          </div>
        </div>
      </section>

      {/* 3. How CrewConnect Works */}
      <section className="bg-surface-tonal py-20 sm:py-28">
        <WorkflowShowcase />
      </section>

      {/* 4. Technical Credibility: Race-Proof Reservation Engine */}
      <section className="bg-surface py-20 sm:py-28">
        <ReservationEngineDemo apiOnline={apiOnline} loadingHealth={loadingHealth} />
      </section>

      {/* 5. Closing Call to Action */}
      <section className="bg-accent py-20 sm:py-24">
        <div
          ref={ctaReveal.ref}
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
        >
          <div
            className={`lg:col-span-7 space-y-4 transition-[transform,opacity] duration-500 ease-out ${
              ctaReveal.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <h2 className="font-serif text-[28px] sm:text-5xl font-normal text-white tracking-tight leading-[1.08]">
              Ready to form your hackathon squad?
            </h2>
            <p className="text-base sm:text-lg text-[#E6F2F0] max-w-[58ch] leading-relaxed">
              Register your participant profile, declare your stack, or initialize a new squad for Hack4Hack 2026 in under two minutes.
            </p>
          </div>

          <div
            style={{ transitionDelay: "90ms" }}
            className={`lg:col-span-5 flex flex-wrap lg:justify-end gap-3.5 transition-[transform,opacity] duration-500 ease-out ${
              ctaReveal.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-white text-ink-primary font-semibold text-sm hover:bg-[#F1F0EC] transition-colors active:scale-[0.97]"
            >
              <span>Create builder profile</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/teams-preview"
              className="inline-flex items-center justify-center h-12 px-5 rounded-md border border-[#5FA29C] text-white font-semibold text-sm hover:bg-accent-hover transition-colors active:scale-[0.97]"
            >
              <span>Browse open squads</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

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
    <PublicLanding apiOnline={Boolean(health)} loadingHealth={loadingHealth} />
  );
};
