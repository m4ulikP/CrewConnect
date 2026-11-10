import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AlertCircle } from "lucide-react";

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, error, clearError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const activeError = formError || error;

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 pane-enter">
      <div className="max-w-md w-full space-y-6">
        <div className="bg-surface border border-border-strong rounded-lg p-8 sm:p-10 shadow-xs space-y-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-serif font-medium text-ink-primary tracking-tight">
              Sign in
            </h1>
            <p className="text-sm text-ink-secondary">
              Return to your hackathon squad and invitations.
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

          <form noValidate className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="form-label"
              >
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
              <label
                htmlFor="password"
                className="form-label"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="form-input"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary w-full h-11 text-sm cursor-pointer"
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </button>
            </div>
          </form>

          <div className="pt-4 border-t border-border-subtle flex items-center justify-between text-xs text-ink-secondary">
            <span>New participant?</span>
            <Link to="/register" className="font-semibold text-accent hover:underline">
              Create an account
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-ink-muted">
          Sessions authenticated via Argon2id hashing and strict HTTP-only cookies.
        </p>
      </div>
    </div>
  );
};
