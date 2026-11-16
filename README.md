# CrewConnect

> **Production-grade hackathon team formation platform with strict race-proof concurrency guarantees.**  
> Built for the **Hack4Hack Crew Hiring Challenge 2026 — Problem Statement 1: Race-Proof Team Formation**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x%20LTS-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg)](https://react.dev/)
[![MongoDB](<https://img.shields.io/badge/MongoDB-7.0%2B%20(rs0)-47A248.svg>)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7%2B-black.svg)](https://socket.io/)
[![Tests](<https://img.shields.io/badge/Tests-475%20Passed%20(44%20Files)-brightgreen.svg>)](#testing--verification-matrix)
[![Render](https://img.shields.io/badge/Deploy-Render%20Live-46E3B7.svg)](https://crewconnect-api-29qw.onrender.com/health)

---

## Live Production Deployment

CrewConnect is deployed and running live in production on Render backed by a managed MongoDB Atlas replica set:

| Service / Resource        | Production URL                                                                                                                                                        | Description                                       |
| :------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------ |
| **Web Application**       | [`https://crewconnect-web.onrender.com`](https://crewconnect-web.onrender.com)                                                                                        | React 18 SPA production deployment                |
| **REST API Base**         | [`https://crewconnect-api-29qw.onrender.com/api/v1`](https://crewconnect-api-29qw.onrender.com/api/v1)                                                                | Express REST API on Node.js 20 LTS                |
| **Deep Readiness Probe**  | [`https://crewconnect-api-29qw.onrender.com/health`](https://crewconnect-api-29qw.onrender.com/health)                                                                | Evaluates DB connectivity & replica set primary   |
| **Active Hackathons**     | [`https://crewconnect-api-29qw.onrender.com/api/v1/hackathons`](https://crewconnect-api-29qw.onrender.com/api/v1/hackathons)                                          | Official `Hack4Hack 2026 — Crew Hiring Challenge` |
| **Demo Squads Directory** | [`https://crewconnect-api-29qw.onrender.com/api/v1/hackathons/:id/teams`](https://crewconnect-api-29qw.onrender.com/api/v1/hackathons/6af8dd4efbb0b5ac7280b86e/teams) | Pre-seeded with verified demo squads & open seats |
| **Prometheus Metrics**    | [`https://crewconnect-api-29qw.onrender.com/metrics`](https://crewconnect-api-29qw.onrender.com/metrics)                                                              | Live telemetry & Prometheus metrics exporter      |

---

## Problem Statement & Core Guarantees

Hackathon team formation experiences extreme contention when registration opens or matchmaking deadlines approach. When $N$ participants simultaneously compete for the final vacancy in a squad ($4/5 \to 5/5$), systems without strict concurrency controls suffer from capacity over-allocation, orphaned counters, duplicate memberships, and phantom notifications.

CrewConnect guarantees four core invariants under extreme concurrency:

1. **Race-Proof Seat Allocation**: When multiple contenders simultaneously attempt to claim the final seat in a team, exactly one user succeeds (`201 Created`). All remaining contenders receive clean, typed `409 Conflict` responses (`TEAM_FULL` or `CONCURRENCY_CONFLICT`). Team capacity strictly caps at `maxCapacity`.
2. **Atomic Transaction Consistency**: Seat reservation, capacity counter updates, membership record creation, and audit logging execute within the same session-aware MongoDB ACID transaction. Any failure triggers a complete rollback with zero orphaned writes.
3. **Global Single-Team Membership**: Enforced via a database-level partial compound unique index (`{ hackathonId: 1, userId: 1, status: "active" }`), ensuring no user can hold active membership in multiple squads within the same hackathon under any race condition.
4. **Post-Commit Real-Time Synchronization**: Authenticated Socket.IO events (`team:member_joined`, `team:capacity_updated`) dispatch strictly **after** transaction commit confirmation to the replica set, preventing phantom real-time events from aborted attempts.

For detailed proofs and retry algorithms, see [Concurrency Architecture](docs/concurrency-design.md) and [System Architecture](docs/architecture.md).

---

## Key Platform Features

- **Auto-Seeded Demo Environment**: On a fresh database, the server automatically provisions the official `Hack4Hack 2026 — Crew Hiring Challenge` hackathon and three realistic demo squads (`Atlas Consensus`, `VectorForge`, and `Hyperion Labs`) with open vacancies. Demo squads can also be seeded on demand via `POST /api/v1/hackathons/seed-demo` or locally with `npm run seed:demo`.
- **Teammate Recommendation Engine**: Algorithmic matching based on skill complementarity (Jaccard similarity), pairwise timezone working-hour overlap, and squad vacancy demand, accessible directly within team workspaces.
- **Route Separation & Navigation**: Clear separation between the public landing view (`/`), team discovery directory (`/teams-preview`), authenticated dashboard (`/dashboard`), and squad workspace (`/teams/:id/manage`), with context-aware navigation and responsive layout.
- **Accessible Team Management Modals**: Redesigned modal workflows for team creation, member invitations, leadership transfers, and join requests with keyboard navigation, ARIA semantics, and responsive design.
- **Comprehensive Security Architecture**:
  - Memory-hard **Argon2id** password hashing with timing attack mitigations.
  - Session authentication via **HTTP-only, Secure, SameSite cookies** (no sensitive tokens in `localStorage`).
  - **CSRF protection** with custom request header validation.
  - **Multi-tiered rate limiting** (general API limiter + user-fenced join limiter for sensitive race endpoints).
  - Strict runtime **input validation** with shared Zod schemas across frontend and backend.
  - **Database-enforced integrity** via compound unique indexes and replica-set transactions.

For complete threat models and security controls, see [Security Architecture](docs/security-design.md).

---

## Architecture & Monorepo Structure

CrewConnect is organized as an enterprise-grade **modular monolith** in a clean TypeScript monorepo:

```
CrewConnect Monorepo
├── apps/
│   ├── api/                   # Node.js + Express + TypeScript REST API & Socket.IO server
│   │   ├── src/
│   │   │   ├── config/        # Strict Zod environment configuration
│   │   │   ├── db/            # MongoDB connection & replica-set transaction manager
│   │   │   ├── metrics/       # Prometheus metrics collection and /metrics exporter
│   │   │   ├── middleware/    # Auth, rate limiting, request validation, CORS, error handling
│   │   │   ├── models/        # Mongoose domain models & compound index definitions
│   │   │   ├── realtime/      # Socket.IO room management & post-commit event dispatcher
│   │   │   ├── routes/        # Typed Express route controllers
│   │   │   └── services/      # Core transactional services (Team, Idempotency, Recommendations, DemoSeed)
│   │   └── tests/             # 27 API unit, integration, race, and chaos test suites
│   └── web/                   # React 18 + TypeScript + Vite + Tailwind CSS SPA
│       ├── src/
│       │   ├── components/    # Reusable UI components (Dialogs, Modals, Navbar, PasswordCompanion)
│       │   ├── context/       # Auth and Socket context providers
│       │   ├── pages/         # Landing, Dashboard, Teams Directory, Workspace, Profile, Auth
│       │   └── lib/           # Typed API client & real-time hooks
│       └── tests/             # 16 React Testing Library component and integration suites
├── packages/
│   └── shared/                # Shared domain schemas, Zod DTOs, error types, and constants
├── docs/                      # Architectural specifications & decision records (ADRs 0001–0010)
├── scripts/                   # Seeding scripts, replica-set verifiers, and load test harnesses
└── docker-compose.yml         # Local 3-node MongoDB replica set (rs0) environment
```

---

## Testing & Verification Matrix

CrewConnect maintains a comprehensive, zero-regression test suite covering domain invariants, race conditions, and UI interactions:

| Verification Suite       | Target                            |  Status  |         Passing Tests          |
| :----------------------- | :-------------------------------- | :------: | :----------------------------: |
| **Backend API Suites**   | `apps/api/tests/*.test.ts`        | **PASS** |    **347 tests (27 files)**    |
| **Frontend Web Suites**  | `apps/web/tests/*.test.tsx`       | **PASS** |    **123 tests (16 files)**    |
| **Shared Package Tests** | `packages/shared/tests/*.test.ts` | **PASS** |      **5 tests (1 file)**      |
| **Total Monorepo Tests** | **All Workspaces**                | **PASS** | **475 passed (44 test files)** |

---

## Verified Performance Benchmarks

Empirical load testing was executed using `scripts/run-load-test.ts` against a dedicated local MongoDB 7.0 replica set (`rs0`) seeded with a challenge-scale dataset (10,000 users, 2,000 teams, 1,601 open squads, and 7,002 pre-existing memberships).

### Benchmark 1: Team Discovery API (100 Concurrent Clients, 2,000 Teams)

| Metric                    |      Target       |     Measured Result      |     Status     |
| :------------------------ | :---------------: | :----------------------: | :------------: |
| **Concurrent Clients**    |    100 clients    |     **100 clients**      |    **PASS**    |
| **Completed Requests**    |   500 requests    |     **500 requests**     |    **PASS**    |
| **Failed Requests**       |    0 failures     | **0 (0.00% error rate)** |    **PASS**    |
| **Total Duration**        |        N/A        |        **713 ms**        |    **FAST**    |
| **Throughput**            |  Sustained load   |    **701.7 req/sec**     |    **PASS**    |
| **Median (p50) Latency**  |     Baseline      |       **129.1 ms**       |    **PASS**    |
| **Mean Latency**          |     Baseline      |       **136.2 ms**       |    **PASS**    |
| **95th Percentile (p95)** | $< 200\text{ ms}$ |       **186.4 ms**       | **TARGET MET** |
| **99th Percentile (p99)** |        N/A        |       **215.7 ms**       |    **PASS**    |
| **Maximum Latency**       |        N/A        |       **245.3 ms**       |    **PASS**    |

### Benchmark 2: 50-Way Last-Seat Race Under Live WebSockets

| Metric                                |          Target          |    Observed Result     |   Status    |
| :------------------------------------ | :----------------------: | :--------------------: | :---------: |
| **Simultaneous Contenders**           |            50            |   **50 contenders**    |  **PASS**   |
| **Available Vacancy**                 |  1 seat ($4/5 \to 5/5$)  |       **1 seat**       |  **PASS**   |
| **Successful Joins (`201 Created`)**  |        Exactly 1         |         **1**          | **PERFECT** |
| **Clean Rejections (`409 Conflict`)** |            49            |         **49**         | **PERFECT** |
| **Server Errors (`5xx`)**             |            0             |         **0**          | **PERFECT** |
| **Final Database Capacity**           |          5 / 5           |       **5 / 5**        | **PERFECT** |
| **Active DB Memberships**             |        Exactly 5         |         **5**          | **PERFECT** |
| **Duplicate Memberships**             |            0             |         **0**          | **PERFECT** |
| **Leader Real-Time Event**            | 1 (`team:member_joined`) |      **1 event**       | **PERFECT** |
| **Spectator Real-Time Event**         |  Delivered to 5 clients  | **5 clients notified** | **PERFECT** |

> **Benchmark Qualification**: These figures reflect an automated benchmark run on local development hardware (Intel i5-13450HX, 24 GB RAM, Windows 11, Node.js 24.18, Docker MongoDB 7.0 replica set) against commit `9374faf`. They represent measured system performance under isolated benchmark conditions rather than universal cloud production guarantees. Complete methodology, full latency distributions, and reproduction instructions are documented in [LOAD_TEST_REPORT.md](./LOAD_TEST_REPORT.md).

---

## Quickstart & Local Development

### Prerequisites

- Node.js >= 20.0.0 LTS
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

## Available Monorepo Scripts

| Command              | Description                                                              |
| :------------------- | :----------------------------------------------------------------------- |
| `npm run dev`        | Starts both backend API and frontend Vite dev servers concurrently       |
| `npm run dev:api`    | Starts backend API dev server with `tsx watch` hot-reload                |
| `npm run dev:web`    | Starts frontend Vite dev server                                          |
| `npm run build`      | Builds shared package, API TypeScript bundle, and Vite production bundle |
| `npm run typecheck`  | Runs TypeScript compiler checks across all workspaces                    |
| `npm run lint`       | Runs ESLint across TypeScript and React code                             |
| `npm run test`       | Runs the full Vitest test suite (475 tests across 44 files)              |
| `npm run seed:demo`  | Seeds or verifies the default demo hackathon and sample squads           |
| `npm run format`     | Verifies Prettier code style formatting                                  |
| `npm run format:fix` | Automatically formats all codebase files with Prettier                   |

---

## Architectural & Engineering Documentation

Key specifications, benchmark reports, and evaluator guides are maintained directly in the repository:

1. **[Design Document (1-Page Architecture Summary)](./DESIGN_DOCUMENT.md)**: Authoritative executive architecture specification, domain invariants, concurrency model, and core guarantees for Hack4Hack PS1 evaluators.
2. **[Load-Test & Concurrency Benchmark Report](./LOAD_TEST_REPORT.md)**: Empirical 10,000-user / 2,000-team load tests, sub-200ms p95 discovery latency, and 50-way last-seat race results.
3. **[REST API Specification](./docs/api-specification.md)**: End-to-end endpoint contracts, request/response structures, authorization tiers, and HTTP status codes.
4. **[Evaluator 5-Minute Demo Guide](./docs/demo-guide.md)**: Step-by-step live walkthrough verifying concurrency, idempotency, rollback safety, and real-time updates.
5. **[System Architecture](./docs/architecture.md)**: Modular monolith architecture, module boundaries, request lifecycle, data flow, and Mermaid diagrams.

For all remaining architectural specifications, database schemas, formal Architecture Decision Records (ADRs 0001–0010), requirements traceability, and deployment guides, see the [`docs/`](./docs/) directory.

---

## License

Distributed under the MIT License. Built for the **Hack4Hack Crew Hiring Challenge 2026**.
