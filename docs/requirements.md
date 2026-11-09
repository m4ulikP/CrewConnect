# CrewConnect — Requirements Specification & Traceability Matrix

**Project:** CrewConnect  
**Challenge:** Hack4Hack Crew Hiring Challenge 2026  
**Problem Statement:** PS1 — Race-proof Team Formation  
**Author:** Senior Software Architect & Engineering Lead  
**Status:** Approved for Implementation Planning  
**Version:** 1.0.0  

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
   - Password hashing with salted Argon2id / bcrypt.
   - Profile retrieval and authenticated session verification (`/api/v1/auth/me`).

2. **FR-USER: User Profiles & Skills Catalog**
   - User profile customization: bio, GitHub URL, LinkedIn URL, portfolio link.
   - Skill tagging (e.g., `TypeScript`, `Python`, `React`, `DevOps`, `UI/UX`, `AI/ML`).
   - Experience level and preferred team roles (e.g., Frontend Lead, Backend Architect, Designer).
   - Availability status per hackathon.

3. **FR-HACK: Hackathon Management**
   - Hackathon entity with title, description, start/end dates, team capacity bounds (`minTeamSize`, `maxTeamSize`, default 1 to 5).
   - Registration status tracking (open, active, ended).
   - Hackathon-scoped constraints: all teams, memberships, and invitations are strictly bounded to a specific `hackathonId`.

4. **FR-TEAM: Team Creation & Management**
   - Any registered user registered in the hackathon can create a new team if not already in one.
   - Creator is automatically assigned the `LEADER` role.
   - Team attributes: `name`, `tagline`, `description`, `skillsNeeded`, `isOpen` (toggle join availability), `maxCapacity`.
   - Team profile updates restricted to current `LEADER`.
   - Team deletion allowed only by `LEADER` when no other members remain or with explicit disband confirmation.

5. **FR-MEM: Team Membership Management & Race-Proof Joining**
   - Direct join via open team enrollment (subject to strict concurrency control).
   - Join requests: non-team users can submit a join request with a note; team leader can approve or reject.
   - Member removal: `LEADER` can remove any non-leader member.
   - Voluntary departure: any non-leader member can leave the team.
   - Leadership transfer: `LEADER` can atomically transfer leadership to any existing active team member.

6. **FR-INV: Secret Invitation Codes & Direct Invites**
   - Secret join code generation: leader generates an alphanumeric invite token.
   - Invite tokens can have an optional expiration timestamp or max redemptions limit.
   - Invite tokens are stored as one-way SHA-256 hashes in the database (never plaintext).
   - Direct user-to-user invitations sent to a target user's email or user ID.
   - Atomic redemption: redeeming an invite enforces the exact same concurrency invariants as open joining.

7. **FR-DISC: Team Discovery & Search**
   - Paginated team discovery board supporting thousands of teams.
   - Filtering by: skills needed, open seats (`memberCount < maxCapacity`), team status.
   - Full-text search on team name, tagline, and required tech stack.
   - High-performance indexing ensuring p95 response time $< 200\text{ ms}$ under load.

8. **FR-REC: Complementary Teammate Recommendations**
   - Recommendation engine calculating affinity scores between unassigned participants and teams with vacancies.
   - Scoring algorithm weighing complementary skills (skills needed by team $\cap$ skills possessed by candidate).
   - Recommendation board for both teams looking for members and solo participants looking for teams.

9. **FR-RT: Real-Time Event Dispatch**
   - WebSocket (Socket.IO) push notifications for:
     - Real-time seat availability updates (live counter decrements/increments).
     - New join requests received by leaders.
     - Join request approvals, rejections, or member removals received by applicants.
     - Direct invitations.

10. **FR-AUDIT: Tamper-Evident Audit Logging**
    - Complete, immutable operational log of all state mutations:
      - `TEAM_CREATED`, `MEMBER_JOINED`, `MEMBER_LEFT`, `MEMBER_REMOVED`, `LEADERSHIP_TRANSFERRED`, `INVITE_GENERATED`, `INVITE_REDEEMED`.
    - Captured fields: `timestamp`, `hackathonId`, `teamId`, `userId`, `actorId`, `action`, `metadata`, `ipAddress`.

---

### B. Critical Non-Functional Requirements (NFR)

1. **NFR-CONC: Race-Condition Protection & Serializability**
   - Zero seat oversaturation: If a team has 1 vacant seat, 50 concurrent joining operations must result in exactly 1 success and 49 failures.
   - Two-tier concurrency control: Atomic conditional reservations (`$inc: { memberCount: 1 }` conditioned on `memberCount: { $lt: maxCapacity }`) combined with MongoDB multi-document ACID transactions.
   - Zero dirty reads or uncommitted state visible to other participants.

