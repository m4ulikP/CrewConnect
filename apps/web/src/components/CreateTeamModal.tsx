import React, { useState } from "react";
import { X, Users, Sparkles, AlertCircle } from "lucide-react";
import { apiCreateTeam, ApiClientError, type HackathonRecord, type TeamRecord } from "../lib/api";

interface CreateTeamModalProps {
  hackathons: HackathonRecord[];
  defaultHackathonId?: string;
  isOpen: boolean;
  onClose: () => void;
  onTeamCreated: (team: TeamRecord) => void;
}

export const CreateTeamModal: React.FC<CreateTeamModalProps> = ({
  hackathons,
  defaultHackathonId,
  isOpen,
  onClose,
  onTeamCreated,
}) => {
  const [selectedHackathonId, setSelectedHackathonId] = useState(
    defaultHackathonId || (hackathons[0]?.id ?? "")
  );
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [maxCapacity, setMaxCapacity] = useState<number>(5);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const currentHackathon = hackathons.find((h) => h.id === selectedHackathonId) || hackathons[0];
  const maxAllowed = currentHackathon?.maxTeamSize || 5;
  const minAllowed = currentHackathon?.minTeamSize || 1;

  const handleAddSkill = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ("key" in e && e.key !== "Enter") return;
    e.preventDefault();
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || name.trim().length < 2) {
      setError("Team name must be at least 2 characters long.");
      return;
    }

    if (!selectedHackathonId) {
      setError("Please select a hackathon for team formation.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiCreateTeam(selectedHackathonId, {
        name: name.trim(),
        tagline: tagline.trim() || undefined,
        description: description.trim() || undefined,
        skillsNeeded: skills,
        maxCapacity,
      });

      onTeamCreated(res.team);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to create team. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-team-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 id="create-team-title" className="text-lg font-bold text-white">
                Create a New Team
              </h2>
              <p className="text-xs text-slate-400">Initialize team and register as leader</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close create team dialog"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl flex items-start space-x-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Hackathon Selection */}
          {hackathons.length > 1 && (
            <div className="space-y-1.5">
              <label
                htmlFor="team-hackathon-select"
                className="text-xs font-semibold text-slate-300"
              >
                Hackathon
              </label>
              <select
                id="team-hackathon-select"
                value={selectedHackathonId}
                onChange={(e) => setSelectedHackathonId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {hackathons.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title} ({h.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Team Name */}
          <div className="space-y-1.5">
            <label htmlFor="team-name-input" className="text-xs font-semibold text-slate-300">
              Team Name <span className="text-rose-400">*</span>
            </label>
            <input
              id="team-name-input"
              type="text"
              required
              minLength={2}
              maxLength={50}
              placeholder="e.g. Distributed Titans"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Tagline */}
          <div className="space-y-1.5">
            <label htmlFor="team-tagline-input" className="text-xs font-semibold text-slate-300">
              Tagline
            </label>
            <input
              id="team-tagline-input"
              type="text"
              maxLength={100}
              placeholder="e.g. Building sub-millisecond race-proof systems"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Max Capacity */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label
                htmlFor="team-max-capacity-input"
                className="text-xs font-semibold text-slate-300"
              >
                Max Capacity
              </label>
              <span className="text-[11px] text-slate-400">
                Allowed: {minAllowed}–{maxAllowed} members
              </span>
            </div>
            <input
              id="team-max-capacity-input"
              type="number"
              min={minAllowed}
              max={maxAllowed}
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(parseInt(e.target.value, 10) || minAllowed)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Skills Needed */}
          <div className="space-y-1.5">
            <label htmlFor="team-skills-input" className="text-xs font-semibold text-slate-300">
              Skills Needed
            </label>
            <div className="flex space-x-2">
              <input
                id="team-skills-input"
                type="text"
                placeholder="e.g. TypeScript, Rust, Docker (press Enter)"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleAddSkill}
                className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition-colors"
              >
                Add
              </button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {skills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-medium rounded-lg"
                  >
                    <span>{s}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(s)}
                      className="hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label
              htmlFor="team-description-input"
              className="text-xs font-semibold text-slate-300"
            >
              Description
            </label>
            <textarea
              id="team-description-input"
              rows={3}
              maxLength={1000}
              placeholder="Provide context about your team goal, tech stack, and ideal collaborators..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{loading ? "Creating Team..." : "Create Team"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
