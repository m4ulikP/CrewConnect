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
 */
authRouter.post(
  "/register",
  authRateLimiter,
  validateBody(RegisterSchema),
  async (req, res, next) => {
    try {
      const { user, token } = await AuthService.register(req.body);
      AuthService.setAuthCookie(res, token);

      const response: ApiResponse<{ user: unknown; token: string }> = {
        success: true,
        data: {
          user: user.toJSON(),
          token,
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
 * Authenticate credentials and issue JWT in HTTP-only cookie and body
 */
authRouter.post("/login", authRateLimiter, validateBody(LoginSchema), async (req, res, next) => {
  try {
    const { user, token } = await AuthService.login(req.body);
    AuthService.setAuthCookie(res, token);

    const response: ApiResponse<{ user: unknown; token: string }> = {
      success: true,
      data: {
        user: user.toJSON(),
        token,
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
 * Invalidate session and clear HTTP-only cookie
 */
authRouter.post("/logout", async (_req, res, next) => {
  try {
    AuthService.clearAuthCookie(res);

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
