# CrewConnect API Service (`apps/api`)

Backend REST API and real-time Socket.IO service for the CrewConnect platform, built to guarantee race-proof hackathon team formation under extreme concurrent traffic.

---

## 1. Responsibilities & Core Guarantees

- **Atomic Seat Allocation**: Optimistic concurrency control (`version` increments) combined with MongoDB multi-document ACID transactions across `teams`, `memberships`, and `audit_logs`.
- **Global Single-Team Membership**: Guaranteed via partial unique compound index `{ hackathonId: 1, userId: 1 }` with `{ status: "ACTIVE" }` on the `memberships` collection.
- **Idempotency & Replay Safety**: Deterministic request fingerprinting (SHA-256) and lease fencing to guard state mutations against network retries.
- **Post-Commit Real-Time Broadcast**: Socket.IO events (`team:capacity_updated`, `team:member_joined`, `join_request:created`) emitted strictly after transaction commits.
- **Security & Session Management**: `httpOnly`, `SameSite=Lax` cookie sessions, Argon2id password hashing, CSRF double-submit protection, and IP-tiered rate limiting.
- **Prometheus Telemetry**: Native instrumentation exporting request throughput, latency histograms, active WebSocket counts, and database health metrics at `/metrics`.

---

## 2. Directory Structure

```
apps/api/
├── src/
│   ├── config/          # Zod-validated environment configuration (env.ts)
│   ├── db/              # MongoDB connection lifecycle, healthcheck, and transaction helpers
│   ├── errors/          # Structured AppError classes and error-handling utilities
│   ├── metrics/         # Prometheus registry, custom metrics, and Prometheus router
│   ├── middleware/      # Auth, CSRF, rate limiter, idempotency, validate, and error handlers
│   ├── models/          # Mongoose data schemas (Team, Membership, User, Hackathon, etc.)
│   ├── realtime/        # Socket.IO server, cookie handshake auth, and room dispatchers
│   ├── routes/          # REST route handlers (/auth, /teams, /hackathons, /users, /invitations, /health)
│   ├── scripts/         # Auto-seeding script for evaluator demo accounts
│   ├── services/        # Central business logic (seat reservation, team, auth, idempotency)
│   ├── app.ts           # Express application composition and middleware pipeline
│   └── server.ts        # Server bootstrap and graceful shutdown handlers
└── tests/               # Vitest integration, unit, and chaos test suites (347 tests)
```

---

## 3. Development & Operational Commands

Run commands from the monorepo root or directly within `apps/api`:

```bash
# Start API development server with tsx hot-reloading
npm run dev --workspace=@crewconnect/api

# Typecheck TypeScript files in strict mode
npm run typecheck --workspace=@crewconnect/api

# Build production bundle
npm run build --workspace=@crewconnect/api

# Run Vitest API test suite (347 tests across 26 files)
npm test -- apps/api
```

---

## 4. Environment Configuration

The API validates all environment variables at startup using Zod in `src/config/env.ts`. Key configuration variables:

| Variable                  | Description                                   | Default / Example                                      |
| :------------------------ | :-------------------------------------------- | :----------------------------------------------------- |
| `PORT`                    | HTTP port                                     | `5000`                                                 |
| `CLIENT_URL`              | Allowed CORS origin                           | `http://localhost:5173`                                |
| `MONGODB_URI`             | Replica set connection URI                    | `mongodb://localhost:27017/crewconnect?replicaSet=rs0` |
| `JWT_SECRET`              | Secret key for session cookies (min 32 chars) | Required in production                                 |
| `COOKIE_SECURE`           | Set `true` when serving over HTTPS            | `false` (dev) / `true` (prod)                          |
| `COOKIE_SAME_SITE`        | SameSite cookie attribute                     | `lax`                                                  |
| `RATE_LIMIT_WINDOW_MS`    | Rate limit sliding window                     | `900000` (15 mins)                                     |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per IP per window                | `300`                                                  |
| `METRICS_ENABLED`         | Toggle Prometheus metrics endpoint            | `true`                                                 |

Refer to [`.env.example`](../../.env.example) and [`apps/api/.env.example`](./.env.example) for the full configuration template.
