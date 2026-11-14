import { Types } from "mongoose";
import { User, type IUser } from "../models/User.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES, type UpdateProfileInput } from "@crewconnect/shared";

export class UserService {
  /**
   * Updates an authenticated user's profile information.
   *
   * Security & Integrity:
   * - Only explicitly whitelisted profile fields are modified.
   * - Sensitive and protected attributes (password, email, status, tokenVersion,
   *   roles, authProvider, googleId) are strictly immutable through this path.
   * - Omitted fields in partial updates are untouched.
   * - Setting optional string fields (bio, URLs) to empty string or null clears them.
   */
  static async updateProfile(userId: string, input: UpdateProfileInput): Promise<IUser> {
    if (!Types.ObjectId.isValid(userId)) {
      throw AppError.validation("Invalid user ID format");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw AppError.notFound("User not found", ERROR_CODES.NOT_FOUND);
    }

    if (user.status === "SUSPENDED") {
      throw AppError.forbidden("Account is suspended", ERROR_CODES.FORBIDDEN);
    }

    if (input.displayName !== undefined) {
      user.displayName = input.displayName.trim();
    }

    if (input.bio !== undefined) {
      user.bio = input.bio === null || input.bio === "" ? "" : input.bio.trim();
    }

    if (input.skills !== undefined) {
      user.skills = input.skills.map((s) => s.trim());
    }

    if (input.timeZone !== undefined) {
      user.timeZone = input.timeZone.trim();
    }

    if (input.experienceLevel !== undefined) {
      user.experienceLevel = input.experienceLevel;
    }

    if (input.githubUrl !== undefined) {
      user.githubUrl = input.githubUrl ? input.githubUrl.trim() : "";
    }

    if (input.linkedinUrl !== undefined) {
      user.linkedinUrl = input.linkedinUrl ? input.linkedinUrl.trim() : "";
    }

    if (input.portfolioUrl !== undefined) {
      user.portfolioUrl = input.portfolioUrl ? input.portfolioUrl.trim() : "";
    }

    await user.save();
    return user;
  }
}
