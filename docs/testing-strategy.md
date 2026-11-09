# CrewConnect — Comprehensive Testing & Quality Verification Strategy

**Document:** Testing & Verification Strategy  
**Author:** Senior Quality & Performance Engineer  
**Status:** Finalized & Approved  
**Version:** 1.3.0

---

## 1. Testing Pyramid & Verification Philosophy

CrewConnect enforces a multi-tier testing strategy specifically tailored to verify concurrency invariants, crash consistency, high-throughput discovery latency, and domain business rules:

```mermaid
flowchart TD
    LT["Load & Stress Tests (k6 / autocannon)\n100 VUs, 10k users, 2k teams, p95 < 200ms"]
    CT["Concurrency Race Tests (Vitest + Supertest)\n50 simultaneous users -> 1 seat, Dual-team race"]
    IT["Integration Tests (Supertest + Mongoose Replica Set)\nAuth, Team CRUD, Invites, Join Requests, Leadership Invariants (20+ tests)"]
    IDEMP["Idempotency & Crash-Consistency Suite (9 Scenarios)\nAtomic commit, crash windows, fencing tokens, UnknownCommit"]
    UT["Unit Tests (Vitest)\nBusiness logic, Zod validation, Argon2id params, Recommendation math"]

    LT --> CT
    CT --> IDEMP
    IDEMP --> IT
    IT --> UT
```

---

## 2. Test Suites & Categorization

### A. Unit Tests (`apps/api/tests/unit/**/*.test.ts`)

1. **Argon2id Parameters & Hashing**: Verifies salt generation, hashing execution, and verification logic.
2. **Team Capacity Logic**: Tests boundary conditions on team size ($0, 1, 4, 5$).
3. **Leadership Invariants**: Verifies that a leader cannot leave without transfer, and verifies last-member disbandment triggers.
4. **Invitation Token Hashing**: Tests SHA-256 token generation and constant-time comparison.
5. **Idempotency Hash Verification**: Tests SHA-256 payload fingerprinting and mismatch detection.
6. **Zod Validation Schemas**: Tests boundary values and injection payloads across all DTOs.

### B. Integration Tests (`apps/api/tests/integration/**/*.test.ts`)

Minimum $\ge 20$ comprehensive passing tests against a local MongoDB Replica Set:

1. `test_auth_register_argon2id`: Registers participant, checks Argon2id hash format in DB.
2. `test_auth_register_duplicate_email`: Rejects duplicate email with 409.
3. `test_auth_login_valid_credentials`: Authenticates, sets `httpOnly` cookie.
4. `test_auth_login_invalid_password`: Returns 401 with generic error.
5. `test_team_create_leader_assigned`: Creates team, verifies creator is `LEADER`.
6. `test_team_create_duplicate_in_hackathon`: Blocks user from creating second team (409).
7. `test_team_discovery_filters`: Tests pagination, skill matching, and vacancy filtering.
8. `test_team_update_by_leader`: Allows leader to update tagline/skills.
9. `test_team_update_forbidden_for_member`: Non-leader update returns 403.
10. `test_invite_code_generation`: Generates code, verifies DB stores SHA-256 hash.
11. `test_invite_code_redemption`: Redeems code, verifies member added and uses count incremented.
12. `test_invite_code_expired`: Rejects expired invite code with 400.
13. `test_join_request_workflow`: Creates pending request, verifies leader approval adds member.
14. `test_member_voluntary_leave`: Member leaves, counter decrements 4 -> 3.
15. `test_member_leader_cannot_leave`: Leader attempt to leave multi-member team returns 400.
16. `test_member_last_departure_disbands_team`: Sole member leaving automatically disbands team.
17. `test_member_removal_by_leader`: Leader kicks member, counter decrements.
18. `test_leadership_transfer_atomic`: Transfers leadership, updates roles and `team.leaderId`.
19. `test_leadership_transfer_invalid_target`: Transfer to non-member fails with 400.
20. `test_auditable_event_log_generation`: Confirms auditable log entries written within transaction.

---

## 3. Dedicated Idempotency & Crash-Consistency Test Suite (`apps/api/tests/idempotency/**/*.test.ts`)

To ensure crash-resilience and correct lease-fencing semantics, nine explicit scenarios are specified:

