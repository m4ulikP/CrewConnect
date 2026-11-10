import React from "react";
import { useAuth } from "../context/AuthContext";
import { Mail, Globe, Shield, Calendar, LogOut, Info } from "lucide-react";
import { Avatar } from "../components/Avatar";

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8 pane-enter">
      {/* Header Profile Card */}
      <div className="bg-surface border border-border-strong rounded-lg p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar name={user.displayName} size="lg" />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-serif font-medium text-ink-primary">
                  {user.displayName}
                </h1>
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-accent-tint text-accent border border-[#C5E0DC]">
                  {user.status}
                </span>
              </div>
              <p className="text-sm text-ink-secondary flex items-center gap-1.5 mt-1">
                <Mail className="w-3.5 h-3.5" />
                {user.email}
              </p>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="btn btn-secondary text-xs h-9 px-4 cursor-pointer text-danger hover:border-danger hover:text-danger"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {user.bio && (
          <div className="mt-6 pt-6 border-t border-border-subtle">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">
              About
            </h2>
            <p className="text-sm text-ink-secondary leading-relaxed">{user.bio}</p>
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Technical Skills */}
        <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-4">
          <h2 className="text-base font-serif text-ink-primary flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent" />
            <span>Technical Skills ({user.skills?.length || 0})</span>
          </h2>
          {user.skills && user.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {user.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-2.5 py-1 rounded bg-surface-tonal border border-border-subtle text-xs font-medium text-ink-primary"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-muted italic">No skills listed.</p>
          )}
        </div>

        {/* Identity & Session Metadata */}
        <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-4">
          <h2 className="text-base font-serif text-ink-primary flex items-center gap-2">
            <Globe className="w-4 h-4 text-accent" />
            <span>Session & Account Details</span>
          </h2>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <span className="text-ink-secondary">User ID</span>
              <span className="font-mono text-ink-primary tabular">{user.id}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <span className="text-ink-secondary">Member Status</span>
              <span className="font-semibold text-positive">{user.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-secondary">Registered</span>
              <span className="text-ink-primary tabular flex items-center gap-1">
                <Calendar className="w-3 h-3 text-ink-muted" />
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Active Participant"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Backend Gap Transparency Notice */}
      <div className="p-4 rounded border border-border-subtle bg-surface-tonal text-xs text-ink-secondary flex items-start gap-3">
        <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-ink-primary">Profile Management Notice:</strong> Live profile modifications via{" "}
          <code className="font-mono text-[11px] bg-surface px-1 py-0.5 rounded border border-border-subtle">PATCH /auth/me</code>{" "}
          are documented as an architectural roadmap capability. Current account attributes are immutable for the duration of the hackathon session.
        </div>
      </div>
    </div>
  );
};
