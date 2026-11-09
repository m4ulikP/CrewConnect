# CrewConnect — REST API Specification

**Document:** API Specification & Endpoint Contracts  
**Author:** Senior API Architect  
**Status:** Finalized & Approved  
**Version:** 1.2.0  
**Base URL:** `/api/v1`

---

## 1. Global Conventions & Standards

### Headers

- `Content-Type: application/json`
- `Authorization: Bearer <jwt_token>` (or transmitted via `httpOnly` cookie `token`)
- `Idempotency-Key: <UUIDv4>` (Mandatory on all mutating `POST`, `PUT`, `DELETE` operations)

### Standard Response Envelope

All API responses adhere to standard envelopes:

#### Success Envelope

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

#### Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human readable summary",
    "details": {},
    "timestamp": "2026-11-09T22:00:00.000Z"
  }
}
```

---

## 2. Authentication Module (`/auth`)

### 1. `POST /auth/register`

- **Auth**: Public
- **Description**: Registers a new participant account. Passwords hashed using **Argon2id**.
- **Request Body**:
  ```json
  {
    "email": "alex.dev@example.com",
    "password": "StrongPassword123!",
    "displayName": "Alex Chen",
    "skills": ["TypeScript", "React", "Node.js"]
  }
  ```
- **Success Response (201 Created)**: Returns user profile and signed JWT token.
- **Failure Cases**:
  - `409 Conflict`: `EMAIL_ALREADY_EXISTS`
  - `422 Unprocessable Entity`: Validation failure on email/password format.

### 2. `POST /auth/login`

- **Auth**: Public
- **Description**: Authenticates user and issues signed JWT in cookie and body.
- **Success Response (200 OK)**: Set-Cookie: `token=...; HttpOnly; Secure; SameSite=Lax`
- **Failure Cases**:
  - `401 Unauthorized`: `INVALID_CREDENTIALS`
  - `429 Too Many Requests`: Rate limit triggered (5 attempts per 15 min).

### 3. `GET /auth/me`

- **Auth**: Authenticated
- **Success Response (200 OK)**: Returns profile and active team memberships.

### 4. `POST /auth/logout`

- **Auth**: Authenticated
- **Success Response (200 OK)**: Clears `token` cookie.

---

## 3. Team Module (`/hackathons/:hackathonId/teams`)

### 1. `GET /hackathons/:hackathonId/teams` (Discovery Board)

- **Auth**: Authenticated
- **Query Params**:
  - `page`: default 1
  - `limit`: default 20 (max 50)
  - `search`: string (matches team name or tagline)
  - `hasVacancies`: boolean (if true, filters `memberCount < maxCapacity`)
  - `skills`: comma-separated string (`React,Node.js`)
- **Success Response (200 OK)** (Target p95 latency < 200ms):
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "65e2b4f910a2b8e3a1f9a010",
        "name": "Kernel Panic",
        "tagline": "Building an AI-driven dev agent",
        "memberCount": 4,
        "maxCapacity": 5,
        "isOpen": true,
        "status": "ACTIVE",
        "skillsNeeded": ["Rust", "DevOps"],
        "leader": {
          "id": "65e2b4f910a2b8e3a1f9a001",
          "displayName": "Alex Chen"
        },
        "createdAt": "2026-11-09T18:00:00.000Z"
      }
    ],
    "meta": { "page": 1, "limit": 20, "total": 240 }
  }
  ```

### 2. `POST /hackathons/:hackathonId/teams` (Create Team)

- **Auth**: Authenticated
- **Header**: `Idempotency-Key` (Required)
- **Success Response (201 Created)**: Returns created team and leader membership.
- **Failure Cases**:
  - `409 Conflict`: `ALREADY_IN_TEAM` (User already has active team in this hackathon).
  - `409 Conflict`: `TEAM_NAME_TAKEN` (Name must be unique within hackathon).

### 3. `POST /teams/:id/disband` (Disband Team)

- **Auth**: Authenticated (Leader only)
- **Header**: `Idempotency-Key` (Required)
- **Description**: Atomically transitions team status to `DISBANDED`, sets `isOpen = false`, marks all active memberships as `LEFT`, and writes auditable event log.
- **Success Response (200 OK)**: `{ "success": true, "message": "Team disbanded successfully" }`
- **Failure Cases**:
  - `403 Forbidden`: `NOT_TEAM_LEADER`

---

## 4. Race-Proof Membership Module (`/teams/:id/memberships`)

### 1. `POST /teams/:id/join` (Direct Open Join — Core Concurrency Endpoint)

