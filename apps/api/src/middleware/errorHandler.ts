import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import { IdempotencyService } from "../services/idempotency.service.js";
import { ERROR_CODES, type ApiErrorResponse } from "@crewconnect/shared";

export async function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const requestId = (req.headers["x-request-id"] as string) || undefined;
  const timestamp = new Date().toISOString();

  const mongoErr = err as {
    code?: number;
    errorLabels?: string[];
    hasErrorLabel?: (l: string) => boolean;
    message?: string;
  };

  // Check if error is an uncertain transaction commit
  const isUncertainCommit =
    (err instanceof AppError && err.code === ERROR_CODES.TRANSACTION_COMMIT_UNCERTAIN) ||
    Boolean(
      mongoErr?.errorLabels?.includes?.("UnknownTransactionCommitResult") ||
      mongoErr?.hasErrorLabel?.("UnknownTransactionCommitResult")
    );

  // Release acquired idempotency lease on deterministic early failures (NEVER on uncertain commit)
  if (req.idempotency && !isUncertainCommit) {
    try {
      await IdempotencyService.releaseLease(req.idempotency.recordId, req.idempotency.ownerToken);
    } catch {
      // Defensive: ignore release errors so client still receives actual failure response
    }
  }

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

  // MongoDB UnknownTransactionCommitResult (defense-in-depth)
  if (
    mongoErr?.errorLabels?.includes?.("UnknownTransactionCommitResult") ||
    mongoErr?.hasErrorLabel?.("UnknownTransactionCommitResult")
  ) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: ERROR_CODES.TRANSACTION_COMMIT_UNCERTAIN,
        message:
          "Transaction commit outcome is uncertain after retries. The operation may have committed or aborted.",
        timestamp,
        requestId,
      },
    };
    res.status(503).json(response);
    return;
  }

  // MongoDB TransientTransactionError or WriteConflict
  if (
    mongoErr?.code === 112 ||
    mongoErr?.errorLabels?.includes?.("TransientTransactionError") ||
    mongoErr?.hasErrorLabel?.("TransientTransactionError") ||
    (typeof mongoErr?.message === "string" && mongoErr.message.includes("Write conflict"))
  ) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: ERROR_CODES.CONCURRENCY_CONFLICT,
        message: "Operation failed due to concurrent write contention. Please retry.",
        timestamp,
        requestId,
      },
    };
    res.status(409).json(response);
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
