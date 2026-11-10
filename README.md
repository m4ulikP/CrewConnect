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
7. **Post-Commit Real-Time Synchronization (Phase 6)**: Authenticated Socket.IO rooms (`user:<id>`, `team:<id>`, `hackathon:<id>`) dispatch events strictly after transaction commit confirmation, ensuring clients observe only confirmed database states without dirty reads, duplicate retries, or phantom notifications.

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
- [x] **Phase 6: Real-Time Event Dispatching, Load Testing and Demo Preparation** _(Completed — Socket.IO Server/Client, Discovery API p95 = 164.3ms @ 759.8 req/sec under 100 concurrent clients, 50-Way Last-Seat Race, Evaluator Demo Guide)_
- [ ] **Phase 7: Production Hardening, Performance Tuning & Deployment Verification**
- [ ] **Phase 8: Final Submission & Evaluator Handover**

---

## 📊 Verified Phase 6 Load & Concurrency Benchmarks (`scripts/run-load-test.ts`)

| Benchmark Scenario                                                            | Load Profile                                                 | Measured Result                                                                                                                         |
| :---------------------------------------------------------------------------- | :----------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| **Team Discovery API** (`GET /api/v1/hackathons/:id/teams?hasVacancies=true`) | 100 concurrent clients, 500 queries over 1,000 teams         | **759.8 req/s**, p50 `123.9 ms`, p95 **`164.3 ms`** (< 200 ms SLA), `0` failed requests                                                 |
| **50-Way Last-Seat Race** (`POST /api/v1/teams/:id/join`, `4/5 -> 5/5`)       | 50 simultaneous contenders + 6 live WebSocket room listeners | `333.2 ms` total; exactly **1** `201 Created`, **49** `409 Conflict`, **0** `5xx`, `5/5` DB count, exact post-commit Socket.IO dispatch |
