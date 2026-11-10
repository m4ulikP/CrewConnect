import React from "react";
import { useInViewOnce } from "../../hooks/useInViewOnce";

export const WorkflowShowcase: React.FC = () => {
  const stage1 = useInViewOnce<HTMLDivElement>(0.15);
  const stage2 = useInViewOnce<HTMLDivElement>(0.15);
  const stage3 = useInViewOnce<HTMLDivElement>(0.15);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
      {/* Editorial Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
        <div className="lg:col-span-6">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink-primary tracking-tight leading-[1.08]">
            Three steps from solo to squad.
          </h2>
        </div>
        <div className="lg:col-span-6">
          <p className="text-base sm:text-lg text-ink-secondary leading-relaxed max-w-[56ch]">
            Go from browsing hackathon projects to collaborating in a structured workspace without
            losing track of open spots.
          </p>
        </div>
      </div>

      {/* Staggered Asymmetric Chapters Reusing Core Brand Builder Marks */}
      <div className="space-y-14 sm:space-y-20">
        {/* Stage 1 */}
        <div
          ref={stage1.ref}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
        >
          <div
            className={`lg:col-span-5 space-y-4 transition-[transform,opacity] duration-500 ease-out ${
              stage1.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Mini Systems Pine Arch Character */}
              <svg aria-hidden="true" viewBox="0 0 44 44" className="w-11 h-11 flex-shrink-0">
                <path
                  d="M4 40 V21 C4 11.059 12.059 3 22 3 C31.941 3 40 11.059 40 21 V40 H4 Z"
                  fill="#115E59"
                  stroke="#18181B"
                  strokeWidth="2.5"
                />
                <circle cx="17" cy="21" r="2.8" fill="#FFFFFF" />
                <circle cx="27" cy="21" r="2.8" fill="#FFFFFF" />
                <path
                  d="M18 29 Q22 33 26 29"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-[4px] bg-surface border-2 border-ink-primary font-display text-lg font-bold text-ink-primary">
                1 · Discover
              </span>
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-ink-primary">
              Find a team that fits your stack
            </h3>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[52ch]">
              Search active hackathon squads, filter by open vacancies and timezones, and inspect
              what roles are still needed.
            </p>
          </div>

          <div
            data-ui="workflow-discover-fragment"
            style={{ transitionDelay: "90ms" }}
            className={`lg:col-span-7 bg-surface border-2 border-ink-primary rounded-lg p-5 sm:p-6 space-y-4 transition-[transform,opacity] duration-500 ease-out ${
              stage1.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-ink-primary">
                Squad Directory Filters (Illustrative)
              </span>
              <span className="px-2.5 py-0.5 rounded bg-highlight border border-ink-primary text-[13px] font-bold text-ink-primary tabular">
                12 open squads
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded bg-accent text-white text-[13px] font-semibold">
                Has Open Seats
              </span>
              <span className="px-3 py-1 rounded bg-surface-tonal border border-ink-primary/25 text-ink-primary text-[13px] font-semibold">
                TypeScript
              </span>
              <span className="px-3 py-1 rounded bg-surface-tonal border border-ink-primary/25 text-ink-primary text-[13px] font-semibold">
                UTC+5:30
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex items-center justify-between bg-ground border border-border-strong rounded px-3.5 py-2.5 text-[13px]">
                <span className="font-semibold text-ink-primary">Helios Mesh</span>
                <span className="text-accent font-bold tabular">3 / 4 seats</span>
              </div>
              <div className="flex items-center justify-between bg-ground border border-border-strong rounded px-3.5 py-2.5 text-[13px]">
                <span className="font-semibold text-ink-primary">Aether Edge</span>
                <span className="text-accent font-bold tabular">2 / 4 seats</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stage 2 (Flipped Asymmetry) */}
        <div
          ref={stage2.ref}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
        >
          <div
            data-ui="workflow-reserve-fragment"
            className={`order-2 lg:order-1 lg:col-span-7 bg-surface border-2 border-ink-primary rounded-lg p-5 sm:p-6 space-y-4 transition-[transform,opacity] duration-500 ease-out ${
              stage2.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-ink-primary">
                Seat Claim Confirmation (Illustrative)
              </span>
              <span className="px-2.5 py-0.5 rounded bg-tangelo border border-ink-primary text-[13px] font-bold text-ink-primary">
                Protected Write
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between bg-ground border border-border-strong rounded px-3.5 py-2.5 text-[13px]">
                <span className="text-ink-secondary font-medium">Available seat check</span>
                <span className="text-positive font-bold tabular">memberCount &lt; 4</span>
              </div>
              <div className="flex items-center justify-between bg-ground border border-border-strong rounded px-3.5 py-2.5 text-[13px]">
                <span className="text-ink-secondary font-medium">Duplicate retry guard</span>
                <span className="text-ink-primary font-bold">Idempotency-Key</span>
              </div>
              <div className="flex items-center justify-between bg-accent-tint border border-accent rounded px-3.5 py-2.5 text-[13px]">
                <span className="text-accent font-semibold">Seat status</span>
                <span className="text-accent font-bold tabular">201 Created</span>
              </div>
            </div>
          </div>

          <div
            style={{ transitionDelay: "90ms" }}
            className={`order-1 lg:order-2 lg:col-span-5 space-y-4 transition-[transform,opacity] duration-500 ease-out ${
              stage2.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Mini Tangelo AI/Data Monolith Character */}
              <svg aria-hidden="true" viewBox="0 0 44 44" className="w-11 h-11 flex-shrink-0">
                <rect
                  x="4"
                  y="4"
                  width="36"
                  height="36"
                  rx="10"
                  fill="#FF5A1F"
                  stroke="#18181B"
                  strokeWidth="2.5"
                />
                <circle cx="17" cy="21" r="2.8" fill="#18181B" />
                <circle cx="27" cy="21" r="2.8" fill="#18181B" />
                <path d="M17 30 H27" stroke="#18181B" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-[4px] bg-surface border-2 border-ink-primary font-display text-lg font-bold text-ink-primary">
                2 · Join or Request
              </span>
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-ink-primary">
              Claim an open spot cleanly
            </h3>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[52ch]">
              Open teams let you claim a seat right away with server-side concurrency locks.
              Invite-only squads route a short skill pitch to the team leader.
            </p>
          </div>
        </div>

        {/* Stage 3 */}
        <div
          ref={stage3.ref}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
        >
          <div
            className={`lg:col-span-5 space-y-4 transition-[transform,opacity] duration-500 ease-out ${
              stage3.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Mini Sunburst Butter Product Character */}
              <svg aria-hidden="true" viewBox="0 0 44 44" className="w-11 h-11 flex-shrink-0">
                <path
                  d="M4 4 H40 V40 H15 C8.925 40 4 35.075 4 29 V4 Z"
                  fill="#FDE047"
                  stroke="#18181B"
                  strokeWidth="2.5"
                />
                <circle cx="17" cy="19" r="2.8" fill="#18181B" />
                <circle cx="27" cy="19" r="2.8" fill="#18181B" />
                <path
                  d="M18 28 Q22 32 26 28"
                  fill="none"
                  stroke="#18181B"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-[4px] bg-highlight border-2 border-ink-primary font-display text-lg font-bold text-ink-primary">
                3 · Collaborate
              </span>
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-ink-primary">
              Build inside your team workspace
            </h3>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[52ch]">
              Review incoming requests, mint single-use invite links, transfer leadership cleanly,
              and receive live Socket.IO roster updates.
            </p>
          </div>

          <div
            data-ui="workflow-build-fragment"
            style={{ transitionDelay: "90ms" }}
            className={`lg:col-span-7 bg-surface border-2 border-ink-primary rounded-lg p-5 sm:p-6 space-y-4 transition-[transform,opacity] duration-500 ease-out ${
              stage3.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-ink-primary">
                Team Workspace Updates (Illustrative)
              </span>
              <span className="px-2.5 py-0.5 rounded bg-accent text-white text-[13px] font-bold tabular">
                4 / 4 seats
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between bg-ground border border-border-strong rounded px-3.5 py-2.5 text-[13px]">
                <span className="text-ink-primary font-semibold">Leadership transferred</span>
                <span className="text-ink-muted tabular">2m ago</span>
              </div>
              <div className="flex items-center justify-between bg-ground border border-border-strong rounded px-3.5 py-2.5 text-[13px]">
                <span className="text-ink-primary font-semibold">Invite link generated</span>
                <span className="text-accent font-bold">crew_8a1c...</span>
              </div>
              <div className="flex items-center justify-between bg-highlight-soft border border-ink-primary rounded px-3.5 py-2.5 text-[13px]">
                <span className="text-ink-primary font-semibold">Socket.IO room sync</span>
                <span className="text-positive font-bold">Live</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
