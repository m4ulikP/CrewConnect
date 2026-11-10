# CrewConnect Utility Scripts (`scripts/`)

Administrative, database verification, isolated challenge-scale load seeding, and concurrency/performance benchmark scripts.

## Implemented Scripts

- **`init-replica-set.sh`**: Initializes the local single-node MongoDB replica set (`rs0`) for Docker Compose.
- **`verify-replica-set.ts`**: Verifies replica set connectivity, primary election, and live ACID transaction commit + rollback semantics.
- **`verify-database-indexes.ts`**: Synchronizes and asserts all production Mongoose indexes (partial compound unique index, compound discovery sort indexes, unique `tokenHash`, idempotency TTL).
- **`seed-load-data.ts`**: Seeds an isolated challenge-scale synthetic benchmark hackathon (`hack4hack-load-bench-2026`) defaulting to **`10,000` participants** and **`2,000` teams** (configurable via `SEED_PARTICIPANT_COUNT` and `SEED_TEAM_COUNT`), preserving exact `Team.memberCount === ACTIVE memberships` invariants and a `4/5` Arena Team for the 50-way race.
  - **Memory & Execution Considerations**: Uses chunked bulk `insertMany(..., { ordered: false })` in batches of `2,000` documents (~1.2 seconds locally) to keep Node heap usage bounded and minimize WiredTiger journal spikes.
  - **Scoped Idempotent Cleanup (`--cleanup`)**: Requires an explicit benchmark slug (`LOAD_BENCH_SLUG`), resolves synthetic users matching `@load-bench.crewconnect.test` and benchmark team IDs, and restricts `IdempotencyRecord.deleteMany` strictly to `{ userId: { $in: syntheticUserIds }, endpoint: ... }`. Never touches ordinary development data.
- **`run-load-test.ts`**: Automated, self-contained load & concurrency benchmark runner spawning an isolated Node HTTP + Socket.IO server process:
  - **Scenario 1 (Discovery API Load)**: 100 concurrent clients performing 500 `GET /api/v1/hackathons/:id/teams?hasVacancies=true&limit=20` queries against the 2,000-team / 10,000-participant dataset; reports p50, p95, p99, throughput, error rate, request count, and concurrency.
  - **Scenario 2 (50-Request Last-Seat Race under Live WebSockets)**: 50 simultaneous `POST /api/v1/teams/:id/join` requests competing for 1 seat (`4/5 -> 5/5`) under 6 live Socket.IO listeners, verifying exact 1 winner (`201`), 49 rejections (`409`), 0 capacity over-allocations, and exact post-commit Socket.IO delivery.

## Usage

```bash
# Seed challenge-scale dataset (10,000 participants, 2,000 teams)
npx tsx scripts/seed-load-data.ts

# Seed smaller custom dataset
SEED_TEAM_COUNT=500 SEED_PARTICIPANT_COUNT=2000 npx tsx scripts/seed-load-data.ts

# Clean up synthetic benchmark data cleanly (safe & idempotent)
npx tsx scripts/seed-load-data.ts --cleanup

# Run the complete challenge-scale load & concurrency benchmark (auto-seeds & cleans up)
npx tsx scripts/run-load-test.ts
```
