import React, { useState } from "react";
import { X, AlertCircle } from "lucide-react";
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/40 backdrop-blur-xs pane-enter"
    >
      <div className="bg-surface border border-border-strong rounded-lg w-full max-w-lg overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface">
          <div>
            <h2 id="create-team-title" className="text-xl font-serif font-medium text-ink-primary">
              Create a New Team
            </h2>
            <p className="text-xs text-ink-secondary">Initialize team and register as squad leader</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close create team dialog"
            className="text-ink-muted hover:text-ink-primary p-1.5 rounded hover:bg-surface-tonal transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-danger-bg border border-[#FCA5A5] rounded flex items-start gap-2 text-danger text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
              <span>{error}</span>
            </div>
          )}

          {/* Hackathon Selection */}
          {hackathons.length > 1 && (
            <div>
              <label htmlFor="team-hackathon-select" className="form-label">
                Hackathon
              </label>
              <select
                id="team-hackathon-select"
                value={selectedHackathonId}
                onChange={(e) => setSelectedHackathonId(e.target.value)}
                className="form-input text-xs"
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
          <div>
            <label htmlFor="team-name-input" className="form-label">
              Team Name <span className="text-danger">*</span>
            </label>
            <input
              id="team-name-input"
              type="text"
              required
              placeholder="e.g. Atlas Consensus"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input text-xs"
            />
          </div>

          {/* Tagline */}
          <div>
            <label htmlFor="team-tagline-input" className="form-label">
              Tagline
            </label>
            <input
              id="team-tagline-input"
              type="text"
              placeholder="A brief one-line squad vision"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="form-input text-xs"
            />
          </div>

          {/* Max Capacity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="team-capacity-input" className="form-label mb-0">
                Max Capacity
              </label>
              <span className="text-[11px] text-ink-muted tabular">
                Allowed: {minAllowed}–{maxAllowed}
              </span>
            </div>
            <input
              id="team-capacity-input"
              type="number"
              min={minAllowed}
              max={maxAllowed}
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(parseInt(e.target.value, 10) || minAllowed)}
              className="form-input text-xs"
            />
          </div>

          {/* Skills Needed */}
          <div className="space-y-2">
            <label htmlFor="team-skills-input" className="form-label mb-0">
              Skills Needed
            </label>
            <div className="flex gap-2">
              <input
                id="team-skills-input"
                type="text"
                placeholder="e.g. TypeScript, Rust, Docker"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleAddSkill}
                className="form-input text-xs flex-1"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="btn btn-secondary text-xs h-11 px-3 cursor-pointer"
              >
                Add
              </button>
            </div>

            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-tonal border border-border-subtle text-xs font-medium text-ink-primary"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-ink-muted hover:text-danger cursor-pointer ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="team-desc-input" className="form-label">
              Detailed Project Description
            </label>
            <textarea
              id="team-desc-input"
              rows={3}
              placeholder="What are you building? What architecture or stack are you planning?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input text-xs py-2 h-auto"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-secondary text-xs h-9 px-4 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary text-xs h-9 px-4 cursor-pointer"
            >
              {loading ? "Creating..." : "Create Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
