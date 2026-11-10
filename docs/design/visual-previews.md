# CrewConnect — Visual Previews & Interaction Matrix
## Phase 1.1 Wireframe Matrix & Phase 1.2.1 Rendered HTML/CSS References

> **Live Rendered Previews (Phase 1.2.1 Canonical):** The authoritative rendered visual designs in the **Editorial Alabaster & Deep Architectural Pine** direction are located in [docs/design/rendered-previews/index.html](file:///c:/Users/mauli/OneDrive/Documents/CrewConnect/docs/design/rendered-previews/index.html) alongside browser-captured viewport screenshots (`1440px`, `768px`, `390px`) in `docs/design/rendered-previews/screenshots/`. The structural ASCII wireframes below preserve the complete 12-state interaction coverage matrix.

This document provides exhaustive, high-fidelity ASCII wireframes and layout specifications for all candidate visual directions and core interaction states in CrewConnect.

---

## PART 1: Direction A — Mission Control (Refined with Human-Centric Details)

Direction A combines the technical certainty and real-time reliability of a developer cockpit with rich human-centric squad presentation (portraits/initials, skills badges, team vision, and timezone alignment).

### Screen 1: Public Landing Page (`/`)

```
+-------------------------------------------------------------------------------------------------------------------------+
| [NAV]  [CC] CREWCONNECT     [API: rs0 Ready | Ping: 14ms]        Hackathons   Explore Teams      [Sign In]  [Get Started]  |
+-------------------------------------------------------------------------------------------------------------------------+
|                                                                                                                         |
|  [SYSTEM INVARIANT: ATOMIC CAPACITY INCREMENT • SNAPSHOT ISOLATION • REALTIME EVICTION]                                  |
|                                                                                                                         |
|  Race-Proof Hackathon Team Formation                                                                                    |
|  Engineered for High-Contention Bursts                                                                                  |
|                                                                                                                         |
|  When 50 engineers contest the final open seat, database-enforced atomic conditional execution                         |
|  guarantees exactly one transaction commits. Forty-nine receive instant HTTP 409 Conflict feedback                       |
|  with zero counter divergence, zero phantom memberships, and zero orphaned socket rooms.                                 |
|                                                                                                                         |
|  [ Explore Squads Seeking Members -> ]      [ Inspect Concurrency Architecture ]                                        |
|                                                                                                                         |
|  +-------------------------------------------------------------------------------------------------------------------+  |
|  | ENGINE VERIFICATION SUMMARY (BENCHMARK REFERENCE: 50 CONCURRENT WORKERS / AUTOCANNON)                             |  |
|  +-----------------------------------+---------------------------------------+---------------------------------------+  |
|  | CONCURRENT CLAIM TEST             | ACTIVE ENGINE TOPOLOGY                | TRANSACTION RETRY BEHAVIOR            |  |
|  | Contention: 50 requests / 1 seat  | MongoDB Replica Set: rs0              | TransientTransactionError: 5 retries  |  |
|  | Committed: 1 (HTTP 201 Created)   | Topology: Writable Primary            | CommitUncertain: Guarded HTTP 503     |  |
|  | Conflicts: 49 (HTTP 409 Conflict) | Socket Engine: In-Process Auth Guard  | Idempotency Cache: 100% Deterministic |  |
|  | Divergence: 0 phantom members     | Health State: READY (HTTP 200 OK)     | Max Capacity Enforcement: 100% Bound  |  |
|  | *Illustrative benchmark data      | *Real-time backend /health response   | *Engineered driver-spec invariants    |  |
|  +-----------------------------------+---------------------------------------+---------------------------------------+  |
|                                                                                                                         |
|  +-------------------------------------------------------------------------------------------------------------------+  |
|  | SQUADS ACTIVELY RECRUITING (LIVE VACANCIES)                                                                       |  |
|  +-------------------------------------------------------------------------------------------------------------------+  |
|  | [Squad Alpha] Hack4Hack 2026 - PS1                                                                                |  |
|  | "Building an ultra-low latency distributed consensus visualization engine for high-scale hackathon teams."        |  |
|  | Roster: [■■■■□] 4 of 5 Filled (1 SEAT REMAINING)                                                                  |  |
|  | Looking for: [Rust] [Raft/Paxos] [Distributed Systems]                                                            |  |
|  | Teammates: (MP) Maulik P. [Lead]  •  (SC) Sarah C. [Frontend]  •  (TC) Tom C. [Systems]  •  (ER) Elena R. [QA]    |  |
|  | Timezones: UTC-5 to UTC+1 (Async-first)                                              [ Inspect Squad Details -> ] |  |
|  +-------------------------------------------------------------------------------------------------------------------+  |
|  | [Zero-Knowledge Proof Lab] Hack4Hack 2026 - PS2                                                                   |  |
|  | "Client-side private identity proofs using recursive SNARKs and WebAssembly runtime."                             |  |
|  | Roster: [■■■□□] 3 of 5 Filled (2 SEATS REMAINING)                                                                 |  |
|  | Looking for: [Circom] [WASM] [Solidity]                                                                           |  |
|  | Teammates: (AK) Alex K. [Lead]  •  (MN) Maya N. [Math]  •  (DL) David L. [Smart Contracts]                        |  |
|  | Timezones: UTC+5:30 (Core sync hours 14:00-18:00 IST)                                [ Inspect Squad Details -> ] |  |
|  +-------------------------------------------------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------------------------------------------------+
```

---

### Screen 2: Team Discovery & Master-Detail Board (`/hackathons/:id/teams`)

```
+-------------------------------------------------------------------------------------------------------------------------+
| [NAV]  [CC] CREWCONNECT     Hackathons > Hack4Hack 2026 > Teams              [Live Sync: ACTIVE]  [Notifications]  (MP)  |
+-------------------------------------------------------------------------------------------------------------------------+
| HACK4HACK CREW HIRING CHALLENGE 2026                                                                                    |
| Status: ACTIVE REGISTRATION   •   Window: Nov 09 - Nov 16   •   Total Squads: 34 Teams Registered   [ + Create Squad ]  |
+-------------------------------------------------------------------------------------------------------------------------+
| [Search by team name, skill, or leader... (Press /)]         [x] Has Vacancies Only   [Skill Filter: All Skills v]       |
+-------------------------------------------------------+-----------------------------------------------------------------+
| TEAM DIRECTORY (34 Squads)                            | SQUAD DOSSIER: SQUAD ALPHA                                      |
|                                                       |                                                                 |
| > SQUAD ALPHA (4/5) - 1 SEAT LEFT                     | SQUAD ALPHA                                                     |
|   Hack4Hack 2026 • Leader: (MP) Maulik P.             | Tagline: Distributed consensus engine for hackathons            |
|   Skills: Node.js, MongoDB, React, Rust               | Status: OPEN FOR APPLICATIONS   •   Capacity: [■■■■□] 4 of 5    |
|   [High Contention] [1 Open Seat]                     |                                                                 |
|                                                       | PROJECT MISSION & ARCHITECTURE                                  |
|   ZK PROOF LAB (3/5) - 2 SEATS LEFT                   | Implementing a high-throughput consensus visualizer with strict |
|   Hack4Hack 2026 • Leader: (AK) Alex K.               | serializability guarantees and real-time room updates.          |
|   Skills: Circom, WASM, Rust                          | Team culture: Async-friendly, PR review required, UTC-5 to UTC+2|
|   [2 Open Seats]                                      |                                                                 |
|                                                       | CONFIRMED SQUAD ROSTER (4 / 5)                                  |
|   ROBO-SWARM (5/5) - FULL                             | 1. (MP) Maulik P. [LEADER]    UTC+5:30   Backend, Architecture  |
|   Hack4Hack 2026 • Leader: (DL) David L.              | 2. (SC) Sarah C.  [MEMBER]    UTC-5      Frontend, UI/UX        |
|   Skills: ROS, C++, Python                            | 3. (TC) Tom C.    [MEMBER]    UTC+1      Distributed Storage    |
|   [Roster Locked]                                     | 4. (ER) Elena R.  [MEMBER]    UTC-8      Testing & Benchmark    |
|                                                       | 5. [VACANT SEAT]  Seeking: Rust / Systems Engineer              |
|   NEURAL VOICE (2/4) - 2 SEATS LEFT                   |                                                                 |
|   Hack4Hack 2026 • Leader: (ER) Elena R.              | ACTION CENTER                                                   |
|   Skills: PyTorch, WebRTC, Audio                      | [ Instant Direct Join (Atomic Claim) ] (Idempotency Protected)  |
|   [2 Open Seats]                                      | [ Submit Join Request to Leader -> ]                            |
|                                                       | [ Have an Invite Token? Redeem Here ]                           |
+-------------------------------------------------------+-----------------------------------------------------------------+
```

---

### Screen 3: Authenticated Dashboard (`/dashboard`)

```
+-------------------+-----------------------------------------------------------------------------------------------------+
| [SIDEBAR (240px)] | Dashboard  /  Overview                                       [Socket: 12ms]  [Alerts (2)]  (MP) Maulik P. |
|                   +-----------------------------------------------------------------------------------------------------+
| [CC] CREWCONNECT  | OVERVIEW & RECENT ACTIVITY                                                                          |
|                   | Active Hackathon: Hack4Hack Crew Hiring Challenge 2026   •   Team Freeze: 4 days remaining               |
| # Overview        +-----------------------------------------------------------------------------------------------------+
| # Squad Alpha [1] | [ACTIVE SQUAD CARD]                                                                                 |
| # Explore Squads  | Squad Alpha (Hack4Hack 2026)                                              [STATUS: RECRUITING 1 SEAT]   |
| # Invitations (1) | Roster: [■■■■□] 4/5 Confirmed Members                                     [Open Squad Workspace ->]     |
| # Audit Trail     | Needed Skill: Rust / Distributed Consensus Engineer                                                 |
|                   | Next Milestone: Initial Architecture Draft & Benchmark Suite                                         |
|                   +-----------------------------------------------------------------------------------------------------+
|                   | [PENDING ACTIONS & DECISIONS REQUIRED]                                                              |
|                   | * (JK) Jason K. submitted a join request for Squad Alpha (Role: Rust Dev)     [Approve]  [Reject]   |
|                   | * Invite token `cc-inv-9821` created 2h ago (1 of 1 remaining)                [Copy Link]  [Revoke]  |
|                   +-----------------------------------------------------------------------------------------------------+
|                   | [COLLABORATIVE ACTIVITY FEED (REAL-TIME SQUAD LOGS)]                                                |
|                   | 15:22:04 - (ER) Elena R. joined Squad Alpha (Committed via MongoDB rs0 session)                     |
|                   | 15:18:30 - Team capacity updated from 4 to 5 by Leader (MP) Maulik P.                                |
|                   | 14:45:12 - Socket room authorization verified for user @m4ulik                                      |
+-------------------+-----------------------------------------------------------------------------------------------------+
```

---

### Screen 4: Team Workspace (`/teams/:id/manage`)

```
+-------------------+-----------------------------------------------------------------------------------------------------+
| [SIDEBAR (240px)] | Squad Alpha  /  Squad Workspace & Roster Management                    [Status: OPEN]  [Close Squad] |
|                   +-----------------------------------------------------------------------------------------------------+
| [CC] CREWCONNECT  | SQUAD ALPHA CONFIGURATION                                                                           |
|                   | Hackathon: Hack4Hack 2026   •   Capacity: [ 5 ] Max Seats   •   Current: 4 Confirmed   •   Open: 1       |
| # Overview        +-----------------------------------------------------------------------------------------------------+
| > Squad Alpha     | [ROSTER MANAGEMENT TABLE]                                                                           |
|   - Roster        | Member Name        Role       Skills                     Joined At     Actions                          |
|   - Invites (1)   | (MP) Maulik P.     Leader     Node.js, MongoDB, React    Nov 09 22:15  [Transfer Leadership]            |
|   - Requests (1)  | (SC) Sarah C.      Member     React, Tailwind, UI/UX     Nov 10 01:20  [Remove Member] [Transfer Lead]  |
|   - Audit Log     | (TC) Tom C.        Member     Distributed Systems, Raft  Nov 10 04:12  [Remove Member] [Transfer Lead]  |
| # Explore Squads  | (ER) Elena R.      Member     Go, Benchmarking, k6       Nov 10 09:44  [Remove Member] [Transfer Lead]  |
| # Settings        | [Vacant Seat 5]    Open       Seeking: Rust Engineer     --            [Generate Invite Token]          |
|                   +-----------------------------------------------------------------------------------------------------+
|                   | [ACTIVE INVITATION TOKENS]                                                                          |
|                   | Token Hash: `a9b2...8f1c` | Created: Nov 10 10:00 | Max Uses: 1/1 | Expires: Nov 11 10:00  [Revoke Token] |
|                   +-----------------------------------------------------------------------------------------------------+
|                   | [PENDING JOIN REQUESTS (1 AWAITING REVIEW)]                                                         |
|                   | (JK) Jason K. (Skills: Rust, WebAssembly, C++) • "Built custom Raft consensus in Rust for past hack" |
|                   | Submitted: 45m ago   •   [ Approve Request (Atomic Join) ]   [ Reject Request ]                         |
|                   +-----------------------------------------------------------------------------------------------------+
| [DANGER ZONE]     | [Disband Squad (Permanent)]   [Leave Squad (Requires Leadership Transfer First)]                    |
+-------------------+-----------------------------------------------------------------------------------------------------+
```

---

### Screen 5: Sign-In (`/login`)

```
+-------------------------------------------------------------------------------------------------------------------------+
|                                                   [CC] CREWCONNECT                                                      |
|                                                                                                                         |
|                                     +-------------------------------------------+                                       |
|                                     | SIGN IN TO YOUR WORKSPACE                 |                                       |
|                                     | Access your hackathon squad and telemetry |                                       |
|                                     +-------------------------------------------+                                       |
|                                     | Email Address                             |                                       |
|                                     | [ engineer@hackathon.org                ] |                                       |
|                                     |                                           |                                       |
|                                     | Password                                  |                                       |
|                                     | [ ************************************  ] |                                       |
|                                     |                                           |                                       |
|                                     | [ Sign In to Workspace -> ]               |                                       |
|                                     |                                           |                                       |
|                                     | New participant? [Register your account]  |                                       |
|                                     +-------------------------------------------+                                       |
|                                     | [i] Sessions secured via Argon2id &       |                                       |
|                                     |     strict HTTP-only JWT cookies.         |                                       |
|                                     +-------------------------------------------+                                       |
+-------------------------------------------------------------------------------------------------------------------------+
```

---

### Screen 6: User Registration (`/register`)

```
+-------------------------------------------------------------------------------------------------------------------------+
|                                                   [CC] CREWCONNECT                                                      |
|                                                                                                                         |
|                               +-------------------------------------------------------+                                 |
|                               | CREATE HACKER ACCOUNT                                 |                                 |
|                               | Join teams with guaranteed atomic reservation         |                                 |
|                               +-------------------------------------------------------+                                 |
|                               | Full Name / Display Handle                            |                                 |
|                               | [ Maulik P.                                         ] |                                 |
|                               |                                                       |                                 |
|                               | Email Address                                         |                                 |
|                               | [ maulik@example.com                                ] |                                 |
|                               |                                                       |                                 |
|                               | Password (min 8 characters)                           |                                 |
|                               | [ ************************************              ] |                                 |
|                               |                                                       |                                 |
|                               | Technical Skills (comma separated, 1-20 skills)       |                                 |
|                               | [ Node.js, MongoDB, TypeScript, React, Go           ] |                                 |
|                               |                                                       |                                 |
|                               | Timezone                                              |                                 |
|                               | [ Asia/Kolkata (UTC+5:30)                           v]|                                 |
|                               |                                                       |                                 |
|                               | Short Bio / Engineering Focus (Optional)              |                                 |
|                               | [ Distributed systems engineer focused on high-     ] |                                 |
|                               | [ concurrency databases and lock-free algorithms.   ] |                                 |
|                               |                                                       |                                 |
|                               | [ Create Account & Enter Workspace -> ]               |                                 |
|                               |                                                       |                                 |
|                               | Already have an account? [Sign In]                    |                                 |
|                               +-------------------------------------------------------+                                 |
+-------------------------------------------------------------------------------------------------------------------------+
```

---

## PART 2: Direction B — Editorial Squad Craft

Direction B treats team formation as editorial curation and architectural project publishing.

### Screen 1: Landing Page (`/`) — Direction B

```
+-------------------------------------------------------------------------------------------------------------------------+
|  CrewConnect — Journal of Collaborative Engineering                          Hackathons   The Teams   About   Sign In   |
+-------------------------------------------------------------------------------------------------------------------------+
|                                                                                                                         |
|  Vol. 01 — Hack4Hack 2026 PS1                                                                         November 10, 2026 |
|                                                                                                                         |
|  Teams formed under pressure,                                                                                           |
|  guaranteed by serializable execution.                                                                                  |
|                                                                                                                         |
|  In the final hour of hackathon registration, when multiple engineers race to claim the last position                  |
|  in a squad, conventional databases experience write divergence and phantom memberships.                                |
|  CrewConnect binds every roster modification to atomic conditional execution on MongoDB replica sets.                  |
|                                                                                                                         |
|  [ Browse the Directory of Squads ]       Read the Architecture Note ->                                                 |
|                                                                                                                         |
|  ---------------------------------------------------------------------------------------------------------------------  |
|                                                                                                                         |
|  FEATURED SQUAD DOSSIER                                                THE RECRUITMENT MANIFESTO                        |
|                                                                                                                         |
|  Squad Alpha — Distributed Core                                        Great hackathon projects are not built           |
|  Lead by Maulik P.  •  Based across UTC-5 and UTC+5:30                 by solitary developers. They are realized        |
|                                                                        by balanced squads whose technical boundaries    |
|  "We are constructing an operational visualizer for Raft consensus     are agreed upon before the first commit.         |
|  clusters under network partition conditions."                                                                          |
|                                                                        Current Vacancy:                                 |
|  Roster Status: 4 of 5 Positions Filled                                Rust / Systems Engineer                         |
|  * Maulik P. (Architecture & Storage Engine)                           Experience with Tokio or async network runtimes  |
|  * Sarah C. (Interface & Visual Ergonomics)                            preferred.                                       |
|  * Tom C. (Consensus Invariant Testing)                                                                                 |
|  * Elena R. (Benchmark Harness & Reliability)                          [ Request to Join Squad Alpha ]                  |
+-------------------------------------------------------------------------------------------------------------------------+
```

### Screen 2: Team Discovery (`/hackathons/:id/teams`) — Direction B

```
+-------------------------------------------------------------------------------------------------------------------------+
|  CrewConnect   /   Hack4Hack 2026 Directory                                              [Filter: Open Only]  Maulik P. |
+-------------------------------------------------------------------------------------------------------------------------+
|                                                                                                                         |
|  THE SQUAD DIRECTORY                                                                                                    |
|  Showing 34 registered engineering collectives for Hack4Hack 2026                                                       |
|                                                                                                                         |
|  No. 01                                             No. 02                                      No. 03                  |
|  SQUAD ALPHA                                        ZERO-KNOWLEDGE LAB                          ROBO-SWARM              |
|  Lead: Maulik P.                                    Lead: Alex K.                               Lead: David L.          |
|  Focus: Distributed consensus engine                Focus: Client-side recursive SNARKs         Focus: ROS swarm control|
|  Positions: 4 of 5 (One Seat Open)                  Positions: 3 of 5 (Two Seats Open)          Positions: 5 of 5 (FULL)|
|  Required: Rust, Raft, Distributed                  Required: Circom, WASM, Solidity            Status: Roster Complete |
|                                                                                                                         |
|  [ View Squad Dossier -> ]                          [ View Squad Dossier -> ]                   [ View Squad Dossier ]  |
+-------------------------------------------------------------------------------------------------------------------------+
```

### Screen 3: Dashboard (`/dashboard`) — Direction B

```
+-------------------------------------------------------------------------------------------------------------------------+
|  CrewConnect   /   Workspace                                                                        Status: Active (rs0)|
+-------------------------------------------------------------------------------------------------------------------------+
|                                                                                                                         |
|  Good afternoon, Maulik.                                                                                                |
|  You are leading Squad Alpha in the Hack4Hack 2026 hiring challenge.                                                    |
|                                                                                                                         |
|  YOUR COLLECTIVE                                                    INCOMING INQUIRIES                                  |
|  Squad Alpha  •  4 of 5 Positions Filled                            One candidate has requested consideration:          |
|  Primary Domain: Distributed Systems                                                                                    |
|                                                                     * Jason K. (Rust & WebAssembly Engineer)            |
|  Teammates:                                                           "Contributed to custom consensus harness."        |
|  * Sarah C. (UI/UX)                                                   [ Review Candidate Credentials ]                  |
|  * Tom C. (Distributed Storage)                                                                                         |
|  * Elena R. (Testing Harness)                                       ACTIVE INVITATION TOKENS                            |
|                                                                     Token cc-inv-9821 valid for 22 hours.               |
|  [ Manage Collective Workspace -> ]                                                                                     |
+-------------------------------------------------------------------------------------------------------------------------+
```

---

## PART 3: Direction C — Dynamic Terminal / High-Contrast Velocity

Direction C is an ultra-dense, pure OLED black (`#000000`) and white 12-column bento board designed for pure keyboard-driven speed.

### Screen 1: Landing Page (`/`) — Direction C

```
+-------------------------------------------------------------------------------------------------------------------------+
| [CC] TERMINAL // CREWCONNECT-V1                     [STATUS: RS0-ONLINE] [PING: 14MS]            [LOGIN]  [REGISTER]    |
+-------------------------------------------------------------------------------------------------------------------------+
| +-------------------------------------------------------------+ +-----------------------------------------------------+ |
| | BENTO TILE 01: HEADLINE                                     | | BENTO TILE 02: ENGINE REALTIME STATS                | |
| | RACE-PROOF HACKATHON TEAM FORMATION                         | | RS: rs0 (PRIMARY)          UPTIME: 14,290s          | |
| | STRICT SERIALIZABILITY // ZERO PHANTOM JOINS                | | WRITABLE: TRUE             ISOLATION: SNAPSHOT      | |
| |                                                             | | SOCKET: ACTIVE             AUTH: STRICT             | |
| | [ EXPLORE SQUADS ]   [ RUN BURST TEST ]                     | | CONDITIONAL INC: ACTIVE    409 REJECTION: VERIFIED  | |
| +-------------------------------------------------------------+ +-----------------------------------------------------+ |
| +---------------------------------------+ +-----------------------------------+ +-------------------------------------+ |
| | BENTO TILE 03: SQUAD ALPHA            | | BENTO TILE 04: ZK-LAB             | | BENTO TILE 05: RECENT ATOMIC JOINS  | |
| | ID: SQ-001  //  4/5 FILLED            | | ID: SQ-002  //  3/5 FILLED        | | 15:22:04 - @elena_r -> SQ-001 [201] | |
| | NEEDS: RUST, RAFT, DISTRIBUTED        | | NEEDS: CIRCOM, WASM, SOL          | | 15:18:30 - CAP 4->5   -> SQ-001     | |
| | [ CLAIM SEAT (ATOMIC) ]               | | [ CLAIM SEAT (ATOMIC) ]           | | 14:45:12 - @m4ulik  -> AUTH_VERIFIED| |
| +---------------------------------------+ +-----------------------------------+ +-------------------------------------+ |
+-------------------------------------------------------------------------------------------------------------------------+
```

### Screen 2: Team Discovery (`/hackathons/:id/teams`) — Direction C

```
+-------------------------------------------------------------------------------------------------------------------------+
| [CC] CREWCONNECT / DIRECTORY                                   CMD+K FOR COMMAND PALETTE               [USER: @m4ulik]  |
+-------------------------------------------------------------------------------------------------------------------------+
| [>] SEARCH: rust___________________________________   [FILTER: VACANCIES_ONLY=TRUE]   SORT: SLOTS_REMAINING_DESC        |
+-----+----------------------+----------+---------+------------------------------+------------+---------------------------+
| IDX | SQUAD NAME           | CAPACITY | STATUS  | REQUIRED TECH STACK          | LEADER     | ACTION                    |
+-----+----------------------+----------+---------+------------------------------+------------+---------------------------+
| 001 | SQUAD ALPHA          | 4 / 5    | OPEN    | Rust, Raft, Distributed Node | @m4ulik    | [ ENTER SQUAD ]           |
| 002 | ZK PROOF LAB         | 3 / 5    | OPEN    | Circom, Rust, WASM           | @alex_k    | [ ENTER SQUAD ]           |
| 003 | NEURAL AUDIO         | 2 / 4    | OPEN    | PyTorch, C++, WebRTC         | @elena_r   | [ ENTER SQUAD ]           |
| 004 | HYPER-GRAPH          | 3 / 4    | OPEN    | Rust, GraphQL, Neo4j         | @kenji     | [ ENTER SQUAD ]           |
+-----+----------------------+----------+---------+------------------------------+------------+---------------------------+
```

### Screen 3: Dashboard (`/dashboard`) — Direction C

```
+-------------------------------------------------------------------------------------------------------------------------+
| [CC] COCKPIT // ACTIVE SESSION: @m4ulik                                      NODE: rs0   PING: 11MS   UPTIME: 14290s    |
+--------------------------------------+---------------------------------------+------------------------------------------+
| CURRENT SQUAD ASSIGNMENT             | INCOMING PROTOCOL REQUESTS            | SQUAD INVITATION FENCING                 |
| Squad: SQUAD ALPHA (SQ-001)          | Pending: 1 join request               | Token: cc_inv_9821_a7                    |
| Role: LEADER                         | Candidate: @jason_k (Rust Specialist) | Status: ACTIVE (1/1 Remaining)           |
| Slots: [■■■■□] 4/5 (1 Vacancy)       | [ APPROVE (201) ]   [ REJECT (200) ]  | [ COPY FENCED LINK ]   [ REVOKE TOKEN ]  |
+--------------------------------------+---------------------------------------+------------------------------------------+
| SERIALIZABLE AUDIT FEED (POST-COMMIT DISPATCH STREAM)                                                                   |
| 15:22:04 UTC  •  MEMBER_JOINED  •  Actor: @elena_r  •  Target: SQ-001  •  TxID: 6730a8f9001b (Committed rs0)            |
| 15:18:30 UTC  •  CAP_UPDATED    •  Actor: @m4ulik   •  Target: SQ-001  •  Payload: { maxCapacity: 5 }                  |
+-------------------------------------------------------------------------------------------------------------------------+
```

---

## PART 4: Comprehensive Page & Interaction Coverage (12 States)

The following wireframes specify exact component behaviors for every required state in the application lifecycle.

### State 1: Team Directory with Actual Team Entries (Normal Populated State)

```
+-------------------------------------------------------------------------------------------------------------------------+
| SQUAD ALPHA                                                                                                             |
| "Distributed consensus and concurrency visualizer for competitive hackathons."                                          |
| Leader: (MP) Maulik P.   •   Hackathon: Hack4Hack 2026   •   Timezone: UTC-5 to UTC+5:30 (Async)                          |
| Skills: [Node.js] [MongoDB] [React] [Rust]                                                                              |
| Capacity: [■■■■□] 4 of 5 (1 Seat Remaining)                                [ High Contention ]  [ View Squad Dossier -> ] |
+-------------------------------------------------------------------------------------------------------------------------+
| ZERO-KNOWLEDGE VERIFIER                                                                                                 |
| "Client-side private identity proofs using recursive SNARKs and WebAssembly."                                           |
| Leader: (AK) Alex K.   •   Hackathon: Hack4Hack 2026   •   Timezone: UTC+5:30 Core Hours                                 |
| Skills: [Circom] [WASM] [Solidity] [SnarkJS]                                                                            |
| Capacity: [■■■□□] 3 of 5 (2 Seats Remaining)                                                    [ View Squad Dossier -> ] |
+-------------------------------------------------------------------------------------------------------------------------+
```

### State 2: Team Directory with No Results (Empty Search / Filter State)

```
+-------------------------------------------------------------------------------------------------------------------------+
| [Search: "haskell, quantum"___________________________]      [x] Open Vacancies Only   [Skill Filter: Quantum Computing]|
+-------------------------------------------------------------------------------------------------------------------------+
|                                                                                                                         |
|                                         [ ICON: SearchSlash / RadarOff ]                                                |
|                                                                                                                         |
|                                      NO SQUADS MATCHING YOUR FILTER CRITERIA                                            |
|                    No teams in Hack4Hack 2026 match the query "haskell, quantum" with open vacancies.                   |
|                                                                                                                         |
|                                   [ Clear All Filters ]      [ + Create a New Squad ]                                   |
|                                                                                                                         |
+-------------------------------------------------------------------------------------------------------------------------+
```

### State 3: Team Detail with Vacancies (Open Seat Available)

```
+-------------------------------------------------------------------------------------------------------------------------+
| SQUAD ALPHA                                                                                                             |
| Status: [ OPEN FOR APPLICATIONS ]   •   Vacancies: 1 of 5 seats open   •   Leader: (MP) Maulik P.                       |
| Tagline: High-concurrency distributed consensus visualizer                                                              |
| Description: Developing a race-proof team formation harness with atomic conditional execution on MongoDB.               |
|                                                                                                                         |
| Current Squad Members (4 of 5):                                                                                         |
| 1. (MP) Maulik P.     [LEADER]     Backend & Architecture      UTC+5:30   [Node.js] [MongoDB] [TypeScript]              |
| 2. (SC) Sarah C.      [MEMBER]     Frontend & Design System    UTC-5      [React] [Tailwind] [UI/UX]                    |
| 3. (TC) Tom C.        [MEMBER]     Distributed Systems         UTC+1      [Distributed Systems] [Raft]                  |
| 4. (ER) Elena R.      [MEMBER]     QA & Load Testing           UTC-8      [Go] [k6] [Autocannon]                        |
| 5. [OPEN POSITION]    Seeking: Rust / Systems Engineer                                                                  |
|                                                                                                                         |
| +---------------------------------------------------------------------------------------------------------------------+ |
| | ACTION SELECTION                                                                                                    | |
| | [ Instant Direct Join (Atomic Reservation) ]           [ Submit Join Request to Leader ]                            | |
| | Uses Idempotency-Key header; commits atomically via    Sends your profile to the squad leader for review.            | |
| | MongoDB transaction. 409 Conflict if claimed first.    Recommended if you want to align on roles first.             | |
| +---------------------------------------------------------------------------------------------------------------------+ |
+-------------------------------------------------------------------------------------------------------------------------+
```

### State 4: Team Detail When Full (Roster Locked)

```
+-------------------------------------------------------------------------------------------------------------------------+
| SQUAD GAMMA                                                                                                             |
| Status: [ ROSTER LOCKED — FULL CAPACITY ]   •   Vacancies: 0 of 5 seats open   •   Leader: (DK) Dev Ken                 |
| Tagline: Full-stack AI agents and autonomous code execution harness                                                     |
|                                                                                                                         |
| Current Squad Members (5 of 5):                                                                                         |
| 1. (DK) Dev Ken       [LEADER]     Systems Architecture        UTC-5      [Python] [FastAPI] [LangChain]                |
| 2. (AL) Alice L.      [MEMBER]     Frontend Engineering        UTC-5      [Next.js] [TypeScript]                        |
| 3. (MR) Mike R.       [MEMBER]     Model Tuning & Eval         UTC+1      [PyTorch] [vLLM]                              |
| 4. (SW) Sophia W.     [MEMBER]     Cloud Infrastructure        UTC-8      [AWS] [Terraform]                             |
| 5. (JL) James L.      [MEMBER]     Security & Red Teaming      UTC+5:30   [AppSec] [Cryptography]                       |
|                                                                                                                         |
| +---------------------------------------------------------------------------------------------------------------------+ |
| | SQUAD AT MAXIMUM CAPACITY                                                                                           | |
| | This squad has filled all 5 sanctioned seats. No further joins or join requests can be submitted.                   | |
| | [ Direct Join Disabled (Team Full) ]                [ Join Requests Closed ]                                         | |
| |                                                                                                                     | |
| | Need a team? [ Explore Other Open Squads in Hack4Hack 2026 -> ]                                                     | |
| +---------------------------------------------------------------------------------------------------------------------+ |
+-------------------------------------------------------------------------------------------------------------------------+
```

### State 5: Join Request Pending (Awaiting Leader Review)

```
+-------------------------------------------------------------------------------------------------------------------------+
| SQUAD BETA                                                                                                              |
| Status: OPEN   •   Capacity: 3 of 4 Filled (1 Vacancy)   •   Leader: (AK) Alex K.                                       |
|                                                                                                                         |
| +---------------------------------------------------------------------------------------------------------------------+ |
| | [STATUS BANNER: YOUR JOIN REQUEST IS CURRENTLY PENDING REVIEW]                                                      | |
| | You submitted a request to join Squad Beta on Nov 10, 2026 at 14:10 UTC.                                            | |
| | Your message: "Hi Alex! I have 3 years experience with PyTorch and audio streaming runtimes."                       | |
| |                                                                                                                     | |
| | The leader has been notified. You may withdraw this request at any time prior to approval.                           | |
| |                                                                                                                     | |
| | [ Cancel Join Request ]                                                             [ Return to Team Directory ]    | |
| +---------------------------------------------------------------------------------------------------------------------+ |
+-------------------------------------------------------------------------------------------------------------------------+
```

### State 6: Invitation Accepted (Success Confirmation Banner)

```
+-------------------------------------------------------------------------------------------------------------------------+
| +---------------------------------------------------------------------------------------------------------------------+ |
| | [SUCCESS: INVITATION ACCEPTED — MEMBERSHIP CONFIRMED]                                                               | |
| | You have successfully redeemed invitation token `cc_inv_8192a` and joined Squad Alpha!                              | |
| |                                                                                                                     | |
| | Transaction ID: `6730a8f9001b`   •   Committed: 2026-11-10 15:22:04 UTC   •   Role: MEMBER                          | |
| | Your socket connection has been authorized and joined to room `team:SquadAlphaId`.                                  | |
| |                                                                                                                     | |
| | [ Open Squad Alpha Workspace -> ]                                      [ View Hackathon Dashboard ]                 | |
| +---------------------------------------------------------------------------------------------------------------------+ |
+-------------------------------------------------------------------------------------------------------------------------+
```

### State 7: Leader Workspace (Full Management Cockpit)

```
+-------------------------------------------------------------------------------------------------------------------------+
| SQUAD ALPHA WORKSPACE  [LEADER VIEW]                                           [STATUS: RECRUITING]  [Close Applications] |
+-------------------------------------------------------------------------------------------------------------------------+
| CONFIGURATION CONTROLS                                                                                                  |
| Squad Name: [ Squad Alpha                              ]   Max Capacity: [ 5 v] (Min 2, Max 10)   [ Save Changes ]     |
| Tagline:    [ Distributed consensus engine for hackathons                                                    ]          |
|                                                                                                                         |
| ROSTER CONTROLS (4 of 5 Members Confirmed)                                                                              |
| * (MP) Maulik P.     [LEADER]     Nov 09 22:15 UTC   [You are Leader]                                                   |
| * (SC) Sarah C.      [MEMBER]     Nov 10 01:20 UTC   [Transfer Leadership]   [Remove from Squad]                        |
| * (TC) Tom C.        [MEMBER]     Nov 10 04:12 UTC   [Transfer Leadership]   [Remove from Squad]                        |
| * (ER) Elena R.      [MEMBER]     Nov 10 09:44 UTC   [Transfer Leadership]   [Remove from Squad]                        |
|                                                                                                                         |
| PENDING INVITATIONS & JOIN REQUESTS                                                                                     |
| 1. Candidate (JK) Jason K. requested to join: "Built custom Raft consensus in Rust"      [Approve (201)]   [Reject (200)]|
| 2. Active Invite Token `cc_inv_9821` (1 use remaining, expires in 22h)                   [Copy Link]       [Revoke Token] |
|                                                                                                                         |
| [ + Generate Single-Use Invite Token ]                                                                                  |
|                                                                                                                         |
| DANGER ZONE                                                                                                             |
| [ Disband Squad Permanently ]  (Irrevocably removes all members, closes rooms, and deletes team from active search)     |
+-------------------------------------------------------------------------------------------------------------------------+
```

### State 8: Ordinary Member Workspace (Read-Only Roster with Self-Leave Action)

```
+-------------------------------------------------------------------------------------------------------------------------+
| SQUAD ALPHA WORKSPACE  [MEMBER VIEW]                                                                    Leader: Maulik P.|
+-------------------------------------------------------------------------------------------------------------------------+
| SQUAD INFORMATION                                                                                                       |
| Status: OPEN FOR RECRUITMENT   •   Capacity: 4 of 5 Members Confirmed   •   Your Role: MEMBER (Active)                  |
| Mission: Building a high-throughput consensus visualizer with strict serializability guarantees.                        |
|                                                                                                                         |
| SQUAD ROSTER                                                                                                            |
| 1. (MP) Maulik P.     [LEADER]     Backend & Architecture      UTC+5:30                                                 |
| 2. (SC) Sarah C.      [MEMBER]     Frontend & UI/UX            UTC-5  (You)                                             |
| 3. (TC) Tom C.        [MEMBER]     Distributed Systems         UTC+1                                                    |
| 4. (ER) Elena R.      [MEMBER]     QA & Load Testing           UTC-8                                                    |
|                                                                                                                         |
| MEMBER ACTIONS                                                                                                          |
| * Share Squad: [ Copy Public Squad Link ]                                                                               |
|                                                                                                                         |
| VOLUNTARY MEMBERSHIP TERMINATION                                                                                        |
| If you leave this squad, your seat will immediately become open for other candidates.                                   |
| You will be safely evicted from the team's private Socket.IO communication room upon transaction commit.                |
| [ Leave Squad Alpha ]                                                                                                   |
+-------------------------------------------------------------------------------------------------------------------------+
```

### State 9: Empty Dashboard (New User Not Yet in Any Team)

```
+-------------------+-----------------------------------------------------------------------------------------------------+
| [SIDEBAR (240px)] | Dashboard  /  Overview                                       [Socket: 12ms]  [Alerts (0)]  (MP) Maulik P. |
|                   +-----------------------------------------------------------------------------------------------------+
| [CC] CREWCONNECT  | WELCOME TO CREWCONNECT, MAULIK                                                                      |
|                   | You are registered for Hack4Hack Crew Hiring Challenge 2026. You are not currently in a squad.      |
| # Overview        +-----------------------------------------------------------------------------------------------------+
| # Explore Squads  |                                                                                                     |
| # Profile         |                             [ ICON: UsersRound / UserPlus / Compass ]                               |
|                   |                                                                                                     |
|                   |                                    YOU DON'T HAVE A SQUAD YET                                       |
|                   |             Hackathons are won by coordinated teams. You can either join an existing                |
|                   |                  squad looking for your skill profile, or establish your own squad.                 |
|                   |                                                                                                     |
|                   |                     [ Explore Teams Seeking Members -> ]      [ + Create a New Squad ]              |
|                   |                                                                                                     |
|                   +-----------------------------------------------------------------------------------------------------+
|                   | YOUR REGISTERED SKILL PROFILE                                                                       |
|                   | Technical Skills: [Node.js] [MongoDB] [TypeScript] [React] [Go]                                     |
|                   | Timezone: Asia/Kolkata (UTC+5:30)   •   Experience: ADVANCED                                        |
|                   | Profile Status: Complete   •   [ Edit Profile & Availability ]                                      |
+-------------------+-----------------------------------------------------------------------------------------------------+
```

### State 10: Dashboard with Active Membership (Populated Squad State)

```
+-------------------+-----------------------------------------------------------------------------------------------------+
| [SIDEBAR (240px)] | Dashboard  /  Overview                                       [Socket: 12ms]  [Alerts (2)]  (MP) Maulik P. |
|                   +-----------------------------------------------------------------------------------------------------+
| [CC] CREWCONNECT  | SQUAD ALPHA WORKSPACE OVERVIEW                                                                      |
|                   | Hack4Hack 2026 PS1   •   Your Role: LEADER   •   Next Deadline: Project Submission in 4 days        |
| # Overview        +-----------------------------------------------------------------------------------------------------+
| # Squad Alpha [1] | [ACTIVE SQUAD CARD]                                                                                 |
|   - Roster (4)    | Squad Alpha                                                            [STATUS: 1 VACANCY REMAINING]|
|   - Invites (1)   | Capacity: [■■■■□] 4 of 5 Seats Filled                                  [Manage Full Roster ->]      |
|   - Requests (1)  | Needed: Rust / Systems Engineer                                                                     |
| # Explore Squads  +-----------------------------------------------------------------------------------------------------+
| # Settings        | [DECISION CENTER: ACTIONS NEEDING ATTENTION]                                                        |
|                   | 1. Join Request from (JK) Jason K. ("Raft consensus in Rust")              [Approve]   [Reject]     |
|                   | 2. Invite token `cc-inv-9821` expires in 22h (0 of 1 claimed)              [Copy Link] [Revoke]     |
|                   +-----------------------------------------------------------------------------------------------------+
|                   | [REAL-TIME AUDIT LOG FEED]                                                                          |
|                   | 15:22:04 - (ER) Elena R. joined squad via direct join (Committed rs0)                               |
|                   | 15:18:30 - Team capacity increased 4 -> 5 by Maulik P.                                             |
+-------------------+-----------------------------------------------------------------------------------------------------+
```

### State 11: Loading and API Failure States

#### 11.1 Skeleton Loading State (During Initial Fetch)
```
+-------------------------------------------------------------------------------------------------------------------------+
| [Skeleton: 240px x 32px Title Bar]                                                                                      |
| [Skeleton: 400px x 16px Subtitle]                                                                                       |
+-------------------------------------------------------------------------------------------------------------------------+
| [Skeleton: Card 1]                                 [Skeleton: Card 2]                                                   |
| [████████████████████████████]                     [████████████████████████████]                                       |
| [████████████████]                                 [████████████████]                                                   |
| [████████████████████████████████████████]         [████████████████████████████████████████]                           |
+-------------------------------------------------------------------------------------------------------------------------+
```

#### 11.2 HTTP 409 Conflict Modal (When a Concurrent User Claims the Final Seat First)
```
+-------------------------------------------------------------------------------------------------------------------------+
|                                    +---------------------------------------------------+                                |
|                                    | [!] CAPACITY CONFLICT — SEAT ALREADY CLAIMED     |                                |
|                                    +---------------------------------------------------+                                |
|                                    | Another participant confirmed the final available |                                |
|                                    | seat in Squad Alpha immediately before your        |                                |
|                                    | transaction reached the primary database replica.  |                                |
|                                    |                                                   |                                |
|                                    | Error Code: `TEAM_FULL` (HTTP 409 Conflict)       |                                |
|                                    | Current Capacity: 5 of 5 Members Filled           |                                |
|                                    | Invariant Protected: Zero Phantom Memberships     |                                |
|                                    |                                                   |                                |
|                                    | Your database state has not been modified.        |                                |
|                                    |                                                   |                                |
|                                    | [ Explore Other Available Squads ]    [ Dismiss ] |                                |
|                                    +---------------------------------------------------+                                |
+-------------------------------------------------------------------------------------------------------------------------+
```

#### 11.3 Network Interruption & Reconnection Banner
```
+-------------------------------------------------------------------------------------------------------------------------+
| [!] DISCONNECTED FROM REAL-TIME DISPATCHER // Attempting reconnection (Attempt 3/5)... [Reconnect Now]                  |
+-------------------------------------------------------------------------------------------------------------------------+
```

---

### State 12: Mobile Navigation & Responsive Drawer

```
+---------------------------------------------------------------------------------------+
| [MOBILE TOP BAR (52px)]  [CC] CREWCONNECT         [Active: Squad Alpha (4/5)]  (MP)   |
+---------------------------------------------------------------------------------------+
| HACK4HACK 2026 SQUAD DIRECTORY                                                        |
|                                                                                       |
| [Search teams or skills...]                           [ Filter Options (1 Active) v ] |
|                                                                                       |
| +-----------------------------------------------------------------------------------+ |
| | SQUAD ALPHA                                                   [ 1 SEAT REMAINING ]| |
| | Hack4Hack 2026  •  Leader: Maulik P.                                              | |
| | Distributed consensus visualizer under partition.                                 | |
| | Capacity: [■■■■□] 4 of 5 Filled                                                   | |
| | Needs: [Rust] [Raft] [Distributed]                                                | |
| |                                                                                   | |
| | [ Claim Seat (Atomic) ]                             [ View Squad Details -> ]     | |
| +-----------------------------------------------------------------------------------+ |
|                                                                                       |
| +-----------------------------------------------------------------------------------+ |
| | ZK PROOF LAB                                                 [ 2 SEATS REMAINING ]| |
| | Hack4Hack 2026  •  Leader: Alex K.                                                | |
| | Client-side recursive SNARKs in WASM.                                             | |
| | Capacity: [■■■□□] 3 of 5 Filled                                                   | |
| | Needs: [Circom] [WASM] [Solidity]                                                 | |
| |                                                                                   | |
| | [ Claim Seat (Atomic) ]                             [ View Squad Details -> ]     | |
| +-----------------------------------------------------------------------------------+ |
|                                                                                       |
| +-----------------------------------------------------------------------------------+ |
| | MOBILE FILTER DRAWER (SLIDES UP FROM BOTTOM ON TAP)                                | |
| | * Hackathon Select: [ Hack4Hack 2026 v ]                                          | |
| | * [x] Open Vacancies Only                                                         | |
| | * Required Skills: [ Select Skills (2 selected) v ]                               | |
| | [ Apply Filters (14 Squads Match) ]                                               | |
| +-----------------------------------------------------------------------------------+ |
+---------------------------------------------------------------------------------------+
| [MOBILE BOTTOM BAR (56px FIXED)]                                                      |
|   [ (Home) ]      [ (Explore) ]     [ (My Squad) ]      [ (Alerts-2) ]    [ (Profile) ] |
+---------------------------------------------------------------------------------------+
```
