import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";
import { ERROR_CODES } from "@crewconnect/shared";

/**
 * Normalizes client IP address, stripping IPv4-mapped IPv6 prefixes.
 */
export function getClientIp(req: Request): string {
  let ip = req.ip || req.socket.remoteAddress || "unknown";
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }
  return ip.trim();
}

/**
 * Generates a privacy-preserving fixed-length hash for account identifiers (email).
 */
export function getAccountKey(email?: unknown): string {
  if (typeof email !== "string" || !email.trim()) return "unknown";
  const normalized = email.toLowerCase().trim();
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

// In-memory sliding-window store
const generalRequestStores = new Map<string, Map<string, number[]>>();
const loginIpRequests = new Map<string, number[]>();
const loginAccountIpFailures = new Map<string, number[]>();
const loginAccountGlobalFailures = new Map<string, number[]>();

/**
 * Cleans expired timestamps from a timestamp map.
 */
function pruneStore(store: Map<string, number[]>, windowMs: number, now: number): void {
  for (const [key, timestamps] of store.entries()) {
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length === 0) {
      store.delete(key);
    } else {
      store.set(key, valid);
    }
  }
}

// Periodic background cleanup timer
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const store of generalRequestStores.values()) {
    pruneStore(store, 3_600_000, now);
  }
  pruneStore(loginIpRequests, env.AUTH_LOGIN_WINDOW_MS, now);
  pruneStore(loginAccountIpFailures, env.AUTH_LOGIN_WINDOW_MS, now);
  pruneStore(loginAccountGlobalFailures, env.AUTH_LOGIN_WINDOW_MS, now);
}, 60_000);
cleanupTimer.unref();

/**
 * Resets all rate-limiting stores (used primarily for test isolation).
 */
export function resetRateLimitStores(): void {
  for (const store of generalRequestStores.values()) {
    store.clear();
  }
  loginIpRequests.clear();
  loginAccountIpFailures.clear();
  loginAccountGlobalFailures.clear();
}

/**
 * Determines whether the request should bypass rate-limiting.
 * In production mode (NODE_ENV=production), rate limits CANNOT be bypassed.
 */
function shouldBypassLimits(req: Request): boolean {
  const isProduction = env.NODE_ENV === "production" || process.env.NODE_ENV === "production";
  if (isProduction) return false;

  // In non-production only:
  // Allow the benchmark runner or tests (without x-test-rate-limit) to bypass limits.
  return (
    req.headers["x-benchmark-bypass"] === "crewconnect-load-test" ||
    (process.env.NODE_ENV === "test" && !req.headers["x-test-rate-limit"])
  );
}

/**
 * Creates a generic sliding-window rate limiter for specific routes.
 */
export function createRateLimiter(config: RateLimitConfig) {
  const { windowMs, max, message = "Too many requests. Please try again later." } = config;
  const requests = new Map<string, number[]>();
  const storeId = crypto.randomUUID();
  generalRequestStores.set(storeId, requests);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (config.skip?.(req)) {
      return next();
    }

    if (shouldBypassLimits(req)) {
      return next();
    }

    const key = config.keyGenerator ? config.keyGenerator(req) : getClientIp(req);
    const now = Date.now();

    const clientTimestamps = requests.get(key) || [];
    const validTimestamps = clientTimestamps.filter((t) => now - t < windowMs);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - validTimestamps.length - 1));

    if (validTimestamps.length >= max) {
      const oldestTimestamp = validTimestamps[0];
      const resetTimeMs = oldestTimestamp + windowMs - now;
      const retryAfterSec = Math.ceil(Math.max(1, resetTimeMs / 1000));

      res.setHeader("Retry-After", retryAfterSec);
      next(new AppError(ERROR_CODES.RATE_LIMITED, message, 429, { retryAfter: retryAfterSec }));
      return;
    }

    validTimestamps.push(now);
    requests.set(key, validTimestamps);
    next();
  };
}

