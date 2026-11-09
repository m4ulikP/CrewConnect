import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Ensure every request has a correlation ID
  const requestId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("X-Request-ID", requestId);

  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== "test") {
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms) [${requestId}]`
      );
    }
  });

  next();
}
