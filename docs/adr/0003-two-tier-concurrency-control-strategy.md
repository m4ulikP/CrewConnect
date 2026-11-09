# ADR-0003: Unified Transactional Concurrency Strategy with Specific Retry Semantics

**Date**: 2026-11-09  
**Status**: accepted  
**Deciders**: Senior Concurrency Architect, Technical Lead  

## Context

When 50 users simultaneously attempt to join a team with only 1 remaining seat (initial 4, capacity 5), standard read-modify-write patterns result in TOCTOU race conditions and capacity oversaturation. Furthermore, storage-level document locking produces transient write conflicts (`WriteConflict` code 112) across contending transactions.

We need a design that guarantees:
1. Exactly one winner claims the seat; losing transactions fail cleanly.
2. A failed join never leaves a permanently incremented capacity counter.
3. Distinction between transient write conflicts and commit confirmation retries.
4. Correct error reporting (exhausted retries must report `CONCURRENCY_CONFLICT`, not `TEAM_FULL`).
5. Real-time events and external side effects occur strictly after confirmed commit.

## Decision

We implement a **Unified Session-Aware Transaction Concurrency Strategy** with explicit retry semantics:

1. **Transaction Callback Scope**:
   Inside a single Mongoose session (`session.startTransaction({ readConcern: "majority", writeConcern: "majority" })`):
   - **Atomic Capacity Reservation**: `Team.findOneAndUpdate({ _id: teamId, memberCount: { $lt: maxCapacity }, isOpen: true }, { $inc: { memberCount: 1 } }, { session, new: true })`.
   - **Active Membership Insertion**: `Membership.create([...], { session })` protected by unique compound partial index `{ hackathonId: 1, userId: 1 }`.
   - **Auditable Event Log**: `AuditLog.create([...], { session })`.
   - If any step fails, the transaction aborts and WiredTiger automatically rolls back the `memberCount` increment.

2. **Explicit Retry Semantics**:
   - **`TransientTransactionError` / Code 112 (`WriteConflict`)**: Abort transaction. Retry the **entire business callback** from the beginning with randomized jittered backoff ($50\text{ ms} \times 2^{\text{attempt}-1} + \text{random}(0, 50)$).
   - **`UnknownTransactionCommitResult`**: Do **NOT** rerun the business callback! Retry **ONLY** the `session.commitTransaction()` command until confirmation or definite failure.
   - **Deterministic Domain Errors (`ALREADY_IN_TEAM`, `TEAM_FULL`)**: Non-transient. Abort immediately without retrying.
   - **Exhausted Retries**: If retries are exhausted due to continuous write conflicts, return **`409 Conflict (CONCURRENCY_CONFLICT)`**. **Never report `TEAM_FULL` on exhausted retries.**

3. **Side Effect Deferral**:
   - The transaction callback must be strictly pure and idempotent.
   - Real-time WebSocket dispatches (`socket.to(...).emit(...)`) and notifications are queued in-memory and emitted **ONLY AFTER** `session.commitTransaction()` resolves successfully.

## Alternatives Considered

### Alternative 1: Blindly Rerunning Callback on Unknown Commit Result
- **Pros**: Simple single catch block.
- **Cons**: If the previous commit actually succeeded on the database primary before the network dropped, rerunning the callback would attempt a second increment and second membership insertion, causing duplicate-key errors or duplicate side effects.
- **Why not**: Violates transaction correctness principles.

### Alternative 2: Reporting TEAM_FULL on Retry Exhaustion
- **Pros**: Hides internal concurrency complexity.
- **Cons**: Factually incorrect. The team may still have seats available, but the transaction timed out due to extreme CPU or lock contention.
- **Why not**: Misleads users and complicates debugging.

## Consequences

### Positive
- Strict mathematical invariant: 1 seat claimed, 49 clean rejections, final count 5.
- Robust resilience against transient write conflicts.
- Zero premature or phantom WebSocket notifications.

### Negative
- Requires maintaining separate retry loops for callback execution vs. commit confirmation.

### Risks
- High latency during heavy lock contention. Mitigated by bounded retries (3) and jittered backoff.
