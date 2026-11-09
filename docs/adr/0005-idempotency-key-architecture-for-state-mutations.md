# ADR-0005: Idempotency Key Architecture for State Mutations

**Date**: 2026-11-09  
**Status**: accepted  
**Deciders**: Senior API Architect, Technical Lead  

## Context

In high-concurrency hackathon environments, participants experience network drops, timeouts, or double-click submit buttons. If a user submits a join request and the server commits the transaction but the network drops before returning the HTTP 201 response, the client will retry. Without idempotency protection, the retry would fail with `409 ALREADY_IN_TEAM` or `409 TEAM_FULL`, creating confusing user experiences and phantom transaction errors.

## Decision

We introduce an **Idempotency Middleware** supporting the standard `Idempotency-Key` HTTP header (UUIDv4) for all mutating `POST`, `PUT`, and `DELETE` requests. Successful transaction results are cached in the `idempotencyRecords` collection with a 24-hour TTL index. Duplicate requests replay the exact saved response without re-executing transactions.

## Alternatives Considered

### Alternative 1: Client-Side Button Disabling Only
- **Pros**: Zero backend complexity.
- **Cons**: Bypassed by network retries, browser page refreshes, script automation, or mobile connection switches.
- **Why not**: Client-only mitigations are fundamentally unreliable.

### Alternative 2: In-Memory Redis Idempotency Store
- **Pros**: Sub-millisecond lookup latency.
- **Cons**: Additional infrastructure dependency; risk of inconsistency between Redis cache and MongoDB transaction commit.
- **Why not**: Writing the idempotency record inside the *same* MongoDB ACID transaction guarantees atomic commit of both the business mutation and the idempotency record.

## Consequences

### Positive
- Safe network retries for clients under adverse network conditions.
- Guaranteed protection against duplicate charge or duplicate seat reservation side-effects.

### Negative
- Slight write overhead to insert the `idempotencyRecords` document during transactions.

### Risks
- Collection growth over time. Mitigated by MongoDB TTL index (`expireAfterSeconds: 86400`).
