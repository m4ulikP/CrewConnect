import { describe, it, expect, vi } from "vitest";
import type { ClientSession } from "mongoose";
import { withTransactionRetry, hasErrorLabel, isTransientError } from "../src/db/transaction.js";
import { AppError } from "../src/errors/AppError.js";
import { ERROR_CODES } from "@crewconnect/shared";

/**
 * Helper to build a mock MongoDB error with error labels.
 */
function createMongoError(message: string, labels: string[] = [], code?: number) {
  const err = new Error(message) as Error & {
    errorLabels?: string[];
    hasErrorLabel?: (l: string) => boolean;
    code?: number;
  };
  err.errorLabels = [...labels];
  err.hasErrorLabel = (label: string) => labels.includes(label);
  if (code !== undefined) {
    err.code = code;
  }
  return err;
}

/**
 * Creates a controllable mock session tracking calls and state.
 */
function createMockSession() {
  let inTx = false;

  const session = {
    startTransaction: vi.fn().mockImplementation(() => {
      inTx = true;
    }),
    commitTransaction: vi.fn().mockImplementation(async () => {
      inTx = false;
    }),
    abortTransaction: vi.fn().mockImplementation(async () => {
      inTx = false;
    }),
    endSession: vi.fn().mockImplementation(async () => {
      inTx = false;
    }),
    inTransaction: vi.fn().mockImplementation(() => inTx),
  } as unknown as ClientSession;

  return { session, getInTx: () => inTx, setInTx: (v: boolean) => (inTx = v) };
}

