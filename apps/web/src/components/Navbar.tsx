import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldCheck, Users, Activity } from "lucide-react";

export const Navbar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-indigo-400 group-hover:text-emerald-400 transition-colors" />
            </div>
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight">CrewConnect</span>
            <span className="hidden sm:inline-block ml-2 text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
              PS1 Engine
            </span>
          </div>
        </Link>

        <nav className="flex items-center space-x-1 sm:space-x-2">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive("/")
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <span className="flex items-center space-x-1.5">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Platform</span>
            </span>
          </Link>
          <Link
            to="/teams"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive("/teams")
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <span className="flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Team Discovery</span>
            </span>
          </Link>
        </nav>

        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono">Replica Set Ready</span>
          </div>
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            Enter Hackathon
          </button>
        </div>
      </div>
    </header>
  );
};
