import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";
import { User } from "../models/User.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "@crewconnect/shared";

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const cookieToken = req.cookies?.token;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7).trim()
      : undefined;

    const token = cookieToken || bearerToken;

    if (!token) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, "Authentication required", 401);
    }

    const payload = AuthService.verifyToken(token);
    const user = await User.findById(payload.id);

    if (!user) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, "User account no longer exists", 401);
    }

    if (user.status === "SUSPENDED") {
      throw new AppError(ERROR_CODES.FORBIDDEN, "Account has been suspended", 403);
    }

    // Revocation check: Token tokenVersion must match current DB tokenVersion
    if (payload.tokenVersion !== user.tokenVersion) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "Session has been revoked. Please sign in again.",
        401
      );
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cookieToken = req.cookies?.token;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7).trim()
      : undefined;

    const token = cookieToken || bearerToken;

    if (token) {
      const payload = AuthService.verifyToken(token);
      const user = await User.findById(payload.id);
      if (user && user.status !== "SUSPENDED" && payload.tokenVersion === user.tokenVersion) {
        req.user = user;
      }
    }
  } catch {
    // Ignore invalid tokens in optional auth
  }
  next();
}
