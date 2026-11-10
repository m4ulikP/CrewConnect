import React from "react";
import { useInViewOnce } from "../../hooks/useInViewOnce";

export const WorkflowShowcase: React.FC = () => {
  const stage1 = useInViewOnce<HTMLDivElement>(0.15);
  const stage2 = useInViewOnce<HTMLDivElement>(0.15);
  const stage3 = useInViewOnce<HTMLDivElement>(0.15);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
      {/* Editorial Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
        <div className="lg:col-span-6">
          <h2 className="font-serif text-[30px] sm:text-5xl font-medium text-ink-primary tracking-tight leading-[1.06]">
            Three steps to a full squad.
          </h2>
        </div>
        <div className="lg:col-span-6">
          <p className="text-base sm:text-lg text-ink-secondary leading-relaxed max-w-[58ch]">
            Every movement takes a builder from solo discovery to atomic seat locking inside an active team workspace.
          </p>
        </div>
      </div>

      {/* Staggered Asymmetric Chapters */}
      <div className="space-y-16 sm:space-y-24">
        {/* Stage 1: Left Editorial + Right Discovery Filter UI */}
        <div
          ref={stage1.ref}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
        >
          <div
            className={`lg:col-span-5 space-y-4 transition-[transform,opacity] duration-500 ease-out ${
              stage1.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-accent text-white font-serif text-3xl font-medium border-2 border-ink-primary"
            >
              1
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl font-medium text-ink-primary">
              Discover compatible teams
            </h3>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[54ch]">
              Filter active hackathons by open seats, desired stack, and overlapping timezones before committing a moment of build time.
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
                Team Board Filters (Illustrative)
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

        {/* Stage 2 (Flipped Asymmetry): Left Idempotent Reserve UI + Right Editorial */}
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
                Atomic Seat Reservation Request
              </span>
              <span className="px-2.5 py-0.5 rounded bg-tangelo border border-ink-primary text-[13px] font-bold text-ink-primary">
                Idempotent
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between bg-ground border border-border-strong rounded px-3.5 py-2.5 text-[13px]">
                <span className="text-ink-secondary font-medium">Capacity predicate</span>
                <span className="text-positive font-bold tabular">memberCount &lt; 4</span>
              </div>
              <div className="flex items-center justify-between bg-ground border border-border-strong rounded px-3.5 py-2.5 text-[13px]">
                <span className="text-ink-secondary font-medium">Request header</span>
                <span className="text-ink-primary font-bold">Idempotency-Key</span>
              </div>
              <div className="flex items-center justify-between bg-accent-tint border border-accent rounded px-3.5 py-2.5 text-[13px]">
                <span className="text-accent font-semibold">Transaction response</span>
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
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-tangelo text-ink-primary font-serif text-3xl font-medium border-2 border-ink-primary"
            >
              2
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl font-medium text-ink-primary">
              Reserve or request a seat
            </h3>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[54ch]">
              Open teams lock your seat directly via an idempotent conditional database write. Curated squads send your skill pitch straight to the team leader.
            </p>
          </div>
        </div>

        {/* Stage 3: Left Editorial + Right Live Workspace Fragment */}
        <div
          ref={stage3.ref}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
        >
          <div
            className={`lg:col-span-5 space-y-4 transition-[transform,opacity] duration-500 ease-out ${
              stage3.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-highlight text-ink-primary font-serif text-3xl font-medium border-2 border-ink-primary"
            >
              3
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl font-medium text-ink-primary">
              Build with your squad
            </h3>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[54ch]">
              Coordinate roles, review join requests, mint single-use invite tokens, and keep roster events synchronized across connected sessions.
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
                Squad Workspace Activity (Illustrative)
              </span>
              <span className="px-2.5 py-0.5 rounded bg-accent text-white text-[13px] font-bold tabular">
                4 / 4 seats
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between bg-ground border border-border-strong rounded px-3.5 py-2.5 text-[13px]">
                <span className="text-ink-primary font-semibold">Leadership updated</span>
                <span className="text-ink-muted tabular">2m ago</span>
              </div>
              <div className="flex items-center justify-between bg-ground border border-border-strong rounded px-3.5 py-2.5 text-[13px]">
                <span className="text-ink-primary font-semibold">Single-use invite issued</span>
                <span className="text-accent font-bold">crew_8a1c...</span>
              </div>
              <div className="flex items-center justify-between bg-highlight-soft border border-ink-primary rounded px-3.5 py-2.5 text-[13px]">
                <span className="text-ink-primary font-semibold">Socket.IO room stream</span>
                <span className="text-positive font-bold">Synced</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
