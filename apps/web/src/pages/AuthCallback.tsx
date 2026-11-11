import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, ArrowLeft, RefreshCw, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const AuthCallback: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const errorParam = searchParams.get("error");

  const [isVerifying, setIsVerifying] = useState<boolean>(!errorParam);
  const [errorMessage, setErrorMessage] = useState<string | null>(errorParam);

  useEffect(() => {
    let mounted = true;

    if (errorParam) {
      setErrorMessage(errorParam);
      setIsVerifying(false);
      return;
    }

    async function completeVerification() {
      try {
        await refreshUser();
        if (mounted) {
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        if (mounted) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : "Unable to verify session cookie. Please try signing in again."
          );
          setIsVerifying(false);
        }
      }
    }

    completeVerification();

    return () => {
      mounted = false;
    };
  }, [errorParam, refreshUser, navigate]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center px-4 sm:px-6 lg:px-8 pt-10 pb-16 sm:pt-14 sm:pb-20 pane-enter">
      <div className="max-w-md w-full my-auto space-y-6">
        <div className="bg-surface border-2 border-ink-primary rounded-xl p-7 sm:p-10 shadow-xs space-y-6">
          {isVerifying ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="space-y-1">
                <h2 className="font-serif text-xl font-medium text-ink-primary">
                  Finalizing Verification
                </h2>
                <p className="text-xs text-ink-secondary">
                  Securing your session and loading your hackathon squad workspace...
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-danger">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider">
                    Authentication Notice
                  </span>
                </div>
                <h1 className="text-2xl font-serif font-medium text-ink-primary tracking-tight">
                  Sign-In Unsuccessful
                </h1>
              </div>

              <div
                role="alert"
                className="p-4 rounded-lg border border-danger/30 bg-danger-bg text-xs text-danger font-medium leading-relaxed"
              >
                {errorMessage || "An unexpected error occurred during Google authentication."}
              </div>

              <div className="space-y-3 pt-2">
                <Link
                  to="/login"
                  className="btn btn-primary w-full h-11 text-sm flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign in with Email & Password</span>
                </Link>

                <Link
                  to="/auth/google"
                  className="btn btn-secondary w-full h-11 text-sm flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Try Google Again</span>
                </Link>
              </div>

              <div className="pt-2 border-t border-border-subtle text-center">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to platform homepage</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
