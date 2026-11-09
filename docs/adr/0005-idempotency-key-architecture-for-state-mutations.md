# ADR-0005: Fenced Lease Idempotency with In-Transaction Atomic Completion

**Date**: 2026-11-09  
**Status**: accepted  
**Deciders**: Senior API Architect, Technical Lead

## Context

In high-concurrency hackathons, participants experience network timeouts, retries, and double-clicks.
An initial two-phase lease design proposed marking the idempotency record `COMPLETED` _after_ the business transaction committed. However, this creates a critical crash consistency flaw:
If the business transaction commits successfully on MongoDB, but the application process crashes or is killed before executing the post-commit update, the record remains in `status: "PROCESSING"`. When the 30-second lease window expires, a subsequent client retry would treat the expired lease as a crashed, uncommitted attempt, reclaim the lease, and **execute the business operation a second time**.

We need an architecture that guarantees:

1. The business mutations and the `COMPLETED` idempotency state become committed and visible **atomically**.
2. Concurrent duplicate requests are locked and rejected without parallel execution.
3. Every lease acquisition has a unique `ownerToken` (fencing token).
4. An expired lease reclaimed by a new worker completely fences out the slow, stale worker.
5. Failed transactions never leave false `COMPLETED` records.
6. Commit uncertainty (`UnknownTransactionCommitResult`) does not cause blind re-execution or premature record deletion.

## Decision

We adopt a **Fenced Lease Idempotency Architecture with In-Transaction Atomic Completion**:

1. **Phase 1: Atomic Key Acquisition (Outside Transaction)**:
   - Scoped unique compound index: `{ key: 1, userId: 1, endpoint: 1 }`.
   - **Fast-Path Replay**: If record exists with `status: "COMPLETED"`:
     - Check `payloadHash === SHA-256(currentBody)`.
     - If matches: Return cached response immediately (`200 OK` / `201 Created`, header `X-Cache: HIT`).
     - If mismatch: Return `409 Conflict (IDEMPOTENCY_KEY_PAYLOAD_MISMATCH)`.
   - **In-Flight Lock**: If record exists with `status: "PROCESSING"`:
     - Check lease expiration (`now - lockedAt < 30_000` ms).
     - If active (< 30s): Return `409 Conflict (REQUEST_IN_PROGRESS)`.
     - If expired (>= 30s): Atomically reclaim the lease via `findOneAndUpdate({ key, userId, endpoint, status: "PROCESSING", lockedAt: existing.lockedAt }, { $set: { ownerToken: newOwnerToken, lockedAt: new Date() } })`.
   - **New Key**: If record does not exist:
     - Atomically insert with `ownerToken: newOwnerToken`, `status: "PROCESSING"`, `payloadHash`, and `lockedAt: new Date()`.
     - Concurrent inserts race on the unique index; exactly one succeeds, while the other catches error 11000 and receives `409 Conflict (REQUEST_IN_PROGRESS)`.

2. **Phase 2: Unified Business Transaction + In-Transaction Completion**:
   - Begin session-aware MongoDB transaction.
   - Execute all business mutations (capacity check, increment, membership insert, auditable event log).
   - **In-Transaction Completion with Lease Fencing**:
     ```typescript
     const completed = await IdempotencyRecord.findOneAndUpdate(
       {
         key,
         userId,
         endpoint,
         ownerToken,
         status: "PROCESSING",
       },
       {
         $set: {
           status: "COMPLETED",
           statusCode: 201,
           responseBody: payload,
           completedAt: new Date(),
         },
         $unset: { lockedAt: 1 },
       },
       { session, new: true }
     );
     if (!completed) {
       // Lease was reclaimed by another worker or fenced! Abort transaction!
       throw new AppError("Idempotency lease lost. Transaction aborted.", "LEASE_LOST", 409);
     }
     ```
   - Commit transaction (`session.commitTransaction()`).
   - All business mutations AND the completed idempotency record become committed and visible **atomically**.

3. **Phase 3: Fenced Cleanup on Failure**:
   - If the business transaction aborts due to a domain error (e.g. `TEAM_FULL`, `ALREADY_IN_TEAM`), execute scoped cleanup:
     `IdempotencyRecord.deleteOne({ key, userId, endpoint, ownerToken, status: "PROCESSING" })`.
   - Scoped deletion by `ownerToken` guarantees that a stale worker can **never delete or overwrite a newer worker's active lease**.

4. **Phase 4: Commit Uncertainty Handling**:
   - Retries commit only on `UnknownTransactionCommitResult`.
   - If commit acknowledgment cannot be resolved within budget, the idempotency record is **preserved** (never deleted prematurely).
   - On subsequent retry, the worker discovers whether the record is `COMPLETED` (commit succeeded) or still in `PROCESSING` with expired lease (commit failed), resolving the state without double execution.

## Alternatives Considered

### Alternative 1: Post-Commit Idempotency Update (Rejected)

- **Pros**: Slightly simpler code flow.
- **Cons**: Process crash between transaction commit and idempotency update allows an expired lease to be reclaimed, causing duplicate execution on client retry.
- **Why not**: Creates an unacceptable idempotency crash window.

### Alternative 2: Purely In-Transaction Idempotency Creation (Rejected)

- **Pros**: No preliminary lease outside the transaction.
- **Cons**: Under MongoDB Read Committed/Majority isolation, uncommitted writes are invisible to concurrent transactions. A parallel duplicate request cannot observe an in-flight transaction, triggering redundant execution or write conflicts.
- **Why not**: Fails to block parallel in-flight requests cleanly.

## Consequences

### Positive

- Strict atomic visibility: business mutations and completed idempotency results commit simultaneously.
- Fencing token prevents slow/stalled workers from committing after lease expiration.
- Scoped cleanup guarantees stale workers cannot interfere with newer leases.
- Full resilience against client retries, process crashes, and commit network drops.

### Negative

- Requires a two-step query structure (lease acquisition outside, completion update inside).

### Risks

- Clock skew during lease timeout calculation. Mitigated by using relative server-side millisecond deltas on a single replica set cluster.
