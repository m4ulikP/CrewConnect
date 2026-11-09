# CrewConnect — Requirements Specification & Traceability Matrix

**Project:** CrewConnect  
**Challenge:** Hack4Hack Crew Hiring Challenge 2026  
**Problem Statement:** PS1 — Race-proof Team Formation  
**Author:** Senior Software Architect & Engineering Lead  
**Status:** Finalized & Approved  
**Version:** 1.1.0  

---

## 1. Executive Problem Definition

In modern hackathons and competitive engineering team formations, team discovery boards experience intense burst traffic when registration opens or matchmaking deadlines approach. 

The canonical concurrency hazard specified in **PS1 (Race-proof Team Formation)** is:
> A team has an initial membership count of $4$ and an immutable capacity ceiling of $5$ (leaving exactly $1$ available seat). Simultaneously, $50$ registered users submit join requests or redeem an invitation code in the same millisecond window.
>
> The system must guarantee that **strictly one** user obtains the remaining seat, the other $49$ requests fail cleanly without corrupting state or leaking exceptions, the final team membership count is exactly $5$, and no user belongs to multiple teams within the same hackathon.

Beyond this core concurrency challenge, the platform must handle the complete lifecycle of hackathon team formation for thousands of participants while maintaining sub-200ms discovery latency and real-time updates.

---

## 2. Requirements Categorization

### A. Core Functional Requirements (FR)

1. **FR-AUTH: User Registration & Authentication**
   - User account creation with email, secure password, and display name.
   - Secure session handling via signed JSON Web Tokens (stored in `httpOnly` secure cookies).
   - Password hashing strictly with salted **Argon2id** (memory cost 64 MB, time cost 3, parallelism 1).
   - Profile retrieval and authenticated session verification (`/api/v1/auth/me`).

2. **FR-USER: User Profiles & Skills Catalog**
   - User profile customization: bio, GitHub URL, LinkedIn URL, portfolio link.
   - Skill tagging (e.g., `TypeScript`, `Python`, `React`, `DevOps`, `UI/UX`, `AI/ML`).
   - Experience level and preferred team roles.
   - Availability status per hackathon.

3. **FR-HACK: Hackathon Management**
   - Hackathon entity with title, description, start/end dates, team capacity bounds (`minTeamSize: 1`, `maxTeamSize: 5`).
   - Registration status tracking (`UPCOMING`, `ACTIVE`, `COMPLETED`).
   - Hackathon-scoped constraints: all teams, memberships, and invitations are strictly bounded to a specific `hackathonId`.

4. **FR-TEAM: Team Creation & Management**
   - Any registered user registered in the hackathon can create a new team if not already in one.
   - Creator is automatically assigned the `LEADER` role.
   - Team attributes: `name`, `tagline`, `description`, `skillsNeeded`, `isOpen` (toggle join availability), `maxCapacity`, `status` (`ACTIVE`, `DISBANDED`, `ARCHIVED`).
   - Team profile updates restricted to current `LEADER`.
   - Team disbandment: when a leader disbands the team or when the last member departs, the team transitions to `status: "DISBANDED"`, `isOpen: false`, and `memberCount: 0`.

5. **FR-MEM: Team Membership Management & Race-Proof Joining**
   - Direct join via open team enrollment (subject to unified single-transaction concurrency control).
   - Join requests: non-team users can submit a join request with a note; team leader can approve or reject.
   - Member removal: `LEADER` can remove any non-leader member.
   - Voluntary departure: any non-leader member can leave the team.
   - Leadership transfer: `LEADER` can atomically transfer leadership to any existing active team member.
   - **Leadership Invariants**:
     - A team's leader must always be an active member.
     - A leader cannot leave or be removed without a valid leadership transfer or explicit team disbandment.
     - Leadership transfers are executed inside an ACID transaction to prevent concurrent race conditions.

6. **FR-INV: Secret Invitation Codes & Direct Invites**
   - Secret join code generation: leader generates an alphanumeric invite token.
   - Stored strictly as SHA-256 hashes in MongoDB (never plaintext).
   - Token redemption: redemption follows the exact same unified transaction concurrency engine as open joining.

7. **FR-DISC: Team Discovery & Search**
   - Paginated team discovery board supporting thousands of teams.
   - Filtering by: skills needed, open seats (`memberCount < maxCapacity`), team status (`ACTIVE`).
   - Full-text search on team name, tagline, and required tech stack.
   - High-performance indexing ensuring p95 response time $< 200\text{ ms}$ under load.

8. **FR-REC: Complementary Teammate Recommendations**
   - Recommendation engine calculating affinity scores between unassigned participants and teams with vacancies based on skill overlap.

