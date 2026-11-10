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
    location.pathname === path || (path === "/teams-preview" && location.pathname.startsWith("/teams"));

  return (
    <header className="sticky top-0 z-50 bg-chrome/90 backdrop-blur-md border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center space-x-2.5 group">
          <span className="w-2.5 h-2.5 rounded-full bg-accent transition-transform group-hover:scale-110" />
          <span className="font-serif text-xl font-semibold tracking-tight text-ink-primary">
            CrewConnect
          </span>
          <span className="ml-1 text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border-subtle text-ink-secondary">
            PS1 Engine
          </span>
        </Link>

        {/* Primary Navigation */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              isActive("/")
                ? "bg-surface text-ink-primary shadow-xs border border-border-subtle"
                : "text-ink-secondary hover:text-ink-primary hover:bg-surface/60"
            }`}
          >
            <span>Platform</span>
          </Link>
          <Link
            to="/teams-preview"
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              isActive("/teams-preview")
                ? "bg-surface text-ink-primary shadow-xs border border-border-subtle"
                : "text-ink-secondary hover:text-ink-primary hover:bg-surface/60"
            }`}
          >
            <span>Team Discovery</span>
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center space-x-3">
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          ) : user ? (
            <div className="flex items-center space-x-3">
              {/* Real-time Socket status badge */}
              <div
                title={`Real-time status: ${connectionState}`}
                aria-label={`Real-time status: ${connectionState}`}
                data-testid="realtime-status-badge"
                className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded text-[11px] font-medium border ${
                  connectionState === "connected"
                    ? "bg-positive-bg text-positive border-[#BBF7D0]"
                    : connectionState === "reconnecting" || connectionState === "connecting"
                      ? "bg-warning-bg text-warning border-[#FDE68A]"
                      : "bg-surface-tonal text-ink-muted border-border-subtle"
                }`}
              >
                <Radio
                  className={`w-3 h-3 ${
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
                className="flex items-center space-x-2 p-1 pr-2.5 rounded-md bg-surface border border-border-subtle hover:border-border-control transition-colors"
              >
                <Avatar name={user.displayName} size="sm" />
                <span className="text-xs font-medium text-ink-primary hidden md:inline">
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
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-ink-secondary hover:text-ink-primary transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="btn btn-primary text-xs h-8 px-3.5"
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
