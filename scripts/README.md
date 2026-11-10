# CrewConnect Utility Scripts (`scripts/`)

Administrative, database verification, isolated load seeding, and concurrency/performance benchmark scripts.

## Implemented Scripts

- **`init-replica-set.sh`**: Initializes the local single-node MongoDB replica set (`rs0`) for Docker Compose.
- **`verify-replica-set.ts`**: Verifies replica set connectivity, primary election, and live ACID transaction commit + rollback semantics.
- **`verify-database-indexes.ts`**: Synchronizes and asserts all production Mongoose indexes (partial compound unique index, discovery index, unique tokenHash, idempotency TTL).
- **`seed-load-data.ts`**: Seeds an isolated synthetic benchmark hackathon (`hack4hack-load-bench-2026`) with `1,000` teams and `100` free contenders (plus a `4/5` arena team for 50-way last-seat contention). Run `--cleanup` to wipe all synthetic benchmark records without touching real development data.
- **`run-load-test.ts`**: Automated, self-contained load & concurrency benchmark runner:
  - **Scenario 1 (Discovery API Load)**: 100 concurrent clients performing 500 `GET /api/v1/hackathons/:id/teams` queries verifying `p95 < 200ms` latency and 0 errors.
  - **Scenario 2 (50-Request Last-Seat Race under Live WebSockets)**: 50 concurrent `POST /api/v1/teams/:id/join` requests competing for 1 seat (`4/5`), verifying exactly 1 winner (`201`), 49 rejections (`409 TEAM_FULL`), 0 capacity over-allocations, and exact post-commit Socket.IO fan-out.

## Usage

```bash
# Seed isolated benchmark data (optional standalone step)
npx tsx scripts/seed-load-data.ts

# Clean up synthetic benchmark data
npx tsx scripts/seed-load-data.ts --cleanup

# Run the complete automated load & concurrency benchmark (auto-seeds and auto-cleans)
npx tsx scripts/run-load-test.ts
```