9. **FR-RT: Real-Time Event Dispatch**
   - Socket.IO push notifications for real-time seat availability updates, join request workflows, and member changes.

10. **FR-AUDIT: Tamper-Evident Audit Logging**
    - Complete, immutable operational log of all state mutations committed within the same transaction.

---

### B. Critical Non-Functional Requirements (NFR)

1. **NFR-CONC: Race-Condition Protection & Unified Transaction Serialization**
   - Zero seat oversaturation: If a team has 1 vacant seat, 50 concurrent joining operations must result in exactly 1 success and 49 failures.
   - **Unified Single-Transaction Execution**: Seat reservation check, capacity increment, membership record insertion, audit log insertion, and idempotency persistence MUST execute within the **same MongoDB transaction** using session-aware Mongoose operations.
   - **Rollback Guarantee**: If any operation fails (e.g. unique compound index violation on membership), the entire transaction rolls back; a failed join never leaves a permanently incremented `memberCount`.
   - **Conflict Handling**: Losing transactions encountering storage write conflicts (`TransientTransactionError` / `WriteConflict`) retry with jittered exponential backoff and discover that `memberCount == maxCapacity`, aborting cleanly with `409 Conflict (TEAM_FULL)`.

2. **NFR-INVAR: Global Database Invariants**
   - Invariant 1: **Single Team per Hackathon** — enforced at the database level by unique compound index `{ hackathonId: 1, userId: 1 }` on `memberships` (`status: "ACTIVE"`).
   - Invariant 2: **Capacity Bounding** — team `memberCount` cannot exceed `maxCapacity`.
   - Invariant 3: **Counter Reconciliation** — team `memberCount` must match `count(memberships where teamId = team._id and status = 'ACTIVE')`.
   - Invariant 4: **Valid Active Leader** — every active team must have exactly one member with `role = 'LEADER'` and `status = 'ACTIVE'`.
   - Invariant 5: **Last Member Exit Safety** — when the final member leaves or is removed, the team is automatically marked `DISBANDED` and closed.

3. **NFR-IDEMP: Scoped Request Idempotency & In-Flight Protection**
   - All state-mutating HTTP requests support an `Idempotency-Key` header (UUIDv4).
   - Keys are scoped by `{ userId, endpoint }`.
   - Incoming requests check payload fingerprint (`payloadHash`); reusing a key with a different payload returns `409 Conflict (IDEMPOTENCY_KEY_PAYLOAD_MISMATCH)`.
   - In-flight requests set status `PROCESSING`; concurrent identical requests receive `409 Conflict (REQUEST_IN_PROGRESS)` to prevent duplicate parallel transactions.
   - Failed transactions never leave successful idempotency records.
   - TTL indexes are strictly for eventual database cleanup, not correctness.

4. **NFR-TECH: Technology Decisions**
   - Package manager: **npm** exclusively (retaining `package-lock.json`).
   - Data access: **Mongoose** as the primary, consistent data-access layer using session-aware operations for all transactions and atomic updates.
   - Password hashing: **Argon2id**.

5. **NFR-PERF: High-Throughput & Low-Latency Performance**
   - Team discovery board endpoint (`GET /api/v1/hackathons/:id/teams`) p95 latency $< 200\text{ ms}$ under 100 concurrent requests against a 2,000-team dataset.

6. **NFR-SEC: Comprehensive Defense-in-Depth Security**
   - 100% of request bodies, query params, and route params validated using strict Zod schemas.
   - JWT transmitted via `httpOnly`, `SameSite=Lax`, `Secure` cookies.
   - Tiered rate limiting (general: 100 req/15min; sensitive join/auth: 10 req/min).

---

### C. Explicit Acceptance Criteria & Metrics

| Criterion | Target Metric | Verification Method |
| :--- | :--- | :--- |
| **Seeded Participants** | $\ge 10,000$ valid user records | Automated MongoDB seeding script (`scripts/seed.ts`) |
| **Seeded Teams** | $\ge 2,000$ team records across hackathons | Automated MongoDB seeding script (`scripts/seed.ts`) |
| **50-User Concurrency Race** | Exactly 1 success, 49 failures; final count = 5/5 | Automated Vitest / Supertest integration test & k6 script |
| **Double-Team Race** | User trying to join 2 teams simultaneously succeeds in at most 1 | Automated Vitest integration test |
| **API Test Suite** | $\ge 20$ comprehensive passing tests | Vitest + Supertest automated test suite |
| **Load Test Concurrency** | 100 concurrent Virtual Users (VUs) sustained | k6 / autocannon load test script |
| **Team Board p95 Latency** | $< 200\text{ ms}$ at 100 VUs on seeded database | k6 metrics summary output |
| **CI Automation** | Automated build, lint, and test on PR & push | GitHub Actions workflow (`.github/workflows/ci.yml`) |