2. **NFR-INVAR: Global Database Invariants**
   - Invariant 1: **Single Team per Hackathon** — enforced at the database level by unique compound index `{ hackathonId: 1, userId: 1 }` on the `memberships` collection.
   - Invariant 2: **Capacity Bounding** — team `memberCount` cannot exceed `maxCapacity`.
   - Invariant 3: **Counter Reconciliation** — team `memberCount` must match `count(memberships where teamId = team._id and status = 'ACTIVE')`.
   - Invariant 4: **Valid Active Leader** — every active team must have exactly one member with `role = 'LEADER'`.

3. **NFR-IDEMP: Strict Request Idempotency**
   - All state-mutating HTTP POST/PUT/DELETE requests support an `Idempotency-Key` header (UUIDv4).
   - Retried requests with the same idempotency key return the cached identical response without re-executing transactions or duplicating side effects.

4. **NFR-PERF: High-Throughput & Low-Latency Performance**
   - Team discovery board endpoint (`GET /api/v1/hackathons/:id/teams`) p95 latency $< 200\text{ ms}$ under 100 concurrent requests against a 2,000-team dataset.
   - Efficient pagination via keyset/cursor or indexed compound skip-limit.

5. **NFR-SEC: Comprehensive Defense-in-Depth Security**
   - Input validation: 100% of request bodies, query params, and route params validated using strict Zod schemas.
   - Authentication: JWT signed with HMAC-SHA256 (minimum 256-bit secret), transmitted via `httpOnly`, `SameSite=Lax/Strict`, `Secure` cookies.
   - Rate limiting: Tiered IP and user rate limiting (general API: 100 req/15min; sensitive join/auth: 10 req/min).
   - Invite code security: Cryptographically strong token generation; stored as SHA-256 hashes.
   - Role-Based Access Control (RBAC): Strict verification that only leaders can perform privileged team actions.

6. **NFR-A11Y: Accessibility & Responsive UI**
   - Fully responsive design supporting mobile (320px+), tablet, and desktop viewports.
   - WCAG 2.1 AA keyboard accessibility: tab navigation, focus rings, ARIA labels, semantic HTML.

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
| **Code Coverage** | $\ge 80\%$ statement and branch coverage on core logic | Vitest c8/v8 coverage reporter |

---

## 3. Submission Deliverables & Evaluation Criteria

### Deliverables Required for Challenge Submission
1. Complete source repository with clear monorepo structure.
2. `docker-compose.yml` orchestrating API, Web, and single-node MongoDB Replica Set (`rs0`).
3. Automated database seeding script supporting 10,000 users and 2,000 teams.
4. Comprehensive test suite demonstrating $\ge 20$ automated API tests.
5. Reproducible concurrency benchmark script proving the 50-to-1 seat invariant.
6. Complete documentation: Architecture, Database Design, Concurrency Design, API Spec, Security, Testing.
7. Recorded demonstration / live deployment link showing responsive UI and real-time socket events.

### Challenge Evaluation Axes
- **Concurrency Correctness (40%)**: Proof that race conditions are mathematically and mechanically eliminated.
- **System Architecture & Code Quality (25%)**: Clean modular monolith, separation of concerns, strict typing, error handling.
- **Performance & Scalability (15%)**: Index optimization, query execution plans, sub-200ms latency under load.
- **User Experience & Accessibility (10%)**: Intuitive interface, real-time visual feedback, keyboard accessibility.
- **Testing & Verification (10%)**: Comprehensive test coverage across unit, integration, and load dimensions.

---

## 4. Requirements Traceability Matrix (RTM)

