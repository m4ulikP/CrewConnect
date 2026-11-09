import type { Request, Response, NextFunction } from "express";
import type { AnyZodObject } from "zod";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "@crewconnect/shared";

export function validateBody(schema: AnyZodObject) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.body);
      req.body = parsed;
      next();
    } catch (err: unknown) {
      if (err && typeof err === "object" && "issues" in err) {
        const issues = (err as { issues: Array<{ path: (string | number)[]; message: string }> })
          .issues;
        const details = issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        }));
        next(new AppError(ERROR_CODES.VALIDATION_ERROR, "Request validation failed", 422, details));
      } else {
        next(err);
      }
    }
  };
}
