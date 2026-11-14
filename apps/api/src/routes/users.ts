import { Router, type Request, type Response, type NextFunction } from "express";
import { UserService } from "../services/user.service.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { UpdateProfileSchema, type ApiResponse, type UserDTO } from "@crewconnect/shared";

export const usersRouter = Router();

/**
 * PATCH /api/v1/users/me
 * Updates the profile of the currently authenticated user.
 *
 * Security:
 * - User identity is strictly derived from the verified JWT context (`req.user.id`).
 * - Client-supplied identity overrides are forbidden and rejected.
 * - Strict schema validation rejects any unknown or protected fields.
 */
usersRouter.patch(
  "/me",
  requireAuth,
  validateBody(UpdateProfileSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const updatedUser = await UserService.updateProfile(userId, req.body);

      const response: ApiResponse<{ user: UserDTO }> = {
        success: true,
        data: {
          user: updatedUser.toJSON() as unknown as UserDTO,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);
