# ADR-0002: Dedicated Memberships Collection with Unique Compound Index vs Embedded Array

**Date**: 2026-11-09  
**Status**: accepted  
**Deciders**: Senior Database Architect, Technical Lead

## Context

In MongoDB, team members can either be embedded as subdocuments in an array on `teams` (`teams.members = [...]`) or stored as discrete documents in a dedicated `memberships` collection with a cached `memberCount` counter on `teams`. We must guarantee Invariant 1: **A user can belong to only one team per hackathon**.

## Decision

We use a **dedicated `memberships` collection** alongside a cached `memberCount` on `teams`. We enforce Invariant 1 with a database-level unique compound index:
`{ hackathonId: 1, userId: 1 }` with partial filter `{ status: "ACTIVE" }`.

## Alternatives Considered

### Alternative 1: Embedded Members Array in Team Document

- **Pros**: Fast single-document reads without joining.
- **Cons**: MongoDB cannot enforce cross-document uniqueness constraints on array items across different team documents. If a user concurrently accepts invites to Team A and Team B, both team documents are modified in parallel, allowing the user into two teams.
- **Why not**: Violates a core hackathon invariant at the storage engine level.

### Alternative 2: Pure Normalization (No Cached Counter on Team)

- **Pros**: Zero counter reconciliation needed.
- **Cons**: Discovery queries and capacity checks require counting documents across `memberships` for thousands of teams on every request, violating the sub-200ms p95 latency requirement.
- **Why not**: Inadequate read performance under high traffic.

## Consequences

### Positive

- Strict, unbypassable database enforcement of single-team membership per hackathon.
- High-performance indexed lookups on both team roster and user membership status.
- Auditability of past memberships (`LEFT`, `REMOVED`) without bloating the team document.

### Negative

- Requires updating both `teams.memberCount` and `memberships` during join/leave operations within a transaction.

### Risks

- Potential counter divergence if an unhandled transaction failure occurs. Mitigated by wrapping writes in MongoDB multi-document transactions and providing an automated reconciliation routine.
