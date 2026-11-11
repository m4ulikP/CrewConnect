import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiGetGoogleAuthStatus, getGoogleAuthUrl } from "../lib/api";
import { usePasswordCompanion } from "../hooks/usePasswordCompanion";
import { PasswordCompanion } from "../components/auth/PasswordCompanion";
import { LargePasswordCompanion } from "../components/auth/LargePasswordCompanion";

function mapOAuthQueryError(rawError: string | null): string | null {
  if (!rawError) return null;
  const lower = rawError.toLowerCase();
  if (lower.includes("cancel") || lower === "access_denied") {
    return "Google sign-in was cancelled. You can try again or sign in with email and password.";
  }
  if (lower.includes("already exists") || lower === "account_exists") {
    return "An account with that email already exists. Please sign in with your email and password.";
  }
  return "Google sign-in could not be completed. Please try again or use your email and password.";
}

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, error, clearError } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const queryOAuthError = mapOAuthQueryError(searchParams.get("error"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isCheckingGoogle, setIsCheckingGoogle] = useState(false);
  const [isRedirectingGoogle, setIsRedirectingGoogle] = useState(false);
  const [isGoogleUnavailable, setIsGoogleUnavailable] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!email || !password) {
      setFormError("Please enter both email and password.");
      return;
    }

    try {
      setIsSubmitting(true);
      await login({ email, password });
      navigate(fromLocation, { replace: true });
    } catch {
      // Error is stored in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isCheckingGoogle || isRedirectingGoogle || isGoogleUnavailable) {
      return;
    }

    setIsCheckingGoogle(true);
    try {
      const status = await apiGetGoogleAuthStatus();
      if (status && status.configured === true) {
        setIsRedirectingGoogle(true);
        const destination = fromLocation && fromLocation !== "/login" ? fromLocation : "/dashboard";
        window.location.href = getGoogleAuthUrl(destination);
        return;
      }
      setIsGoogleUnavailable(true);
    } catch {
      setIsGoogleUnavailable(true);
    } finally {
      setIsCheckingGoogle(false);
    }
  };

  const activeError = formError || error || queryOAuthError;
  const isGoogleDisabled = isCheckingGoogle || isRedirectingGoogle || isGoogleUnavailable;

  return (
    <div className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-12 bg-ground pane-enter">
      {/* LEFT — Primary Authentication Section */}
      <section
        aria-label="Sign in"
        className="lg:col-span-6 flex flex-col items-center px-5 sm:px-8 lg:px-12 pt-10 pb-12 sm:pt-12 sm:pb-16 bg-surface border-b lg:border-b-0 lg:border-r-2 border-ink-primary"
      >
        <div className="w-full max-w-[400px] my-auto space-y-7">
          {/* Editorial Heading & Supporting Sentence */}
          <div className="space-y-2">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Participant Access
            </p>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-ink-primary tracking-tight leading-[1.1]">
              Welcome back.
            </h1>
            <p className="text-sm text-ink-secondary leading-relaxed">
              Sign in to reconnect with your hackathon squad and open invitations.
            </p>
          </div>

          {/* Error / Validation Banner */}
          {activeError && (
            <div
              role="alert"
              className="p-3.5 rounded-md border border-[#FCA5A5] bg-danger-bg flex items-start gap-3 text-xs text-danger"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-danger mt-0.5" />
              <div className="font-medium leading-relaxed">{activeError}</div>
            </div>
          )}

          {/* Email & Password Form */}
          <form noValidate className="space-y-5" onSubmit={handleSubmit}>
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

            <div>
              <div className="flex items-end justify-between gap-2 mb-1.5">
                <label htmlFor="password" className="form-label !mb-0">
                  Password
                </label>
                {/* Compact interactive companion visible on mobile & tablet */}
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
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    notifyTyping();
                  }}
                  placeholder="••••••••••••"
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
            </div>

            {/* Dominant Primary Sign In Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-brutal-primary w-full h-12 text-sm font-semibold cursor-pointer"
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </button>
            </div>
          </form>

          {/* Subtle Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-border-subtle" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-surface px-3 text-ink-muted font-mono tracking-wider">OR</span>
            </div>
          </div>

          {/* Secondary Custom Google Action */}
          <div>
            <button
              type="button"
              disabled={isGoogleDisabled}
              onClick={handleGoogleSignIn}
              aria-label="Continue with Google"
              className={`w-full h-11 px-4 flex items-center justify-center gap-2.5 rounded-md border text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                isGoogleUnavailable
                  ? "bg-surface-tonal border-border-strong text-ink-muted cursor-not-allowed opacity-80"
                  : isCheckingGoogle || isRedirectingGoogle
                    ? "bg-surface-tonal border-border-strong text-ink-secondary cursor-wait"
                    : "bg-surface border-border-strong text-ink-primary hover:bg-surface-tonal hover:border-ink-primary cursor-pointer"
              }`}
            >
              {isCheckingGoogle || isRedirectingGoogle ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-ink-secondary border-t-transparent rounded-full animate-spin" />
                  <span>
                    {isRedirectingGoogle ? "Connecting to Google..." : "Checking availability..."}
                  </span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill={isGoogleUnavailable ? "#8B8982" : "#4285F4"}
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"
                    />
                    <path
                      fill={isGoogleUnavailable ? "#8B8982" : "#34A853"}
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.28 21.43 7.35 24 12 24z"
                    />
                    <path
                      fill={isGoogleUnavailable ? "#8B8982" : "#FBBC05"}
                      d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.13z"
                    />
                    <path
                      fill={isGoogleUnavailable ? "#8B8982" : "#EA4335"}
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.28 2.57 1.25 6.58l4.03 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {isGoogleUnavailable && (
              <p
                role="status"
                className="mt-2.5 text-xs text-ink-secondary leading-relaxed text-center"
              >
                Google sign-in is unavailable right now. Please use your email and password instead.
              </p>
            )}
          </div>

          {/* Registration Link */}
          <div className="pt-4 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
            <span>New participant?</span>
            <Link
              to="/register"
              className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent rounded-sm"
            >
              Create an account
            </Link>
          </div>
        </div>
      </section>

      {/* RIGHT — Large Interactive Character Showcase (Desktop) */}
      <aside
        aria-hidden="true"
        className="hidden lg:flex lg:col-span-6 bg-chrome relative overflow-hidden flex-col items-center justify-center p-8 xl:p-12"
      >
        {/* Subtle Drafting Dot Pattern */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
          aria-hidden="true"
        >
          <defs>
            <pattern id="login-dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.1" fill="#8B8982" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#login-dots)" />
        </svg>

        <div className="relative z-10 flex items-center justify-center w-full max-w-[520px]">
          <LargePasswordCompanion
            isPasswordFocused={isPasswordFocused}
            isPasswordVisible={isPasswordVisible}
            isTyping={isTyping}
          />
        </div>
      </aside>
    </div>
  );
};
