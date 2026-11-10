import React from "react";
import { useInViewOnce } from "../../hooks/useInViewOnce";

export const WorkflowShowcase: React.FC = () => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>(0.15);

  return (
    <div ref={ref} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      {/* Section Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
        <div
          className={`lg:col-span-6 transition-[transform,opacity] duration-500 ease-out ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="font-serif text-[28px] sm:text-4xl font-medium text-ink-primary tracking-tight leading-tight">
            Three steps to a full squad.
          </h2>
        </div>
        <div
          style={{ transitionDelay: "70ms" }}
          className={`lg:col-span-6 transition-[transform,opacity] duration-500 ease-out ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <p className="text-base text-ink-secondary leading-relaxed max-w-[60ch]">
            No scattered Discord threads or stale spreadsheets. Every step moves from skill matching into your live team workspace.
          </p>
        </div>
      </div>

      {/* Three Unboxed Editorial Columns with Rich Product Vignettes (>=200px) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-8">
        {/* Stage 1: Discover */}
        <div
          style={{ transitionDelay: "80ms" }}
          className={`flex flex-col justify-between space-y-6 transition-[transform,opacity] duration-500 ease-out ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="space-y-2.5">
            <h3 className="font-serif text-2xl font-medium text-ink-primary">
              Discover compatible teams
            </h3>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[60ch]">
              Filter active hackathons by open vacancies, desired skills, and overlapping timezones before applying.
            </p>
          </div>

          <div
            data-ui="workflow-discover-fragment"
            className="bg-surface border border-border-subtle rounded-lg p-5 space-y-3.5 min-h-[216px] flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink-primary">
                Vacancy filter active
              </span>
              <span className="status-label status-open tabular">12 open</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 rounded bg-accent-tint text-accent text-[13px] font-medium">
                Has Open Seats
              </span>
              <span className="px-2.5 py-1 rounded bg-surface-tonal text-ink-primary text-[13px] font-medium">
                TypeScript
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between bg-ground rounded px-3 py-2 text-[13px]">
                <span className="font-medium text-ink-primary">Helios Mesh</span>
                <span className="text-accent font-semibold tabular">3 / 4 seats</span>
              </div>
              <div className="flex items-center justify-between bg-ground rounded px-3 py-2 text-[13px]">
                <span className="font-medium text-ink-primary">Aether Edge</span>
                <span className="text-accent font-semibold tabular">2 / 4 seats</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stage 2: Reserve */}
        <div
          style={{ transitionDelay: "160ms" }}
          className={`flex flex-col justify-between space-y-6 transition-[transform,opacity] duration-500 ease-out ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="space-y-2.5">
            <h3 className="font-serif text-2xl font-medium text-ink-primary">
              Reserve or request a seat
            </h3>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[60ch]">
              Open squads grant direct atomic seat claims; curated teams route a concise skill pitch to the squad leader.
            </p>
          </div>

          <div
            data-ui="workflow-reserve-fragment"
            className="bg-surface border border-border-subtle rounded-lg p-5 space-y-3.5 min-h-[216px] flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink-primary">
                Seat 4 reservation
              </span>
              <span className="status-label status-open">Idempotent</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between bg-ground rounded px-3 py-2 text-[13px]">
                <span className="text-ink-secondary font-medium">Guard check</span>
                <span className="text-positive font-semibold tabular">memberCount &lt; 4</span>
              </div>
              <div className="flex items-center justify-between bg-ground rounded px-3 py-2 text-[13px]">
                <span className="text-ink-secondary font-medium">Client key</span>
                <span className="text-ink-primary font-semibold">Idempotency-Key</span>
              </div>
              <div className="flex items-center justify-between bg-accent-tint rounded px-3 py-2 text-[13px]">
                <span className="text-accent font-medium">Outcome</span>
                <span className="text-accent font-semibold tabular">201 Created</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stage 3: Build */}
        <div
          style={{ transitionDelay: "240ms" }}
          className={`flex flex-col justify-between space-y-6 transition-[transform,opacity] duration-500 ease-out ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="space-y-2.5">
            <h3 className="font-serif text-2xl font-medium text-ink-primary">
              Build with your squad
            </h3>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[60ch]">
              Coordinate roles, review incoming pitches, share single-use invite tokens, and track persistent roster logs.
            </p>
          </div>

          <div
            data-ui="workflow-build-fragment"
            className="bg-surface border border-border-subtle rounded-lg p-5 space-y-3.5 min-h-[216px] flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink-primary">
                Workspace roster synced
              </span>
              <span className="status-label status-full tabular">4 / 4 seats</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between bg-ground rounded px-3 py-2 text-[13px]">
                <span className="text-ink-primary font-medium">Maya transferred role</span>
                <span className="text-ink-muted tabular">2m ago</span>
              </div>
              <div className="flex items-center justify-between bg-ground rounded px-3 py-2 text-[13px]">
                <span className="text-ink-primary font-medium">Invite token issued</span>
                <span className="text-accent font-semibold">crew_8a1c...</span>
              </div>
              <div className="flex items-center justify-between bg-ground rounded px-3 py-2 text-[13px]">
                <span className="text-ink-primary font-medium">Socket room</span>
                <span className="text-positive font-semibold">Connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
