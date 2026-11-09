import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "@crewconnect/shared";

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
}

export function createRateLimiter(config: RateLimitConfig) {
  const { windowMs, max, message = "Too many requests. Please try again later." } = config;
  const requests = new Map<string, number[]>();

  // Background cleanup every 60s
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requests.entries()) {
      const validTimestamps = timestamps.filter((t) => now - t < windowMs);
      if (validTimestamps.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, validTimestamps);
      }
    }
  }, 60_000);

  // Unref timer so it does not keep Node process alive
  cleanupTimer.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, allow normal test requests to pass unless explicitly testing rate limits
    if (process.env.NODE_ENV === "test" && !req.headers["x-test-rate-limit"]) {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    const clientTimestamps = requests.get(ip) || [];
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
    requests.set(ip, validTimestamps);
    next();
  };
}

// Security Architecture rate limiters
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: "Too many authentication attempts. Please try again after 15 minutes.",
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
});
