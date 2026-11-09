# ADR-0004: Cryptographic SHA-256 Hashing for Secret Invitation Codes

**Date**: 2026-11-09  
**Status**: accepted  
**Deciders**: Senior Security Architect, Technical Lead

## Context

Team leaders generate alphanumeric secret invitation codes that allow invited participants to bypass open join requests and take seats directly. Storing invitation codes in plaintext in the database poses a significant risk: any database snapshot, read replica leak, or log exposure would compromise all team invite codes.

## Decision

We treat secret invitation codes like passwords. We generate high-entropy tokens via `crypto.randomBytes`, deliver the raw code once to the team leader upon generation, and store **only the SHA-256 hash** (`tokenHash`) in the `invitations` collection. Redemption requests hash the submitted code in-memory and match against the hashed index.

## Alternatives Considered

### Alternative 1: Plaintext Token Storage

- **Pros**: Trivial database lookups.
- **Cons**: Severe security vulnerability; tokens exposed in database exports, audits, or admin views.
- **Why not**: Fails basic security defense-in-depth principles.

### Alternative 2: Bcrypt / Argon2 Hashing

- **Pros**: High work factor against brute-force attacks.
- **Cons**: High CPU cost for every invite redemption, which harms performance under high-concurrency burst traffic.
- **Why not**: Randomly generated 64-bit entropy codes already have massive keyspaces where SHA-256 is fully adequate without CPU bottlenecking.

## Consequences

### Positive

- Zero risk of token compromise from database read leaks or logs.
- O(1) indexed lookup on `tokenHash` with sub-millisecond execution.

### Negative

- Plaintext code cannot be viewed again by the leader after initial generation (must generate a new code if forgotten).

### Risks

- Code collision. Mitigated by using 64-bit random entropy and unique compound index on `tokenHash`.
