# CrewConnect

> **Production-grade hackathon team formation platform with strict race-proof concurrency guarantees.**  
> Built for the **Hack4Hack Crew Hiring Challenge 2026 — Problem Statement 1: Race-proof Team Formation**.

---

## 🎯 Executive Summary & Problem Statement

Hackathon team formation is notoriously prone to concurrency race conditions when registration windows open or team discovery boards get flooded with thousands of active participants.

### The Core Challenge (PS1)

Consider a team with **4 members** and a maximum capacity of **5**. Suppose **50 users** simultaneously click "Join Team" or submit an invitation code within the exact same millisecond window.

**CrewConnect guarantees:**

1. **Strict Seat Invariant**: Exactly **one** user claims the final seat (5/5). The remaining 49 requests fail cleanly with typed `409 Conflict (TEAM_FULL)` error responses after transaction write conflict retries.
2. **Unified Single-Transaction Consistency**: Capacity check & reservation, capacity increment, active membership insertion, and auditable event logging happen within the **same session-aware MongoDB transaction**. If any step fails, the entire transaction rolls back—preventing permanent orphaned capacity increments.
3. **Specific Transaction Retry Semantics**: Distinguishes `TransientTransactionError` (retry whole callback with jittered backoff) from `UnknownTransactionCommitResult` (retry only the commit command). Exhausted retries report `409 Conflict (CONCURRENCY_CONFLICT)`, never `TEAM_FULL`. Side effects (WebSockets) dispatch only after confirmed commits.
4. **Global Single-Team Invariant**: Enforced by a database-level unique compound index `{ hackathonId: 1, userId: 1 }` on `memberships`, ensuring no user can belong to more than one team within the same hackathon under any race condition.
5. **Fenced Lease Idempotency with In-Transaction Completion**: Atomic lease acquisition outside the business transaction with unique `ownerToken` fencing, 30s crash recovery, and SHA-256 payload verification. The transition to `COMPLETED` occurs inside the business transaction, guaranteeing that business mutations and the cached result commit atomically.
6. **Team Leadership Invariants**: The team leader must always be an active member. Leaders cannot leave without transferring leadership, transfers are atomic, and last-member departure disbands the team safely.
7. **Post-Commit Real-Time Synchronization (Phases 6 & 6.1)**: Authenticated Socket.IO rooms (`user:<id>`, `team:<id>`, `hackathon:<id>`) dispatch events strictly **after** transaction commit confirmation and dynamically revoke `team:<id>` access across all sockets of departed/removed users or disbanded teams. The in-memory dispatcher is best-effort (non-durable, not guaranteed exactly-once if a process crashes between commit and emit); failed/uncertain commits emit zero events, and REST resynchronization serves as recovery on reconnect.

---

## 🏗 Architecture Overview

CrewConnect is organized as an enterprise-grade **modular monolith** inside a clean TypeScript monorepo:

```
CrewConnect Monorepo
├── apps/
│   ├── api/        # Node.js + Express + TypeScript REST API & Socket.IO server
│   └── web/        # React + TypeScript + Vite + Tailwind CSS SPA
├── packages/
│   └── shared/     # Shared DTOs, Zod validation schemas, domain types, error codes
├── docs/           # Comprehensive system architecture & engineering specifications
│   └── adr/        # Architecture Decision Records (ADRs 0001 through 0009)
├── scripts/        # Database seeders, load tests (k6/autocannon), CI helper scripts
└── .github/        # GitHub Actions CI/CD workflows
```

---

## 🚀 Approved Technology Stack

| Layer                 | Technology                                | Key Justification                                                                              |
| :-------------------- | :---------------------------------------- | :--------------------------------------------------------------------------------------------- |
| **Package Manager**   | npm (>= 10.0.0)                           | Standardized package manager across environments; single root `package-lock.json`              |
| **Frontend**          | React 18+, TypeScript, Vite, Tailwind CSS | High performance, rapid iteration, strict type safety, responsive component design             |
| **Backend**           | Node.js (v20+ LTS), Express, TypeScript   | Non-blocking asynchronous I/O, enterprise modular design, type-safe API contracts              |
| **Database**          | MongoDB 7.0+ (Replica Set `rs0`)          | Multi-document ACID transactions, unique compound indexes, atomic conditional updates          |
| **Data Access Layer** | Mongoose (8.x+)                           | Primary, consistent data-access layer with session-aware transactional operations              |
| **Security / Auth**   | Argon2id + JWT in `httpOnly` cookies      | Memory-hard password hashing (RFC 9106), XSS-safe cookie-based JWT sessions                    |
| **Real-time**         | Socket.IO (WebSockets)                    | Authenticated room broadcasting strictly post-commit for live team capacity and roster updates |
| **Validation**        | Zod                                       | Runtime schema validation shared across frontend and backend packages                          |
| **Testing**           | Vitest, Supertest, Custom Load Harness    | Unit & integration testing, 50-user race verification, 100-VU discovery p95 load testing       |
| **DevOps / CI**       | Docker, Docker Compose, GitHub Actions    | Multi-container replica set orchestration, automated CI test & lint pipelines                  |

