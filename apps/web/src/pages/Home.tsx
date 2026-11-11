import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { fetchHealth } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AuthenticatedDashboard } from "../components/dashboard/AuthenticatedDashboard";
import { SquadAssemblyIllustration } from "../components/landing/SquadAssemblyIllustration";
import { TypingHeadline } from "../components/landing/TypingHeadline";
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
    <div className="bg-ground overflow-x-clip">
      {/* 1. Expressive Hero on Architectural Drafting Dots */}
      <section className="bg-drafting-dots pt-10 sm:pt-16 pb-16 sm:pb-24">
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

            <div className="pt-1 reveal-line reveal-delay-3">
              <a href="#architecture" className="btn-text-link group text-sm">
                <span>See how last-seat locking works</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-1" />
              </a>
            </div>
          </div>

          {/* Right Playful Builder Assembly Illustration */}
          <div className="lg:col-span-6">
            <SquadAssemblyIllustration />
          </div>
        </div>
      </section>

      {/* 2. Visual Story: The Fourth Seat */}
      <section className="py-16 sm:py-24">
        <div
          ref={showcaseReveal.ref}
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center"
        >
          <div className="lg:col-span-4 space-y-4">
            <div
              data-visible={showcaseReveal.inView}
              className="inline-flex items-baseline gap-2.5 font-display text-3xl sm:text-4xl font-bold text-accent tabular motion-reveal"
            >
              <span>3</span>
              <span className="text-ink-muted text-xl">→</span>
              <span className="text-ink-primary underline decoration-[#FFE45C] decoration-4 underline-offset-4">
                4
              </span>
            </div>
            <h2
              data-visible={showcaseReveal.inView}
              style={{ transitionDelay: "60ms" }}
              className="font-display text-3xl sm:text-4xl font-bold text-ink-primary tracking-tight leading-tight motion-reveal"
            >
              Inspect a squad before joining.
            </h2>
            <p
              data-visible={showcaseReveal.inView}
              style={{ transitionDelay: "120ms" }}
              className="text-base text-ink-secondary leading-relaxed max-w-[44ch] motion-reveal"
            >
              Review active members, open roles, and remaining capacity at a glance before claiming
              the final seat.
            </p>
          </div>

          <div className="lg:col-span-8">
            <LiveSquadShowcase />
          </div>
        </div>
      </section>

      {/* 3. Staggered User Journey on Drafting Grid Texture */}
      <section className="bg-drafting-grid border-y-2 border-ink-primary py-16 sm:py-24">
        <WorkflowShowcase />
      </section>

      {/* 4. Last-Seat Protection Explainer */}
      <section className="bg-drafting-dots py-16 sm:py-24">
        <ReservationEngineDemo apiOnline={apiOnline} loadingHealth={loadingHealth} />
      </section>

      {/* 5. Cohesive Framed Pine Closing CTA Poster */}
      <section className="pt-4 pb-20 sm:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            ref={ctaReveal.ref}
            className="relative bg-accent border-2 border-ink-primary rounded-xl p-8 sm:p-12 overflow-hidden"
          >
            {/* Quiet Corner Crew Motif — settles from base into frame */}
            <svg
              aria-hidden="true"
              viewBox="0 0 220 140"
              className="hidden lg:block absolute right-6 bottom-0 w-44 h-28 pointer-events-none opacity-85 overflow-visible"
            >
              <g
                style={{
                  opacity: ctaReveal.inView ? 1 : 0,
                  transform: ctaReveal.inView ? "translate3d(0, 0, 0)" : "translate3d(0, 16px, 0)",
                  transition:
                    "transform 420ms cubic-bezier(0.23, 1, 0.32, 1) 50ms, opacity 320ms ease-out 50ms",
                }}
              >
                <path
                  d="M12 140 V92 C12 68.8 30.8 50 54 50 C77.2 50 96 68.8 96 92 V140 H12 Z"
                  fill="#0F4C48"
                  stroke="#18181B"
                  strokeWidth="2.5"
                />
                <circle cx="42" cy="90" r="4" fill="#FFFFFF" />
                <circle cx="64" cy="90" r="4" fill="#FFFFFF" />
              </g>
              <g
                style={{
                  opacity: ctaReveal.inView ? 1 : 0,
                  transform: ctaReveal.inView ? "translate3d(0, 0, 0)" : "translate3d(0, 18px, 0)",
                  transition:
                    "transform 420ms cubic-bezier(0.23, 1, 0.32, 1) 120ms, opacity 320ms ease-out 120ms",
                }}
              >
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
              </g>
              <circle
                cx="192"
                cy="42"
                r="18"
                fill="#FF5A1F"
                stroke="#18181B"
                strokeWidth="2.5"
                style={{
                  opacity: ctaReveal.inView ? 1 : 0,
                  transform: ctaReveal.inView
                    ? "translate3d(0, 0, 0) scale(1)"
                    : "translate3d(0, 12px, 0) scale(0.9)",
                  transformOrigin: "192px 42px",
                  transition:
                    "transform 400ms cubic-bezier(0.23, 1, 0.32, 1) 190ms, opacity 300ms ease-out 190ms",
                }}
              />
            </svg>

            <div className="relative z-10 max-w-2xl space-y-5">
              <div className="motion-mask-reveal">
                <h2
                  data-visible={ctaReveal.inView}
                  className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight leading-[1.08] motion-mask-inner"
                >
                  Ready to form your hackathon squad?
                </h2>
              </div>
              <p
                data-visible={ctaReveal.inView}
                style={{ transitionDelay: "80ms" }}
                className="text-base sm:text-lg text-[#E6F2F0] max-w-[50ch] leading-relaxed motion-reveal"
              >
                Create your builder profile, list your skills, or start a new squad for Hack4Hack
                2026 in under two minutes.
              </p>

              <div
                data-visible={ctaReveal.inView}
                style={{ transitionDelay: "150ms" }}
                className="flex flex-wrap items-center gap-3.5 pt-2 motion-reveal-scale"
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

  // Fetch health probe (for public landing telemetry when unauthenticated)
  useEffect(() => {
    if (user) {
      setLoadingHealth(false);
      return;
    }
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
  }, [user]);

  // If user is authenticated, render the dedicated personal Dashboard workspace
  if (user) {
    return <AuthenticatedDashboard key={user.id} />;
  }

  // If user is NOT authenticated, render the Public Landing Page
  return <PublicLanding apiOnline={Boolean(health)} loadingHealth={loadingHealth} />;
};