| Test ID      | Test Scenario                                   | Execution Description                                                                              | Expected Invariant & Assertion                                                                                                                                                                                             |
| :----------- | :---------------------------------------------- | :------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IDEMP-01** | **Successful Operation & In-Txn Completion**    | Execute join request with valid `Idempotency-Key`.                                                 | Business mutation commits AND `idempotencyRecord` transitions to `COMPLETED` atomically with status 201. Subsequent request with same key returns cached 201 (`X-Cache: HIT`).                                             |
| **IDEMP-02** | **App Crash Before Transaction Commit**         | Simulate process termination/failure prior to `session.commitTransaction()`.                       | MongoDB coordinator rolls back transaction. Business mutation is discarded. Record remains in `PROCESSING`. After lease expiry (30s), a retry reclaims the lease and executes cleanly without partial state.               |
| **IDEMP-03** | **App Crash After Transaction Commit**          | Simulate crash immediately after `session.commitTransaction()` succeeds.                           | Because completion happened inside the transaction, the record is ALREADY `status: "COMPLETED"` in the database. When client retries, it immediately receives cached 201 response. Zero re-execution!                      |
| **IDEMP-04** | **Lease Expiry and Reclamation**                | Worker A acquires lease with `ownerToken_A`, then halts/stalls for $> 30\text{ s}$.                | Worker B detects expired lease (`lockedAt < now - 30s`), atomically updates `ownerToken_B` and resets `lockedAt`. Worker B successfully executes and commits.                                                              |
| **IDEMP-05** | **Fenced Stale Worker Commit Rejection**        | Worker A stalls, Worker B reclaims lease. Worker A resumes and attempts to commit its transaction. | Worker A's conditional update `{ ownerToken: ownerToken_A }` matches 0 documents. Worker A detects `matchedCount === 0`, aborts its transaction, and rolls back all business mutations. Stale worker is completely fenced! |
| **IDEMP-06** | **Concurrent Duplicate Key Requests**           | Two identical requests with same `Idempotency-Key` fire concurrently.                              | One request acquires the lease (`status: PROCESSING`); the second request catches unique constraint / lease lock and is rejected with `409 Conflict (REQUEST_IN_PROGRESS)`.                                                |
| **IDEMP-07** | **Same Key with Different Payloads**            | Client sends request with Key $K$ and Body $B_1$, then sends Key $K$ with Body $B_2$.              | System detects `SHA-256(B_1) !== SHA-256(B_2)` and immediately returns `409 Conflict (IDEMPOTENCY_KEY_PAYLOAD_MISMATCH)`.                                                                                                  |
| **IDEMP-08** | **UnknownTransactionCommitResult Handling**     | Mock commit network failure returning `UnknownTransactionCommitResult`.                            | Runner retries ONLY `commitTransaction()`. If unresolved, idempotency record is preserved (never deleted). Client retry discovers whether record is `COMPLETED` or `PROCESSING` without double-execution.                  |
| **IDEMP-09** | **Transaction Failure Without False COMPLETED** | Inject a business failure (e.g. `TEAM_FULL`) during transaction.                                   | Transaction aborts. Scoped cleanup deletes the lease with `ownerToken`. Record is NEVER marked `COMPLETED`. Next attempt can retry fresh.                                                                                  |

---

## 4. Concurrency Race Tests (`apps/api/tests/concurrency/**/*.test.ts`)

1. **The 50-Simultaneous-Users Race for 1 Seat**:
   - **Setup**: Team with `memberCount: 4`, `maxCapacity: 5`.
   - **Execution**: 50 distinct registered user tokens issue `POST /teams/:id/join` simultaneously via `Promise.all()`.
   - **Assertions**:
     - Exactly **1** HTTP response has status `201 Created`.
     - Exactly **49** HTTP responses have status `409 Conflict (TEAM_FULL)` after transaction retries.
     - Final `team.memberCount === 5`.
     - `Membership.countDocuments({ teamId, status: "ACTIVE" }) === 5`.
     - Exactly 1 new record in `auditLogs` with action `MEMBER_JOINED`.
2. **Dual-Team Competing Join Race**:
   - User A attempts to join Team X and Team Y concurrently in the same hackathon.
   - **Assertions**: Exactly 1 succeeds (201); 1 fails with `409 ALREADY_IN_TEAM`. The failed team's counter does NOT increment.
3. **Transaction Rollback on Secondary Failure**:
   - Inject a failure after capacity increment (e.g. simulated unique index conflict).
   - **Assertion**: Transaction aborts completely; `team.memberCount` remains at original value (no permanent orphaned increment).
4. **Transient Write Conflict vs Retry Exhaustion**:
   - Verify that transactions experiencing `WriteConflict` back off and retry.
   - If retries are artificially exhausted, verify that the API returns `409 CONCURRENCY_CONFLICT`, not `TEAM_FULL`.

---

## 5. Load & Performance Testing (`scripts/k6/load-test.js`)

- **Dataset**: $10,000$ participants, $2,000$ teams.
- **Concurrency**: 100 concurrent Virtual Users (VUs) over 3 minutes.
- **Threshold**: Discovery Board p95 latency $< 200\text{ ms}$. Error rate $< 0.1\%$.
