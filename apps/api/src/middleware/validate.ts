import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "@crewconnect/shared";

function createValidator(schema: ZodTypeAny, source: "body" | "query") {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(source === "body" ? req.body : req.query);
      if (source === "body") {
        req.body = parsed;
      } else {
        req.query = parsed as Request["query"];
      }
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

export function validateBody(schema: ZodTypeAny) {
  return createValidator(schema, "body");
}

export function validateQuery(schema: ZodTypeAny) {
  return createValidator(schema, "query");
}
