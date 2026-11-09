import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES, type ApiErrorResponse } from "@crewconnect/shared";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = (req.headers["x-request-id"] as string) || undefined;
  const timestamp = new Date().toISOString();

  // Known AppError
  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        timestamp,
        requestId,
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Zod validation error
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Request validation failed",
        details,
        timestamp,
        requestId,
      },
    };
    res.status(422).json(response);
    return;
  }

  // Unexpected internal server error
  console.error("Unhandled API Error:", err);
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "An internal server error occurred",
      timestamp,
      requestId,
    },
  };
  res.status(500).json(response);
}
