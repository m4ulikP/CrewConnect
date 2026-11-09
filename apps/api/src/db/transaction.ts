import mongoose, { type ClientSession } from "mongoose";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "@crewconnect/shared";

/**
 * Executes a callback within a MongoDB session transaction with automatic retry
 * for TransientTransactionError / WriteConflict (code 112) with jittered backoff.
 */
export async function withTransactionRetry<T>(
  fn: (session: ClientSession) => Promise<T>,
  maxRetries = 5
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        session.startTransaction();
        const result = await fn(session);
        await session.commitTransaction();
        return result;
      } catch (error: unknown) {
        if (session.inTransaction()) {
          try {
            await session.abortTransaction();
          } catch {
            // Ignore abort failure if connection lost
          }
        }

        const err = error as {
          code?: number;
          hasErrorLabel?: (label: string) => boolean;
          errorLabels?: string[];
          errorResponse?: { code?: number };
          message?: string;
        };

        const isTransient =
          err?.code === 112 ||
          err?.hasErrorLabel?.("TransientTransactionError") ||
          err?.errorLabels?.includes("TransientTransactionError") ||
          err?.errorResponse?.code === 112 ||
          (typeof err?.message === "string" && err.message.includes("Write conflict"));

        if (isTransient && attempt < maxRetries) {
          const delay = Math.floor(Math.random() * 45) + 15;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (isTransient) {
          throw AppError.conflict(
            ERROR_CODES.CONCURRENCY_CONFLICT,
            "Operation failed due to concurrent write contention. Please retry."
          );
        }

        throw error;
      }
    }

    throw AppError.conflict(
      ERROR_CODES.CONCURRENCY_CONFLICT,
      "Operation failed due to concurrent write contention. Please retry."
    );
  } finally {
    await session.endSession();
  }
}