---

## 📚 Architectural & Engineering Documentation

All engineering specifications, design trade-offs, and architecture decisions are documented in depth within [`docs/`](./docs/):

1. **[Requirements Specification](./docs/requirements.md)**: Full breakdown of core functional requirements, critical non-functional invariants, and the Requirements Traceability Matrix.
2. **[System Architecture](./docs/architecture.md)**: Modular monolith architecture, module boundaries, request lifecycle, data flow, and Mermaid diagrams.
3. **[Database Design](./docs/database-design.md)**: Complete collection schemas, field specifications, compound indexes, trade-off analysis, leadership lifecycle rules, auditable event log scope, and ER diagrams.
4. **[Concurrency Architecture](./docs/concurrency-design.md)**: Deep dive into the 50-simultaneous-users scenario, two-phase lease idempotency protocol, MongoDB transaction retry semantics, and mathematical proofs.
5. **[REST API Specification](./docs/api-specification.md)**: End-to-end endpoint contracts, request/response structures, authorization tiers, and HTTP status codes.
6. **[Security Architecture](./docs/security-design.md)**: Argon2id password hashing parameters, JWT session strategy, rate limiting, invite-code hashing, CORS, and auditable event log boundaries.
7. **[Testing Strategy](./docs/testing-strategy.md)**: Vitest unit & integration suites (20+ tests), k6 concurrency benchmarks, 10k-user seeding, and latency targets.
8. **[Implementation Roadmap](./docs/implementation-roadmap.md)**: 8-phase execution plan from architecture foundation to production delivery.
9. **[Evaluator 5-Minute Demo Guide](./docs/demo-guide.md)**: Step-by-step live walkthrough verifying concurrency, idempotency, rollback safety, and real-time updates.
10. **[Architecture Decision Records (ADRs)](./docs/adr/)**: Formal ADRs 0001 through 0010 capturing context, alternatives, and trade-offs for core design decisions.

---

## 🚦 Project Phases & Status

- [x] **Phase 1: Project Foundation, Repository Initialization & System Architecture** _(Completed & Approved)_
- [x] **Phase 2: Project Scaffolding & Infrastructure** _(Completed & Approved — Monorepo, Docker Replica Set `rs0`, CI)_
- [x] **Phase 3: Core Domain Modeling & Authentication Foundation** _(Completed & Approved — Argon2id, JWT Cookies, Domain Models)_
- [x] **Phase 4: Team Lifecycle and Management** _(Completed & Approved — Invariant Enforcement, Atomic Succession, Disbandment)_
- [x] **Phase 5: Race-Proof Membership and Idempotency Engine** _(Completed & Approved — 50-Concurrent-Requests Capacity Engine)_
- [x] **Phase 5.1 & 5.2: Correctness Fixes & CI Pipeline Repair** _(Completed & Approved)_
- [x] **Phase 6 & 6.1: Real-Time Event Dispatching, Room Revocation, Challenge-Scale Load Testing & Safe Cleanup** _(Completed — Socket.IO Room Eviction, 10k-Participant / 2k-Team Dataset @ 739.7 req/sec, Discovery p95 = 165.5ms, Scoped Cleanup Safety, Evaluator Demo Guide)_
- [x] **Phase 7: Production Hardening, Performance Tuning & Deployment Verification** _(Completed — Regex injection & ReDoS neutralized, tiered rate limiting, cookie & CORS origin hardening, liveness/readiness health probes, auto-index sync on startup, multi-stage production Dockerfiles, Render blueprint & deployment guide)_
- [ ] **Phase 8: Final Submission & Evaluator Handover**

---

## 🛡️ Production Security & Hardening Controls (Phase 7)

CrewConnect enforces defense-in-depth security across every layer of the application:

