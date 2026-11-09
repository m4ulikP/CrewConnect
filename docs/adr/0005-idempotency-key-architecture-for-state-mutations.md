# ADR-0005: Two-Phase Lease-Based Idempotency Architecture

**Date**: 2026-11-09  
**Status**: accepted  
**Deciders**: Senior API Architect, Technical Lead  

## Context

In high-concurrency hackathons, participants experience network timeouts, retries, and double-clicks.
An initial design proposed creating an in-flight `PROCESSING` record inside the business transaction. However, under MongoDB's Read Committed / Majority transaction isolation, uncommitted writes inside a transaction are invisible to concurrent transactions. A concurrent duplicate request cannot observe an uncommitted `PROCESSING` record, risking duplicate execution or write conflicts.

We need a design that guarantees:
1. Scoped keys per user and endpoint.
2. Concurrent duplicate requests are locked and rejected without parallel execution.
3. Repeated requests with the identical payload replay the original response.
4. Reusing a key with an altered payload returns a clear conflict response.
5. Failed transactions never leave false successful records.
6. Server crashes or interrupted requests do not leave permanent deadlocks.

## Decision

We adopt a **Two-Phase Idempotency Lease Architecture** operating around the business transaction:

1. **Phase 1: Atomic Key Acquisition / Fast-Path Evaluation (Outside Transaction)**:
   - Scoped unique compound index: `{ key: 1, userId: 1, endpoint: 1 }`.
   - **Fast-Path Replay**: If record exists with `status: "COMPLETED"`:
     - Check `payloadHash === SHA-256(currentBody)`.
     - If matches: Return cached response immediately (`200 OK` / `201 Created`, header `X-Cache: HIT`).
     - If mismatch: Return `409 Conflict (IDEMPOTENCY_KEY_PAYLOAD_MISMATCH)`.
   - **In-Flight Lock**: If record exists with `status: "PROCESSING"`:
     - Check lease expiration (`now - lockedAt < 30_000` ms).
     - If active (< 30s): Return `409 Conflict (REQUEST_IN_PROGRESS)`.
     - If expired (>= 30s): Server crash or timeout occurred; atomically reclaim the lease by updating `lockedAt: new Date()`.
   - **New Key**: If record does not exist:
     - Atomically insert with `status: "PROCESSING"`, `payloadHash`, and `lockedAt: new Date()`.
     - If concurrent requests race, the unique index allows exactly one to succeed; the loser catches error 11000 and receives `409 Conflict (REQUEST_IN_PROGRESS)`.

2. **Phase 2: Business Transaction Execution**:
   - The winning request executes the business logic inside the session-aware MongoDB ACID transaction.

3. **Phase 3: Finalization or Cleanup**:
   - **On Transaction Success**: Atomically update the record to `status: "COMPLETED"`, `statusCode`, `responseBody`, and clear `lockedAt`.
   - **On Transaction Failure**: If the business transaction aborts (e.g. `TEAM_FULL`, `ALREADY_IN_TEAM`), atomically delete the lease (or mark `status: "FAILED"`). This ensures failed transactions **never leave misleading success records**.
   - **Role of TTL**: The TTL index (`expireAfterSeconds: 0` on `expiresAt: 24h`) is strictly for eventual storage reclamation, not application correctness.

## Alternatives Considered

### Alternative 1: In-Transaction Idempotency Record Creation
- **Pros**: All writes inside one transaction.
- **Cons**: Uncommitted writes are invisible to concurrent transactions. A second parallel request cannot see the in-flight status and attempts the same operation.
- **Why not**: Violates concurrency safety for parallel in-flight duplicate requests.

### Alternative 2: In-Memory Redis Lock with Database Persistence
- **Pros**: Sub-millisecond locking.
- **Cons**: Adds an external Redis dependency, network failure modes, and cache-database synchronization drift.
- **Why not**: MongoDB atomic `findOneAndUpdate` with unique index provides robust leasing without external infrastructure.

## Consequences

### Positive
- Strict visibility and duplicate-request locking before any business transaction begins.
- Automatic crash recovery via 30-second lease expiry.
- Guaranteed protection against duplicate seat allocations and parameter tampering.

### Negative
- Requires a preliminary atomic document check/write before starting the business transaction.

### Risks
- Clock skew on lease expiration. Mitigated by using relative server-side elapsed time calculations.
