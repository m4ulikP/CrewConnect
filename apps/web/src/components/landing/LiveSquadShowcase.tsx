import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { Avatar } from "../Avatar";

interface DemoSquad {
  id: string;
  name: string;
  track: string;
  mission: string;
  skillsSought: string[];
  maxCapacity: number;
  baseMembers: Array<{ name: string; role: string; specialty: string }>;
  openRoleLabel: string;
}

const DEMO_SQUADS: DemoSquad[] = [
  {
    id: "helios-mesh",
    name: "Helios Mesh",
    track: "Resilient Infrastructure · UTC-5 / UTC+5:30",
    mission:
      "Peer-to-peer emergency coordination tool that keeps local device meshes synchronized when cell towers drop.",
    skillsSought: ["WebRTC", "TypeScript", "IndexedDB"],
    maxCapacity: 4,
    baseMembers: [
      { name: "Maya Lin", role: "Leader", specialty: "Rust & Transport" },
      { name: "Arjun Nair", role: "Member", specialty: "Inference Engine" },
      { name: "Sofia Reyes", role: "Member", specialty: "Design Systems" },
    ],
    openRoleLabel: "Frontend Sync Lead",
  },
  {
    id: "veridian-grid",
    name: "Veridian Grid",
    track: "Civic Telemetry · UTC+0 / UTC+1",
    mission:
      "Open micro-climate dashboard mapping urban heat islands and canopy coverage from municipal sensor feeds.",
    skillsSought: ["Spatial SQL", "React", "PostGIS"],
    maxCapacity: 4,
    baseMembers: [
      { name: "Elena Novak", role: "Leader", specialty: "Geo Ingestion" },
      { name: "Tariq Al-Mansoor", role: "Member", specialty: "Time-Series API" },
      { name: "Noah Patel", role: "Member", specialty: "Data Visualization" },
    ],
    openRoleLabel: "Spatial Map Engineer",
  },
];

