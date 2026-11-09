# ADR-0003: Two-Tier Concurrency Control Strategy (Atomic Reservation + ACID Transaction)

**Date**: 2026-11-09  
**Status**: accepted  
**Deciders**: Senior Concurrency Architect, Technical Lead  

## Context

When 50 users simultaneously attempt to join a team with only 1 remaining seat (initial 4, capacity 5), standard read-modify-write patterns result in TOCTOU race conditions and capacity oversaturation. We need a concurrency strategy that guarantees exactly 1 winner and 49 clean rejections without long lock-holding or database deadlocks.

## Decision

We implement a **Two-Tier Concurrency Control Strategy**:
1. **Tier 1 (Atomic Conditional Reservation)**: Execute `findOneAndUpdate` on `teams` matching `{ _id: teamId, memberCount: { $lt: maxCapacity }, isOpen: true }` and incrementing `{ $inc: { memberCount: 1 } }`.
2. **Tier 2 (Multi-Document ACID Transaction)**: Inside a MongoDB transaction (`session.withTransaction`), verify Tier 1, insert the `memberships` record (subject to the unique compound index), append the `auditLogs` entry, and record the `idempotencyRecords` entry.
3. Transient write conflicts are handled via an exponential backoff retry loop with randomized jitter (max 3 retries).

## Alternatives Considered

### Alternative 1: Application-Level Distributed Mutex (Redis Redlock)
- **Pros**: Locks team ID before executing database writes.
- **Cons**: Adds an external infrastructure dependency (Redis), network latency overhead, and failure modes when locks expire prematurely during GC pauses.
- **Why not**: Adds unnecessary complexity when MongoDB's native storage engine (`WiredTiger`) already provides document-level serialized write locks.

### Alternative 2: Standalone Atomic Update Without Multi-Document Transactions
- **Pros**: Extremely fast.
- **Cons**: Cannot atomically insert the membership record and audit log alongside the counter increment. If membership insertion fails (e.g. user already in another team), the counter is permanently out of sync.
- **Why not**: Causes counter corruption and broken invariants.

## Consequences

### Positive
- Under 50 concurrent requests, exactly 1 request succeeds in incrementing the counter; the other 49 fail immediately at the database level and abort cleanly.
- Guaranteed all-or-nothing rollback if any secondary constraint fails.
- Mathematical certainty against seat overflow.

### Negative
- Requires a MongoDB replica set (`rs0`) for local and test environments.

### Risks
- Write conflicts under intense contention. Mitigated by bounded retry loops with jittered backoff.