describe("withTransactionRetry - Transaction Retry Semantics & Commit Verification", () => {
  it("helper functions: hasErrorLabel and isTransientError correctly identify MongoDB error signatures", () => {
    const transientErr = createMongoError("Write conflict", ["TransientTransactionError"]);
    const unknownCommitErr = createMongoError("Commit failed", ["UnknownTransactionCommitResult"]);
    const code112Err = { code: 112, message: "WriteConflict" };
    const randomErr = new Error("Regular business error");

    expect(hasErrorLabel(transientErr, "TransientTransactionError")).toBe(true);
    expect(hasErrorLabel(transientErr, "UnknownTransactionCommitResult")).toBe(false);
    expect(hasErrorLabel(unknownCommitErr, "UnknownTransactionCommitResult")).toBe(true);
    expect(hasErrorLabel(randomErr, "UnknownTransactionCommitResult")).toBe(false);

    expect(isTransientError(transientErr)).toBe(true);
    expect(isTransientError(code112Err)).toBe(true);
    expect(isTransientError(unknownCommitErr)).toBe(false);
    expect(isTransientError(randomErr)).toBe(false);
  });

  // 1. A transient transaction error causes the entire callback to retry
  it("Scenario 1: TransientTransactionError in callback causes the entire callback to retry and aborts previous transaction", async () => {
    const { session } = createMockSession();
    let callbackAttempts = 0;

    const result = await withTransactionRetry(
      async (_s) => {
        callbackAttempts++;
        if (callbackAttempts === 1) {
          throw createMongoError("Transient write conflict", ["TransientTransactionError"]);
        }
        return `success-on-attempt-${callbackAttempts}`;
      },
      {
        sessionFactory: async () => session,
        minBackoffMs: 1,
        maxBackoffMs: 5,
        maxTransactionRetries: 3,
      }
    );

    expect(result).toBe("success-on-attempt-2");
    expect(callbackAttempts).toBe(2);
    // Verified: First attempt was aborted, second attempt started transaction and committed
    expect(session.startTransaction).toHaveBeenCalledTimes(2);
    expect(session.abortTransaction).toHaveBeenCalledTimes(1);
    expect(session.commitTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  // 2. An UnknownTransactionCommitResult causes commit retry without rerunning the callback
  it("Scenario 2: UnknownTransactionCommitResult causes commitTransaction() to retry without rerunning the business callback", async () => {
    const { session } = createMockSession();
    let callbackAttempts = 0;
    let commitAttempts = 0;

    // Fail commit on first call with UnknownTransactionCommitResult, succeed on second call
    vi.mocked(session.commitTransaction).mockImplementation(async () => {
      commitAttempts++;
      if (commitAttempts === 1) {
        throw createMongoError("Network lost during commit", ["UnknownTransactionCommitResult"]);
      }
      vi.mocked(session.inTransaction).mockReturnValue(false);
    });

    const result = await withTransactionRetry(
      async () => {
        callbackAttempts++;
        return { value: 42 };
      },
      {
        sessionFactory: async () => session,
        minBackoffMs: 1,
        maxBackoffMs: 5,
        maxCommitRetries: 3,
      }
    );

    // Business callback must execute strictly ONCE
    expect(callbackAttempts).toBe(1);
    // commitTransaction must be retried
    expect(commitAttempts).toBe(2);
    expect(session.commitTransaction).toHaveBeenCalledTimes(2);
    // Must NOT have aborted
    expect(session.abortTransaction).not.toHaveBeenCalled();
    // Result returned accurately
    expect(result).toEqual({ value: 42 });
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  // 3. A subsequent successful commit returns the callback result exactly once
  it("Scenario 3: Subsequent successful commit returns the callback result exactly once after commit-only retries", async () => {
    const { session } = createMockSession();
    let callbackInvocations = 0;
    let commitCalls = 0;

    vi.mocked(session.commitTransaction).mockImplementation(async () => {
      commitCalls++;
      if (commitCalls < 3) {
        throw createMongoError("Primary failover during commit", [
          "UnknownTransactionCommitResult",
        ]);
      }
      vi.mocked(session.inTransaction).mockReturnValue(false);
    });

    const payload = { transactionId: "tx-abc-123", status: "COMMITTED" };

    const returned = await withTransactionRetry(
      async () => {
        callbackInvocations++;
        return payload;
      },
      {
        sessionFactory: async () => session,
        minBackoffMs: 1,
        maxBackoffMs: 3,
        maxCommitRetries: 5,
      }
    );

    expect(returned).toBe(payload);
    expect(callbackInvocations).toBe(1);
    expect(commitCalls).toBe(3);
    expect(session.abortTransaction).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  // 4. A permanently uncertain commit returns a clearly distinguishable error without rerunning the business callback
  it("Scenario 4: Permanently uncertain commit returns TRANSACTION_COMMIT_UNCERTAIN without rerunning the business callback or blindly aborting", async () => {
    const { session } = createMockSession();
    let callbackInvocations = 0;
    let commitCalls = 0;

    // Always fail commit with UnknownTransactionCommitResult
    vi.mocked(session.commitTransaction).mockImplementation(async () => {
      commitCalls++;
      throw createMongoError("Unconfirmed commit status", ["UnknownTransactionCommitResult"]);
    });

    let caughtError: unknown;
    try {
      await withTransactionRetry(
        async () => {
          callbackInvocations++;
          return "unreachable";
        },
        {
          sessionFactory: async () => session,
          minBackoffMs: 1,
          maxBackoffMs: 2,
          maxCommitRetries: 3,
        }
      );
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(AppError);
    const appErr = caughtError as AppError;
    expect(appErr.code).toBe(ERROR_CODES.TRANSACTION_COMMIT_UNCERTAIN);
    expect(appErr.statusCode).toBe(503);
    expect(appErr.message).toContain("uncertain after retries");

    // Callback must NOT have rerun
    expect(callbackInvocations).toBe(1);
    // Commit was retried up to maxCommitRetries (3)
    expect(commitCalls).toBe(3);
    // Blind abort must NOT have occurred because commit state is uncertain
    expect(session.abortTransaction).not.toHaveBeenCalled();
    // Session cleanup occurred
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  // 5. Sessions are cleaned up correctly after success and failure
  it("Scenario 5: Sessions are always ended in finally upon regular success, regular failure, and retry exhaustion", async () => {
    // 5A: Cleaned up upon normal success
    const { session: s1 } = createMockSession();
    await withTransactionRetry(async () => "ok", {
      sessionFactory: async () => s1,
    });
    expect(s1.endSession).toHaveBeenCalledTimes(1);
    expect(s1.abortTransaction).not.toHaveBeenCalled();

    // 5B: Cleaned up upon non-transient business exception (e.g. 404 or validation)
    const { session: s2 } = createMockSession();
    await expect(
      withTransactionRetry(
        async () => {
          throw AppError.notFound("Resource missing");
        },
        { sessionFactory: async () => s2 }
      )
    ).rejects.toThrow("Resource missing");
    expect(s2.abortTransaction).toHaveBeenCalledTimes(1);
    expect(s2.endSession).toHaveBeenCalledTimes(1);

    // 5C: Cleaned up upon exhausted transient transaction retries
    const { session: s3 } = createMockSession();
    await expect(
      withTransactionRetry(
        async () => {
          throw createMongoError("Persistent contention", ["TransientTransactionError"]);
        },
        {
          sessionFactory: async () => s3,
          minBackoffMs: 1,
          maxBackoffMs: 2,
          maxTransactionRetries: 3,
        }
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.CONCURRENCY_CONFLICT,
      statusCode: 409,
    });
    expect(s3.abortTransaction).toHaveBeenCalledTimes(3);
    expect(s3.endSession).toHaveBeenCalledTimes(1);
  });
});
