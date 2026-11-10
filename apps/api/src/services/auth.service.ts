import jwt from "jsonwebtoken";
import type { Response } from "express";
import { User, type IUser } from "../models/User.js";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES, type RegisterInput, type LoginInput } from "@crewconnect/shared";

export interface AuthTokenPayload {
  id: string;
  email: string;
  displayName: string;
  tokenVersion: number;
}

export class AuthService {
  /**
   * Generates a signed JWT authentication token
   */
  static generateToken(user: IUser): string {
    const payload: AuthTokenPayload = {
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      tokenVersion: user.tokenVersion ?? 0,
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    });
  }

  /**
   * Verifies and decodes a JWT authentication token
   */
  static verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
    } catch (error) {
      if ((error as Error).name === "TokenExpiredError") {
        throw new AppError(ERROR_CODES.UNAUTHORIZED, "Authentication token has expired", 401);
      }
      throw new AppError(ERROR_CODES.UNAUTHORIZED, "Invalid authentication token", 401);
    }
  }

  /**
   * Generates standard cookie options respecting production and configuration flags
   */
  static getCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax" | "strict" | "none";
    path: string;
  } {
    const isProduction = env.NODE_ENV === "production";
    const secure = env.COOKIE_SECURE ?? isProduction;
    const sameSite = env.COOKIE_SAME_SITE ?? "lax";
    return {
      httpOnly: true,
      secure,
      sameSite,
      path: "/",
    };
  }

  /**
   * Attaches HTTP-only JWT authentication cookie to response
   */
  static setAuthCookie(res: Response, token: string): void {
    res.cookie("token", token, {
      ...this.getCookieOptions(),
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
  }

  /**
   * Clears the HTTP-only authentication cookie
   */
  static clearAuthCookie(res: Response): void {
    res.clearCookie("token", this.getCookieOptions());
  }

  /**
   * Invalidates active sessions by atomically incrementing the user's tokenVersion
   * and clearing the HTTP-only authentication cookie
   */
  static async revokeSession(userId: string, res: Response): Promise<void> {
    await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
    this.clearAuthCookie(res);
  }

  /**
   * Registers a new user account with Argon2id hashed password
   */
  static async register(input: RegisterInput): Promise<{ user: IUser; token: string }> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Check for existing user with normalized email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new AppError(
        ERROR_CODES.EMAIL_ALREADY_EXISTS,
        "An account with this email already exists",
        409
      );
    }

    // Hash password with Argon2id (ADR-0008)
    const passwordHash = await User.hashPassword(input.password);

    // Persist new user
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      displayName: input.displayName.trim(),
      skills: input.skills.map((s: string) => s.trim()),
      timeZone: input.timeZone || "UTC",
      bio: input.bio || "",
      status: "ACTIVE",
    });

    const token = this.generateToken(user);
    return { user, token };
  }

  /**
   * Authenticates user credentials and returns user and token
   */
  static async login(input: LoginInput): Promise<{ user: IUser; token: string }> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Explicitly select passwordHash which is select: false by default
    const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");

    if (!user) {
      // Prevent timing-based user enumeration by hashing a dummy password with argon2id
      await User.hashPassword("DummyTimingMitigationPassword123!");
      throw new AppError(ERROR_CODES.INVALID_CREDENTIALS, "Invalid email or password", 401);
    }

    if (user.status === "SUSPENDED") {
      throw new AppError(ERROR_CODES.FORBIDDEN, "Account has been suspended", 403);
    }

    const isValidPassword = await user.verifyPassword(input.password);
    if (!isValidPassword) {
      throw new AppError(ERROR_CODES.INVALID_CREDENTIALS, "Invalid email or password", 401);
    }

    const token = this.generateToken(user);
    return { user, token };
  }
}
