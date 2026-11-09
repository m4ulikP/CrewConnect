import React from "react";
import { Users, Filter, Search, UserPlus } from "lucide-react";

export const TeamsPreview: React.FC = () => {
  const mockTeams = [
    {
      id: "1",
      name: "Kernel Panic",
      tagline: "Building an autonomous systems verification agent",
      memberCount: 4,
      maxCapacity: 5,
      skills: ["Rust", "TypeScript", "DevOps"],
      isOpen: true,
    },
    {
      id: "2",
      name: "Distributed Titans",
      tagline: "High-throughput race-proof architecture specialists",
      memberCount: 3,
      maxCapacity: 5,
      skills: ["Node.js", "MongoDB", "Express"],
      isOpen: true,
    },
    {
      id: "3",
      name: "Zero Latency",
      tagline: "Sub-200ms discovery query indexing & k6 benchmarks",
      memberCount: 5,
      maxCapacity: 5,
      skills: ["React", "Tailwind", "Vite"],
      isOpen: false,
    },
  ];

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center space-x-3">
          <Users className="w-7 h-7 text-indigo-400" />
          <span>Team Discovery Board (Preview)</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Paginated discovery board matching hackathon candidates with open teams.
        </p>
      </div>

      {/* Filter and Search Bar Mock */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search teams by name, tagline or technology..."
            disabled
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs focus:outline-none cursor-not-allowed"
          />
        </div>
        <button
          disabled
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-medium cursor-not-allowed"
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Vacancies Only</span>
        </button>
      </div>

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockTeams.map((team) => (
          <div
            key={team.id}
            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between">
                <h3 className="font-bold text-white text-base">{team.name}</h3>
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                    team.memberCount < team.maxCapacity
                      ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/60"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {team.memberCount} / {team.maxCapacity} seats
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2 line-clamp-2">{team.tagline}</p>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-800/60">
              <div className="flex flex-wrap gap-1.5">
                {team.skills.map((skill) => (
                  <span
                    key={skill}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              <button
                disabled
                className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors ${
                  team.isOpen && team.memberCount < team.maxCapacity
                    ? "bg-indigo-600/80 hover:bg-indigo-600 text-white cursor-pointer"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{team.memberCount < team.maxCapacity ? "Request to Join" : "Team Full"}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
