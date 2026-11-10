import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, Radio } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { Avatar } from "./Avatar";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { user, logout, isLoading } = useAuth();
  const { connectionState } = useSocket();

  const isActive = (path: string) =>
    location.pathname === path ||
    (path === "/teams-preview" && location.pathname.startsWith("/teams"));

  return (
    <header className="sticky top-0 z-50 bg-chrome">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-accent transition-transform group-hover:scale-110" />
          <span className="font-serif text-lg sm:text-xl font-semibold tracking-tight text-ink-primary whitespace-nowrap">
            CrewConnect
          </span>
          <span className="hidden lg:inline-flex ml-1 text-[13px] font-medium px-2 py-0.5 rounded bg-surface text-ink-secondary whitespace-nowrap">
            PS1 Engine
          </span>
        </Link>

        {/* Primary Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <Link
            to="/"
            className={`hidden sm:inline-flex px-3 py-1.5 rounded-md text-[13px] sm:text-sm font-medium whitespace-nowrap transition-colors ${
              isActive("/")
                ? "bg-surface text-ink-primary"
                : "text-ink-secondary hover:text-ink-primary hover:bg-surface/60"
            }`}
          >
            <span>Platform</span>
          </Link>
          <Link
            to="/teams-preview"
            className={`px-2.5 sm:px-3 py-1.5 rounded-md text-[13px] sm:text-sm font-medium whitespace-nowrap transition-colors ${
              isActive("/teams-preview")
                ? "bg-surface text-ink-primary"
                : "text-ink-secondary hover:text-ink-primary hover:bg-surface/60"
            }`}
          >
            <span className="sm:hidden">Teams</span>
            <span className="hidden sm:inline">Team Discovery</span>
          </Link>
        </nav>

        {/* Right Actions */}
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
                className="flex items-center gap-2 p-1 pr-2.5 rounded-md bg-surface hover:bg-surface-hover transition-colors"
              >
                <Avatar name={user.displayName} size="sm" />
                <span className="text-[13px] font-medium text-ink-primary hidden md:inline">
                  {user.displayName}
                </span>
              </Link>

              {/* Sign out */}
              <button
                onClick={() => logout()}
                title="Sign out"
                aria-label="Sign out"
                className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                to="/login"
                className="px-1.5 sm:px-3 py-1.5 text-[13px] sm:text-sm font-medium text-ink-primary hover:text-accent whitespace-nowrap transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="btn btn-primary text-[13px] h-9 !px-3 sm:!px-4 whitespace-nowrap"
              >
                Find a squad
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
