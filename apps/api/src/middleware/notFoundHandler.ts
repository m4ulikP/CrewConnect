import type { Request, Response } from "express";
import { ERROR_CODES, type ApiErrorResponse } from "@crewconnect/shared";

export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `Cannot ${req.method} ${req.originalUrl}`,
      timestamp: new Date().toISOString(),
      requestId: (req.headers["x-request-id"] as string) || undefined,
    },
  };
  res.status(404).json(response);
}
