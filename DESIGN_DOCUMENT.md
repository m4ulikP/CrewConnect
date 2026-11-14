# CrewConnect — System Architecture & Design Document (PS1)

**Challenge:** Hack4Hack Crew Hiring Challenge 2026  
**Problem Statement:** PS1 — Race-Proof Team Formation at Scale  
**Repository:** [m4ulikP/CrewConnect](https://github.com/m4ulikP/CrewConnect)  
**Baseline Commit:** `7664896` (`main`)  
**Document Status:** Final Production Specification (1-Page Executive Architecture)

---

## 1. Problem Definition & Objectives

Modern hackathon team formation experiences acute contention when registration windows open or matchmaking deadlines approach. The primary failure mode occurs when **$N$ users simultaneously compete for $1$ remaining squad vacancy**. Without rigorous concurrency controls, naive systems suffer from capacity over-allocation, orphaned counters, multi-team membership leaks, and phantom UI notifications.

**CrewConnect Guarantees:**

1. **Strict Seat Invariant:** When $N$ concurrent users attempt to claim the final seat ($4/5 \to 5/5$), strictly **one** user succeeds (`201 Created`); the remaining $N-1$ fail cleanly (`409 Conflict`).
2. **Global Single-Team Invariant:** No participant can belong to more than one active team within the same hackathon under any race condition.
3. **Atomic Consistency:** State mutations, capacity counters, membership insertions, and audit entries commit atomically or roll back completely.
4. **Post-Commit Real-Time Sync:** WebSockets dispatch events strictly after transaction confirmation, preventing phantom event leakage from aborted attempts.

---

## 2. Core Architecture

CrewConnect is organized as an enterprise-grade modular monolith inside a clean TypeScript monorepo:

```
┌────────────────────────────────────────────────────────┐
│               Client Tier (React 18 SPA)               │
│      Vite + Tailwind CSS + Socket.IO Client + Zod      │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / WSS
                            ▼
┌────────────────────────────────────────────────────────┐
│            Application Tier (Node.js / Express)        │
│   Auth / CSRF / Rate Limiting / Idempotency Middleware  │
│   ├── Team Service & Seat Reservation Engine           │
│   ├── Deterministic Teammate Recommendation Engine     │
│   └── Post-Commit Socket.IO Event Dispatcher           │
└───────────────────────────┬────────────────────────────┘
                            │ Mongoose Driver (Session-Aware)
                            ▼
┌────────────────────────────────────────────────────────┐
│         Database Tier (MongoDB 7.0 Replica Set)        │
│   Multi-Document ACID Transactions (rs0 / WiredTiger)  │
│   Unique Partial Indexes & Conditional Update Locks    │
└────────────────────────────────────────────────────────┘
```

- **Client Tier:** React 18, React Router v6, Tailwind CSS (Mineral Alabaster + Architectural Pine `#115E59`).
- **API Tier:** Node.js v20+ LTS, Express, Socket.IO, Zod runtime schema validation, Argon2id password hashing, and signed JWTs stored in `httpOnly`, `SameSite=Lax`, `Secure` cookies.
- **Database Tier:** MongoDB v7.0+ Replica Set (`rs0`), leveraging multi-document ACID transactions with `readConcern: majority` and `writeConcern: majority`.

---

## 3. Concurrency Strategy & Critical Invariants

CrewConnect uses a **Two-Tier Concurrency Control Strategy** combining database constraints with application-level serializable transactions:

```
                  Client Request: POST /api/v1/teams/:id/join
                                      │
                                      ▼
                        [1. Acquire Idempotency Lease]
                        Atomic key reservation with 30s TTL
                                      │
                                      ▼
                 [2. Start MongoDB Transaction (Session-Aware)]
                                      │
                                      ▼
        ┌───────────────────────────────────────────────────────────┐
        │  Read Team with Session (readConcern: majority)           │
        │  Check: status == 'ACTIVE' && isOpen && memberCount < max │
        └─────────────────────────────┬─────────────────────────────┘
                                      │
                      ┌───────────────┴───────────────┐
                      ▼                               ▼
               [Capacity Full]                 [Vacancy Exists]
                      │                               │
                      ▼                               ▼
             Abort & Release Lease         Update Team memberCount++
             Return 409 TEAM_FULL          Insert Membership ('ACTIVE')
                                           Insert AuditLog Entry
                                           Update Idempotency -> COMPLETED
                                                      │
                                                      ▼
                                           [Commit Transaction]
                                                      │
                                      ┌───────────────┴───────────────┐
                                      ▼                               ▼
                                  [Success]                    [Write Conflict]
                                      │                               │
                                      ▼                               ▼
                           Dispatch Socket.IO Events       withTransactionRetry
                           Return 201 Created              Exponential Jitter Backoff
```

### Critical Invariants Enforced:

1. **Single-Hackathon Membership:** Enforced by partial compound unique index:
   ```typescript
   MembershipSchema.index(
     { hackathonId: 1, userId: 1 },
     { unique: true, partialFilterExpression: { status: "ACTIVE" } }
   );
   ```
2. **Bounded Capacity:** Atomically checked inside the transaction. If `team.memberCount >= team.maxCapacity`, the reservation aborts immediately before any write.
3. **Transaction Retry Semantics:** Managed by `withTransactionRetry`:
   - `TransientTransactionError` (code 112 / write conflict): Aborts and retries the entire callback with exponential jitter backoff.
   - `UnknownTransactionCommitResult`: Retries only the commit command on the active session.
   - Non-transient domain errors (`TEAM_FULL`, `ALREADY_IN_TEAM`): Fail-fast immediately without wasted retries.
   - Retries exhausted: Returns `409 Conflict (CONCURRENCY_CONFLICT)`.

---

## 4. Idempotency & Fault Tolerance

To guard against double-clicks, network drops, and browser retries:

- **Two-Phase Lease:** Middleware acquires an `IdempotencyRecord` with status `STARTED`, owner token, and 30-second TTL before business logic runs.
- **Payload Verification:** SHA-256 hash of the request body is recorded. Reusing a key with altered parameters returns `409 Conflict (IDEMPOTENCY_KEY_PAYLOAD_MISMATCH)`.
- **In-Transaction Completion:** Transition to `COMPLETED` occurs **inside the business transaction**. If the reservation commits, the cached response is permanently recorded; if the transaction aborts, the lease is released for immediate retry.
- **Cached Replay:** Matching subsequent requests return the cached response with `X-Cache: HIT` without re-executing writes.

---

## 5. Post-Commit Real-Time Synchronization

- **Zero Ghost Events:** Socket.IO events (`team:capacity_updated`, `team:member_joined`, `join_request:approved`) are staged in a transaction-bound queue and dispatched **strictly after confirmed MongoDB commit**.
- **Reconnection Resilience:** Authenticated rooms (`user:<id>`, `team:<id>`, `hackathon:<id>`) recover state via REST synchronization upon reconnect. Dynamic membership checks revoke room access when members leave or are removed.

---

## 6. Teammate Recommendation Engine

A pure, side-effect-free scoring engine ranks eligible unassigned candidates for open squads:
$$\text{Score} = \text{round}\left(0.50 \times S_{\text{skills}} + 0.25 \times S_{\text{experience}} + 0.25 \times S_{\text{timezone}}\right)$$

- **Skill Complementarity (50%):** Needed skills coverage (60%), breadth expansion (25%), collaboration overlap (15%).
- **Experience Fit (25%):** Squad balance matrix; rewards mentors for beginner squads and execution speed for senior squads.
- **Timezone Overlap (25%):** Average pairwise working-hour overlap (09:00–18:00) using native `Intl.DateTimeFormat` UTC offsets (DST & partial-hour aware). Protects candidate privacy by emitting compatibility labels rather than raw locations.

---

## 7. Verification Evidence & Quality Gates

| Verification Gate             | Test File Citation                                                                             |                   Observed Result                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | :-------------------------------------------------: |
| **50-Way Final-Seat Race**    | [`apps/api/tests/membership-race.test.ts`](apps/api/tests/membership-race.test.ts#L96)         | **1 winner (201), 49 rejects (409), 0 overbooking** |
| **Double-Team Race**          | [`apps/api/tests/membership-race.test.ts`](apps/api/tests/membership-race.test.ts)             |         **Single-team invariant preserved**         |
| **Real-Time Rollback Safety** | [`apps/api/tests/realtime.test.ts`](apps/api/tests/realtime.test.ts)                           |     **0 events emitted on aborted transaction**     |
| **Idempotent Replay**         | [`apps/api/tests/idempotency.test.ts`](apps/api/tests/idempotency.test.ts)                     | **100% cached response matching (`X-Cache: HIT`)**  |
| **Recommendation Engine**     | [`apps/api/tests/recommendation-engine.test.ts`](apps/api/tests/recommendation-engine.test.ts) | **37 unit tests covering all matrix permutations**  |
| **Monorepo Test Suite**       | 36 test files across API, Web, and Shared                                                      |         **370 / 370 tests passing (100%)**          |
| **Production Scale Load**     | [`scripts/run-load-test.ts`](scripts/run-load-test.ts)                                         |      **247 req/s across 10k users / 2k teams**      |
