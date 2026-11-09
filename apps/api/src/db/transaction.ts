import mongoose, { type ClientSession } from "mongoose";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "@crewconnect/shared";

export interface TransactionRetryOptions {
  /**
   * Maximum attempts for the entire business transaction callback on TransientTransactionError
   * or WriteConflict (code 112). Default: 5.
   */
  maxTransactionRetries?: number;
  /**
   * Maximum attempts for commitTransaction() when UnknownTransactionCommitResult is encountered.
   * Default: 5.
   */
  maxCommitRetries?: number;
  /**
   * Minimum jitter backoff in milliseconds. Default: 15.
   */
  minBackoffMs?: number;
  /**
   * Maximum jitter backoff in milliseconds. Default: 50.
   */
  maxBackoffMs?: number;
  /**
   * Test seam: allows injecting a custom session factory (e.g. for mock verification).
   */
  sessionFactory?: () => Promise<ClientSession>;
}

/**
 * Checks whether an error has a specific MongoDB error label.
 */
export function hasErrorLabel(error: unknown, label: string): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    hasErrorLabel?: (l: string) => boolean;
    errorLabels?: string[] | Set<string>;
  };
  if (typeof err.hasErrorLabel === "function") {
    try {
      if (err.hasErrorLabel(label)) return true;
    } catch {
      // Ignore inspection failure
    }
  }
  if (Array.isArray(err.errorLabels)) {
    return err.errorLabels.includes(label);
  }
  if (err.errorLabels instanceof Set) {
    return err.errorLabels.has(label);
  }
  return false;
}

/**
 * Determines whether an error is transient and safe for whole-transaction retry.
 */
export function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if (hasErrorLabel(error, "TransientTransactionError")) return true;

  const err = error as {
    code?: number;
    errorResponse?: { code?: number };
    message?: string;
  };

  return (
    err.code === 112 ||
    err.errorResponse?.code === 112 ||
    (typeof err.message === "string" && err.message.includes("Write conflict"))
  );
}

/**
 * Calculates a jittered backoff delay.
 */
function calculateJitter(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Executes a callback within a MongoDB session transaction with strict, standards-compliant
 * transaction retry semantics:
 *
 * 1. Whole-transaction retries: If a TransientTransactionError occurs during the business
 *    callback (e.g. write conflict or network interruption before commit), the transaction is
 *    aborted and the entire callback is retried up to maxTransactionRetries.
 * 2. Commit-only retries: If UnknownTransactionCommitResult occurs during commitTransaction(),
 *    the callback is NEVER rerun (preventing duplicate execution of already-committed work).
 *    Instead, commitTransaction() is retried on the same session/transaction up to maxCommitRetries.
 * 3. Uncertain outcome reporting: If commit retries are exhausted without confirmation,
 *    AppError.commitUncertain (HTTP 503) is raised without blindly aborting.
 * 4. Proper cleanup: The session is always ended in finally.
 */
export async function withTransactionRetry<T>(
  fn: (session: ClientSession) => Promise<T>,
  optionsOrMaxRetries?: TransactionRetryOptions | number
): Promise<T> {
  const options: TransactionRetryOptions =
    typeof optionsOrMaxRetries === "number"
      ? { maxTransactionRetries: optionsOrMaxRetries }
      : optionsOrMaxRetries || {};

  const maxTransactionRetries = options.maxTransactionRetries ?? 5;
  const maxCommitRetries = options.maxCommitRetries ?? 5;
  const minBackoffMs = options.minBackoffMs ?? 15;
  const maxBackoffMs = options.maxBackoffMs ?? 50;

  const session = options.sessionFactory
    ? await options.sessionFactory()
    : await mongoose.startSession();

  let commitUncertain = false;
  let commitSucceeded = false;

  try {
    for (let attempt = 1; attempt <= maxTransactionRetries; attempt++) {
      session.startTransaction();

      let result: T;
      try {
        result = await fn(session);
      } catch (cbError: unknown) {
        if (session.inTransaction()) {
          try {
            await session.abortTransaction();
          } catch {
            // Ignore abort error
          }
        }

        if (isTransientError(cbError)) {
          if (attempt < maxTransactionRetries) {
            await new Promise((resolve) =>
              setTimeout(resolve, calculateJitter(minBackoffMs, maxBackoffMs))
            );
            continue;
          }
          throw AppError.conflict(
            ERROR_CODES.CONCURRENCY_CONFLICT,
            "Operation failed due to concurrent write contention. Please retry."
          );
        }

        throw cbError;
      }

      // Business callback succeeded. Now commit with commit-only retry semantics.
      let commitAttempt = 1;

      while (!commitSucceeded) {
        try {
          await session.commitTransaction();
          commitSucceeded = true;
          return result;
        } catch (commitError: unknown) {
          // Case A: UnknownTransactionCommitResult
          // Outcome of commit is uncertain. Do NOT re-execute fn(session). Retry commitTransaction only.
          if (hasErrorLabel(commitError, "UnknownTransactionCommitResult")) {
            if (commitAttempt < maxCommitRetries) {
              commitAttempt++;
              await new Promise((resolve) =>
                setTimeout(resolve, calculateJitter(minBackoffMs, maxBackoffMs))
              );
              continue;
            }

            // Exceeded commit retries: outcome remains uncertain
            commitUncertain = true;
            throw AppError.commitUncertain(
              "Transaction commit outcome is uncertain after retries. The operation may have committed or aborted."
            );
          }

          // Case B: TransientTransactionError during commit
          // Server explicitly aborted the transaction due to write conflict during commit.
          // Whole transaction callback can be retried.
          if (isTransientError(commitError)) {
            if (session.inTransaction()) {
              try {
                await session.abortTransaction();
              } catch {
                // Ignore abort error
              }
            }

            if (attempt < maxTransactionRetries) {
              await new Promise((resolve) =>
                setTimeout(resolve, calculateJitter(minBackoffMs, maxBackoffMs))
              );
              break; // Breaks the commit loop to allow outer whole-transaction retry
            }

            throw AppError.conflict(
              ERROR_CODES.CONCURRENCY_CONFLICT,
              "Operation failed due to concurrent write contention. Please retry."
            );
          }

          // Case C: Non-retryable commit error
          if (session.inTransaction()) {
            try {
              await session.abortTransaction();
            } catch {
              // Ignore
            }
          }
          throw commitError;
        }
      }
    }

    throw AppError.conflict(
      ERROR_CODES.CONCURRENCY_CONFLICT,
      "Operation failed due to concurrent write contention. Please retry."
    );
  } finally {
    if (!commitSucceeded && !commitUncertain && session.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch {
        // Ignore
      }
    }
    await session.endSession();
  }
}
