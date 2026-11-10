import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, LogOut, Radio } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { Avatar } from "./Avatar";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { user, logout, isLoading } = useAuth();
  const { connectionState } = useSocket();

  const isActive = (path: string) =>
    location.pathname === path ||
    (path === "/" && Boolean(user) && location.pathname === "/dashboard") ||
    (path === "/teams-preview" && location.pathname.startsWith("/teams"));

  return (
    <header className="sticky top-0 z-50 bg-ground border-b-2 border-ink-primary">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Bespoke Brand Emblem + Division Stamp */}
        <Link
          to="/"
          className="flex items-center gap-1.5 sm:gap-2.5 group flex-shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent rounded"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 28 28"
            className="w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0 transition-transform duration-150 ease-out group-hover:-rotate-6"
          >
            <path
              d="M3 22 V13 C3 7.477 7.477 3 13 3 H15 V22 H3 Z"
              fill="#115E59"
              stroke="#18181B"
              strokeWidth="2"
            />
            <circle cx="20" cy="17" r="6" fill="#FDE047" stroke="#18181B" strokeWidth="2" />
          </svg>
          <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-ink-primary whitespace-nowrap">
            CrewConnect
          </span>
          <span className="hidden lg:inline-flex items-center gap-1.5 ml-1 text-[13px] font-bold px-2.5 py-0.5 rounded-[3px] bg-highlight border border-ink-primary text-ink-primary whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-tangelo" />
            <span>PS1 Engine</span>
          </span>
        </Link>

        {/* Primary Navigation */}
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-2 sm:gap-5 flex-shrink-0"
        >
          <Link
            to={user ? "/dashboard" : "/"}
            className={`hidden sm:inline-flex items-center py-1 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent rounded-sm ${
              isActive("/")
                ? "text-ink-primary font-bold underline decoration-2 decoration-accent underline-offset-[6px]"
                : "text-ink-secondary hover:text-ink-primary"
            }`}
          >
            <span>{user ? "Dashboard" : "Platform"}</span>
          </Link>
          <Link
            to="/teams-preview"
            className={`inline-flex items-center px-1.5 sm:px-0 py-1 text-[13px] sm:text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent rounded-sm ${
              isActive("/teams-preview")
                ? "text-ink-primary font-bold underline decoration-2 decoration-accent underline-offset-[6px]"
                : "text-ink-secondary hover:text-ink-primary"
            }`}
          >
            <span className="sm:hidden">Teams</span>
            <span className="hidden sm:inline">Team Discovery</span>
          </Link>
        </nav>

        {/* Right Auth & Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          ) : user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Real-time Socket status badge */}
              <div
                title={`Real-time status: ${connectionState}`}
                aria-label={`Real-time status: ${connectionState}`}
                data-testid="realtime-status-badge"
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded text-[13px] font-medium ${
                  connectionState === "connected"
                    ? "bg-positive-bg text-positive"
                    : connectionState === "reconnecting" || connectionState === "connecting"
                      ? "bg-warning-bg text-warning"
                      : "bg-surface-tonal text-ink-muted"
                }`}
              >
                <Radio
                  className={`w-3.5 h-3.5 ${
                    connectionState === "connected"
                      ? "text-positive"
                      : connectionState === "reconnecting" || connectionState === "connecting"
                        ? "text-warning animate-spin"
                        : "text-ink-muted"
                  }`}
                />
                <span className="tabular">
                  {connectionState === "connected"
                    ? "Live"
                    : connectionState === "reconnecting" || connectionState === "connecting"
                      ? "Syncing"
                      : "Offline"}
                </span>
              </div>

              {/* Profile Shortcut */}
              <Link
                to="/profile"
                className="flex items-center gap-2 p-1 pr-2.5 rounded bg-surface border border-ink-primary/25 hover:border-ink-primary transition-colors"
              >
                <Avatar name={user.displayName} size="sm" />
                <span className="text-[13px] font-semibold text-ink-primary hidden md:inline">
                  {user.displayName}
                </span>
              </Link>

              {/* Sign out */}
              <button
                onClick={() => logout()}
                title="Sign out"
                aria-label="Sign out"
                className="p-2 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface-tonal transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                className="px-1.5 sm:px-2 py-1.5 text-[13px] sm:text-sm font-semibold text-ink-primary hover:text-accent whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent rounded-sm"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="btn btn-brutal-primary group h-9 !px-3 sm:!px-4 text-[13px] whitespace-nowrap"
              >
                <span className="sm:hidden">Join</span>
                <span className="hidden sm:inline">Find a squad</span>
                <ArrowRight className="w-3.5 h-3.5 hidden sm:inline transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
