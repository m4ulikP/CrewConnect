import React from "react";
import { useInViewOnce } from "../../hooks/useInViewOnce";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

export const WorkflowShowcase: React.FC = () => {
  const headerReveal = useInViewOnce<HTMLDivElement>(0.15);
  const stage1 = useInViewOnce<HTMLDivElement>(0.15);
  const stage2 = useInViewOnce<HTMLDivElement>(0.15);
  const stage3 = useInViewOnce<HTMLDivElement>(0.15);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      {/* Editorial Header */}
      <div ref={headerReveal.ref} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
        <div className="lg:col-span-6 motion-reveal" data-visible={headerReveal.inView}>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink-primary tracking-tight leading-[1.08]">
            Three steps from solo to squad.
          </h2>
        </div>
        <div
          style={{ transitionDelay: "70ms" }}
          className="lg:col-span-6 motion-reveal"
          data-visible={headerReveal.inView}
        >
          <p className="text-base text-ink-secondary leading-relaxed max-w-[50ch]">
            Move cleanly from browsing open hackathon teams to shipping together in a shared
            workspace.
          </p>
        </div>
      </div>

      {/* Staggered Asymmetric Chapters with Progressive Drafting Connectors */}
      <div>
        {/* Stage 1: Discover */}
        <div
          ref={stage1.ref}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
        >
          <div className="lg:col-span-5 space-y-3 motion-reveal" data-visible={stage1.inView}>
            <div className="flex items-center gap-3">
              {/* Mini Systems Pine Arch Character */}
              <svg
                aria-hidden="true"
                viewBox="0 0 44 44"
                className="w-10 h-10 flex-shrink-0"
                style={{
                  transform: stage1.inView ? "scale(1)" : "scale(0.9)",
                  transition: `transform 380ms ${EASE_OUT}`,
                }}
              >
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
              <span className="font-display text-lg font-bold text-accent tracking-tight">
                01 · Discover
              </span>
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-ink-primary">
              Find a team that fits your stack
            </h3>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[46ch]">
              Filter squads by needed skills, timezone, and real-time open vacancies.
            </p>
          </div>

          <div
            data-ui="workflow-discover-fragment"
            data-visible={stage1.inView}
            style={{ transitionDelay: "70ms" }}
            className="lg:col-span-7 bg-surface border-2 border-ink-primary rounded-lg p-5 sm:p-6 space-y-4 motion-reveal-scale"
          >
            <div className="flex flex-wrap gap-2">
              <span
                style={{
                  opacity: stage1.inView ? 1 : 0,
                  transform: stage1.inView ? "translate3d(0, 0, 0)" : "translate3d(0, 6px, 0)",
                  transition: `opacity 320ms ${EASE_OUT} 110ms, transform 340ms ${EASE_OUT} 110ms`,
                }}
                className="px-3 py-1 rounded bg-accent text-white text-[13px] font-semibold"
              >
                Has Open Seats
              </span>
              <span
                style={{
                  opacity: stage1.inView ? 1 : 0,
                  transform: stage1.inView ? "translate3d(0, 0, 0)" : "translate3d(0, 6px, 0)",
                  transition: `opacity 320ms ${EASE_OUT} 150ms, transform 340ms ${EASE_OUT} 150ms`,
                }}
                className="px-3 py-1 rounded bg-surface-tonal border border-border-strong text-ink-primary text-[13px] font-medium"
              >
                TypeScript
              </span>
              <span
                style={{
                  opacity: stage1.inView ? 1 : 0,
                  transform: stage1.inView ? "translate3d(0, 0, 0)" : "translate3d(0, 6px, 0)",
                  transition: `opacity 320ms ${EASE_OUT} 190ms, transform 340ms ${EASE_OUT} 190ms`,
                }}
                className="px-3 py-1 rounded bg-surface-tonal border border-border-strong text-ink-primary text-[13px] font-medium"
              >
                UTC+5:30
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                style={{
                  opacity: stage1.inView ? 1 : 0,
                  transform: stage1.inView ? "translate3d(0, 0, 0)" : "translate3d(0, 8px, 0)",
                  transition: `opacity 360ms ${EASE_OUT} 190ms, transform 380ms ${EASE_OUT} 190ms`,
                }}
                className="flex items-center justify-between bg-ground border border-border-subtle rounded px-3.5 py-2.5 text-[13px]"
              >
                <span className="font-semibold text-ink-primary">Helios Mesh</span>
                <span className="text-accent font-semibold">Frontend Lead needed</span>
              </div>
              <div
                style={{
                  opacity: stage1.inView ? 1 : 0,
                  transform: stage1.inView ? "translate3d(0, 0, 0)" : "translate3d(0, 8px, 0)",
                  transition: `opacity 360ms ${EASE_OUT} 240ms, transform 380ms ${EASE_OUT} 240ms`,
                }}
                className="flex items-center justify-between bg-ground border border-border-subtle rounded px-3.5 py-2.5 text-[13px]"
              >
                <span className="font-semibold text-ink-primary">Aether Edge</span>
                <span className="text-accent font-semibold">Rust Systems needed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progressive Connector: Stage 01 -> Stage 02 */}
        <div aria-hidden="true" className="py-3 sm:py-4 flex justify-center lg:block">
          <svg
            viewBox="0 0 1100 44"
            className="hidden lg:block w-full h-11 overflow-visible"
            preserveAspectRatio="none"
          >
            <path
              d="M 800 2 V 20 Q 800 26 794 26 H 312 Q 306 26 306 32 V 42"
              fill="none"
              stroke="#CFCBC2"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
            <path
              d="M 800 2 V 20 Q 800 26 794 26 H 312 Q 306 26 306 32 V 42"
              pathLength={100}
              fill="none"
              stroke="#115E59"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="motion-trace"
              data-visible={stage2.inView}
            />
            <circle
              cx="306"
              cy="42"
              r="3.5"
              fill="#115E59"
              style={{
                opacity: stage2.inView ? 1 : 0,
                transition: `opacity 200ms ${EASE_OUT} 320ms`,
              }}
            />
          </svg>
          <svg viewBox="0 0 24 28" className="lg:hidden w-6 h-7">
            <path
              d="M 12 2 V 24"
              pathLength={100}
              fill="none"
              stroke="#115E59"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="motion-trace"
              data-visible={stage2.inView}
            />
          </svg>
        </div>

        {/* Stage 2: Join or Request (Flipped Asymmetry) */}
        <div
          ref={stage2.ref}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
        >
          <div
            data-ui="workflow-reserve-fragment"
            data-visible={stage2.inView}
            style={{
              opacity: stage2.inView ? 1 : 0,
              transform: stage2.inView
                ? "translate3d(0, 0, 0) scale(1)"
                : "translate3d(-10px, 8px, 0) scale(0.97)",
              transition: `opacity 420ms ${EASE_OUT} 40ms, transform 440ms ${EASE_OUT} 40ms`,
            }}
            className="order-2 lg:order-1 lg:col-span-7 bg-surface border-2 border-ink-primary rounded-lg p-5 sm:p-6 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                style={{
                  opacity: stage2.inView ? 1 : 0,
                  transform: stage2.inView ? "translate3d(0, 0, 0)" : "translate3d(0, 8px, 0)",
                  transition: `opacity 360ms ${EASE_OUT} 120ms, transform 380ms ${EASE_OUT} 120ms`,
                }}
                className="bg-accent-tint border border-accent rounded-md p-3.5 space-y-1"
              >
                <span className="text-sm font-bold text-accent block">Open Recruiting</span>
                <p className="text-[13px] text-ink-secondary">
                  Claim a vacant seat immediately with atomic reservation protection.
                </p>
              </div>
              <div
                style={{
                  opacity: stage2.inView ? 1 : 0,
                  transform: stage2.inView ? "translate3d(0, 0, 0)" : "translate3d(0, 8px, 0)",
                  transition: `opacity 360ms ${EASE_OUT} 180ms, transform 380ms ${EASE_OUT} 180ms`,
                }}
                className="bg-ground border border-border-strong rounded-md p-3.5 space-y-1"
              >
                <span className="text-sm font-bold text-ink-primary block">
                  Curated Applications
                </span>
                <p className="text-[13px] text-ink-secondary">
                  Send a short pitch note directly to the squad leader for approval.
                </p>
              </div>
            </div>
          </div>

          <div
            data-visible={stage2.inView}
            style={{ transitionDelay: "90ms" }}
            className="order-1 lg:order-2 lg:col-span-5 space-y-3 motion-reveal"
          >
            <div className="flex items-center gap-3">
              {/* Mini Tangelo AI/Data Monolith Character */}
              <svg
                aria-hidden="true"
                viewBox="0 0 44 44"
                className="w-10 h-10 flex-shrink-0"
                style={{
                  transform: stage2.inView ? "scale(1)" : "scale(0.9)",
                  transition: `transform 380ms ${EASE_OUT} 90ms`,
                }}
              >
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
              <span className="font-display text-lg font-bold text-tangelo tracking-tight">
                02 · Join or Request
              </span>
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-ink-primary">
              Claim an open spot cleanly
            </h3>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[46ch]">
              Enter open squads immediately or apply with a note when leaders review candidates.
            </p>
          </div>
        </div>

        {/* Progressive Connector: Stage 02 -> Stage 03 */}
        <div aria-hidden="true" className="py-3 sm:py-4 flex justify-center lg:block">
          <svg
            viewBox="0 0 1100 44"
            className="hidden lg:block w-full h-11 overflow-visible"
            preserveAspectRatio="none"
          >
            <path
              d="M 306 2 V 20 Q 306 26 312 26 H 794 Q 800 26 800 32 V 42"
              fill="none"
              stroke="#CFCBC2"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
            <path
              d="M 306 2 V 20 Q 306 26 312 26 H 794 Q 800 26 800 32 V 42"
              pathLength={100}
              fill="none"
              stroke="#18181B"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="motion-trace"
              data-visible={stage3.inView}
            />
            <circle
              cx="800"
              cy="42"
              r="3.5"
              fill="#18181B"
              style={{
                opacity: stage3.inView ? 1 : 0,
                transition: `opacity 200ms ${EASE_OUT} 320ms`,
              }}
            />
          </svg>
          <svg viewBox="0 0 24 28" className="lg:hidden w-6 h-7">
            <path
              d="M 12 2 V 24"
              pathLength={100}
              fill="none"
              stroke="#18181B"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="motion-trace"
              data-visible={stage3.inView}
            />
          </svg>
        </div>

        {/* Stage 3: Collaborate */}
        <div
          ref={stage3.ref}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
        >
          <div data-visible={stage3.inView} className="lg:col-span-5 space-y-3 motion-reveal">
            <div className="flex items-center gap-3">
              {/* Mini Sunburst Butter Product Character */}
              <svg
                aria-hidden="true"
                viewBox="0 0 44 44"
                className="w-10 h-10 flex-shrink-0"
                style={{
                  transform: stage3.inView ? "scale(1)" : "scale(0.9)",
                  transition: `transform 380ms ${EASE_OUT}`,
                }}
              >
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
              <span className="font-display text-lg font-bold text-ink-primary tracking-tight">
                03 · Collaborate
              </span>
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-ink-primary">
              Build inside your team workspace
            </h3>
            <p className="text-base text-ink-secondary leading-relaxed max-w-[46ch]">
              Manage roster decisions, mint one-time invite tokens, transfer leadership, and sync
              roster updates live.
            </p>
          </div>

          <div
            data-ui="workflow-build-fragment"
            data-visible={stage3.inView}
            style={{ transitionDelay: "70ms" }}
            className="lg:col-span-7 bg-surface border-2 border-ink-primary rounded-lg p-5 sm:p-6 space-y-2.5 motion-reveal-scale"
          >
            <div
              style={{
                opacity: stage3.inView ? 1 : 0,
                transform: stage3.inView ? "translate3d(0, 0, 0)" : "translate3d(0, 8px, 0)",
                transition: `opacity 340ms ${EASE_OUT} 120ms, transform 360ms ${EASE_OUT} 120ms`,
              }}
              className="flex items-center justify-between bg-ground border border-border-subtle rounded px-3.5 py-2.5 text-[13px]"
            >
              <span className="text-ink-primary font-semibold">Incoming join applications</span>
              <span className="text-accent font-semibold">One-click review</span>
            </div>
            <div
              style={{
                opacity: stage3.inView ? 1 : 0,
                transform: stage3.inView ? "translate3d(0, 0, 0)" : "translate3d(0, 8px, 0)",
                transition: `opacity 340ms ${EASE_OUT} 175ms, transform 360ms ${EASE_OUT} 175ms`,
              }}
              className="flex items-center justify-between bg-ground border border-border-subtle rounded px-3.5 py-2.5 text-[13px]"
            >
              <span className="text-ink-primary font-semibold">Single-reveal invite tokens</span>
              <span className="text-ink-secondary font-medium">SHA-256 hashed</span>
            </div>
            <div
              style={{
                opacity: stage3.inView ? 1 : 0,
                transform: stage3.inView ? "translate3d(0, 0, 0)" : "translate3d(0, 8px, 0)",
                transition: `opacity 340ms ${EASE_OUT} 230ms, transform 360ms ${EASE_OUT} 230ms`,
              }}
              className="flex items-center justify-between bg-highlight-soft border border-ink-primary/80 rounded px-3.5 py-2.5 text-[13px]"
            >
              <span className="text-ink-primary font-semibold">Socket.IO room sync</span>
              <span className="text-positive font-bold inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-positive" aria-hidden="true" />
                Live
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
