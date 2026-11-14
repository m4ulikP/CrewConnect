import React, { useState, useEffect, useCallback } from "react";
import { X, AlertCircle, Users, Plus, ShieldCheck, Loader2, RefreshCw } from "lucide-react";
import { AccessibleDialog } from "./AccessibleDialog";
import {
  apiCreateTeam,
  apiGetHackathons,
  ApiClientError,
  type HackathonRecord,
  type TeamRecord,
} from "../lib/api";

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

const getHackathonId = (h: HackathonRecord | undefined): string =>
  h?.id || (h as unknown as { _id?: string })?._id || "";

export const CreateTeamModal: React.FC<CreateTeamModalProps> = ({
  hackathons,
  defaultHackathonId,
  isOpen,
  onClose,
  onTeamCreated,
}) => {
  const [internalHackathons, setInternalHackathons] = useState<HackathonRecord[]>(hackathons || []);
  const [loadingHackathons, setLoadingHackathons] = useState<boolean>(false);
  const [hackathonFetchError, setHackathonFetchError] = useState<string | null>(null);

  const [selectedHackathonId, setSelectedHackathonId] = useState<string>(
    defaultHackathonId ||
      getHackathonId(hackathons.find((h) => h.status === "ACTIVE")) ||
      getHackathonId(hackathons[0]) ||
      ""
  );

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [maxCapacity, setMaxCapacity] = useState<number>(5);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync internal list if hackathons prop updates
  useEffect(() => {
    if (hackathons && hackathons.length > 0) {
      setInternalHackathons(hackathons);
    }
  }, [hackathons]);

  // Proactively fetch hackathons if prop was empty
  const fetchHackathons = useCallback(async () => {
    setLoadingHackathons(true);
    setHackathonFetchError(null);
    try {
      const data = await apiGetHackathons();
      if (data && data.length > 0) {
        setInternalHackathons(data);
      }
    } catch {
      setHackathonFetchError("Failed to load hackathon list.");
    } finally {
      setLoadingHackathons(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && internalHackathons.length === 0 && (!hackathons || hackathons.length === 0)) {
      fetchHackathons();
    }
  }, [isOpen, hackathons, internalHackathons.length, fetchHackathons]);

  // Keep selectedHackathonId in sync with props or loaded hackathons
  useEffect(() => {
    if (defaultHackathonId) {
      setSelectedHackathonId(defaultHackathonId);
    } else if (internalHackathons.length > 0) {
      setSelectedHackathonId((prev) => {
        if (prev && internalHackathons.some((h) => getHackathonId(h) === prev)) return prev;
        const active =
          internalHackathons.find((h) => h.status === "ACTIVE") || internalHackathons[0];
        return getHackathonId(active);
      });
    }
  }, [defaultHackathonId, internalHackathons]);

  if (!isOpen) return null;

  const currentHackathon =
    internalHackathons.find((h) => getHackathonId(h) === selectedHackathonId) ||
    internalHackathons.find((h) => h.status === "ACTIVE") ||
    internalHackathons[0];
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

    const hackathonToUse =
      selectedHackathonId ||
      getHackathonId(internalHackathons.find((h) => h.status === "ACTIVE")) ||
      getHackathonId(internalHackathons[0]);

    if (!hackathonToUse) {
      setError("Please select a hackathon for team formation.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiCreateTeam(hackathonToUse, {
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

          {/* Hackathon Competition Field - Always accessible and visible */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="team-hackathon-select"
                className="form-label !mb-0 text-xs font-semibold"
              >
                Hackathon Competition{" "}
                <span className="text-danger" aria-hidden="true">
                  *
                </span>
              </label>
              {loadingHackathons && (
                <span className="text-[11px] text-ink-muted flex items-center gap-1 font-mono">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading competitions...</span>
                </span>
              )}
            </div>

            <div className="relative">
              <select
                id="team-hackathon-select"
                value={selectedHackathonId}
                onChange={(e) => {
                  setSelectedHackathonId(e.target.value);
                  if (error) setError(null);
                }}
                disabled={loading || loadingHackathons || internalHackathons.length === 0}
                className="form-input text-sm cursor-pointer pr-10"
              >
                {internalHackathons.length === 0 ? (
                  <option value="">
                    {loadingHackathons ? "Loading hackathons..." : "No hackathons available"}
                  </option>
                ) : (
                  internalHackathons.map((h) => {
                    const hId = getHackathonId(h);
                    return (
                      <option key={hId} value={hId}>
                        {h.title} {h.status === "ACTIVE" ? "(Active Competition)" : `(${h.status})`}
                      </option>
                    );
                  })
                )}
              </select>
            </div>

            {hackathonFetchError && internalHackathons.length === 0 && (
              <div className="flex items-center gap-2 pt-1 text-xs text-danger">
                <span>{hackathonFetchError}</span>
                <button
                  type="button"
                  onClick={fetchHackathons}
                  className="inline-flex items-center gap-1 text-accent hover:underline font-semibold cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
            )}
          </div>

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