| Req ID | Description | Priority | Planned Implementation Module | Verification Method | Planned Phase |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FR-AUTH-1** | User registration & password hashing | Must-have | `apps/api/src/modules/auth` | Vitest API integration tests | Phase 3 |
| **FR-AUTH-2** | JWT cookie-based session management | Must-have | `apps/api/src/modules/auth` | Supertest auth cookie tests | Phase 3 |
| **FR-USER-1** | User profile & skills catalog | Must-have | `apps/api/src/modules/users` | Unit & API tests | Phase 3 |
| **FR-HACK-1** | Hackathon configuration & boundaries | Must-have | `apps/api/src/modules/hackathons` | CRUD integration tests | Phase 3 |
| **FR-TEAM-1** | Team creation with automatic leader assignment | Must-have | `apps/api/src/modules/teams` | Team creation API tests | Phase 4 |
| **FR-TEAM-2** | Team profile & tech stack editing | Must-have | `apps/api/src/modules/teams` | RBAC validation tests | Phase 4 |
| **FR-MEM-1** | Race-proof open seat joining (50 concurrent) | Must-have | `apps/api/src/modules/memberships` | Concurrency stress test (50 VUs) | Phase 5 |
| **FR-MEM-2** | Single-team-per-hackathon enforcement | Must-have | `apps/api/src/modules/memberships` | Unique index & dual-join tests | Phase 5 |
| **FR-MEM-3** | Voluntary departure & member removal | Must-have | `apps/api/src/modules/memberships` | Membership lifecycle tests | Phase 4 |
| **FR-MEM-4** | Atomic leadership transfer | Must-have | `apps/api/src/modules/memberships` | Leadership transfer tests | Phase 4 |
| **FR-INV-1** | Hashed invitation code generation & redemption | Must-have | `apps/api/src/modules/invitations` | Expiry & redemption tests | Phase 4 |
| **FR-REQ-1** | Join requests & leader approval/rejection | Must-have | `apps/api/src/modules/join-requests` | Request workflow tests | Phase 4 |
| **FR-DISC-1** | Paginated team discovery board | Must-have | `apps/api/src/modules/teams` | k6 p95 latency benchmark | Phase 4, 7 |
| **FR-REC-1** | Skill-matching recommendation engine | Should-have| `apps/api/src/modules/recommendations` | Unit tests with test vectors | Phase 4 |
| **FR-RT-1** | Real-time seat updates & notifications | Should-have| `apps/api/src/modules/notifications` | Socket.IO client mock tests | Phase 6 |
| **FR-AUDIT-1**| Tamper-evident audit logging | Must-have | `apps/api/src/modules/audit` | Database inspection tests | Phase 4 |
| **NFR-CONC-1**| 50-to-1 seat race-proof allocation | Must-have | Concurrency engine / MongoDB Txn | Automated concurrency test | Phase 5 |
| **NFR-IDEMP-1**| `Idempotency-Key` header support | Must-have | `apps/api/src/middleware/idempotency` | Duplicate POST retry test | Phase 5 |
| **NFR-PERF-1**| Discovery endpoint p95 $< 200\text{ ms}$ | Must-have | Indexed MongoDB queries | k6 100 VU benchmark | Phase 7 |
| **NFR-PERF-2**| Seeding 10k users & 2k teams | Must-have | `scripts/seed.ts` | Count verification query | Phase 7 |
| **NFR-TEST-1**| At least 20 automated API tests | Must-have | `apps/api/tests/**/*.test.ts` | CI pipeline report | Phase 7 |
| **NFR-CI-1**  | GitHub Actions CI workflow | Must-have | `.github/workflows/ci.yml` | GitHub Actions runner status | Phase 2 |
| **UI-RESP-1** | Responsive mobile & desktop interface | Must-have | `apps/web/src` | Playwright / visual inspection | Phase 6 |
| **UI-A11Y-1** | WCAG 2.1 AA keyboard accessibility | Should-have| `apps/web/src` | Lighthouse accessibility audit | Phase 6 |
| **BONUS-1**   | Real-time team chat & activity feed | Bonus      | `apps/api/src/modules/chat` | Manual / E2E test | Phase 8 |
| **BONUS-2**   | AI-powered resume / GitHub profile parser | Bonus  | `apps/api/src/modules/ai` | Unit tests with mock responses | Phase 8 |

---

## 5. Distinction: Official Requirements vs. Proposed Improvements

To maintain total transparency, here is the explicit division between mandatory challenge specifications and our proposed engineering improvements:

### Official Challenge Specifications (Mandatory)
1. 50 simultaneous users attempting to take 1 remaining seat must produce exactly 1 winner and 49 clean rejections.
2. No user can belong to multiple teams in the same hackathon.
3. Teams cannot exceed capacity.
4. Membership counts must remain strictly consistent.
5. Support for 10,000 seeded users and 2,000 seeded teams.
6. Discovery board p95 latency under 200 ms with 100 concurrent users.
7. At least 20 automated API tests.
8. GitHub Actions CI pipeline.
9. Responsive UI with keyboard accessibility.

### Proposed Engineering Improvements (Best-Practice Enhancements)
1. **Idempotency Key Middleware**: RFC-compliant `Idempotency-Key` handling to protect against mobile or flaky network retries during concurrent operations.
2. **Two-Tier Reservation Strategy**: High-throughput conditional atomic counter decrement combined with an transactional compensation rollback pattern, optimizing MongoDB lock duration.
3. **Cryptographic Invite Token Hashing**: Storing invite tokens as SHA-256 hashes instead of plaintext to prevent token leakage in read-only database replicas or audit exports.
4. **Structured Error Contract (`AppError`)**: RFC 7807-inspired error response envelope `{ error: { code, message, details, timestamp } }` for machine-actionable client error handling.
5. **Architectural Decision Records (ADR)**: Version-controlled ADR directory (`docs/adr/`) documenting every key design trade-off for auditability.