- **Auth**: Authenticated
- **Header**: `Idempotency-Key: <UUIDv4>` (Mandatory)
- **Execution Flow**:
  1. Atomic Idempotency Lease Acquisition outside business transaction (30s lease expiry).
  2. Unified Session-Aware Mongoose Business Transaction:
     - Atomic capacity check and conditional reservation (`$expr: { $lt: ["$memberCount", "$maxCapacity"] }`, `$inc: { memberCount: 1 }`).
     - Insert active membership (guarded by unique compound index `{ hackathonId: 1, userId: 1 }`).
     - Insert auditable event log.
  3. On confirmed commit: Update idempotency record to `COMPLETED` and emit Socket.IO events.
  4. On failure: Clean up idempotency lease and abort transaction.
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "membershipId": "65e2b4f910a2b8e3a1f9a099",
      "teamId": "65e2b4f910a2b8e3a1f9a010",
      "userId": "65e2b4f910a2b8e3a1f9a055",
      "role": "MEMBER",
      "status": "ACTIVE",
      "currentMemberCount": 5,
      "maxCapacity": 5,
      "joinedAt": "2026-11-09T22:00:00.000Z"
    }
  }
  ```
- **Failure Cases**:
  - `409 Conflict`: `TEAM_FULL` ("The team has reached maximum capacity (5/5).")
  - `409 Conflict`: `TEAM_CLOSED` ("The team is not accepting new members.")
  - `409 Conflict`: `ALREADY_IN_TEAM` ("User is already a member of a team in this hackathon.")
  - `409 Conflict`: `REQUEST_IN_PROGRESS` ("A request with this idempotency key is currently processing.")
  - `409 Conflict`: `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` ("Idempotency key reused with different request payload.")
  - `409 Conflict`: `LEASE_LOST` ("Idempotency lease ownership lost during execution. Transaction aborted.")
  - `409 Conflict`: `CONCURRENCY_CONFLICT` ("Operation failed due to concurrent write contention. Please retry.")

### 2. `POST /teams/:id/leave` (Voluntary Departure)

- **Auth**: Authenticated (Member only)
- **Header**: `Idempotency-Key`
- **Description**: Atomically transitions membership to `LEFT`, decrements `memberCount`, writes auditable log.
  - If the user is the **sole remaining member** (count = 1), the team is automatically transitioned to `status: "DISBANDED"`, `isOpen: false`, and `memberCount: 0`.
  - If the user is the **leader** and other members remain, departure is blocked until leadership is transferred.
- **Success Response (200 OK)**: `{ "success": true, "message": "Left team successfully" }`
- **Failure Cases**:
  - `400 Bad Request`: `LEADER_CANNOT_LEAVE` ("Leader cannot leave a multi-member team without transferring leadership.")

### 3. `DELETE /teams/:id/members/:userId` (Remove Member)

- **Auth**: Authenticated (Leader only)
- **Description**: Leader removes a member. Atomically decrements `memberCount` inside transaction.
- **Success Response (200 OK)**: `{ "success": true, "message": "Member removed successfully" }`
- **Failure Cases**:
  - `403 Forbidden`: `NOT_TEAM_LEADER`
  - `400 Bad Request`: `CANNOT_REMOVE_SELF` (Leader cannot remove self)

### 4. `POST /teams/:id/transfer-leadership`

- **Auth**: Authenticated (Current Leader only)
- **Header**: `Idempotency-Key`
- **Request Body**: `{ "newLeaderId": "65e2b4f910a2b8e3a1f9a055" }`
- **Description**: Atomically swaps roles inside an ACID transaction: current leader demoted to `MEMBER`, target promoted to `LEADER`, `team.leaderId` updated.
- **Success Response (200 OK)**: Returns updated team leadership metadata.
- **Failure Cases**:
  - `403 Forbidden`: `NOT_TEAM_LEADER`
  - `400 Bad Request`: `TARGET_USER_NOT_ACTIVE_MEMBER`
  - `409 Conflict`: `CONCURRENCY_CONFLICT`

---

## 5. Invitations Module (`/invitations`)

### 1. `POST /teams/:id/invitations/code` (Generate Secret Code)

- **Auth**: Authenticated (Leader only)
- **Request Body**: `{ "maxUses": 1, "expiresInHours": 24 }`
- **Success Response (201 Created)**: Returns `{ inviteCode: "CREW-7X9K2M", expiresAt: "...", maxUses: 1 }`.
  _(Database stores only `SHA-256("CREW-7X9K2M")`)_

### 2. `POST /invitations/redeem` (Redeem Invite Code)

- **Auth**: Authenticated
- **Header**: `Idempotency-Key`
- **Request Body**: `{ "inviteCode": "CREW-7X9K2M" }`
- **Description**: Hashes input code, verifies validity, and executes the race-proof reservation transaction.
- **Success Response (200 OK)**: Membership details.
- **Failure Cases**:
  - `400 Bad Request`: `INVITATION_INVALID` / `INVITATION_EXPIRED`
  - `409 Conflict`: `TEAM_FULL` / `ALREADY_IN_TEAM`

---

## 6. Audit & Activity Logs Module (`/audit`)

### 1. `GET /teams/:id/audit-logs`

- **Auth**: Authenticated (Team members only)
- **Query Params**: `page`, `limit`
- **Success Response (200 OK)**: Paginated chronological history from the auditable event log.
