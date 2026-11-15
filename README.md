# CrewConnect

> **Production-grade hackathon team formation platform with strict race-proof concurrency guarantees.**  
> Built for the **Hack4Hack Crew Hiring Challenge 2026 — Problem Statement 1: Race-Proof Team Formation**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x%20LTS-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg)](https://react.dev/)
[![MongoDB](<https://img.shields.io/badge/MongoDB-7.0%2B%20(rs0)-47A248.svg>)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7%2B-black.svg)](https://socket.io/)
[![Tests](<https://img.shields.io/badge/Tests-475%20Passed%20(44%20Files)-brightgreen.svg>)](./README.md#-testing--verification-matrix)
[![Render](https://img.shields.io/badge/Deploy-Render%20Live-46E3B7.svg)](https://crewconnect-api-29qw.onrender.com/health)

---

## 🌐 Live Production Deployment

CrewConnect is deployed and running live in production on Render backed by a MongoDB Atlas multi-node replica set:

| Service / Resource        | Production URL                                                                                                                                                        | Status / Notes                                           |
| :------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| **REST API Base**         | [`https://crewconnect-api-29qw.onrender.com/api/v1`](https://crewconnect-api-29qw.onrender.com/api/v1)                                                                | Express + Node 20 LTS API                                |
| **Deep Readiness Probe**  | [`https://crewconnect-api-29qw.onrender.com/health`](https://crewconnect-api-29qw.onrender.com/health)                                                                | Evaluates DB connectivity & replica set writable primary |
| **Active Hackathons**     | [`https://crewconnect-api-29qw.onrender.com/api/v1/hackathons`](https://crewconnect-api-29qw.onrender.com/api/v1/hackathons)                                          | Official `Hack4Hack 2026 — Crew Hiring Challenge`        |
| **Demo Squads Directory** | [`https://crewconnect-api-29qw.onrender.com/api/v1/hackathons/:id/teams`](https://crewconnect-api-29qw.onrender.com/api/v1/hackathons/6af8dd4efbb0b5ac7280b86e/teams) | Pre-seeded with verified demo squads & open seats        |

---

## 🎯 Executive Summary & Problem Statement (PS1)

Hackathon team formation is notoriously vulnerable to concurrency race conditions when registration windows open or discovery boards get flooded with thousands of active participants.

### The Core Challenge

Consider a team with **4 members** and a maximum capacity of **5**. Suppose **50 users** simultaneously click "Join Team" or submit an invitation code within the exact same millisecond window.

**CrewConnect guarantees:**

1. **Strict Seat Invariant**: Exactly **one** user claims the final seat (4/5 → 5/5). The remaining 49 requests fail cleanly with typed `409 Conflict (TEAM_FULL)` error responses after transaction write conflict retries. Zero oversubscription under all conditions.
2. **Unified Single-Transaction Consistency**: Capacity check, reservation, increment, active membership insertion, and auditable event logging happen within the **same session-aware MongoDB transaction**. Any failure triggers an automatic rollback—preventing orphaned capacity increments.
3. **Specific Transaction Retry Semantics**: Distinguishes `TransientTransactionError` (retries callback with jittered backoff) from `UnknownTransactionCommitResult` (retries only the commit command). Exhausted retries report `409 Conflict (CONCURRENCY_CONFLICT)`. Side effects (WebSockets) dispatch only after confirmed commits.
4. **Global Single-Team Invariant**: Enforced by a database-level unique compound index `{ hackathonId: 1, userId: 1 }` on `memberships`, ensuring no participant can belong to more than one team within the same hackathon under any race condition.
5. **Fenced Lease Idempotency with In-Transaction Completion**: Atomic lease acquisition outside the business transaction with unique `ownerToken` fencing, 30-second crash recovery, and SHA-256 payload verification. Atomic state transition to `COMPLETED` guarantees idempotency without duplicate executions.
6. **Team Leadership Invariants**: The team leader must always be an active member. Leaders cannot leave without transferring leadership, transfers are atomic, and last-member departure disbands the team safely.
7. **Post-Commit Real-Time Synchronization**: Authenticated Socket.IO rooms (`user:<id>`, `team:<id>`, `hackathon:<id>`) dispatch events strictly **after** transaction commit confirmation and dynamically revoke `team:<id>` access across all sockets of departed/removed users or disbanded teams.

---

## ✨ Key Platform Features & Recent Updates

### 🚀 Auto-Seeded Demo Environment (`Hack4Hack 2026`)

- **Self-Initializing Database**: On server startup, `ensureDefaultHackathonAndDemoData()` verifies the database state. If empty, it automatically provisions the official `Hack4Hack 2026 — Crew Hiring Challenge` hackathon and 3 realistic demo squads:
  - **Atlas Consensus** (Leader: Alex Chen, 1/4 members, skills: _Rust, Distributed Systems, Solidity, TypeScript_)
  - **VectorForge** (Leader: Sarah Lin, 1/5 members, skills: _Python, PyTorch, React, CUDA, FastAPI_)
  - **Hyperion Labs** (Leader: Marcus Vance, 1/4 members, skills: _Go, WebRTC, TypeScript, UI/UX Design, Docker_)
- **On-Demand Seeding**: Triggerable via `POST /api/v1/hackathons/seed-demo` or locally with `npm run seed:demo`.

### 🧭 Route Separation & Navigation Architecture

- **Dedicated Public Landing (`/`)**: High-converting hero page accessible to all visitors (logged in or logged out), highlighting live platform statistics, system invariants, and demo walkthroughs.
- **Dedicated Authenticated Dashboard (`/dashboard`)**: Protected user hub with auto-redirection for unauthenticated users that preserves return destinations after login.
- **Context-Aware Navbar**:
  - _Logged Out_: Clean public navigation displaying Sign In and Register actions.
  - _Logged In_: The user's name and profile avatar act as the direct navigation trigger to `/dashboard`, removing redundant tabs while keeping the CrewConnect brand emblem linking to `/`.

### 🎨 Visual Identity, Motion & UX Refinements

- **Seamless Page Transitions**: Hardware-accelerated, fluid route transitions across all views (subtle 12px vertical slide + fade, 250–350ms duration, natural cubic-bezier easing).
- **Global Scroll Progress Indicator**: Slim, non-intrusive progress bar tracking viewport scroll depth alongside customized theme-matched scrollbars.
- **Interactive Security Companion Avatar**: A delightful, security-conscious avatar companion during authentication. It activates upon initial keystroke, remains in watching mode while the password field stays focused (even when typing pauses or text is cleared), and smoothly resets on blur.
- **Official Geometric Brand Icon**: Custom SVG emblem featuring a three-figure collaboration silhouette framed by an orbital connection sweep, crafted in deep architectural pine (`#115E59`) and warm alabaster.
- **Redesigned Team Creation Modal**: Fully accessible modal supporting quick capacity presets, tag chips with common suggestions, and automatic competition pre-selection.

### 🧠 Teammate & Squad Recommendation Engine

- **Algorithmic Matching**: Calculates compatibility scores based on skill overlap (Jaccard similarity), timezone alignment, and squad vacancy demand.
- **Integrated Workspace Tabs**: Squad leaders can review recommended teammates with transparent scoring breakdowns directly within the team workspace.

---

## 🏗 Architecture & Monorepo Structure

CrewConnect is organized as an enterprise-grade **modular monolith** in a clean TypeScript monorepo:

```
CrewConnect Monorepo
├── apps/
│   ├── api/                   # Node.js + Express + TypeScript REST API & Socket.IO server
│   │   ├── src/
│   │   │   ├── config/        # Strict Zod environment configuration
│   │   │   ├── db/            # MongoDB connection & replica-set transaction manager
│   │   │   ├── middleware/    # Auth, rate limiting, request validation, CORS, error handling
│   │   │   ├── models/        # Mongoose domain models & compound index definitions
│   │   │   ├── realtime/      # Socket.IO room management & post-commit event dispatcher
│   │   │   ├── routes/        # Typed Express route controllers
│   │   │   └── services/      # Core transactional services (Team, Idempotency, Recommendations, DemoSeed)
│   │   └── tests/             # 22+ API unit, integration, race, and benchmark test suites
│   └── web/                   # React 18 + TypeScript + Vite + Tailwind CSS SPA
│       ├── src/
│       │   ├── components/    # Reusable UI components (Dialogs, Modals, Navbar, PasswordCompanion)
│       │   ├── context/       # Auth and Socket context providers
│       │   ├── pages/         # Landing, Dashboard, Teams Directory, Workspace, Profile, Auth
│       │   └── lib/           # Typed API client & real-time hooks
│       └── tests/             # 17+ React Testing Library component and integration suites
├── packages/
│   └── shared/                # Shared domain schemas, Zod DTOs, error types, and constants
├── docs/                      # Architectural specifications & decision records (ADRs 0001–0010)
├── scripts/                   # Seeding scripts, replica-set verifiers, and load test harnesses
└── docker-compose.yml         # Local 3-node MongoDB replica set (rs0) environment
```

---

## 🚀 Approved Technology Stack

| Layer                 | Technology                               | Key Justification                                                                         |
| :-------------------- | :--------------------------------------- | :---------------------------------------------------------------------------------------- |
| **Package Manager**   | npm (>= 10.0.0)                          | Standardized workspaces monorepo; single root `package-lock.json`                         |
| **Frontend**          | React 18, TypeScript, Vite, Tailwind CSS | High performance, rapid iteration, strict type safety, responsive component design        |
| **Backend**           | Node.js (v20+ LTS), Express, TypeScript  | Non-blocking asynchronous I/O, enterprise modular design, type-safe API contracts         |
| **Database**          | MongoDB 7.0+ (Replica Set `rs0` / Atlas) | Multi-document ACID transactions, unique compound indexes, atomic conditional updates     |
| **Data Access Layer** | Mongoose (8.x+)                          | Session-aware transactional operations with automated index synchronization               |
| **Security & Auth**   | Argon2id + JWT in `httpOnly` cookies     | Memory-hard password hashing (RFC 9106), XSS-safe cookie sessions, CSRF validation        |
| **Real-time**         | Socket.IO (WebSockets)                   | Authenticated room broadcasting strictly post-commit for live capacity and roster updates |
| **Validation**        | Zod                                      | Runtime schema validation shared across frontend and backend packages                     |
| **Testing**           | Vitest, Supertest, Testing Library       | Unit & integration testing, 50-user race verification, 100-VU discovery p95 load testing  |
| **DevOps & Hosting**  | Render, Docker, GitHub Actions           | Automated multi-stage Docker builds, continuous deployment, and CI pipelines              |

---

## 🛡️ Production Security & Hardening Controls

1. **Authentication & Session Tokens**:
   - Argon2id password hashing (64MB memory, 3 iterations, 1 thread, 16-byte cryptographically secure random salt).
   - Dummy Argon2id timing attack mitigation on failed login attempts to prevent user enumeration.
   - JWT issued exclusively via `httpOnly`, `SameSite=Lax` cookies (no storage in `localStorage`).
   - Atomic session revocation via `tokenVersion` counter incrementing.
2. **Mandatory Production Secrets & Fail-Closed Guardrails**:
   - Development fallback secrets are rejected at startup in `NODE_ENV=production`. If `JWT_SECRET` is unset or equals the default, the server fails safely and halts.
   - `docker-compose.prod.yml` enforces fail-closed variable interpolation (`${JWT_SECRET:?...}` and `${CLIENT_URL:?...}`).
3. **Internal Network Isolation**:
   - In production Docker Compose, MongoDB and Express API run without published host ports, strictly bound to the internal bridge. External traffic reaches the platform exclusively through NGINX.
4. **Production Rate Limiting & Bypass Protection**:
   - General API limiter on all `/api/v1/*` routes.
   - User-fenced join rate limiter on sensitive race endpoints (`/teams/:id/join`, `/invitations/accept`, `/join-requests`).
   - Benchmark headers (`x-benchmark-bypass`) are strictly ignored in production (`NODE_ENV=production`).
5. **ReDoS & Injection Defense**:
   - User-supplied search queries are sanitized via `escapeRegex()` before `$regex` evaluation, neutralizing catastrophic backtracking.
   - Express body size strictly bounded to `1mb` (`express.json({ limit: "1mb" })`).
6. **Container Liveness & Readiness Probes**:
   - `GET /health/live`: Fast process liveness check for orchestrator restarts.
   - `GET /health/ready` / `GET /health`: Deep container readiness probe evaluating MongoDB topology via unprivileged `hello` command. Verifies replica set `rs0` / Atlas primary and returns HTTP 503 if standalone or non-writable.
7. **Startup Reliability & Index Synchronization**:
   - `initializeDatabaseAndIndexes()` executes bounded retries with exponential backoff and jitter before `server.listen()`. Asserts database readiness and synchronizes all indexes before traffic is served.

---

## 🧪 Testing & Verification Matrix

CrewConnect maintains a comprehensive, zero-regression test suite covering domain invariants, race conditions, and UI interactions:

| Verification Suite       | Target                            |  Status  |         Passing Tests          |
| :----------------------- | :-------------------------------- | :------: | :----------------------------: |
| **Backend API Suites**   | `apps/api/tests/*.test.ts`        | **PASS** |    **347 tests (27 files)**    |
| **Frontend Web Suites**  | `apps/web/tests/*.test.tsx`       | **PASS** |    **123 tests (16 files)**    |
| **Shared Package Tests** | `packages/shared/tests/*.test.ts` | **PASS** |      **5 tests (1 file)**      |
| **Total Monorepo Tests** | **All Workspaces**                | **PASS** | **475 passed (44 test files)** |

### Verified Challenge-Scale Load & Concurrency Benchmarks

| Benchmark Scenario                                                            | Load Profile                                                  | Measured Result                                                                                                                         |
| :---------------------------------------------------------------------------- | :------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------- |
| **50-Way Last-Seat Race** (`POST /api/v1/teams/:id/join`, `4/5 -> 5/5`)       | 50 simultaneous contenders + 6 live WebSocket room listeners  | `336.8 ms` total; exactly **1** `201 Created`, **49** `409 Conflict`, **0** `5xx`, `5/5` DB count, exact post-commit Socket.IO dispatch |
| **Team Discovery API** (`GET /api/v1/hackathons/:id/teams?hasVacancies=true`) | 100 concurrent clients, 500 queries (2,000 teams / 10k users) | **739.7 req/s**, p50 `121.9 ms`, **p95 `165.5 ms`** (`< 200 ms` SLA achieved), p99 `192.3 ms`, `0` failed requests (`0.00%` error rate) |

---

## 🏃 Quickstart & Local Development

### Prerequisites

- Node.js >= 20.11.0 LTS
- npm >= 10.0.0
- Docker & Docker Compose (for local replica set `rs0`)

### 1. Start MongoDB Replica Set

```bash
# Start 3-node local replica set
docker compose up -d

# Verify replica set initialization (rs0)
npx tsx scripts/verify-replica-set.ts
```

### 2. Install Dependencies & Build Packages

```bash
npm install
npm run build:shared
```

### 3. Seed Demo Data (Optional)

```bash
# Populates Hack4Hack 2026 and sample squads
npm run seed:demo
```

### 4. Start Local Development Servers

```bash
npm run dev
```

- **Frontend Web Application**: [http://localhost:5173](http://localhost:5173)
- **Backend REST API**: [http://localhost:5000/api/v1](http://localhost:5000/api/v1)
- **API Health Check**: [http://localhost:5000/health](http://localhost:5000/health)
- **Prometheus Metrics**: [http://localhost:5000/metrics](http://localhost:5000/metrics)

---

## 📋 Available Monorepo Scripts

| Command              | Description                                                              |
| :------------------- | :----------------------------------------------------------------------- |
| `npm run dev`        | Starts both backend API and frontend Vite dev servers concurrently       |
| `npm run dev:api`    | Starts backend API dev server with `tsx watch` hot-reload                |
| `npm run dev:web`    | Starts frontend Vite dev server                                          |
| `npm run build`      | Builds shared package, API TypeScript bundle, and Vite production bundle |
| `npm run typecheck`  | Runs TypeScript compiler checks across all workspaces                    |
| `npm run lint`       | Runs ESLint across TypeScript and React code                             |
| `npm run test`       | Runs the full Vitest test suite (387 tests)                              |
| `npm run seed:demo`  | Seeds or verifies the default demo hackathon and sample squads           |
| `npm run format`     | Verifies Prettier code style formatting                                  |
| `npm run format:fix` | Automatically formats all codebase files with Prettier                   |

---

## 📚 Architectural & Engineering Documentation

All engineering specifications, design trade-offs, and architecture decisions are documented in depth within the repository and [`docs/`](./docs/):

1. **[Design Document (1-Page Architecture Summary)](./DESIGN_DOCUMENT.md)**: Authoritative executive architecture specification, domain invariants, concurrency model, and core guarantees for Hack4Hack PS1 evaluators.
2. **[Load-Test & Concurrency Benchmark Report](./LOAD_TEST_REPORT.md)**: Empirical 10,000-user / 2,000-team load tests, sub-200ms p95 discovery latency, and 50-way last-seat race results.
3. **[Requirements Specification](./docs/requirements.md)**: Full breakdown of core functional requirements, critical non-functional invariants, and the Requirements Traceability Matrix.
4. **[System Architecture](./docs/architecture.md)**: Modular monolith architecture, module boundaries, request lifecycle, data flow, and Mermaid diagrams.
5. **[Database Design](./docs/database-design.md)**: Complete collection schemas, field specifications, compound indexes, trade-off analysis, leadership lifecycle rules, auditable event log scope, and ER diagrams.
6. **[Concurrency Architecture](./docs/concurrency-design.md)**: Deep dive into the 50-simultaneous-users scenario, two-phase lease idempotency protocol, MongoDB transaction retry semantics, and mathematical proofs.
7. **[REST API Specification](./docs/api-specification.md)**: End-to-end endpoint contracts, request/response structures, authorization tiers, and HTTP status codes.
8. **[Security Architecture](./docs/security-design.md)**: Argon2id password hashing parameters, JWT session strategy, rate limiting, invite-code hashing, CORS, and auditable event log boundaries.
9. **[Testing Strategy](./docs/testing-strategy.md)**: Vitest unit & integration suites, k6 concurrency benchmarks, 10k-user seeding, and latency targets.
10. **[Implementation Roadmap](./docs/implementation-roadmap.md)**: 8-phase execution plan from architecture foundation to production delivery.
11. **[Evaluator 5-Minute Demo Guide](./docs/demo-guide.md)**: Step-by-step live walkthrough verifying concurrency, idempotency, rollback safety, and real-time updates.
12. **[Deployment Architecture](./docs/deployment.md)**: Multi-provider production deployment guide covering Render, Railway, AWS ECS, and Docker.
13. **[Architecture Decision Records (ADRs)](./docs/adr/)**: Formal ADRs 0001 through 0010 capturing context, alternatives, and trade-offs for core design decisions.

---

## ⚖️ License

Distributed under the MIT License. Built for the **Hack4Hack Crew Hiring Challenge 2026**.
