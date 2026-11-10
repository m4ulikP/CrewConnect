import React, { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { apiUpdateTeam, ApiClientError, type TeamRecord } from "../lib/api";
import { AccessibleDialog } from "./AccessibleDialog";

interface EditTeamModalProps {
  team: TeamRecord;
  isOpen: boolean;
  onClose: () => void;
  onTeamUpdated: (updatedTeam: TeamRecord) => void;
}

export const EditTeamModal: React.FC<EditTeamModalProps> = ({
  team,
  isOpen,
  onClose,
  onTeamUpdated,
}) => {
  const [name, setName] = useState(team.name);
  const [tagline, setTagline] = useState(team.tagline || "");
  const [description, setDescription] = useState(team.description || "");
  const [skills, setSkills] = useState<string[]>(team.skillsNeeded || []);
  const [skillInput, setSkillInput] = useState("");
  const [maxCapacity, setMaxCapacity] = useState<number>(team.maxCapacity);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

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

    if (maxCapacity < team.memberCount) {
      setError(`Max capacity cannot be less than current member count (${team.memberCount}).`);
      return;
    }

    setLoading(true);
    try {
      const updated = await apiUpdateTeam(team.id, {
        name: name.trim(),
        tagline: tagline.trim() || undefined,
        description: description.trim() || undefined,
        skillsNeeded: skills,
        maxCapacity,
      });

      onTeamUpdated(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to update team details.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccessibleDialog
      isOpen={isOpen}
      onClose={onClose}
      titleId="edit-team-title"
      descriptionId="edit-team-description"
      allowClose={!loading}
      maxWidthClass="max-w-lg"
    >
      <div className="flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface">
          <div>
            <h2 id="edit-team-title" className="text-xl font-serif font-medium text-ink-primary">
              Edit Team Details
            </h2>
            <p id="edit-team-description" className="text-xs text-ink-secondary">
              Update attributes and adjust squad capacity
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close edit team dialog"
            className="text-ink-muted hover:text-ink-primary p-1.5 rounded hover:bg-surface-tonal transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3 bg-danger-bg border border-[#FCA5A5] rounded flex items-start gap-2 text-danger text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
              <span>{error}</span>
            </div>
          )}

          {/* Team Name */}
          <div>
            <label htmlFor="edit-name-input" className="form-label">
              Team Name
            </label>
            <input
              id="edit-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input text-xs"
            />
          </div>

          {/* Tagline */}
          <div>
            <label htmlFor="edit-tagline-input" className="form-label">
              Tagline
            </label>
            <input
              id="edit-tagline-input"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="form-input text-xs"
            />
          </div>

          {/* Max Capacity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="edit-capacity-input" className="form-label mb-0">
                Max Capacity
              </label>
              <span className="text-[11px] text-ink-muted tabular">
                Must be at least current size ({team.memberCount})
              </span>
            </div>
            <input
              id="edit-capacity-input"
              type="number"
              min={team.memberCount}
              max={10}
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(parseInt(e.target.value, 10) || team.memberCount)}
              className="form-input text-xs"
            />
          </div>

          {/* Skills Needed */}
          <div className="space-y-2">
            <label htmlFor="edit-skills-input" className="form-label mb-0">
              Skills Needed
            </label>
            <div className="flex gap-2">
              <input
                id="edit-skills-input"
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
            <label htmlFor="edit-desc-input" className="form-label">
              Detailed Description
            </label>
            <textarea
              id="edit-desc-input"
              rows={3}
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
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </AccessibleDialog>
  );
};
