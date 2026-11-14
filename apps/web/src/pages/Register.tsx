import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Check, Eye, EyeOff, Plus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePasswordCompanion } from "../hooks/usePasswordCompanion";
import { PasswordCompanion } from "../components/auth/PasswordCompanion";
import { LargePasswordCompanion } from "../components/auth/LargePasswordCompanion";

const SUGGESTED_SKILLS = [
  "TypeScript",
  "React",
  "Node.js",
  "Rust",
  "Go",
  "Python",
  "MongoDB",
  "Docker",
  "Distributed Systems",
  "UI/UX Design",
];

const MAX_SKILLS = 20;
const MAX_BIO_LENGTH = 500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  displayName?: string;
  email?: string;
  password?: string;
  bio?: string;
}

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, error, clearError } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [skillFeedback, setSkillFeedback] = useState<string | null>(null);
  const [bio, setBio] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    isPasswordFocused,
    isPasswordVisible,
    isTyping,
    notifyTyping,
    handleGroupFocus,
    handleGroupBlur,
    toggleVisibility,
  } = usePasswordCompanion();

  const fromLocation = (location.state as { from?: string })?.from || "/";

  const passwordChecks = useMemo(
    () => [
      { id: "len", label: "8+ characters", met: password.length >= 8 },
      { id: "digit", label: "1 number", met: /[0-9]/.test(password) },
      { id: "symbol", label: "1 special character", met: /[^a-zA-Z0-9]/.test(password) },
    ],
    [password]
  );

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleAddSkill = (rawSkill: string) => {
    const trimmed = rawSkill.trim();
    if (!trimmed) {
      setSkillFeedback("Enter a skill name before adding.");
      return;
    }
    if (trimmed.length > 40) {
      setSkillFeedback("Skill names should be 40 characters or shorter.");
      return;
    }
    if (skills.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
      setSkillFeedback(`"${trimmed}" is already added.`);
      return;
    }
    if (skills.length >= MAX_SKILLS) {
      setSkillFeedback(`You can list up to ${MAX_SKILLS} skills.`);
      return;
    }

    setSkills((prev) => [...prev, trimmed]);
    setSkillInput("");
    setSkillFeedback(null);
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills((prev) => prev.filter((s) => s !== skillToRemove));
    setSkillFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSkillFeedback(null);
    clearError();

    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim();
    const trimmedBio = bio.trim();

    const nextFieldErrors: FieldErrors = {};

    if (!trimmedName) {
      nextFieldErrors.displayName = "Full name is required.";
    } else if (trimmedName.length < 2) {
      nextFieldErrors.displayName = "Full name must be at least 2 characters.";
    } else if (trimmedName.length > 50) {
      nextFieldErrors.displayName = "Full name cannot exceed 50 characters.";
    }

    if (!trimmedEmail) {
      nextFieldErrors.email = "Email address is required.";
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextFieldErrors.email = "Enter a valid email address.";
    }

    if (password.length < 8) {
      nextFieldErrors.password = "Password must be at least 8 characters long.";
    } else if (!/[0-9]/.test(password)) {
      nextFieldErrors.password = "Password must contain at least one digit.";
    } else if (!/[^a-zA-Z0-9]/.test(password)) {
      nextFieldErrors.password = "Password must contain at least one special character.";
    }

    if (trimmedBio.length > MAX_BIO_LENGTH) {
      nextFieldErrors.bio = `Bio cannot exceed ${MAX_BIO_LENGTH} characters.`;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      const firstMessage =
        nextFieldErrors.displayName ||
        nextFieldErrors.email ||
        nextFieldErrors.password ||
        nextFieldErrors.bio ||
        "Please review the highlighted fields.";
      setFormError(firstMessage);
      return;
    }

    setFieldErrors({});

    try {
      setIsSubmitting(true);
      await register({
        displayName: trimmedName,
        email: trimmedEmail,
        password,
        skills,
        bio: trimmedBio || undefined,
      });
      setIsSuccess(true);
      navigate(fromLocation, { replace: true });
    } catch {
      // API error is stored in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeError = formError || error;
  const availableSuggestions = SUGGESTED_SKILLS.filter(
    (suggestion) => !skills.some((selected) => selected.toLowerCase() === suggestion.toLowerCase())
  ).slice(0, 6);

  return (
    <div className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-12 bg-ground pane-enter">
      {/* LEFT — Primary Registration Workspace */}
      <section
        aria-label="Create account"
        className="lg:col-span-7 min-w-0 flex flex-col items-center px-5 sm:px-8 lg:px-12 pt-8 pb-12 sm:pt-10 sm:pb-14 bg-surface border-b lg:border-b-0 lg:border-r-2 border-ink-primary"
      >
        <div className="w-full max-w-[520px] my-auto space-y-6">
          {/* 1. Heading & Concise Supporting Copy */}
          <div className="space-y-2">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Participant Onboarding
            </p>
            <h1 className="text-3xl sm:text-[34px] font-display font-bold text-ink-primary tracking-tight leading-[1.1]">
              Create your account.
            </h1>
            <p className="text-sm text-ink-secondary leading-relaxed">
              Share your core details and technical skills so hackathon squads can find you.
            </p>
          </div>

          {/* Form Error / Submission Status */}
          {activeError && (
            <div
              role="alert"
              className="p-3.5 rounded-md border border-[#FCA5A5] bg-danger-bg flex items-start gap-3 text-xs text-danger"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-danger mt-0.5" />
              <div className="font-medium leading-relaxed">{activeError}</div>
            </div>
          )}

          {isSuccess && !activeError && (
            <div
              role="status"
              className="p-3.5 rounded-md border border-[#A7F3D0] bg-accent-tint flex items-center gap-2.5 text-xs font-medium text-accent"
            >
              <Check className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>Account created. Opening CrewConnect...</span>
            </div>
          )}

          <form noValidate className="space-y-5" onSubmit={handleSubmit}>
            {/* 2. Full Name & Email Address (2 columns on sm+, stacked on mobile) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label htmlFor="displayName" className="form-label">
                  Full Name{" "}
                  <span className="text-danger" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  autoComplete="name"
                  required
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    clearFieldError("displayName");
                  }}
                  aria-invalid={Boolean(fieldErrors.displayName)}
                  aria-describedby={fieldErrors.displayName ? "displayName-error" : undefined}
                  placeholder="Alex Rivera"
                  className="form-input"
                />
                {fieldErrors.displayName && (
                  <p id="displayName-error" className="mt-1.5 text-xs text-danger font-medium">
                    {fieldErrors.displayName}
                  </p>
                )}
              </div>

              <div className="min-w-0">
                <label htmlFor="email" className="form-label">
                  Email Address{" "}
                  <span className="text-danger" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError("email");
                  }}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  placeholder="name@hackathon.org"
                  className="form-input"
                />
                {fieldErrors.email && (
                  <p id="email-error" className="mt-1.5 text-xs text-danger font-medium">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
            </div>

            {/* 3. Password & Concise Password Requirements */}
            <div>
              <div className="flex items-end justify-between gap-2 mb-1.5">
                <label htmlFor="password" className="form-label !mb-0">
                  Password{" "}
                  <span className="text-danger" aria-hidden="true">
                    *
                  </span>
                </label>
                {/* Compact interactive companion on mobile/tablet */}
                <div className="lg:hidden">
                  <PasswordCompanion
                    isPasswordFocused={isPasswordFocused}
                    isPasswordVisible={isPasswordVisible}
                    isTyping={isTyping}
                  />
                </div>
              </div>

              <div onFocus={handleGroupFocus} onBlur={handleGroupBlur} className="relative">
                <input
                  id="password"
                  name="password"
                  type={isPasswordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    notifyTyping();
                    clearFieldError("password");
                  }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={
                    fieldErrors.password
                      ? "password-error password-requirements"
                      : "password-requirements"
                  }
                  placeholder="Create a strong password"
                  className="form-input pr-11"
                />
                <button
                  type="button"
                  onClick={toggleVisibility}
                  aria-label={isPasswordVisible ? "Hide characters" : "Show characters"}
                  aria-pressed={isPasswordVisible}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded text-ink-muted hover:text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent cursor-pointer"
                >
                  {isPasswordVisible ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>

              {fieldErrors.password && (
                <p id="password-error" className="mt-1.5 text-xs text-danger font-medium">
                  {fieldErrors.password}
                </p>
              )}

              <ul
                id="password-requirements"
                className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]"
              >
                {passwordChecks.map((rule) => (
                  <li
                    key={rule.id}
                    className={`inline-flex items-center gap-1 transition-colors ${
                      rule.met ? "text-accent font-semibold" : "text-ink-muted"
                    }`}
                  >
                    <Check
                      className={`w-3 h-3 ${rule.met ? "opacity-100" : "opacity-35"}`}
                      aria-hidden="true"
                    />
                    <span>{rule.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 4. Technical Skills Input & Selected Chips */}
            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="skills" className="form-label !mb-0">
                  Technical Skills <span className="text-ink-muted font-normal">(Optional)</span>
                </label>
                <span className="font-mono text-[11px] text-ink-muted tabular">
                  {skills.length}/{MAX_SKILLS} selected
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  id="skills"
                  name="skills"
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
                  aria-describedby="skills-help"
                  placeholder="Add a skill (e.g. Rust, Docker)"
                  className="form-input flex-1 min-w-0"
                />
                <button
                  type="button"
                  onClick={() => handleAddSkill(skillInput)}
                  disabled={skills.length >= MAX_SKILLS}
                  className="btn btn-secondary text-xs h-11 px-4 flex-shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add</span>
                </button>
              </div>

              <p id="skills-help" className="text-[11px] text-ink-muted leading-snug">
                Press Enter or click Add. Adding skills helps teammate matching, or you can add them
                later.
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

              {/* Selected Skills */}
              {skills.length > 0 && (
                <ul aria-label="Selected skills" className="flex flex-wrap gap-2 pt-0.5">
                  {skills.map((skill) => (
                    <li
                      key={skill}
                      className="skill-chip-enter inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-md bg-surface-tonal border border-border-strong text-xs font-medium text-ink-primary"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        aria-label={`Remove ${skill}`}
                        className="inline-flex items-center justify-center w-5 h-5 rounded text-ink-muted hover:text-danger hover:bg-danger-bg transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent cursor-pointer"
                      >
                        <X className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Suggested Skills */}
              {availableSuggestions.length > 0 && (
                <div className="pt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-ink-muted mr-1">Quick add:</span>
                  {availableSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleAddSkill(suggestion)}
                      aria-label={`Add suggested skill ${suggestion}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border-subtle bg-surface text-[11px] font-medium text-ink-secondary hover:border-accent hover:text-accent hover:bg-accent-tint transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent cursor-pointer"
                    >
                      <span aria-hidden="true">+</span>
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Optional Short Bio (Full Width) */}
            <div>
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <label htmlFor="bio" className="form-label !mb-0">
                  Short Bio <span className="text-ink-muted font-normal">(Optional)</span>
                </label>
                {bio.length > 0 && (
                  <span className="font-mono text-[11px] text-ink-muted tabular">
                    {bio.length}/{MAX_BIO_LENGTH}
                  </span>
                )}
              </div>
              <textarea
                id="bio"
                name="bio"
                rows={2}
                maxLength={MAX_BIO_LENGTH}
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value);
                  clearFieldError("bio");
                }}
                aria-invalid={Boolean(fieldErrors.bio)}
                aria-describedby={fieldErrors.bio ? "bio-error" : undefined}
                placeholder="What do you enjoy building at hackathons? (e.g. Realtime backends & APIs)"
                className="form-input form-textarea"
              />
              {fieldErrors.bio && (
                <p id="bio-error" className="mt-1.5 text-xs text-danger font-medium">
                  {fieldErrors.bio}
                </p>
              )}
            </div>

            {/* 6. Dominant Primary Create Account Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="btn btn-brutal-primary w-full h-12 text-sm font-semibold cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                      aria-hidden="true"
                    />
                    <span>Creating account...</span>
                  </span>
                ) : (
                  "Create Account"
                )}
              </button>
            </div>
          </form>

          {/* 7. Existing-Account Sign In Link */}
          <div className="pt-4 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
            <span>Already have an account?</span>
            <Link
              to="/login"
              className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent rounded-sm"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* RIGHT — Complementary Signup Character Presentation (Desktop) */}
      <aside
        aria-hidden="true"
        className="hidden lg:flex lg:col-span-5 min-w-0 bg-chrome relative overflow-hidden flex-col items-center justify-center p-8 xl:p-10"
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
          aria-hidden="true"
        >
          <defs>
            <pattern id="signup-dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.1" fill="#8B8982" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#signup-dots)" />
        </svg>

        <div className="relative z-10 flex items-center justify-center w-full max-w-[460px]">
          <LargePasswordCompanion
            variant="signup"
            isPasswordFocused={isPasswordFocused}
            isPasswordVisible={isPasswordVisible}
            isTyping={isTyping}
          />
        </div>
      </aside>
    </div>
  );
};
