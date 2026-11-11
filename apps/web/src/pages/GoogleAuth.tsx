import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { apiGetGoogleAuthStatus, getGoogleAuthUrl } from "../lib/api";

export const GoogleAuth: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const errorParam = searchParams.get("error");
  const returnToParam = searchParams.get("returnTo") || "/dashboard";

  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    async function checkStatus() {
      try {
        const { configured } = await apiGetGoogleAuthStatus();
        if (mounted) {
          setIsConfigured(configured);
        }
      } catch {
        if (mounted) {
          setIsConfigured(false);
        }
      } finally {
        if (mounted) {
          setIsLoadingStatus(false);
        }
      }
    }

    checkStatus();

    return () => {
      mounted = false;
    };
  }, []);

  const handleGoogleClick = () => {
    if (!isConfigured || isRedirecting) return;
    setIsRedirecting(true);
    window.location.href = getGoogleAuthUrl(returnToParam);
  };

  const isUnavailable =
    errorParam === "not_configured" || (isConfigured === false && !isLoadingStatus);
  const hasOtherError = Boolean(errorParam && errorParam !== "not_configured");

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center px-4 sm:px-6 lg:px-8 pt-10 pb-16 sm:pt-14 sm:pb-20 pane-enter">
      <div className="max-w-md w-full my-auto">
        <div className="bg-surface border-2 border-ink-primary rounded-xl p-6 sm:p-10 shadow-xs space-y-7 relative overflow-hidden">
          {/* Subtle architectural butter-yellow corner accent */}
          <div
            aria-hidden="true"
            className="absolute top-0 right-0 w-28 h-28 bg-highlight/35 rounded-bl-full pointer-events-none -mr-8 -mt-8"
          />

          {/* 1. CrewConnect Branding */}
          <div className="flex items-center gap-2.5">
            <svg aria-hidden="true" viewBox="0 0 28 28" className="w-6 h-6 flex-shrink-0">
              <path
                d="M3 22 V13 C3 7.477 7.477 3 13 3 H15 V22 H3 Z"
                fill="#115E59"
                stroke="#18181B"
                strokeWidth="2"
              />
              <circle cx="20" cy="17" r="6" fill="#FDE047" stroke="#18181B" strokeWidth="2" />
            </svg>
            <span className="font-display text-base font-bold tracking-tight text-ink-primary">
              CrewConnect
            </span>
          </div>

          {/* 2 & 3. Heading + Short Supporting Sentence */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-[34px] font-display font-bold text-ink-primary tracking-tight leading-[1.15]">
              Continue with Google
            </h1>
            <p className="text-sm text-ink-secondary leading-relaxed">
              One account. Your next great team starts here.
            </p>
          </div>

          {/* 4. Custom Google Action Button */}
          <div className="space-y-4">
            <button
              type="button"
              disabled={isLoadingStatus || !isConfigured || isRedirecting}
              onClick={handleGoogleClick}
              aria-label="Continue with Google"
              className={`w-full h-12 px-5 flex items-center justify-center gap-3 rounded-lg border-2 font-semibold text-sm transition-all duration-150 select-none ${
                isConfigured && !isLoadingStatus
                  ? "bg-surface border-ink-primary text-ink-primary hover:border-accent hover:shadow-[3px_3px_0px_#18181B] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  : "bg-surface-tonal border-border-strong text-ink-muted cursor-not-allowed opacity-75"
              }`}
            >
              {isLoadingStatus ? (
                <>
                  <div className="w-4 h-4 border-2 border-ink-muted border-t-transparent rounded-full animate-spin" />
                  <span>Checking availability...</span>
                </>
              ) : isRedirecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  {/* Official Google G Multicolour SVG */}
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.28 21.43 7.35 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.13z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.28 2.57 1.25 6.58l4.03 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* 5. Availability or Error Notice (Only when relevant) */}
            {isUnavailable && (
              <div
                role="alert"
                className="p-3.5 rounded-lg border border-border-strong bg-surface-tonal flex items-start gap-2.5 text-xs text-ink-secondary leading-relaxed"
              >
                <AlertCircle className="w-4 h-4 text-tangelo flex-shrink-0 mt-0.5" />
                <span>
                  Google sign-in isn&apos;t available right now. You can continue using your email
                  and password.
                </span>
              </div>
            )}

            {hasOtherError && (
              <div
                role="alert"
                className="p-3.5 rounded-lg border border-danger/30 bg-danger-bg flex items-start gap-2.5 text-xs text-danger leading-relaxed"
              >
                <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                <span>
                  Unable to complete Google sign-in. Please try again or use your email and
                  password.
                </span>
              </div>
            )}
          </div>

          {/* 6. Small Reassurance Statement */}
          <div className="pt-2 border-t border-border-subtle flex items-start gap-2.5 text-xs text-ink-muted leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-ink-secondary">Your account, protected.</span>{" "}
              <span>
                Sign in securely with Google. Your account information is handled with care.
              </span>
            </div>
          </div>

          {/* 7. Link back to email/password sign-in */}
          <div className="pt-2 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
            <span>Prefer email &amp; password?</span>
            <Link
              to="/login"
              className="font-bold text-accent hover:underline inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent rounded-sm"
            >
              <span>Use email and password</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
