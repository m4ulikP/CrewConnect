import React from "react";
import { useAuth } from "../context/AuthContext";
import { User, Mail, Globe, Shield, Calendar, LogOut } from "lucide-react";

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header Profile Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 font-bold text-2xl shadow-lg shadow-emerald-500/20">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{user.displayName}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {user.status}
                </span>
              </div>
              <p className="text-sm text-slate-400 flex items-center gap-1.5 mt-1">
                <Mail className="w-3.5 h-3.5" />
                {user.email}
              </p>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/20 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

        {user.bio && (
          <div className="mt-6 pt-6 border-t border-slate-800/80">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              About
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">{user.bio}</p>
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Skills & Stack */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            Technical Skills ({user.skills.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {user.skills.map((skill: string) => (
              <span
                key={skill}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-950 border border-slate-800 text-emerald-400"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Account Details */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-400" />
            Account Overview
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
              <span className="text-slate-400 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Time Zone
              </span>
              <span className="text-slate-200 font-mono text-xs">{user.timeZone || "UTC"}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
              <span className="text-slate-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Member Since
              </span>
              <span className="text-slate-200 text-xs">
                {new Date(user.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-slate-400">Experience Tier</span>
              <span className="text-emerald-400 font-medium text-xs">
                {user.experienceLevel || "INTERMEDIATE"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