1. **Authentication & Session Tokens**:
   - Argon2id password hashing (64MB memory, 3 iterations, 1 thread, 16-byte cryptographically secure random salt).
   - Dummy Argon2id timing attack mitigation on failed login attempts to prevent user enumeration.
   - JWT issued exclusively via `httpOnly`, `SameSite=Lax` cookies (no storage in `localStorage` or response bodies).
   - Atomic session revocation via `tokenVersion` counter incrementing.
2. **Mandatory Production Secrets**:
   - Development fallback secrets are rejected at startup in `NODE_ENV=production`. If `JWT_SECRET` is unset or equals the dev default, the server fails safely and refuses to start.
3. **ReDoS & MongoDB Query Injection Defense**:
   - All user-supplied search parameters and team names are sanitized via `escapeRegex()` before `$regex` evaluation, neutralizing catastrophic backtracking and syntax exceptions.
4. **Dual-Tiered Rate Limiting**:
   - General API limiter (`RATE_LIMIT_MAX_REQUESTS` per `RATE_LIMIT_WINDOW_MS`) on all `/api/v1/*` routes.
   - User-fenced join rate limiter (`JOIN_RATE_LIMIT_MAX_REQUESTS` per minute) on sensitive race endpoints (`/teams/:id/join`, `/invitations/accept`, `/join-requests`).
5. **CSRF & CORS Hardening**:
   - OWASP Origin and Referer validation on all cookie-authenticated state-changing requests.
   - Environment-aware CORS configuration restricting origins to `CLIENT_URL` in production.
6. **Container Liveness & Readiness Probes**:
   - `GET /health/live`: Fast process liveness check for orchestrator restarts.
   - `GET /health/ready`: Deep container readiness check validating database connectivity and replica set election state.
7. **Automatic Database Index Synchronization**:
   - `syncAllIndexes()` executes upon server startup, automatically verifying all unique, compound sort, and TTL indexes before traffic is served.

---

## 🏃 Quickstart & Local Development

### 1. Start MongoDB Replica Set

```bash
docker compose up -d
npx tsx scripts/verify-replica-set.ts
```

### 2. Install Dependencies & Build Packages

```bash
npm install
npm run build:shared
```

### 3. Start Local Development Servers

```bash
npm run dev
```

- Frontend Web App: [http://localhost:5173](http://localhost:5173)
- Backend REST API: [http://localhost:5000/api/v1](http://localhost:5000/api/v1)
- Health Check: [http://localhost:5000/health](http://localhost:5000/health)

---

## 🚢 Production Deployment

For complete multi-provider cloud guides (Render, Railway, AWS ECS, Self-Hosted Docker), see **[`docs/deployment.md`](./docs/deployment.md)**.

### Running Production Stack Locally via Docker Compose

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## ⚠️ Known Limitations & Best-Effort Semantics

1. **In-Memory Event Dispatcher (Best-Effort Delivery)**: Socket.IO events are dispatched strictly after MongoDB transaction commits. If a node process terminates after the commit but before network socket emit, events are not resent. Clients use REST resynchronization (`wasDisconnectedRef` in `useSocket`) upon reconnection.
2. **Single-Node Rate Limiter**: The in-memory rate limiter tracks timestamps in process memory. For horizontally scaled multi-instance deployments behind a load balancer, a Redis-backed token bucket (e.g., `rate-limiter-flexible`) can be connected without altering route handlers.

---

## 📊 Verified Challenge-Scale Load & Concurrency Benchmarks (`scripts/run-load-test.ts`)

| Benchmark Scenario                                                            | Load Profile                                                  | Measured Result                                                                                                                         |
| :---------------------------------------------------------------------------- | :------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------- |
| **Team Discovery API** (`GET /api/v1/hackathons/:id/teams?hasVacancies=true`) | 100 concurrent clients, 500 queries (2,000 teams / 10k users) | **739.7 req/s**, p50 `121.9 ms`, **p95 `165.5 ms`** (`< 200 ms` SLA achieved), p99 `192.3 ms`, `0` failed requests (`0.00%` error rate) |
| **50-Way Last-Seat Race** (`POST /api/v1/teams/:id/join`, `4/5 -> 5/5`)       | 50 simultaneous contenders + 6 live WebSocket room listeners  | `336.8 ms` total; exactly **1** `201 Created`, **49** `409 Conflict`, **0** `5xx`, `5/5` DB count, exact post-commit Socket.IO dispatch |
