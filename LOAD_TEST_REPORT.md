# CrewConnect — Official Load-Test & Concurrency Benchmark Report

**Challenge:** Hack4Hack Crew Hiring Challenge 2026  
**Problem Statement:** PS1 — Race-Proof Team Formation at Scale  
**Repository:** `m4ulikP/CrewConnect`  
**Latest Benchmark Evaluation Baseline:** Commit `9374faf8264a5cdd976e236a04c60470faa4bfa0` (`main`)<br>
**Historical Baseline Run:** Commit `7664896d7cba72ee23f72360553677fa3adc3009` (14 November 2026, 18:24:06 IST)<br>
**Benchmark Suite:** `scripts/run-load-test.ts` (using `scripts/seed-load-data.ts`)

---

## 1. Executive Summary

This report documents the empirical benchmark results for CrewConnect under the Hack4Hack 2026 PS1 challenge scale.

The evaluation benchmarks two critical scenarios:

1. **Challenge-Scale Discovery API Load Test:** Evaluates read performance and throughput under **100 concurrent clients** against a freshly seeded dataset of **10,000 participants and 2,000 teams** (with 1,601 open teams and 7,002 pre-seeded memberships).
2. **50-Way Last-Seat Concurrency Race:** Evaluates atomic write consistency when **50 simultaneous contenders** compete for the final vacancy (4/5 $\to$ 5/5) of an arena squad under **live Socket.IO WebSocket listeners**.

### Key Findings (Latest Verified Run: Commit `9374faf`)

- **Sub-200ms Latency SLA Achieved:** The Team Discovery API achieved a **p95 latency of 186.4 ms** (target $< 200\text{ ms}$), with a median (p50) latency of **129.1 ms** and mean latency of **136.2 ms**.
- **Measured Throughput:** Observed throughput of **701.7 requests/sec during this run** with **0 failures (0.00% error rate)** across 500 measured requests (with 50 warmup requests) completing in **713 ms total duration**.
- **Zero Oversaturation:** In the 50-way race for the final seat, **exactly 1 contender succeeded** (`201 Created`), **49 contenders received clean rejections** (`409 Conflict`), and **0 server errors occurred**. The final database team capacity remained strictly **5/5**.
- **Strict Real-Time Consistency:** Exactly **one `team:member_joined` event** was dispatched to the leader and **`team:capacity_updated` was delivered to 5 clients** strictly post-commit.
- **Zero Data Corruption:** Final active memberships reconciled exactly to **5/5** with zero duplicate memberships.

---

## 2. Test Environment & Hardware Specification

| Parameter                  | Specification                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| **Operating System**       | Microsoft Windows 11 Home (x64)                                                              |
| **CPU Hardware**           | 13th Gen Intel(R) Core(TM) i5-13450HX (10 physical cores, 16 logical threads)                |
| **Physical Memory (RAM)**  | 24.0 GB                                                                                      |
| **Runtime Environment**    | Node.js `24.18`                                                                              |
| **Database Engine**        | MongoDB `7.0.12` in a local Docker replica set (`rs0`)                                       |
| **Database Isolation**     | Disposable isolated database: `crewconnect_loadbench` (`mongodb://localhost:27017/crewconnect_loadbench?replicaSet=rs0`) |
| **Storage & Transactions** | Multi-Document ACID Transactions (`readConcern: majority`, `writeConcern: majority`)         |
| **Evaluated Benchmark Runs** | • **Latest Verified Run:** Commit `9374faf8264a5cdd976e236a04c60470faa4bfa0`<br>• **Historical Baseline:** Commit `7664896d7cba72ee23f72360553677fa3adc3009` |

---

## 3. Test Methodology & Workload Profiles

### A. Challenge Dataset Seeding (`scripts/seed-load-data.ts`)

- **Participant Count:** 10,000 distinct user profiles with hashed passwords, skills, and experience distributions.
- **Team Count:** 2,000 distinct teams.
- **Active Memberships:** 7,002 active memberships pre-populated across teams.
- **Open Teams:** 1,601 open teams with vacancies available for discovery.
- **Arena Squad:** Team 0 pre-configured at $4/5$ members with `isOpen: true` (leaving exactly 1 vacancy).

### B. Benchmark 1: Discovery API Workload Profile

- **Target Endpoint:** `GET /api/v1/hackathons/:id/teams?hasVacancies=true&limit=20`
- **Concurrency:** 100 sustained concurrent worker clients.
- **Request Volume:** 500 measured requests.
- **Warmup:** 50 warmup requests to prime connection pools and MongoDB query execution plans.
- **Metrics Recorded:** Total wall-clock duration, throughput (req/s), failure count, p50, mean, p95, p99, and maximum latencies.

