import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AlertCircle, X, Plus } from "lucide-react";

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

const TIMEZONES = [
  "UTC",
  "UTC-8 (Pacific)",
  "UTC-5 (Eastern)",
  "UTC+0 (London)",
  "UTC+1 (Central Europe)",
  "UTC+5:30 (India)",
  "UTC+8 (Singapore)",
  "UTC+9 (Tokyo)",
];

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, error, clearError } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [skills, setSkills] = useState<string[]>(["TypeScript", "React"]);
  const [skillInput, setSkillInput] = useState("");
  const [timeZone, setTimeZone] = useState("UTC");
  const [bio, setBio] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSkill = (skillToAdd: string) => {
    const trimmed = skillToAdd.trim();
    if (trimmed && !skills.includes(trimmed) && skills.length < 20) {
      setSkills([...skills, trimmed]);
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    // Client password validation rules matching backend & tests
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setFormError("Password must contain at least one digit.");
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      setFormError("Password must contain at least one special character.");
      return;
    }
    if (!displayName.trim()) {
      setFormError("Full name is required.");
      return;
    }
    if (!email.trim()) {
      setFormError("Email address is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        skills,
        timeZone,
        bio: bio.trim() || undefined,
      });
      navigate("/", { replace: true });
    } catch {
      // Error is set in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeError = formError || error;

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 pane-enter">
      <div className="max-w-xl w-full space-y-6">
        <div className="bg-surface border border-border-strong rounded-lg p-8 sm:p-10 shadow-xs space-y-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-serif font-medium text-ink-primary tracking-tight">
              Create participant profile
            </h1>
            <p className="text-sm text-ink-secondary">
              Join Hack4Hack 2026 and discover matching teammates.
            </p>
          </div>

          {activeError && (
            <div
              role="alert"
              className="p-3.5 rounded border border-[#FCA5A5] bg-danger-bg flex items-start gap-3 text-xs text-danger"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-danger mt-0.5" />
              <div className="font-medium leading-relaxed">{activeError}</div>
            </div>
          )}

          <form noValidate className="space-y-5" onSubmit={handleSubmit}>
            {/* Full Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="displayName" className="form-label">
                  Full Name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Maulik Patel"
                  className="form-input"
                />
              </div>

              <div>
                <label htmlFor="email" className="form-label">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@hackathon.org"
                  className="form-input"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters with numbers & symbols"
                className="form-input"
              />
              <span className="text-[11px] text-ink-muted mt-1 block">
                Minimum 8 characters, at least 1 digit and 1 special symbol.
              </span>
            </div>

            {/* Skills & Tags */}
            <div className="space-y-2">
              <label htmlFor="skills" className="form-label">
                Technical Skills ({skills.length} added)
              </label>

              <div className="flex gap-2">
                <input
                  id="skills"
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSkill(skillInput);
                    }
                  }}
                  placeholder="Add skill (e.g. Rust, Raft, Docker)..."
                  className="form-input flex-1"
                />
                <button
                  type="button"
                  onClick={() => handleAddSkill(skillInput)}
                  className="btn btn-secondary text-xs h-11 px-3 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {/* Added Skills Chips */}
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

              {/* Suggestions */}
              <div className="pt-1">
                <span className="text-[11px] text-ink-muted mr-1.5">Suggested:</span>
                <div className="inline-flex flex-wrap gap-1">
                  {SUGGESTED_SKILLS.filter((s) => !skills.includes(s)).slice(0, 5).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleAddSkill(s)}
                      className="text-[11px] text-ink-secondary hover:text-accent underline cursor-pointer mr-1.5"
                    >
                      +{s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Timezone & Bio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="timeZone" className="form-label">
                  Primary Timezone
                </label>
                <select
                  id="timeZone"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  className="form-input"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="bio" className="form-label">
                  Short Bio (Optional)
                </label>
                <input
                  id="bio"
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Distributed systems enthusiast"
                  className="form-input"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary w-full h-11 text-sm cursor-pointer"
              >
                {isSubmitting ? "Creating account..." : "Create Account"}
              </button>
            </div>
          </form>

          <div className="pt-4 border-t border-border-subtle flex items-center justify-between text-xs text-ink-secondary">
            <span>Already registered?</span>
            <Link to="/login" className="font-semibold text-accent hover:underline">
              Sign In
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-ink-muted">
          Your credentials and sessions are protected with Argon2id and HTTPS secure cookies.
        </p>
      </div>
    </div>
  );
};