---

## 3. Requirements Traceability Matrix (RTM)

| Req ID | Description | Priority | Planned Implementation Module | Verification Method | Planned Phase |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FR-AUTH-1** | User registration & Argon2id hashing | Must-have | `apps/api/src/modules/auth` | Vitest API integration tests | Phase 3 |
| **FR-AUTH-2** | JWT cookie-based session management | Must-have | `apps/api/src/modules/auth` | Supertest auth cookie tests | Phase 3 |
| **FR-USER-1** | User profile & skills catalog | Must-have | `apps/api/src/modules/users` | Unit & API tests | Phase 3 |
| **FR-HACK-1** | Hackathon configuration & boundaries | Must-have | `apps/api/src/modules/hackathons` | CRUD integration tests | Phase 3 |
| **FR-TEAM-1** | Team creation with automatic leader assignment | Must-have | `apps/api/src/modules/teams` | Team creation API tests | Phase 4 |
| **FR-TEAM-2** | Team profile & tech stack editing | Must-have | `apps/api/src/modules/teams` | RBAC validation tests | Phase 4 |
| **FR-MEM-1** | Race-proof open seat joining (50 concurrent) | Must-have | `apps/api/src/modules/memberships` | Concurrency stress test (50 VUs) | Phase 5 |
| **FR-MEM-2** | Single-team-per-hackathon enforcement | Must-have | `apps/api/src/modules/memberships` | Unique index & dual-join tests | Phase 5 |
| **FR-MEM-3** | Voluntary departure & member removal | Must-have | `apps/api/src/modules/memberships` | Membership lifecycle tests | Phase 4 |
| **FR-MEM-4** | Atomic leadership transfer | Must-have | `apps/api/src/modules/memberships` | Leadership transfer tests | Phase 4 |
| **FR-MEM-5** | Disbandment on last member departure | Must-have | `apps/api/src/modules/memberships` | Team lifecycle integration tests | Phase 4 |
| **FR-INV-1** | Hashed invitation code generation & redemption | Must-have | `apps/api/src/modules/invitations` | Expiry & redemption tests | Phase 4 |
| **FR-REQ-1** | Join requests & leader approval/rejection | Must-have | `apps/api/src/modules/join-requests` | Request workflow tests | Phase 4 |
| **FR-DISC-1** | Paginated team discovery board | Must-have | `apps/api/src/modules/teams` | k6 p95 latency benchmark | Phase 4, 7 |
| **FR-REC-1** | Skill-matching recommendation engine | Should-have| `apps/api/src/modules/recommendations` | Unit tests with test vectors | Phase 4 |
| **FR-RT-1** | Real-time seat updates & notifications | Should-have| `apps/api/src/modules/notifications` | Socket.IO client mock tests | Phase 6 |
| **FR-AUDIT-1**| Tamper-evident audit logging in transaction | Must-have | `apps/api/src/modules/audit` | Database inspection tests | Phase 4 |
| **NFR-CONC-1**| 50-to-1 seat race-proof allocation | Must-have | Unified Mongoose Transaction | Automated concurrency test | Phase 5 |
| **NFR-IDEMP-1**| Scoped & hashed `Idempotency-Key` support | Must-have | `apps/api/src/middleware/idempotency` | Duplicate POST retry & conflict tests | Phase 5 |
| **NFR-PERF-1**| Discovery endpoint p95 $< 200\text{ ms}$ | Must-have | Indexed MongoDB queries | k6 100 VU benchmark | Phase 7 |
| **NFR-PERF-2**| Seeding 10k users & 2k teams | Must-have | `scripts/seed.ts` | Count verification query | Phase 7 |
| **NFR-TEST-1**| At least 20 automated API tests | Must-have | `apps/api/tests/**/*.test.ts` | CI pipeline report | Phase 7 |
| **NFR-CI-1**  | GitHub Actions CI workflow | Must-have | `.github/workflows/ci.yml` | GitHub Actions runner status | Phase 2 |
| **UI-RESP-1** | Responsive mobile & desktop interface | Must-have | `apps/web/src` | Playwright / visual inspection | Phase 6 |
| **UI-A11Y-1** | WCAG 2.1 AA keyboard accessibility | Should-have| `apps/web/src` | Lighthouse accessibility audit | Phase 6 |