/**
 * Dedicated Authentication Login Rate Limiter (POST /api/v1/auth/login)
 * Implements layered protection:
 *  1. Volumetric IP throttle (stops automated credential-stuffing sweeps)
 *  2. Failed login attempt throttle scoped to (account + IP) (locks out brute-force guessing without locking legitimate users on other IPs)
 *  3. Account-level threshold across all IPs (mitigates distributed attacks while prioritizing legitimate user security)
 *  4. Successful logins immediately clear the consecutive failure count for that account + IP.
 */
export function authLoginRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (shouldBypassLimits(req)) {
    return next();
  }

  const clientIp = getClientIp(req);
  const now = Date.now();
  const email = typeof req.body?.email === "string" ? req.body.email : undefined;
  const accountKey = getAccountKey(email);

  // 1. Check IP-level volumetric limit
  const ipTimestamps = (loginIpRequests.get(clientIp) || []).filter(
    (t) => now - t < env.AUTH_LOGIN_WINDOW_MS
  );

  res.setHeader("X-RateLimit-Limit", env.AUTH_LOGIN_MAX_IP_ATTEMPTS);
  res.setHeader(
    "X-RateLimit-Remaining",
    Math.max(0, env.AUTH_LOGIN_MAX_IP_ATTEMPTS - ipTimestamps.length - 1)
  );

  if (ipTimestamps.length >= env.AUTH_LOGIN_MAX_IP_ATTEMPTS) {
    const oldestTimestamp = ipTimestamps[0];
    const resetTimeMs = oldestTimestamp + env.AUTH_LOGIN_WINDOW_MS - now;
    const retryAfterSec = Math.ceil(Math.max(1, resetTimeMs / 1000));

    res.setHeader("Retry-After", retryAfterSec);
    return next(
      new AppError(
        ERROR_CODES.RATE_LIMITED,
        `Too many login attempts from this network. Please try again after ${Math.ceil(retryAfterSec / 60)} minutes.`,
        429,
        { retryAfter: retryAfterSec }
      )
    );
  }

  // 2. Check (Account + IP) consecutive failed attempts
  if (email) {
    const accountIpKey = `${accountKey}:${clientIp}`;
    const failures = (loginAccountIpFailures.get(accountIpKey) || []).filter(
      (t) => now - t < env.AUTH_LOGIN_WINDOW_MS
    );

    if (failures.length >= env.AUTH_LOGIN_MAX_FAILED_ATTEMPTS) {
      const oldestFailure = failures[0];
      const resetTimeMs = oldestFailure + env.AUTH_LOGIN_WINDOW_MS - now;
      const retryAfterSec = Math.ceil(Math.max(1, resetTimeMs / 1000));

      res.setHeader("Retry-After", retryAfterSec);
      return next(
        new AppError(
          ERROR_CODES.RATE_LIMITED,
          `Too many failed login attempts for this account from your network. Please try again after ${Math.ceil(retryAfterSec / 60)} minutes.`,
          429,
          { retryAfter: retryAfterSec }
        )
      );
    }

    // 3. Track Account-Wide Suspicious Activity as a Risk Signal
    // NOTE: We deliberately do NOT perform an automatic hard-lockout (429) across all IPs
    // based on unauthenticated failure counts alone, as this creates a Denial-of-Service vector
    // where an attacker guessing bad passwords locks out the legitimate user from their own network.
    // Instead, failed attempts are strictly enforced per (account + IP), while global failure counts
    // serve as a risk signal. Legitimate users entering the correct password are never denied login.
    const globalFailures = (loginAccountGlobalFailures.get(accountKey) || []).filter(
      (t) => now - t < env.AUTH_LOGIN_WINDOW_MS
    );

    if (globalFailures.length >= 10) {
      // Elevated threat signal: attach risk metadata for security logging / audits
      (req as unknown as { accountSecurityRisk?: boolean }).accountSecurityRisk = true;
    }
  }

  // Record IP attempt timestamp
  ipTimestamps.push(now);
  loginIpRequests.set(clientIp, ipTimestamps);

  // Hook into response completion to record failures vs successes
  res.on("finish", () => {
    if (!email) return;

    const accountIpKey = `${accountKey}:${clientIp}`;

    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Successful authentication: immediately reset consecutive failed attempts for this account + IP!
      loginAccountIpFailures.delete(accountIpKey);
      loginAccountGlobalFailures.delete(accountKey);
    } else if (res.statusCode === 401) {
      // Invalid credentials failure: record failure timestamp
      const nowFailure = Date.now();
      const currentFailures = (loginAccountIpFailures.get(accountIpKey) || []).filter(
        (t) => nowFailure - t < env.AUTH_LOGIN_WINDOW_MS
      );
      currentFailures.push(nowFailure);
      loginAccountIpFailures.set(accountIpKey, currentFailures);

      const currentGlobal = (loginAccountGlobalFailures.get(accountKey) || []).filter(
        (t) => nowFailure - t < env.AUTH_LOGIN_WINDOW_MS
      );
      currentGlobal.push(nowFailure);
      loginAccountGlobalFailures.set(accountKey, currentGlobal);
    }
  });

  next();
}

