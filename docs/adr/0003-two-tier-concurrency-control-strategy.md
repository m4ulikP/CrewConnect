# ADR-0003: Unified Transactional Concurrency Strategy with Atomic Capacity Reservation

**Date**: 2026-11-09  
**Status**: accepted  
**Deciders**: Senior Concurrency Architect, Technical Lead  

## Context

When 50 users simultaneously attempt to join a team with only 1 remaining seat (initial 4, capacity 5), standard read-modify-write patterns result in TOCTOU race conditions and capacity oversaturation. Furthermore, if capacity reservation and membership creation are decoupled across multiple transactions or non-transactional updates, failures in membership insertion leave orphaned capacity increments, corrupting the team counter.

## Decision

We implement a **Unified Single-Transaction Concurrency Control Strategy** inside a single Mongoose `ClientSession` (`session.startTransaction({ readConcern: "majority", writeConcern: "majority" })`):
1. **Atomic Capacity Check & Reservation**: Execute `Team.findOneAndUpdate({ _id: teamId, memberCount: { $lt: maxCapacity }, isOpen: true }, { $inc: { memberCount: 1 } }, { session, new: true })`.
2. **Atomic Membership Insertion**: Execute `Membership.create([{ hackathonId, teamId, userId, role: "MEMBER", status: "ACTIVE" }], { session })` protected by the unique compound partial index `{ hackathonId: 1, userId: 1 }`.
3. **Atomic Audit Logging**: Append the `AuditLog` entry within the same session.
4. **Atomic Idempotency Persistence**: Store the completed response payload in `IdempotencyRecord` within the same session.
5. **Rollback Guarantee**: If any step fails, `session.abortTransaction()` rolls back all operations, restoring `memberCount` to its previous value.
6. **Transient Write Conflict Handling**: A bounded retry runner handles `TransientTransactionError` and `WriteConflict` (code 112) using exponential backoff with randomized jitter (max 3 retries). Retrying transactions see `memberCount == maxCapacity`, match 0 documents, return `null`, and abort cleanly with `409 Conflict (TEAM_FULL)`.

## Alternatives Considered

### Alternative 1: Decoupled Atomic Update followed by Separate Transaction
- **Pros**: Fast initial reservation.
- **Cons**: If the subsequent transaction or process fails before membership insertion, the team capacity counter remains incremented without a corresponding member record, requiring asynchronous compensation scripts.
- **Why not**: Violates ACID guarantees and risks permanent state corruption.

### Alternative 2: Application-Level Distributed Mutex (Redis Redlock)
- **Pros**: Locks team ID before calling MongoDB.
- **Cons**: External infrastructure dependency, network latency, and lock expiration during garbage collection pauses.
- **Why not**: MongoDB's native storage engine (`WiredTiger`) already provides document write serialization.

## Consequences

### Positive
- Strict mathematical guarantee that exactly 1 request claims the seat and 49 fail cleanly.
- Failed attempts (e.g. user already in another team) roll back the capacity increment completely.
- Zero orphaned or phantom records.

### Negative
- High write contention on the team document requires handling transient write conflicts with backoff.

### Risks
- Contention under extreme loads. Mitigated by bounded retries (max 3) and jittered backoff.