export const LiveSquadShowcase: React.FC = () => {
  const [selectedSquadId, setSelectedSquadId] = useState<string>(DEMO_SQUADS[0].id);
  const [reservedIds, setReservedIds] = useState<Record<string, boolean>>({});
  const [isReserving, setIsReserving] = useState(false);

  const activeSquad =
    DEMO_SQUADS.find((s) => s.id === selectedSquadId) ?? DEMO_SQUADS[0];
  const isReserved = Boolean(reservedIds[activeSquad.id]);
  const occupiedCount = activeSquad.baseMembers.length + (isReserved ? 1 : 0);
  const remainingSeats = activeSquad.maxCapacity - occupiedCount;

  const handleReserveDemoSeat = () => {
    if (isReserved || isReserving) return;
    setIsReserving(true);
    setTimeout(() => {
      setReservedIds((prev) => ({ ...prev, [activeSquad.id]: true }));
      setIsReserving(false);
    }, 220);
  };

  const handleResetDemo = () => {
    setReservedIds((prev) => ({ ...prev, [activeSquad.id]: false }));
  };

  return (
    <div
      data-ui="live-squad-showcase"
      className="bg-surface border-2 border-ink-primary rounded-lg overflow-hidden"
    >
      {/* Top Brutalist Switcher Bar */}
      <div className="bg-ink-primary px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {DEMO_SQUADS.map((squad) => {
            const active = squad.id === activeSquad.id;
            return (
              <button
                key={squad.id}
                type="button"
                onClick={() => setSelectedSquadId(squad.id)}
                className={`px-3.5 py-1.5 rounded text-[13px] font-semibold transition-colors cursor-pointer active:scale-[0.97] ${
                  active
                    ? "bg-highlight text-ink-primary"
                    : "bg-[#27272A] text-ground hover:bg-[#3F3F46]"
                }`}
              >
                {squad.name}
              </button>
            );
          })}
        </div>
        <span className="text-[13px] font-medium text-[#D4D4D8]">
          Illustrative interactive preview
        </span>
      </div>

      {/* Main Dossier Body */}
      <div className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-serif text-3xl font-medium text-ink-primary tracking-tight">
              {activeSquad.name}
            </h3>
            <p className="text-[13px] font-medium text-ink-muted">
              {activeSquad.track}
            </p>
          </div>

          <span
            className={`px-3 py-1 rounded text-[13px] font-bold tabular border-2 border-ink-primary self-start ${
              remainingSeats > 0
                ? "bg-highlight text-ink-primary"
                : "bg-accent text-white"
            }`}
          >
            {occupiedCount} / {activeSquad.maxCapacity} seats ·{" "}
            {remainingSeats > 0 ? `${remainingSeats} remaining` : "Squad full"}
          </span>
        </div>

        {/* Modular 4-Slot Capacity Bar */}
        <div className="grid grid-cols-4 gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map((slot) => {
            const filled = slot < occupiedCount;
            const isFourthSlot = slot === 3;
            return (
              <div
                key={slot}
                className={`h-3 rounded-sm border border-ink-primary transition-colors duration-200 ${
                  filled
                    ? isFourthSlot
                      ? "bg-accent"
                      : "bg-ink-primary"
                    : "bg-highlight"
                }`}
              />
            );
          })}
        </div>

        <p className="text-base text-ink-secondary leading-relaxed">
          {activeSquad.mission}
        </p>

        {/* Skills Sought */}
        <div className="space-y-2.5">
          <p className="text-[13px] font-semibold text-ink-primary">
            Skills sought for open role ({activeSquad.openRoleLabel})
          </p>
          <div className="flex flex-wrap gap-2">
            {activeSquad.skillsSought.map((skill) => (
              <span
                key={skill}
                className="px-3 py-1 rounded bg-surface-tonal border border-ink-primary/25 text-[13px] font-semibold text-ink-primary"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Current Roster & Final Seat Slot */}
        <div className="space-y-3">
          <p className="text-[13px] font-semibold text-ink-primary">
            Current Roster ({occupiedCount} / {activeSquad.maxCapacity})
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeSquad.baseMembers.map((member) => (
              <div
                key={member.name}
                className="flex items-center gap-3 p-3 rounded-md bg-ground border border-border-strong"
              >
                <Avatar name={member.name} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-primary truncate">
                    {member.name}
                  </p>
                  <p className="text-[13px] text-ink-secondary truncate">
                    {member.role} · {member.specialty}
                  </p>
                </div>
              </div>
            ))}

            {/* 4th Seat — Dynamic Reservation State */}
            {isReserved ? (
              <div className="pane-enter flex items-center gap-3 p-3 rounded-md bg-accent-tint border-2 border-accent">
                <span className="avatar av-pine">
                  <Check className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-accent truncate">
                    You (Seat 4 Reserved)
                  </p>
                  <p className="text-[13px] text-ink-primary truncate">
                    Simulated Idempotency-Key lock
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-highlight-soft border-2 border-ink-primary">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink-primary truncate">
                    Open Seat 4
                  </p>
                  <p className="text-[13px] text-ink-primary truncate">
                    Direct join available
                  </p>
                </div>
                <span className="text-[13px] font-bold text-ink-primary px-2.5 py-0.5 rounded bg-highlight border border-ink-primary">
                  Open
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="pt-4 border-t-2 border-border-subtle flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {!isReserved ? (
              <button
                type="button"
                onClick={handleReserveDemoSeat}
                disabled={isReserving}
                className="btn btn-primary h-10 px-5 text-sm border-2 border-ink-primary"
              >
                <span>{isReserving ? "Locking seat..." : "Try Reserve Final Seat"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResetDemo}
                className="btn h-10 px-4 text-sm bg-highlight text-ink-primary border-2 border-ink-primary hover:bg-highlight-hover"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset demonstration</span>
              </button>
            )}
          </div>

          <Link
            to="/teams-preview"
            className="text-sm font-semibold text-accent hover:text-accent-hover inline-flex items-center gap-1.5"
          >
            <span>Inspect live squads</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};
