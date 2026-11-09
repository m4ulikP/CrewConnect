import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Zap,
  Cpu,
  Layers,
  ArrowRight,
  Database,
  CheckCircle2,
  Server,
} from "lucide-react";
import { fetchHealth } from "../lib/api";

export const Home: React.FC = () => {
  const [health, setHealth] = useState<{
    status: string;
    uptime: number;
    timestamp: string;
    environment: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

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
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-950/70 border border-indigo-700/50 text-indigo-300 text-xs font-semibold shadow-inner">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Hack4Hack 2026 — Problem Statement 1</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Race-Proof Team Formation{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-emerald-300 to-teal-200">
            Engine
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
          Engineered to guarantee strict serializability under high-concurrency burst traffic. When
          50 participants simultaneously claim the final seat, exactly one wins and forty-nine fail
          cleanly without counter divergence or phantom memberships.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            to="/teams"
            className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium text-sm shadow-lg shadow-indigo-600/25 transition-all transform hover:-translate-y-0.5"
          >
            <span>Explore Team Board</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="https://github.com/m4ulikP/CrewConnect"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium text-sm transition-all"
          >
            <span>Architecture Specs</span>
          </a>
        </div>
      </section>

      {/* Platform Telemetry & Status Card */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-slate-800/80 gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Server className="w-5 h-5 text-indigo-400" />
              <span>Infrastructure Telemetry</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Live status from the Express backend and containerized environment.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-emerald-400 font-semibold">
              {loading ? "Probing..." : health ? "API Online (200 OK)" : "API Standby"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/60">
            <span className="text-xs text-slate-500 block">Transaction Engine</span>
            <span className="text-sm font-semibold text-slate-200 mt-1 flex items-center space-x-1.5">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>MongoDB 7.0 (rs0)</span>
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">ACID Session Support</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/60">
            <span className="text-xs text-slate-500 block">Concurrency Control</span>
            <span className="text-sm font-semibold text-slate-200 mt-1 flex items-center space-x-1.5">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Two-Tier Reservation</span>
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">Atomic $inc + Fencing</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/60">
            <span className="text-xs text-slate-500 block">Idempotency Protocol</span>
            <span className="text-sm font-semibold text-slate-200 mt-1 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>In-Txn Completion</span>
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Crash-Consistent Guarantee
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/60">
            <span className="text-xs text-slate-500 block">Architecture Style</span>
            <span className="text-sm font-semibold text-slate-200 mt-1 flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-teal-400" />
              <span>Modular Monolith</span>
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">TypeScript Workspaces</span>
          </div>
        </div>
      </section>

      {/* Core Concurrency Invariant Feature Highlights */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400 flex items-center justify-center mb-4">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base mb-2">50-to-1 Seat Allocation</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            When multiple transactions contend for the 5th seat of a 5-person team, WiredTiger write
            tickets serialize the atomic conditional increment. Exactly 1 request succeeds; 49
            receive clean 409 Conflict responses.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base mb-2">Single-Team Invariant</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Guaranteed by a database-level unique compound partial index{" "}
            <code className="text-emerald-300 font-mono text-[11px] bg-slate-950 px-1 py-0.5 rounded">
              {"{ hackathonId: 1, userId: 1 }"}
            </code>
            . No participant can belong to two teams simultaneously under any concurrent race
            condition.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-800 text-amber-400 flex items-center justify-center mb-4">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base mb-2">Atomic Crash Consistency</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Idempotency leases are acquired outside the transaction with 30s crash expiry, while the
            transition to COMPLETED occurs within the transaction itself. Process crashes can never
            leave unrecorded mutations.
          </p>
        </div>
      </section>
    </div>
  );
};
