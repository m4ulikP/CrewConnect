import { Router } from "express";
import { AuthService } from "../services/auth.service.js";
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
