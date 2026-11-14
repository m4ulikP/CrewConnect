import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Mail,
  Globe,
  Shield,
  Calendar,
  LogOut,
  Pencil,
  Check,
  X,
  Plus,
  AlertCircle,
  Loader2,
  Github,
  Linkedin,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Avatar } from "../components/Avatar";
import { apiUpdateProfile, ApiClientError } from "../lib/api";
import type { ExperienceLevel } from "@crewconnect/shared";

const MAX_SKILLS = 20;
const MAX_BIO_LENGTH = 500;

const SUGGESTED_SKILLS = [
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "Go",
  "Rust",
  "PostgreSQL",
  "MongoDB",
  "Docker",
  "Kubernetes",
  "GraphQL",
  "TailwindCSS",
  "Next.js",
  "AWS",
  "Figma",
];

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Warsaw",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function isValidUrl(val: string): boolean {
  if (!val.trim()) return true;
  try {
    const url = new URL(val.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const Profile: React.FC = () => {
  const { user, logout, updateUser, refreshUser } = useAuth();

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [bio, setBio] = useState<string>("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState<string>("");
  const [skillFeedback, setSkillFeedback] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState<string>("UTC");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("INTERMEDIATE");
  const [githubUrl, setGithubUrl] = useState<string>("");
  const [linkedinUrl, setLinkedinUrl] = useState<string>("");
  const [portfolioUrl, setPortfolioUrl] = useState<string>("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync form state when user changes or edit mode opens
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setBio(user.bio || "");
      setSkills(user.skills || []);
      setTimeZone(user.timeZone || "UTC");
      setExperienceLevel(user.experienceLevel || "INTERMEDIATE");
      setGithubUrl(user.githubUrl || "");
      setLinkedinUrl(user.linkedinUrl || "");
      setPortfolioUrl(user.portfolioUrl || "");
    }
  }, [user]);

  if (!user) return null;

  const handleStartEdit = () => {
    setDisplayName(user.displayName || "");
    setBio(user.bio || "");
    setSkills(user.skills || []);
    setTimeZone(user.timeZone || "UTC");
    setExperienceLevel(user.experienceLevel || "INTERMEDIATE");
    setGithubUrl(user.githubUrl || "");
    setLinkedinUrl(user.linkedinUrl || "");
    setPortfolioUrl(user.portfolioUrl || "");
    setFieldErrors({});
    setFormError(null);
    setSuccessMessage(null);
    setSkillFeedback(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDisplayName(user.displayName || "");
    setBio(user.bio || "");
    setSkills(user.skills || []);
    setTimeZone(user.timeZone || "UTC");
    setExperienceLevel(user.experienceLevel || "INTERMEDIATE");
    setGithubUrl(user.githubUrl || "");
    setLinkedinUrl(user.linkedinUrl || "");
    setPortfolioUrl(user.portfolioUrl || "");
    setFieldErrors({});
    setFormError(null);
    setSkillFeedback(null);
    setIsEditing(false);
  };

  const handleAddSkill = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    if (skills.length >= MAX_SKILLS) {
      setSkillFeedback(`Maximum ${MAX_SKILLS} skills allowed.`);
      return;
    }

    const isDuplicate = skills.some((s) => s.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      setSkillFeedback(`"${trimmed}" is already added.`);
      return;
    }

    setSkills([...skills, trimmed]);
    setSkillInput("");
    setSkillFeedback(null);
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
    if (skillFeedback) setSkillFeedback(null);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      errors.displayName = "Full name is required.";
    } else if (trimmedName.length < 2) {
      errors.displayName = "Full name must be at least 2 characters.";
    } else if (trimmedName.length > 50) {
      errors.displayName = "Full name cannot exceed 50 characters.";
    }

    if (bio.length > MAX_BIO_LENGTH) {
      errors.bio = `Bio cannot exceed ${MAX_BIO_LENGTH} characters.`;
    }

    if (githubUrl.trim() && !isValidUrl(githubUrl)) {
      errors.githubUrl = "Please provide a valid URL (e.g. https://github.com/username).";
    }

    if (linkedinUrl.trim() && !isValidUrl(linkedinUrl)) {
      errors.linkedinUrl = "Please provide a valid URL (e.g. https://linkedin.com/in/username).";
    }

    if (portfolioUrl.trim() && !isValidUrl(portfolioUrl)) {
      errors.portfolioUrl = "Please provide a valid URL (e.g. https://yourdomain.com).";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!validateForm()) {
      setFormError("Please resolve the highlighted validation errors.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        displayName: displayName.trim(),
        bio: bio.trim(),
        skills,
        timeZone: timeZone.trim(),
        experienceLevel,
        githubUrl: githubUrl.trim(),
        linkedinUrl: linkedinUrl.trim(),
        portfolioUrl: portfolioUrl.trim(),
      };

      const result = await apiUpdateProfile(payload);
      if (updateUser) {
        updateUser(result.user);
      } else {
        await refreshUser();
      }
      setSuccessMessage("Profile updated successfully.");
      setIsEditing(false);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to update profile. Please try again.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableSuggestions = SUGGESTED_SKILLS.filter(
    (s) => !skills.some((sel) => sel.toLowerCase() === s.toLowerCase())
  ).slice(0, 6);

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8 pane-enter">
      {/* Feedback Messages */}
      {successMessage && !isEditing && (
        <div
          role="status"
          className="p-4 rounded-lg border border-[#A7F3D0] bg-accent-tint flex items-center justify-between gap-3 text-sm font-medium text-accent shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <Check className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-accent hover:opacity-75 cursor-pointer"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
                {user.experienceLevel && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-tonal text-ink-secondary border border-border-subtle">
                    {user.experienceLevel}
                  </span>
                )}
              </div>
              <p className="text-sm text-ink-secondary flex items-center gap-1.5 mt-1">
                <Mail className="w-3.5 h-3.5" />
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isEditing ? (
              <button
                type="button"
                onClick={handleStartEdit}
                className="btn btn-primary text-xs h-9 px-4 cursor-pointer flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
                className="btn btn-secondary text-xs h-9 px-4 cursor-pointer"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              onClick={() => logout()}
              className="btn btn-secondary text-xs h-9 px-4 cursor-pointer text-danger hover:border-danger hover:text-danger"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* View Mode: About / Bio */}
        {!isEditing && user.bio && (
          <div className="mt-6 pt-6 border-t border-border-subtle">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">
              About
            </h2>
            <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-line">
              {user.bio}
            </p>
          </div>
        )}
      </div>

      {/* EDIT MODE: Profile Edit Form */}
      {isEditing ? (
        <form
          noValidate
          onSubmit={handleSave}
          className="bg-surface border border-border-strong rounded-lg p-6 sm:p-8 space-y-8 shadow-xs"
        >
          <div className="border-b border-border-subtle pb-4">
            <h2 className="text-lg font-serif font-medium text-ink-primary">Edit Profile</h2>
            <p className="text-xs text-ink-secondary mt-1">
              Update your public hackathon information, skills, and portfolio links.
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              className="p-3.5 rounded-md border border-[#FCA5A5] bg-danger-bg flex items-start gap-3 text-xs text-danger"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-danger mt-0.5" />
              <div className="font-medium leading-relaxed">{formError}</div>
            </div>
          )}

          {/* Section 1: Core Identity */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Core Identity
            </h3>

            {/* Display Name */}
            <div>
              <label htmlFor="displayName" className="form-label">
                Full Name <span className="text-danger">*</span>
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (fieldErrors.displayName) {
                    setFieldErrors({ ...fieldErrors, displayName: "" });
                  }
                }}
                aria-invalid={Boolean(fieldErrors.displayName)}
                aria-describedby={fieldErrors.displayName ? "displayName-error" : undefined}
                className="form-input"
                placeholder="Your full name"
                disabled={isSubmitting}
              />
              {fieldErrors.displayName && (
                <p id="displayName-error" className="mt-1 text-xs text-danger font-medium">
                  {fieldErrors.displayName}
                </p>
              )}
            </div>

            {/* Bio */}
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="bio" className="form-label !mb-0">
                  Short Bio <span className="text-ink-muted font-normal">(Optional)</span>
                </label>
                <span className="font-mono text-[11px] text-ink-muted tabular">
                  {bio.length}/{MAX_BIO_LENGTH}
                </span>
              </div>
              <textarea
                id="bio"
                name="bio"
                rows={3}
                maxLength={MAX_BIO_LENGTH}
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value);
                  if (fieldErrors.bio) {
                    setFieldErrors({ ...fieldErrors, bio: "" });
                  }
                }}
                aria-invalid={Boolean(fieldErrors.bio)}
                aria-describedby={fieldErrors.bio ? "bio-error" : "bio-help"}
                className="form-input mt-1.5 resize-y min-h-[80px]"
                placeholder="Tell potential teammates about your interests, past projects, or preferred hackathon roles."
                disabled={isSubmitting}
              />
              <p id="bio-help" className="mt-1 text-[11px] text-ink-muted leading-snug">
                Clear this field to remove your bio.
              </p>
              {fieldErrors.bio && (
                <p id="bio-error" className="mt-1 text-xs text-danger font-medium">
                  {fieldErrors.bio}
                </p>
              )}
            </div>
          </div>

          {/* Section 2: Technical Skills */}
          <div className="space-y-3 pt-4 border-t border-border-subtle">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="skillInput" className="form-label !mb-0">
                Technical Skills <span className="text-ink-muted font-normal">(Optional)</span>
              </label>
              <span className="font-mono text-[11px] text-ink-muted tabular">
                {skills.length}/{MAX_SKILLS} selected
              </span>
            </div>

            <div className="flex gap-2">
              <input
                id="skillInput"
                name="skillInput"
                type="text"
                value={skillInput}
                onChange={(e) => {
                  setSkillInput(e.target.value);
                  if (skillFeedback) setSkillFeedback(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSkill(skillInput);
                  }
                }}
                placeholder="Add a technical skill (e.g. Rust, PyTorch, GraphQL)"
                className="form-input flex-1 min-w-0"
                disabled={isSubmitting || skills.length >= MAX_SKILLS}
              />
              <button
                type="button"
                onClick={() => handleAddSkill(skillInput)}
                disabled={isSubmitting || skills.length >= MAX_SKILLS}
                className="btn btn-secondary text-xs h-11 px-4 flex-shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add</span>
              </button>
            </div>

            <p className="text-[11px] text-ink-muted leading-snug">
              Press Enter or click Add. Adding skills helps squads find you in discovery. You may
              save with zero skills.
            </p>

            {skillFeedback && (
              <p
                role="status"
                aria-live="polite"
                className="text-xs font-medium text-ink-secondary"
              >
                {skillFeedback}
              </p>
            )}

            {/* Selected Skills Chips */}
            {skills.length > 0 && (
              <ul aria-label="Selected skills" className="flex flex-wrap gap-2 pt-1">
                {skills.map((skill) => (
                  <li
                    key={skill}
                    className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-md bg-surface-tonal border border-border-strong text-xs font-medium text-ink-primary"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      aria-label={`Remove ${skill}`}
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center w-5 h-5 rounded text-ink-muted hover:text-danger hover:bg-danger-bg transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Suggested Skills */}
            {availableSuggestions.length > 0 && (
              <div className="pt-2">
                <span className="text-[11px] text-ink-muted block mb-1.5 font-medium">
                  Suggested skills:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleAddSkill(suggestion)}
                      disabled={isSubmitting || skills.length >= MAX_SKILLS}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-surface border border-border-subtle text-ink-secondary hover:border-accent hover:text-accent hover:bg-accent-tint transition-all cursor-pointer"
                    >
                      <Plus className="w-3 h-3 opacity-60" aria-hidden="true" />
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Experience & Timezone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-border-subtle">
            {/* Experience Level */}
            <div>
              <label htmlFor="experienceLevel" className="form-label">
                Experience Level
              </label>
              <select
                id="experienceLevel"
                name="experienceLevel"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
                className="form-input cursor-pointer"
                disabled={isSubmitting}
              >
                <option value="BEGINNER">BEGINNER — Newer to hackathons / learning</option>
                <option value="INTERMEDIATE">INTERMEDIATE — Experienced builder</option>
                <option value="ADVANCED">ADVANCED — Senior / Systems architect</option>
              </select>
              <p className="mt-1 text-[11px] text-ink-muted leading-snug">
                Helps squads balance their experience roster.
              </p>
            </div>

            {/* Timezone */}
            <div>
              <label htmlFor="timeZone" className="form-label">
                Timezone (IANA)
              </label>
              <div className="relative">
                <input
                  id="timeZone"
                  name="timeZone"
                  type="text"
                  list="timezone-options"
                  value={timeZone}
                  onChange={(e) => {
                    setTimeZone(e.target.value);
                    if (fieldErrors.timeZone) {
                      setFieldErrors({ ...fieldErrors, timeZone: "" });
                    }
                  }}
                  className="form-input"
                  placeholder="e.g. UTC, America/New_York, Asia/Kolkata"
                  disabled={isSubmitting}
                />
                <datalist id="timezone-options">
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz} />
                  ))}
                </datalist>
              </div>
              <p className="mt-1 text-[11px] text-ink-muted leading-snug">
                Used for scheduling collaboration and async coordination.
              </p>
              {fieldErrors.timeZone && (
                <p className="mt-1 text-xs text-danger font-medium">{fieldErrors.timeZone}</p>
              )}
            </div>
          </div>

          {/* Section 4: External Profiles & Portfolio */}
          <div className="space-y-4 pt-4 border-t border-border-subtle">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Online Profiles & Portfolio (Optional)
            </h3>

            {/* GitHub URL */}
            <div>
              <label htmlFor="githubUrl" className="form-label flex items-center gap-1.5">
                <Github className="w-3.5 h-3.5 text-ink-secondary" />
                <span>GitHub URL</span>
              </label>
              <input
                id="githubUrl"
                name="githubUrl"
                type="url"
                value={githubUrl}
                onChange={(e) => {
                  setGithubUrl(e.target.value);
                  if (fieldErrors.githubUrl) {
                    setFieldErrors({ ...fieldErrors, githubUrl: "" });
                  }
                }}
                aria-invalid={Boolean(fieldErrors.githubUrl)}
                aria-describedby={fieldErrors.githubUrl ? "githubUrl-error" : undefined}
                className="form-input"
                placeholder="https://github.com/username"
                disabled={isSubmitting}
              />
              {fieldErrors.githubUrl && (
                <p id="githubUrl-error" className="mt-1 text-xs text-danger font-medium">
                  {fieldErrors.githubUrl}
                </p>
              )}
            </div>

            {/* LinkedIn URL */}
            <div>
              <label htmlFor="linkedinUrl" className="form-label flex items-center gap-1.5">
                <Linkedin className="w-3.5 h-3.5 text-ink-secondary" />
                <span>LinkedIn URL</span>
              </label>
              <input
                id="linkedinUrl"
                name="linkedinUrl"
                type="url"
                value={linkedinUrl}
                onChange={(e) => {
                  setLinkedinUrl(e.target.value);
                  if (fieldErrors.linkedinUrl) {
                    setFieldErrors({ ...fieldErrors, linkedinUrl: "" });
                  }
                }}
                aria-invalid={Boolean(fieldErrors.linkedinUrl)}
                aria-describedby={fieldErrors.linkedinUrl ? "linkedinUrl-error" : undefined}
                className="form-input"
                placeholder="https://linkedin.com/in/username"
                disabled={isSubmitting}
              />
              {fieldErrors.linkedinUrl && (
                <p id="linkedinUrl-error" className="mt-1 text-xs text-danger font-medium">
                  {fieldErrors.linkedinUrl}
                </p>
              )}
            </div>

            {/* Portfolio URL */}
            <div>
              <label htmlFor="portfolioUrl" className="form-label flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-ink-secondary" />
                <span>Portfolio / Personal Website</span>
              </label>
              <input
                id="portfolioUrl"
                name="portfolioUrl"
                type="url"
                value={portfolioUrl}
                onChange={(e) => {
                  setPortfolioUrl(e.target.value);
                  if (fieldErrors.portfolioUrl) {
                    setFieldErrors({ ...fieldErrors, portfolioUrl: "" });
                  }
                }}
                aria-invalid={Boolean(fieldErrors.portfolioUrl)}
                aria-describedby={fieldErrors.portfolioUrl ? "portfolioUrl-error" : undefined}
                className="form-input"
                placeholder="https://yourportfolio.dev"
                disabled={isSubmitting}
              />
              {fieldErrors.portfolioUrl && (
                <p id="portfolioUrl-error" className="mt-1 text-xs text-danger font-medium">
                  {fieldErrors.portfolioUrl}
                </p>
              )}
            </div>
            <p className="text-[11px] text-ink-muted">
              Tip: Clear any URL field and save to remove it from your public profile.
            </p>
          </div>

          {/* Form Actions */}
          <div className="pt-6 border-t border-border-subtle flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSubmitting}
              className="btn btn-secondary w-full sm:w-auto text-xs h-10 px-5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full sm:w-auto text-xs h-10 px-6 cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* VIEW MODE: Details Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Technical Skills */}
          <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-serif text-ink-primary flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent" />
                <span>Technical Skills ({user.skills?.length || 0})</span>
              </h2>
              <button
                type="button"
                onClick={handleStartEdit}
                className="text-xs text-accent hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit</span>
              </button>
            </div>
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
              <p className="text-xs text-ink-muted italic">
                No technical skills listed. Click Edit Profile to add skills for squad discovery.
              </p>
            )}
          </div>

          {/* Profile & Collaboration Details */}
          <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-4 shadow-xs">
            <h2 className="text-base font-serif text-ink-primary flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              <span>Matching & Availability</span>
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <span className="text-ink-secondary">Experience Level</span>
                <span className="font-semibold text-ink-primary">
                  {user.experienceLevel || "INTERMEDIATE"}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <span className="text-ink-secondary">Timezone</span>
                <span className="font-mono text-ink-primary">{user.timeZone || "UTC"}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <span className="text-ink-secondary">Member Status</span>
                <span className="font-semibold text-positive">{user.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-secondary">Participant Since</span>
                <span className="text-ink-primary tabular flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-ink-muted" />
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : "Active Participant"}
                </span>
              </div>
            </div>
          </div>

          {/* Online Presence & Links */}
          <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-4 shadow-xs md:col-span-2">
            <h2 className="text-base font-serif text-ink-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span>Online Presence & Links</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* GitHub */}
              <div className="p-3.5 rounded border border-border-subtle bg-surface-tonal">
                <div className="flex items-center gap-2 text-ink-muted mb-1.5 font-medium">
                  <Github className="w-4 h-4 text-ink-primary" />
                  <span>GitHub</span>
                </div>
                {user.githubUrl ? (
                  <a
                    href={user.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline flex items-center gap-1 truncate font-medium"
                  >
                    <span className="truncate">{user.githubUrl.replace(/^https?:\/\//, "")}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ) : (
                  <span className="text-ink-muted italic">Not linked</span>
                )}
              </div>

              {/* LinkedIn */}
              <div className="p-3.5 rounded border border-border-subtle bg-surface-tonal">
                <div className="flex items-center gap-2 text-ink-muted mb-1.5 font-medium">
                  <Linkedin className="w-4 h-4 text-ink-primary" />
                  <span>LinkedIn</span>
                </div>
                {user.linkedinUrl ? (
                  <a
                    href={user.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline flex items-center gap-1 truncate font-medium"
                  >
                    <span className="truncate">{user.linkedinUrl.replace(/^https?:\/\//, "")}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ) : (
                  <span className="text-ink-muted italic">Not linked</span>
                )}
              </div>

              {/* Portfolio */}
              <div className="p-3.5 rounded border border-border-subtle bg-surface-tonal">
                <div className="flex items-center gap-2 text-ink-muted mb-1.5 font-medium">
                  <Globe className="w-4 h-4 text-ink-primary" />
                  <span>Portfolio</span>
                </div>
                {user.portfolioUrl ? (
                  <a
                    href={user.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline flex items-center gap-1 truncate font-medium"
                  >
                    <span className="truncate">
                      {user.portfolioUrl.replace(/^https?:\/\//, "")}
                    </span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ) : (
                  <span className="text-ink-muted italic">Not linked</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
