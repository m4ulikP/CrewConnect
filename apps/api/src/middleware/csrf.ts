import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";
import { ERROR_CODES } from "@crewconnect/shared";

/**
 * Standard OWASP Origin / Referer validation for CSRF defense on state-changing requests
 */
export function validateCsrf(req: Request, _res: Response, next: NextFunction): void {
  // Safe HTTP methods do not change state
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // If request has no authentication cookie and is purely public or uses Bearer token,
  // cross-site cookie attachment does not apply.
  const hasCookieAuth = Boolean(req.cookies?.token);

  // For state-changing requests with authentication cookies, enforce Origin/Referer validation
  if (hasCookieAuth) {
    const originHeader = req.headers.origin;
    const refererHeader = req.headers.referer;

    let requestOrigin: string | null = null;

    if (originHeader) {
      requestOrigin = originHeader;
    } else if (refererHeader) {
      try {
        const url = new URL(refererHeader);
        requestOrigin = url.origin;
      } catch {
        return next(
          new AppError(
            ERROR_CODES.FORBIDDEN,
            "Cross-site request forgery (CSRF) validation failed: Malformed Referer header",
            403
          )
        );
      }
    }

    // Build list of allowed origins
    const allowedOrigins = [
      env.CLIENT_URL,
      "http://localhost:5173",
      "http://localhost:3000",
      `http://${req.headers.host}`,
      `https://${req.headers.host}`,
    ].map((o) => o.replace(/\/$/, ""));

    // If Origin or Referer is supplied, verify it matches an allowed client origin
    if (requestOrigin) {
      const normalizedRequestOrigin = requestOrigin.replace(/\/$/, "");
      if (!allowedOrigins.includes(normalizedRequestOrigin)) {
        return next(
          new AppError(
            ERROR_CODES.FORBIDDEN,
            `Cross-site request forgery (CSRF) validation failed: Origin "${requestOrigin}" not authorized`,
            403
          )
        );
      }
    } else {
      // If neither Origin nor Referer is present on a cookie-authenticated request,
      // verify that a custom anti-CSRF header is present (browsers cannot send custom headers cross-origin without preflight)
      const hasCustomHeader = Boolean(
        req.headers["x-requested-with"] || req.headers["x-crewconnect-csrf"]
      );
      if (!hasCustomHeader) {
        return next(
          new AppError(
            ERROR_CODES.FORBIDDEN,
            "Cross-site request forgery (CSRF) validation failed: Missing Origin and Referer headers",
            403
          )
        );
      }
    }
  }

  next();
}
