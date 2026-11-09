# CrewConnect

> **Production-grade hackathon team formation platform with strict race-proof concurrency guarantees.**  
> Built for the **Hack4Hack Crew Hiring Challenge 2026 — Problem Statement 1: Race-proof Team Formation**.

---

## 🎯 Executive Summary & Problem Statement

Hackathon team formation is notoriously prone to concurrency race conditions when registration windows open or team discovery boards get flooded with thousands of active participants. 

### The Core Challenge (PS1)
Consider a team with **4 members** and a maximum capacity of **5**. Suppose **50 users** simultaneously click "Join Team" or submit an invitation code within the exact same millisecond window.

**CrewConnect guarantees:**
1. **Strict Seat Invariant**: Exactly **one** user claims the final seat (5/5). The remaining 49 requests fail gracefully with descriptive, typed error responses.
2. **Global Single-Team Invariant**: No user can belong to more than one team within the same hackathon under any race condition (e.g., accepting two invites concurrently).
3. **Capacity & Counter Consistency**: The cached `memberCount` on the team document is guaranteed to strictly equal the count of committed active membership records in the database.
4. **Idempotency**: Retrying network requests with identical idempotency keys produces identical, safe responses without duplicate state mutations.
5. **Real-Time Consistency**: Team members and prospective applicants receive sub-second WebSocket updates reflecting the exact committed state.

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
├── scripts/        # Database seeders, load tests (k6/autocannon), CI helper scripts
└── .github/        # GitHub Actions CI/CD workflows
```

---

## 🚀 Technology Stack

| Layer | Technology | Key Justification |
| :--- | :--- | :--- |
| **Frontend** | React 18+, TypeScript, Vite, Tailwind CSS | High performance, rapid iteration, strict type safety, responsive component design |
| **Backend** | Node.js (v20+ LTS), Express, TypeScript | Non-blocking asynchronous I/O, enterprise modular design, type-safe API contracts |
| **Database** | MongoDB 7.0+ (Replica Set) | Atomic conditional updates (`$inc` with `$lt`), unique compound indexes, multi-document transactions |
| **Real-time** | Socket.IO (WebSockets) | Bi-directional event broadcasting for team capacity changes and join request decisions |
| **Validation** | Zod | Runtime schema validation shared across frontend and backend packages |
| **Testing** | Vitest, Supertest, k6 / autocannon | Fast unit & integration testing, robust 50-user race condition verification & 10k seed load testing |
| **DevOps / CI** | Docker, Docker Compose, GitHub Actions | Multi-container replica set orchestration, automated CI test & lint pipelines |

> **Crucial MongoDB Requirement**: Multi-document transactions require a MongoDB replica set (`rs0`). CrewConnect's Docker Compose environment spins up a single-node replica set automatically for local development and CI testing.

---

## 📚 Architectural & Engineering Documentation

All engineering specifications, design trade-offs, and architecture decisions are documented in depth within [`docs/`](./docs/):

1. **[Requirements Specification](./docs/requirements.md)**: Full breakdown of core functional requirements, critical non-functional invariants, and the Requirements Traceability Matrix.
2. **[System Architecture](./docs/architecture.md)**: Modular monolith architecture, module boundaries, request lifecycle, data flow, and Mermaid diagrams.
3. **[Database Design](./docs/database-design.md)**: Complete collection schemas, field specifications, compound indexes, trade-off analysis (dedicated memberships collection vs. embedded arrays), and ER diagrams.
4. **[Concurrency Architecture](./docs/concurrency-design.md)**: Deep dive into the 50-simultaneous-users scenario, atomic conditional reservations, multi-document transactions, write conflict retries, and idempotency guarantees.
5. **[REST API Specification](./docs/api-specification.md)**: End-to-end endpoint contracts, request/response structures, authorization tiers, and HTTP status codes.
6. **[Security Architecture](./docs/security-design.md)**: Password hashing (Argon2id/bcrypt), JWT session strategy, rate limiting, invite-code hashing, CORS, and audit logging.
7. **[Testing Strategy](./docs/testing-strategy.md)**: Vitest unit & integration suites, k6 concurrency benchmarks, 10k-user seeding, and latency targets.
8. **[Implementation Roadmap](./docs/implementation-roadmap.md)**: 8-phase execution plan from architecture foundation to production delivery.
9. **[Architecture Decision Records (ADRs)](./docs/adr/)**: Formal ADRs capturing context, alternatives, and trade-offs for core design decisions.

---

## 🚦 Project Phases & Status

- [x] **Phase 1: Project Foundation, Repository Initialization & System Architecture** *(Current Phase — Complete)*
- [ ] **Phase 2: Project Scaffolding & Infrastructure** *(Pending Approval)*
- [ ] **Phase 3: Database & Authentication**
- [ ] **Phase 4: Core Team Management**
- [ ] **Phase 5: Race-Proof Membership & Idempotency**
- [ ] **Phase 6: Frontend & Real-Time Functionality**
- [ ] **Phase 7: Testing, Performance & Deployment**
- [ ] **Phase 8: Documentation & Final Submission**

---

## 🛡 Standards & Invariants

- **TypeScript Strict Mode**: Zero unchecked `any` across the entire codebase.
- **Fail Fast & Loud**: Typed domain errors with structured HTTP envelopes (`{ error: { code, message, details } }`).
- **Zero Secret Leakage**: Strict environment variable hygiene and automated scanning.
- **Race-Proof Guarantees**: Strict mathematical verification and automated stress testing for all mutating operations.