/**
 * Dedicated Account Registration Rate Limiter (POST /api/v1/auth/register)
 * Implements two-tier protection for shared networks (hackathons, universities, offices):
 *  1. Short-term burst guard (stops automated rapid-fire bot scripts)
 *  2. Calibrated hourly quota (accommodates legitimate multi-user registration bursts on shared Wi-Fi)
 */
const registerBurstLimiter = createRateLimiter({
  windowMs: env.AUTH_REGISTER_BURST_WINDOW_MS,
  max: env.AUTH_REGISTER_BURST_MAX,
  message:
    "Too many rapid registration attempts from this network. Please wait a minute before trying again.",
  keyGenerator: (req) => `register-burst:${getClientIp(req)}`,
});

const registerHourlyLimiter = createRateLimiter({
  windowMs: env.AUTH_REGISTER_WINDOW_MS,
  max: env.AUTH_REGISTER_MAX_ATTEMPTS,
  message:
    "Registration limit reached for this network. Please try again after an hour or contact support.",
  keyGenerator: (req) => `register-hourly:${getClientIp(req)}`,
});

export const authRegisterRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  registerBurstLimiter(req, res, (err) => {
    if (err) return next(err);
    registerHourlyLimiter(req, res, next);
  });
};

/**
 * Dedicated OAuth Initiation Rate Limiter (GET /api/v1/auth/google)
 */
export const authOAuthRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many sign-in attempts. Please try again later.",
  keyGenerator: (req) => `oauth:${getClientIp(req)}`,
});

/**
 * Backwards-compatible alias for existing imports.
 */
export const authRateLimiter = authLoginRateLimiter;

/**
 * General API Rate Limiter
 * Protects general read/write API endpoints (300 requests per 15 minutes per IP).
 * Explicitly skips /auth/login and /auth/register to guarantee authentication requests are never
 * throttled by background browsing or SPA navigation traffic.
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: "API rate limit exceeded. Please try again later.",
  keyGenerator: (req) => `api:${getClientIp(req)}`,
  skip: (req) => {
    // Skip dedicated auth mutation endpoints from general browsing quota
    const originalUrl = req.originalUrl || req.url || "";
    return originalUrl.includes("/auth/login") || originalUrl.includes("/auth/register");
  },
});

/**
 * Sensitive Membership Operations Rate Limiter (Join Team, Accept Invitation)
 * Scoped to authenticated user ID (or client IP for unauthenticated token redemption).
 */
export const joinRateLimiter = createRateLimiter({
  windowMs: env.JOIN_RATE_LIMIT_WINDOW_MS,
  max: env.JOIN_RATE_LIMIT_MAX_REQUESTS,
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : `join:${getClientIp(req)}`),
  message: "Too many membership or invitation requests. Please wait a moment before trying again.",
});
