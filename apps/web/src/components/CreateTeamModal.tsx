import React, { useState } from "react";
import { X, AlertCircle, Users, Plus, ShieldCheck, Loader2, Sparkles } from "lucide-react";
import { AccessibleDialog } from "./AccessibleDialog";
import { apiCreateTeam, ApiClientError, type HackathonRecord, type TeamRecord } from "../lib/api";

interface CreateTeamModalProps {
  hackathons: HackathonRecord[];
  defaultHackathonId?: string;
  isOpen: boolean;
  onClose: () => void;
  onTeamCreated: (team: TeamRecord) => void;
}

const COMMON_SKILL_SUGGESTIONS = [
  "TypeScript",
  "React",
  "Python",
  "Rust",
  "Go",
  "Docker",
  "Node.js",
  "Solidity",
  "UI/UX Design",
  "AI / ML",
];

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

  const handleAddSkill = (e?: React.KeyboardEvent | React.MouseEvent) => {
    if (e && "key" in e && e.key !== "Enter") return;
    if (e) e.preventDefault();
    const trimmed = skillInput.trim();
    if (trimmed && !skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkills([...skills, trimmed]);
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const availableSuggestions = COMMON_SKILL_SUGGESTIONS.filter(
    (sugg) => !skills.some((s) => s.toLowerCase() === sugg.toLowerCase())
  );

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
    <AccessibleDialog
      isOpen={isOpen}
      onClose={onClose}
      titleId="create-team-title"
      descriptionId="create-team-description"
      allowClose={!loading}
      maxWidthClass="max-w-xl"
    >
      <div className="flex flex-col max-h-[90vh]">
        {/* Brand Accent Top Stripe */}
        <div className="h-1.5 w-full bg-accent flex-shrink-0" />

        {/* Modal Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border-subtle bg-surface flex-shrink-0">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-accent-tint border border-accent/20 flex items-center justify-center text-accent flex-shrink-0 mt-0.5">
              <Users className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="create-team-title"
                className="font-display font-bold text-xl sm:text-2xl text-ink-primary tracking-tight"
              >
                Create a New Team
              </h2>
              <p
                id="create-team-description"
                className="text-xs sm:text-sm text-ink-secondary mt-1"
              >
                Initialize squad parameters, define needed roles, and recruit teammates.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close create team dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink-primary hover:bg-surface-tonal transition-colors cursor-pointer disabled:opacity-50 -mr-1 -mt-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3.5 bg-danger-bg border border-danger/30 rounded-lg flex items-start gap-2.5 text-danger text-xs sm:text-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
              <span>{error}</span>
            </div>
          )}

          {/* Hackathon Context */}
          {hackathons.length > 1 ? (
            <div className="space-y-1.5">
              <label
                htmlFor="team-hackathon-select"
                className="form-label !mb-0 text-xs font-semibold"
              >
                Hackathon Competition
              </label>
              <select
                id="team-hackathon-select"
                value={selectedHackathonId}
                onChange={(e) => setSelectedHackathonId(e.target.value)}
                className="form-input text-sm cursor-pointer"
              >
                {hackathons.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title} ({h.status})
                  </option>
                ))}
              </select>
            </div>
          ) : currentHackathon ? (
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-surface-tonal border border-border-subtle">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="text-xs font-semibold text-ink-primary">
                  {currentHackathon.title}
                </span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-accent-tint text-accent font-semibold border border-accent/20">
                Active Competition
              </span>
            </div>
          ) : null}

          {/* Team Name */}
          <div className="space-y-1.5">
            <label htmlFor="team-name-input" className="form-label !mb-0 text-xs font-semibold">
              Team Name{" "}
              <span className="text-danger" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="team-name-input"
              type="text"
              required
              placeholder="e.g. Atlas Consensus"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input text-sm"
              maxLength={64}
            />
          </div>

          {/* Tagline */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="team-tagline-input"
                className="form-label !mb-0 text-xs font-semibold"
              >
                Tagline
              </label>
              <span className="text-[11px] text-ink-muted">Optional</span>
            </div>
            <input
              id="team-tagline-input"
              type="text"
              placeholder="A brief one-line squad vision"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="form-input text-sm"
              maxLength={120}
            />
          </div>

          {/* Max Capacity */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="team-capacity-input"
                className="form-label !mb-0 text-xs font-semibold"
              >
                Max Capacity
              </label>
              <span className="text-[11px] font-mono text-ink-muted">
                Allowed: {minAllowed}–{maxAllowed}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                {[2, 3, 4, 5]
                  .filter((n) => n >= minAllowed && n <= maxAllowed)
                  .map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setMaxCapacity(num)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
                        maxCapacity === num
                          ? "bg-accent text-white border-accent shadow-xs"
                          : "bg-surface-tonal text-ink-secondary border-border-subtle hover:border-border-control hover:text-ink-primary"
                      }`}
                    >
                      {num} members
                    </button>
                  ))}
              </div>

              <div className="relative w-24">
                <input
                  id="team-capacity-input"
                  type="number"
                  min={minAllowed}
                  max={maxAllowed}
                  value={maxCapacity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setMaxCapacity(val);
                  }}
                  className="form-input text-sm font-mono text-center h-9 px-2"
                />
              </div>
            </div>
            <p className="text-[11px] text-ink-muted">
              Includes you as squad leader plus {Math.max(0, maxCapacity - 1)} open{" "}
              {maxCapacity - 1 === 1 ? "seat" : "seats"}.
            </p>
          </div>

          {/* Skills Needed */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <label htmlFor="team-skills-input" className="form-label !mb-0 text-xs font-semibold">
                Skills Needed
              </label>
              <span className="text-[11px] font-mono text-ink-muted">{skills.length} added</span>
            </div>

            <div className="flex gap-2">
              <input
                id="team-skills-input"
                type="text"
                placeholder="e.g. TypeScript, Rust, Docker"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleAddSkill}
                className="form-input text-sm flex-1 min-w-0"
              />
              <button
                type="button"
                onClick={() => handleAddSkill()}
                className="btn btn-secondary text-xs h-11 px-4 flex-shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add</span>
              </button>
            </div>

            {/* Suggested Skills */}
            {availableSuggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] text-ink-muted mr-1">Suggestions:</span>
                {availableSuggestions.slice(0, 5).map((sugg) => (
                  <button
                    key={sugg}
                    type="button"
                    onClick={() => {
                      if (!skills.includes(sugg)) setSkills([...skills, sugg]);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-surface-tonal border border-border-subtle hover:border-accent hover:text-accent transition-colors cursor-pointer text-ink-secondary"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>{sugg}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Skills Chips */}
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="skill-chip-enter inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md bg-accent-tint border border-accent/25 text-xs font-semibold text-accent"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      aria-label={`Remove ${skill}`}
                      className="w-4 h-4 rounded flex items-center justify-center text-accent/70 hover:text-danger hover:bg-danger-bg transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Detailed Project Description */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="team-desc-input" className="form-label !mb-0 text-xs font-semibold">
                Detailed Project Description
              </label>
              <span className="text-[11px] text-ink-muted">Optional</span>
            </div>
            <textarea
              id="team-desc-input"
              rows={3}
              placeholder="What are you building? What architecture or stack are you planning?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input form-textarea text-sm py-2.5 min-h-[88px] leading-relaxed"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-ink-muted">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span>You will be squad leader</span>
            </div>
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="btn btn-secondary text-sm h-10 px-5 cursor-pointer font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary text-sm h-10 px-6 cursor-pointer font-semibold flex items-center gap-2 shadow-xs"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create Team</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AccessibleDialog>
  );
};
