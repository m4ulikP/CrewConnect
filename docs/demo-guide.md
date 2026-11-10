# CrewConnect — Evaluator 5-Minute Live Demo Guide

**Project:** CrewConnect (Hack4Hack 2026 — Problem Statement 1: Race-Proof Hackathon Team Formation)  
**Estimated Duration:** 5 minutes  
**Objective:** Demonstrate atomic seat reservation, multi-team exclusion, idempotent replay, transactional rollback isolation, and post-commit Socket.IO real-time synchronization.

---

## Prerequisites

1. **Start MongoDB Replica Set (`rs0`)**:
   ```bash
   docker compose up -d
   npx tsx scripts/verify-replica-set.ts
   ```
2. **Start API and Web Servers**:
   ```bash
   npm run build:shared
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend API & Socket.IO Hub: `http://localhost:5000`

_(Alternatively, run our automated benchmark + concurrency verification script directly via `npx tsx scripts/run-load-test.ts`!)_

---

## 5-Minute Walkthrough Checklist

### Minute 0:00 – 1:00 | Authentication & Real-Time Connection State

1. Open `http://localhost:5173` in **Browser Window A** (Team Leader) and register/sign in (`leader@demo.dev`).
2. Note that authentication uses `httpOnly`, `SameSite=Lax` session cookies (no JWT tokens exposed in `localStorage` or response JSON).
3. Observe the **Navbar Real-Time Status Badge** switching cleanly to `Live` (green pulse) as Socket.IO authenticates the cookie handshake and joins `user:<leaderId>`.

### Minute 1:00 – 2:00 | Team Creation & Live Directory Broadcast

1. Navigate to **Team Discovery** (`/teams-preview`), click **Create a Team**, set `maxCapacity: 2`, and submit.
2. Open **Browser Window B (Incognito)** at `http://localhost:5173/teams-preview` (Participant Bob).
3. Notice Window B displays the live team capacity badge (`1 / 2`) subscribed to `hackathon:<hackathonId>`.

### Minute 2:00 – 3:00 | The 50-Way Last-Seat Race (Atomicity & Zero Over-Allocation)

1. Show the live capacity on the team (`1 / 2` — 1 final vacancy remaining).
2. Run the automated 50-client race harness in your terminal:
   ```bash
   npx tsx scripts/run-load-test.ts
   ```
3. Point out the empirical terminal output:
   - **Discovery API Under Load (100 concurrent workers, 500 queries):** p95 latency stays well below the `< 200 ms` target with `0` errors.
   - **50-Request Last-Seat Race (`POST /api/v1/teams/:id/join`):**
     - Exactly **1** request receives `201 Created`.
     - Exactly **49** concurrent contenders receive `409 Conflict` (`TEAM_FULL`).
     - Zero `5xx` errors or seat over-allocation (`memberCount === 5 / 5`).
     - Live Socket.IO listeners receive **exactly 1** `team:capacity_updated` and `team:member_joined` event post-commit.

### Minute 3:00 – 4:00 | Multi-Team Exclusion & Idempotent Replay Safety

1. Attempt to join a second team in the same hackathon using the winning user account → rejected with `409 Conflict` (`ALREADY_IN_TEAM`) enforced by the partial unique index `{ hackathonId: 1, userId: 1 }` (`status: "ACTIVE"`).
2. Resend an identical `POST /join` request with the **same** `Idempotency-Key` header → returns the cached response (`X-Cache: HIT`) without re-executing database writes.
3. Reuse the **same** `Idempotency-Key` with a different request payload → blocked cleanly with `409 Conflict` (`IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`).

### Minute 4:00 – 5:00 | Real-Time UI Updates & Transactional Rollback Proof

1. In **Browser Window A** (`TeamDetails`), submit/approve a join request or toggle team open/close status → **Browser Window B** reflects capacity and roster changes immediately without page reload.
2. Open the **History / Audit Log** tab on the team page to show append-only transactional audit entries (`TEAM_CREATED`, `MEMBER_JOINED`, `TEAM_OPENED`) written inside the exact same ACID transaction as the state change.
3. Run the automated real-time + concurrency test suite to verify rollback and commit-uncertainty isolation:
   ```bash
   npm test -- apps/api/tests/realtime.test.ts apps/api/tests/membership-race.test.ts
   ```
   - Proves that rolled-back transactions, transient retries, and uncertain commits emit **zero** spurious Socket.IO events.
