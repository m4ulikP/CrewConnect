import { Router } from "express";
import { AuthService } from "../services/auth.service.js";
import { GoogleAuthService } from "../services/google-auth.service.js";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";
import { validateBody } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";
import { RegisterSchema, LoginSchema, type ApiResponse } from "@crewconnect/shared";

export const authRouter = Router();

/**
 * POST /api/v1/auth/register
 * Register a new user account with Argon2id password hashing
 * Sets HTTP-only session cookie exclusively; does not expose token in body
 */
authRouter.post(
  "/register",
  authRateLimiter,
  validateBody(RegisterSchema),
  async (req, res, next) => {
    try {
      const { user, token } = await AuthService.register(req.body);
      AuthService.setAuthCookie(res, token);

      const response: ApiResponse<{ user: unknown }> = {
        success: true,
        data: {
          user: user.toJSON(),
        },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/login
 * Authenticate credentials and issue JWT exclusively via HTTP-only cookie
 */
authRouter.post("/login", authRateLimiter, validateBody(LoginSchema), async (req, res, next) => {
  try {
    const { user, token } = await AuthService.login(req.body);
    AuthService.setAuthCookie(res, token);

    const response: ApiResponse<{ user: unknown }> = {
      success: true,
      data: {
        user: user.toJSON(),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * Retrieve currently authenticated user profile
 */
authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const response: ApiResponse<{ user: unknown }> = {
      success: true,
      data: {
        user: req.user!.toJSON(),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * Invalidate session by incrementing user tokenVersion and clearing HTTP-only cookie
 */
authRouter.post("/logout", async (req, res, next) => {
  try {
    const cookieToken = req.cookies?.token;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7).trim()
      : undefined;

    const token = cookieToken || bearerToken;

    if (token) {
      try {
        const payload = AuthService.verifyToken(token);
        await AuthService.revokeSession(payload.id, res);
      } catch {
        AuthService.clearAuthCookie(res);
      }
    } else {
      AuthService.clearAuthCookie(res);
    }

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: {
        message: "Logged out successfully",
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/google/status
 * Returns whether Google OAuth is configured in this environment
 */
authRouter.get("/google/status", (_req, res) => {
  res.json({
    success: true,
    data: {
      configured: GoogleAuthService.isConfigured(),
    },
  });
});

/**
 * GET /api/v1/auth/google
 * Initiates Google OAuth 2.0 / OpenID Connect authorization code flow
 */
authRouter.get("/google", authRateLimiter, (req, res, next) => {
  try {
    if (!GoogleAuthService.isConfigured()) {
      return res.redirect(`${env.CLIENT_URL}/auth/google?error=not_configured`);
    }
    const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : undefined;
    const authUrl = GoogleAuthService.buildAuthorizationUrl(res, returnTo);
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/google/callback
 * Handles Google OAuth callback with PKCE, state verification, and safe user resolution
 */
authRouter.get("/google/callback", async (req, res) => {
  try {
    const { returnTo } = await GoogleAuthService.handleCallback(req, res);
    const destination = GoogleAuthService.sanitizeReturnTo(returnTo);
    res.redirect(`${env.CLIENT_URL}${destination}`);
  } catch (error) {
    let safeMessage = "Authentication failed. Please try signing in again.";
    if (error instanceof AppError) {
      safeMessage = error.message;
    } else if (error instanceof Error && error.message) {
      if (error.message.includes("cancelled")) {
        safeMessage = "Google sign-in was cancelled.";
      } else if (error.message.includes("already exists")) {
        safeMessage = error.message;
      }
    }
    res.redirect(`${env.CLIENT_URL}/auth/callback?error=${encodeURIComponent(safeMessage)}`);
  }
});
