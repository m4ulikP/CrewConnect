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
2. **Unified Single-Transaction Consistency**: Capacity check & reservation, capacity increment, active membership insertion, audit logging, and idempotency persistence happen within the **same session-aware MongoDB transaction**. If any step fails, the entire transaction rolls back—preventing permanent orphaned capacity increments.
3. **Global Single-Team Invariant**: Enforced by a database-level unique compound index `{ hackathonId: 1, userId: 1 }` on `memberships`, ensuring no user can belong to more than one team within the same hackathon under any race condition.
4. **Idempotency with In-Flight Locking**: Scoped by `{ key, userId, endpoint }` with SHA-256 request payload verification; in-flight requests lock duplicate executions, while retries return cached responses.
5. **Team Leadership Invariants**: The team leader must always be an active member. Leaders cannot leave without transferring leadership, transfers are atomic, and last-member departure disbands the team.
6. **Real-Time Consistency**: Team members receive sub-second Socket.IO WebSocket updates reflecting the exact committed state.

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

| Layer | Technology | Key Justification |
| :--- | :--- | :--- |
| **Package Manager** | npm (>= 10.0.0) | Standardized package manager across environments; single root `package-lock.json` |
| **Frontend** | React 18+, TypeScript, Vite, Tailwind CSS | High performance, rapid iteration, strict type safety, responsive component design |
| **Backend** | Node.js (v20+ LTS), Express, TypeScript | Non-blocking asynchronous I/O, enterprise modular design, type-safe API contracts |
| **Database** | MongoDB 7.0+ (Replica Set `rs0`) | Multi-document ACID transactions, unique compound indexes, atomic conditional updates |
| **Data Access Layer** | Mongoose (8.x+) | Primary, consistent data-access layer with session-aware transactional operations |
| **Security / Auth** | Argon2id + JWT in `httpOnly` cookies | Memory-hard password hashing (RFC 9106), XSS-safe cookie-based JWT sessions |
| **Real-time** | Socket.IO (WebSockets) | Bi-directional event broadcasting for team capacity changes and join request decisions |
| **Validation** | Zod | Runtime schema validation shared across frontend and backend packages |
| **Testing** | Vitest, Supertest, k6 / autocannon | Fast unit & integration testing, robust 50-user race condition verification & 10k seed load testing |
| **DevOps / CI** | Docker, Docker Compose, GitHub Actions | Multi-container replica set orchestration, automated CI test & lint pipelines |

---

## 📚 Architectural & Engineering Documentation

All engineering specifications, design trade-offs, and architecture decisions are documented in depth within [`docs/`](./docs/):

1. **[Requirements Specification](./docs/requirements.md)**: Full breakdown of core functional requirements, critical non-functional invariants, and the Requirements Traceability Matrix.
2. **[System Architecture](./docs/architecture.md)**: Modular monolith architecture, module boundaries, request lifecycle, data flow, and Mermaid diagrams.
3. **[Database Design](./docs/database-design.md)**: Complete collection schemas, field specifications, compound indexes, trade-off analysis, leadership lifecycle rules, and ER diagrams.
4. **[Concurrency Architecture](./docs/concurrency-design.md)**: Deep dive into the 50-simultaneous-users scenario, unified Mongoose transaction engine, WiredTiger write conflict retry mechanics, and mathematical proofs.
5. **[REST API Specification](./docs/api-specification.md)**: End-to-end endpoint contracts, request/response structures, authorization tiers, and HTTP status codes.
6. **[Security Architecture](./docs/security-design.md)**: Argon2id password hashing parameters, JWT session strategy, rate limiting, invite-code hashing, CORS, and audit logging.
7. **[Testing Strategy](./docs/testing-strategy.md)**: Vitest unit & integration suites (20+ tests), k6 concurrency benchmarks, 10k-user seeding, and latency targets.
8. **[Implementation Roadmap](./docs/implementation-roadmap.md)**: 8-phase execution plan from architecture foundation to production delivery.
9. **[Architecture Decision Records (ADRs)](./docs/adr/)**: Formal ADRs 0001 through 0009 capturing context, alternatives, and trade-offs for core design decisions.

---

## 🚦 Project Phases & Status

- [x] **Phase 1: Project Foundation, Repository Initialization & System Architecture** *(Current Phase — Finalized & Clarified)*
- [ ] **Phase 2: Project Scaffolding & Infrastructure** *(Pending Approval)*
- [ ] **Phase 3: Database & Authentication**
- [ ] **Phase 4: Core Team Management**
- [ ] **Phase 5: Race-Proof Membership & Idempotency**
- [ ] **Phase 6: Frontend & Real-Time Functionality**
- [ ] **Phase 7: Testing, Performance & Deployment**
- [ ] **Phase 8: Documentation & Final Submission**