### C. Benchmark 2: 50-Way Final-Seat Race Profile

- **Target Endpoint:** `POST /api/v1/teams/:arenaTeamId/join`
- **Concurrency:** 50 simultaneous contenders firing requests in parallel using `Promise.all`.
- **Authentication:** 50 distinct user JWTs signed with `HS256`.
- **Idempotency:** 50 unique UUIDv4 `Idempotency-Key` headers.
- **Live WebSocket Listeners:** Dedicated room listeners (squad leader in `team:<id>` room and spectators in `hackathon:<id>` room).

---

## 4. Empirical Benchmark Results

### Benchmark 1: Team Discovery API (100 Concurrent Clients, 2,000 Teams)

#### A. Latest Verified Run (Commit `9374faf8264a5cdd976e236a04c60470faa4bfa0`)

| Metric                       |      Measured Result       | Evaluation Target  |     Status     |
| ---------------------------- | :------------------------: | :----------------: | :------------: |
| **Concurrent Clients**       |      **100** clients       |    100 clients     |    **PASS**    |
| **Measured Requests**        |      **500** requests      |    500 requests    |    **PASS**    |
| **Warmup Requests**          |       **50** requests      |    50 requests     |    **PASS**    |
| **Failed Requests**          | **0** (`0.00%` error rate) |     0 failures     |    **PASS**    |
| **Total Test Duration**      |         **713 ms**         |        N/A         |    **FAST**    |
| **Throughput**               |     **701.7 req/sec**      |   Sustained load   |    **PASS**    |
| **Median (p50) Latency**     |        **129.1 ms**        |      Baseline      |    **PASS**    |
| **Mean Latency**             |        **136.2 ms**        |      Baseline      |    **PASS**    |
| **95th Percentile (p95)**    |        **186.4 ms**        |  $< 200\text{ ms}$ | **TARGET MET** |
| **99th Percentile (p99)**    |        **215.7 ms**        |        N/A         |    **PASS**    |
| **Maximum Latency**          |        **245.3 ms**        |        N/A         |    **PASS**    |

#### B. Historical Baseline Run (Commit `7664896d7cba72ee23f72360553677fa3adc3009`, 14 Nov 2026)

For transparency and progression tracking, the initial unoptimized baseline run measured on the same hardware specification:

| Metric                       | Historical Baseline Result | Evaluation Target  |      Status      |
| ---------------------------- | :------------------------: | :----------------: | :--------------: |
| **Concurrent Workers**       |        100 clients         |    100 clients     |       PASS       |
| **Total Requests Completed** |        500 requests        |    500 requests    |       PASS       |
| **Failed Requests**          |             0              |     0 failures     |       PASS       |
| **Total Test Duration**      |          2,024 ms          |        N/A         |       N/A        |
| **Throughput**               |       247.0 req/sec        |   Sustained load   |       PASS       |
| **Minimum Latency**          |          121.8 ms          |        N/A         |       PASS       |
| **Median (p50) Latency**     |          367.6 ms          |      Baseline      |       PASS       |
| **Mean Latency**             |          375.0 ms          |      Baseline      |       PASS       |
| **95th Percentile (p95)**    |        **519.9 ms**        |  $< 200\text{ ms}$ | Initial Baseline |
| **99th Percentile (p99)**    |          570.8 ms          |        N/A         |       PASS       |
| **Maximum Latency**          |          702.6 ms          |        N/A         |       PASS       |

#### C. Progression Comparison

| Metric                   | Historical Baseline (`7664896`) | Latest Verified Run (`9374faf`) | Improvement |
| :----------------------- | :-----------------------------: | :-----------------------------: | :---------: |
| **Throughput**           |          247.0 req/sec          |        **701.7 req/sec**        |  **+184%**  |
| **Total Test Duration**  |            2,024 ms             |           **713 ms**            |  **-64.8%** |
| **Median (p50) Latency** |            367.6 ms             |          **129.1 ms**           |  **-64.9%** |
| **Mean Latency**         |            375.0 ms             |          **136.2 ms**           |  **-63.7%** |
| **95th Percentile (p95)**|            519.9 ms             |          **186.4 ms**           |  **-64.1%** |
| **Maximum Latency**      |            702.6 ms             |          **245.3 ms**           |  **-65.1%** |

---

### Benchmark 2: 50-Way Last-Seat Race Under Live WebSockets

Verified in the latest benchmark execution:

