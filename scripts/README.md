# CrewConnect Utility Scripts (`scripts/`)

Administrative, database seeding, performance benchmarking, and development support scripts.

## Planned Scripts (to be implemented in Phases 2, 5, and 7)
- `init-replica-set.sh` / `init-replica-set.js`: Initializes MongoDB replica set `rs0` for local Docker Compose development.
- `seed.ts`: Seeds the database with **10,000 participants** and **2,000 teams** across multiple mock hackathons for performance validation.
- `concurrency-test.ts`: Runs the high-concurrency race condition stress test (50 concurrent users racing for 1 seat).
- `k6/load-test.js`: k6 load testing script executing 100 concurrent virtual users hitting the team discovery board and testing p95 latency (< 200 ms).

> **Status**: Test specifications and scenarios defined in Phase 1 (`docs/testing-strategy.md`). Implementation planned for Phases 2, 5, and 7.
