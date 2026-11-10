import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldCheck, Users, Activity, LogOut, LogIn, UserPlus, Radio } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { user, logout, isLoading } = useAuth();
  const { connectionState } = useSocket();

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
            to="/teams-preview"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive("/teams-preview")
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
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          ) : user ? (
            <div className="flex items-center space-x-3">
              <div
                title={`Real-time status: ${connectionState}`}
                aria-label={`Real-time status: ${connectionState}`}
                data-testid="realtime-status-badge"
                className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                  connectionState === "connected"
                    ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-300"
                    : connectionState === "reconnecting" || connectionState === "connecting"
                      ? "bg-amber-950/60 border-amber-800/60 text-amber-300"
                      : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                <Radio
                  className={`w-3 h-3 ${
                    connectionState === "connected"
                      ? "text-emerald-400 animate-pulse"
                      : connectionState === "reconnecting" || connectionState === "connecting"
                        ? "text-amber-400 animate-spin"
                        : "text-slate-500"
                  }`}
                />
                <span>
                  {connectionState === "connected"
                    ? "Live"
                    : connectionState === "reconnecting" || connectionState === "connecting"
                      ? "Syncing"
                      : "Offline"}
                </span>
              </div>
              <Link
                to="/profile"
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors group"
              >
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-slate-200 group-hover:text-white">
                  {user.displayName}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                aria-label="Sign out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
              <Link
                to="/register"
                className="flex items-center space-x-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
