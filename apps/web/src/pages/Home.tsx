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
import { SquadAssemblyIllustration } from "../components/landing/SquadAssemblyIllustration";
import { TypingHeadline } from "../components/landing/TypingHeadline";
import { LiveSquadShowcase } from "../components/landing/LiveSquadShowcase";
import { WorkflowShowcase } from "../components/landing/WorkflowShowcase";
import { ReservationEngineDemo } from "../components/landing/ReservationEngineDemo";
import { useInViewOnce } from "../hooks/useInViewOnce";

const SectionConnector: React.FC<{ dotClass: string }> = ({ dotClass }) => (
  <div aria-hidden="true" className="flex flex-col items-center py-2">
    <span className="w-0.5 h-6 bg-ink-primary" />
    <span className={`w-3.5 h-3.5 rounded-full border-2 border-ink-primary ${dotClass}`} />
    <span className="w-0.5 h-6 bg-ink-primary" />
  </div>
);

const PublicLanding: React.FC<{ apiOnline: boolean; loadingHealth: boolean }> = ({
  apiOnline,
  loadingHealth,
}) => {
  const showcaseReveal = useInViewOnce<HTMLDivElement>(0.15);
  const ctaReveal = useInViewOnce<HTMLDivElement>(0.15);

  return (
    <div className="bg-ground overflow-x-clip">
      {/* 1. Expressive Hero on Architectural Drafting Dots */}
      <section className="bg-drafting-dots pt-10 sm:pt-16 pb-14 sm:pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-10 items-center">
          {/* Left Copy, Typing Headline & Cohesive Brutalist Actions */}
          <div className="lg:col-span-6 space-y-6">
            <TypingHeadline />

            <p className="text-base sm:text-lg text-ink-secondary max-w-[46ch] leading-relaxed reveal-line reveal-delay-1">
              Discover hackathon teams, check which skills they need, and claim open seats backed by
              atomic database reservations that prevent double-bookings.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-1 reveal-line reveal-delay-2">
              <Link
                to="/teams-preview"
                className="btn btn-brutal-primary group h-12 px-6 text-sm sm:text-base"
              >
                <span>Explore Team Board</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-1" />
              </Link>
              <Link
                to="/register"
                className="btn btn-brutal-secondary h-12 px-6 text-sm sm:text-base"
              >
                <span>Create account</span>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-1 reveal-line reveal-delay-3">
              <a href="#architecture" className="btn-text-link group text-sm">
                <span>See how last-seat locking works</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-1" />
              </a>
              <span className="inline-flex items-center gap-2 bg-surface border border-ink-primary/30 px-2.5 py-1 rounded-[3px] text-[13px] font-medium text-ink-secondary">
                <span className="w-2 h-2 rounded-full bg-tangelo" />
                <span>Hack4Hack 2026</span>
              </span>
            </div>
          </div>

          {/* Right Playful Builder Assembly Illustration */}
          <div className="lg:col-span-6 reveal-line reveal-delay-2">
            <SquadAssemblyIllustration />
          </div>
        </div>
      </section>

      <SectionConnector dotClass="bg-highlight" />

      {/* 2. Interactive Product / Discovery Showcase */}
      <section className="py-12 sm:py-16">
        <div
          ref={showcaseReveal.ref}
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start"
        >
          <div
            className={`lg:col-span-4 space-y-5 lg:sticky lg:top-24 transition-[transform,opacity] duration-500 ease-out ${
              showcaseReveal.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="inline-flex items-baseline gap-2 font-display text-4xl sm:text-5xl font-bold text-accent tabular">
              <span>3</span>
              <span className="text-ink-muted text-2xl">→</span>
              <span className="bg-highlight border-2 border-ink-primary text-ink-primary px-2 rounded-[4px]">
                4
              </span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink-primary tracking-tight leading-tight">
              Inspect a squad before joining.
            </h2>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[56ch]">
              See active members, project goals, sought skills, and remaining seat count at a glance
              before deciding where to contribute.
            </p>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[56ch]">
              Click the button on this preview to try reserving the open fourth slot.
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

      <SectionConnector dotClass="bg-tangelo" />

      {/* 3. Staggered User Journey on Drafting Grid Texture */}
      <section className="bg-drafting-grid border-y-2 border-ink-primary py-16 sm:py-24">
        <WorkflowShowcase />
      </section>

      <SectionConnector dotClass="bg-accent" />

      {/* 4. Last-Seat Protection Explainer */}
      <section className="bg-drafting-dots py-14 sm:py-20">
        <ReservationEngineDemo apiOnline={apiOnline} loadingHealth={loadingHealth} />
      </section>

      {/* 5. Cohesive Framed Pine Closing CTA Poster (Unified Within Grid Canvas) */}
      <section className="pt-8 pb-20 sm:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            ref={ctaReveal.ref}
            className="relative bg-accent border-2 border-ink-primary rounded-xl p-8 sm:p-12 overflow-hidden"
          >
            {/* Friendly Geometric Crew Corner Cameo */}
            <svg
              aria-hidden="true"
              viewBox="0 0 220 140"
              className="hidden lg:block absolute right-6 bottom-0 w-52 h-32 pointer-events-none"
            >
              <path
                d="M12 140 V92 C12 68.8 30.8 50 54 50 C77.2 50 96 68.8 96 92 V140 H12 Z"
                fill="#0F4C48"
                stroke="#18181B"
                strokeWidth="2.5"
              />
              <circle cx="42" cy="90" r="4" fill="#FFFFFF" />
              <circle cx="64" cy="90" r="4" fill="#FFFFFF" />
              <rect
                x="110"
                y="62"
                width="76"
                height="78"
                rx="16"
                fill="#FDE047"
                stroke="#18181B"
                strokeWidth="2.5"
              />
              <circle cx="136" cy="94" r="4" fill="#18181B" />
              <circle cx="160" cy="94" r="4" fill="#18181B" />
              <path
                d="M140 110 Q148 117 156 110"
                fill="none"
                stroke="#18181B"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="192" cy="42" r="18" fill="#FF5A1F" stroke="#18181B" strokeWidth="2.5" />
            </svg>

            <div className="relative z-10 max-w-2xl space-y-5">
              <h2
                className={`font-display text-3xl sm:text-4xl font-bold text-white tracking-tight leading-[1.08] transition-[transform,opacity] duration-500 ease-out ${
                  ctaReveal.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                Ready to form your hackathon squad?
              </h2>
              <p
                style={{ transitionDelay: "70ms" }}
                className={`text-base sm:text-lg text-[#E6F2F0] max-w-[50ch] leading-relaxed transition-[transform,opacity] duration-500 ease-out ${
                  ctaReveal.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                Create your builder profile, list your skills, or start a new squad for Hack4Hack
                2026 in under two minutes.
              </p>

              <div
                style={{ transitionDelay: "130ms" }}
                className={`flex flex-wrap items-center gap-3.5 pt-2 transition-[transform,opacity] duration-500 ease-out ${
                  ctaReveal.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                <Link
                  to="/register"
                  className="btn btn-brutal-highlight group h-12 px-6 text-sm sm:text-base"
                >
                  <span>Create builder profile</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/teams-preview"
                  className="btn btn-brutal-secondary h-12 px-5 text-sm sm:text-base"
                >
                  <span>Browse open squads</span>
                </Link>
              </div>
            </div>
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
              {selectedHackathon
                ? `${selectedHackathon.title} • Active recruitment window`
                : "Active recruitment window"}
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
                    You haven't formed or joined a squad for this hackathon. Explore open squads
                    with remaining seats or initialize your own team.
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
                <h3 className="text-base font-serif text-ink-primary">
                  Open Squads Seeking Members
                </h3>
                <Link
                  to="/teams-preview"
                  className="text-xs font-medium text-accent hover:underline"
                >
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
                        <p className="text-xs text-ink-secondary line-clamp-1">
                          {t.tagline || t.description || "Building hackathon project"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <CapacityBadge memberCount={t.memberCount} maxCapacity={t.maxCapacity} />
                        <Link
                          to={`/teams/${t.id}`}
                          className="text-xs font-medium text-accent hover:underline"
                        >
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
                        <span className="text-ink-secondary">
                          {log.action.toLowerCase().replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="tabular text-ink-muted text-[11px] flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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
                    <span className="font-semibold text-ink-primary">
                      {selectedHackathon.title}
                    </span>
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
  return <PublicLanding apiOnline={Boolean(health)} loadingHealth={loadingHealth} />;
};
