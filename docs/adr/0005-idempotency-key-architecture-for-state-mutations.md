# ADR-0005: Scoped and Payload-Hashed Idempotency Architecture

**Date**: 2026-11-09  
**Status**: accepted  
**Deciders**: Senior API Architect, Technical Lead  

## Context

In high-concurrency hackathons, participants experience network timeouts, retries, and rapid double-clicks. If a transaction commits but the network drops before returning the response, a client retry could fail or duplicate state. Furthermore, concurrent requests using the same key must not execute parallel transactions, and keys must not be reused with different payloads.

## Decision

We implement a **Scoped, In-Flight Locked, and Payload-Hashed Idempotency Architecture**:
1. **Scoped Keys**: Compound unique index on `{ key: 1, userId: 1, endpoint: 1 }` prevents cross-user and cross-endpoint collision.
2. **Payload Fingerprinting**: Each request hashes its body (`SHA-256`). Reusing a key with a different payload returns `409 Conflict (IDEMPOTENCY_KEY_PAYLOAD_MISMATCH)`.
3. **In-Flight Lock**: Initial record creation sets `status: "PROCESSING"`. Concurrent requests with the same key receive `409 Conflict (REQUEST_IN_PROGRESS)` to block parallel transaction execution.
4. **Transaction Atomicity**: The completed status, status code, and response body are persisted inside the same transaction session. If the transaction fails, the record is removed or marked `FAILED`.
5. **Role of TTL**: The TTL index is purely for **eventual storage cleanup** (24 hours), not for application correctness.

## Alternatives Considered

### Alternative 1: Client-Side Button Disabling Only
- **Pros**: Zero backend overhead.
- **Cons**: Completely ineffective against network retries, page refreshes, and automated scripts.
- **Why not**: Client-only mechanisms provide no correctness guarantees.

### Alternative 2: In-Memory Redis Idempotency Store
- **Pros**: Low latency.
- **Cons**: Additional infrastructure dependency; risk of inconsistency between Redis cache and MongoDB transaction commits.
- **Why not**: Persisting the idempotency record inside the MongoDB ACID transaction guarantees atomic commit.

## Consequences

### Positive
- Completely safe network retries under flaky connections.
- Parallel concurrent requests with identical keys are locked and rejected cleanly.
- Tamper-proof payload verification.

### Negative
- Slight write overhead during transactions.

### Risks
- Collection size over time. Mitigated by MongoDB TTL index.