| Metric                        |       Expected Value        |    Observed Result     |   Status    |
| ----------------------------- | :-------------------------: | :--------------------: | :---------: |
| **Simultaneous Attempts**     |             50              |         **50**         |  **PASS**   |
| **Seat Availability**         |   1 seat ($4/5 \to 5/5$)    | 1 seat ($4/5 \to 5/5$) |  **PASS**   |
| **Successful Joins (201)**    |            **1**            |         **1**          | **PERFECT** |
| **HTTP 409 Conflicts**        |           **49**            |         **49**         | **PERFECT** |
| **Server Errors (5xx)**       |            **0**            |         **0**          | **PERFECT** |
| **Final Team Capacity**       |          **5 / 5**          |       **5 / 5**        | **PERFECT** |
| **Final Active Memberships**  |            **5**            |         **5**          | **PERFECT** |
| **Duplicate Memberships**     |            **0**            |         **0**          | **PERFECT** |
| **Member Joined Event**       |  1 (`team:member_joined`)   |      **1** event       | **PERFECT** |
| **Capacity Updated Event**    | Delivered to 5 clients      | **5 clients** notified | **PERFECT** |

---

## 5. Architectural Interpretation & Benchmark Qualifications

### What These Results Establish

1. **Target Latency SLA Compliance:** The p95 target for the Hack4Hack challenge is below 200 ms; this verified benchmark run achieved **186.4 ms**, demonstrating that index-covered team discovery queries scale cleanly under 100 concurrent workers on 2,000 teams.
2. **Race-Proof Concurrency Safety:** The conditional capacity check within an ACID transaction (`memberCount < maxCapacity`) and the partial compound unique index (`{ hackathonId: 1, userId: 1, status: "active" }`) are designed to prevent oversaturation, and the 50-way test observed exactly one winner, 49 conflicts, and no server errors.
3. **Clean Error Propagation:** All 49 losing contenders received structured `409 Conflict` responses without leaking uncaught exceptions or producing 500 errors.
4. **Transaction Rollback Isolation:** Rolled-back transaction attempts emitted zero spurious Socket.IO events. Real-time updates were dispatched strictly after write confirmation to the replica set.
5. **Idempotency Lease Safety:** Distinct idempotency keys prevented contenders from interfering with each other's in-flight transaction leases.

### Important Qualifications & Limitations

- **Local Benchmark Scope:** This is one local benchmark run on development hardware, not a production multi-region cloud load test or a universal performance guarantee.
- **Specific Commit Baseline:** This benchmark was executed specifically against commit `9374faf8264a5cdd976e236a04c60470faa4bfa0`. It was **not** run against subsequent commits on `main` (such as accessibility fixes `4b23d6d`, Prometheus metrics instrumentation `eee1bfb`, or process-crash chaos tests `1925f03`). This report does not imply or extrapolate that later commits have been benchmarked.
- **Network Latency:** The local benchmark measures collocated intra-machine networking ($< 1\text{ ms}$ round trip). Production users distributed globally will experience additional network transit times (30–120 ms).
- **Rate Limiting:** The in-memory sliding window rate limiter protects single instances; multi-instance clustering in production environments would utilize distributed Redis-backed rate limiting.

---

## 6. Reproduction Instructions

To reproduce these benchmark numbers locally against an isolated disposable database:

### Prerequisites

1. Docker Desktop installed and running.
2. Node.js v20+ or v24+.

### Commands

```bash
# 1. Start the local MongoDB Replica Set
docker compose up -d

# 2. Verify replica set primary status
npx tsx scripts/verify-replica-set.ts

# 3. Execute the automated benchmark against an isolated database
# Windows PowerShell:
$env:MONGODB_URI="mongodb://localhost:27017/crewconnect_loadbench?replicaSet=rs0"
npx tsx scripts/run-load-test.ts

# Linux / macOS Bash:
MONGODB_URI="mongodb://localhost:27017/crewconnect_loadbench?replicaSet=rs0" npx tsx scripts/run-load-test.ts
```

*Note:* The script automatically seeds the 10,000-user / 2,000-team dataset, spawns an isolated API child process on an ephemeral port, runs both benchmarks, asserts all invariants, and cleans up the synthetic benchmark records.

---

## 7. Conclusion

CrewConnect demonstrates complete compliance with **Hack4Hack 2026 PS1** concurrency, scale, and latency requirements. The core seat reservation engine is rigorously verified to prevent over-allocation under extreme burst contention, and team discovery achieves sub-200ms p95 latency under 100 concurrent workers.
