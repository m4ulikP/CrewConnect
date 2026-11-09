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

## 4. Race-Proof Membership Module (`/teams/:id`)

All capacity-modifying operations funnel through the centralized **SeatReservationService** ensuring invariant protection, session-aware transactional consistency, and two-phase fenced idempotency.

### 1. `POST /teams/:id/join` (Direct Open Join — Core Concurrency Endpoint)

- **Auth**: Authenticated
- **Header**: `Idempotency-Key: <string>` (Mandatory, 1-128 chars)
- **Execution Flow**:
  1. **Phase A (Outside Transaction)**: Atomic Idempotency Lease Acquisition (`status: "PROCESSING"`, 30s TTL, `ownerToken: UUID`).
  2. **Phase B (ACID Transaction with Exponential Backoff & Commit-Retry Separation)**:
     - Atomic capacity check and conditional reservation (`$expr: { $lt: ["$memberCount", "$maxCapacity"] }`, `$inc: { memberCount: 1 }`).
     - Insert active membership (guarded by compound partial unique index `{ hackathonId: 1, userId: 1 }` where `{ status: "ACTIVE" }`).
     - Insert auditable event log (`MEMBER_JOINED`).
     - Inside same transaction: fenced completion of idempotency lease (`status: "COMPLETED"`, cached response envelope, `$unset: { lockedAt: 1 }`).
  3. **Commit & Post-Processing**: On confirmed commit, return `201 Created`. On replay with identical payload, return cached response with `X-Cache: HIT`.
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
  - `400 Bad Request`: `IDEMPOTENCY_KEY_REQUIRED` ("Idempotency-Key header is required.")
  - `422 Unprocessable Entity`: `IDEMPOTENCY_KEY_INVALID` ("Invalid Idempotency-Key format.")
  - `409 Conflict`: `TEAM_FULL` ("The team has reached maximum capacity (5/5).")
  - `409 Conflict`: `TEAM_CLOSED` ("The team is not accepting new members.")
  - `409 Conflict`: `ALREADY_IN_TEAM` ("User is already a member of an active team in this hackathon.")
  - `409 Conflict`: `REQUEST_IN_PROGRESS` ("A request with this idempotency key is currently processing.")
  - `409 Conflict`: `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` ("Idempotency key reused with different request payload.")
  - `409 Conflict`: `LEASE_LOST` ("Idempotency lease ownership lost during execution. Transaction aborted.")
  - `409 Conflict`: `CONCURRENCY_CONFLICT` ("Operation failed due to concurrent write contention after max retries.")

### 2. `POST /teams/:id/join-requests` (Apply to Join Team)

- **Auth**: Authenticated
- **Header**: `Idempotency-Key: <string>` (Optional)
- **Request Body**:
  ```json
  {
    "message": "Specialized in distributed systems and consensus protocols."
  }
  ```
- **Description**: Submits candidate application to team leader. Enforces partial unique index `{ teamId: 1, userId: 1 }` where `{ status: "PENDING" }` to prevent duplicate pending applications.
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "65e2b4f910a2b8e3a1f9a088",
      "teamId": "65e2b4f910a2b8e3a1f9a010",
      "userId": "65e2b4f910a2b8e3a1f9a055",
      "status": "PENDING",
      "message": "Specialized in distributed systems and consensus protocols.",
      "createdAt": "2026-11-09T22:00:00.000Z"
    }
  }
  ```
- **Failure Cases**:
  - `409 Conflict`: `JOIN_REQUEST_ALREADY_EXISTS` ("You already have a pending join request for this team.")
  - `409 Conflict`: `ALREADY_IN_TEAM` ("User is already in an active team.")
  - `409 Conflict`: `TEAM_FULL` ("Team is already full.")

### 3. `GET /teams/:id/join-requests` (List Team Join Requests)

- **Auth**: Authenticated (Team Leader only)
- **Query Params**: `status` (default: "PENDING")
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "65e2b4f910a2b8e3a1f9a088",
        "userId": {
          "id": "65e2b4f910a2b8e3a1f9a055",
          "displayName": "Alex Chen",
          "email": "alex@example.com",
          "skills": ["TypeScript", "Distributed Systems"]
        },
        "status": "PENDING",
        "message": "Specialized in distributed systems.",
        "createdAt": "2026-11-09T22:00:00.000Z"
      }
    ]
  }
  ```

### 4. `POST /teams/:id/join-requests/:requestId/approve` (Approve Join Request)

- **Auth**: Authenticated (Team Leader only)
- **Header**: `Idempotency-Key: <string>` (Mandatory)
- **Description**: Executes `SeatReservationService.reserveSeatAndJoin` inside an ACID transaction with an `onBeforeCommit` hook that transitions `JoinRequest.status: "PENDING" -> "APPROVED"`.
- **Success Response (200 OK)**: Returns the newly created `MembershipRecord`.
- **Failure Cases**:
  - `403 Forbidden`: `NOT_TEAM_LEADER`
  - `404 Not Found`: `JOIN_REQUEST_NOT_FOUND`
  - `409 Conflict`: `TEAM_FULL` / `ALREADY_IN_TEAM`

### 5. `POST /teams/:id/join-requests/:requestId/reject` (Reject Join Request)

- **Auth**: Authenticated (Team Leader only)
- **Description**: Atomically transitions `JoinRequest.status: "PENDING" -> "REJECTED"`.
- **Success Response (200 OK)**: `{ "success": true, "message": "Join request rejected successfully." }`

### 6. `DELETE /teams/:id/join-requests/:requestId` (Cancel Own Join Request)

- **Auth**: Authenticated (Applicant only)
- **Description**: Atomically transitions `JoinRequest.status: "PENDING" -> "CANCELLED"`.
- **Success Response (200 OK)**: `{ "success": true, "message": "Join request cancelled successfully." }`

### 7. `POST /teams/:id/leave` (Voluntary Departure)

- **Auth**: Authenticated (Member only)
- **Header**: `Idempotency-Key`
- **Description**: Atomically transitions membership to `LEFT`, decrements `memberCount`, writes auditable log.
  - If the user is the **sole remaining member** (count = 1), the team is automatically transitioned to `status: "DISBANDED"`, `isOpen: false`, and `memberCount: 0`.
  - If the user is the **leader** and other members remain, departure is blocked until leadership is transferred.
- **Success Response (200 OK)**: `{ "success": true, "message": "Left team successfully" }`
- **Failure Cases**:
  - `400 Bad Request`: `LEADER_CANNOT_LEAVE` ("Leader cannot leave a multi-member team without transferring leadership.")

### 8. `DELETE /teams/:id/members/:userId` (Remove Member)

- **Auth**: Authenticated (Leader only)
- **Description**: Leader removes a member. Atomically decrements `memberCount` inside transaction.
- **Success Response (200 OK)**: `{ "success": true, "message": "Member removed successfully" }`
- **Failure Cases**:
  - `403 Forbidden`: `NOT_TEAM_LEADER`
  - `400 Bad Request`: `CANNOT_REMOVE_SELF` (Leader cannot remove self)

### 9. `POST /teams/:id/transfer-leadership`

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

## 5. Invitations Module (`/teams/:id/invitations` & `/invitations`)

### 1. `POST /teams/:id/invitations` (Generate Cryptographic Invitation)

- **Auth**: Authenticated (Leader only)
- **Request Body**:
  ```json
  {
    "inviteeId": "65e2b4f910a2b8e3a1f9a055",
    "maxUses": 1,
    "expiresInHours": 24
  }
  ```
- **Security Invariant**: Generates a 64-character hex secret (`crew_<randomBytes(32)>`).
  Only the `SHA-256(token)` is stored in MongoDB. The plaintext secret is returned **only once** in this response and is excluded from `toJSON` transforms and idempotency caches.
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "invitation": {
        "id": "65e2b4f910a2b8e3a1f9a077",
        "teamId": "65e2b4f910a2b8e3a1f9a010",
        "maxUses": 1,
        "usesCount": 0,
        "status": "ACTIVE",
        "expiresAt": "2026-11-10T22:00:00.000Z"
      },
      "token": "crew_7f8a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a"
    }
  }
  ```

### 2. `GET /teams/:id/invitations` (List Team Invitations)

- **Auth**: Authenticated (Leader only)
- **Success Response (200 OK)**: Returns array of active/revoked team invitations (without tokens or token hashes).

### 3. `DELETE /teams/:id/invitations/:invitationId` (Revoke Invitation)

- **Auth**: Authenticated (Leader only)
- **Description**: Transitions invitation status to `REVOKED`.
- **Success Response (200 OK)**: `{ "success": true, "message": "Invitation revoked successfully." }`

### 4. `POST /invitations/accept` (or `/invitations/redeem`) (Accept Invitation)

- **Auth**: Authenticated
- **Header**: `Idempotency-Key: <string>` (Mandatory)
- **Request Body**:
  ```json
  {
    "token": "crew_7f8a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a"
  }
  ```
- **Execution Flow**:
  1. Hashes input token with `SHA-256`.
  2. Resolves and validates invitation: must be `ACTIVE`, not expired, `usesCount < maxUses`, and matches `inviteeId` if account-scoped.
  3. Funnels into `SeatReservationService.reserveSeatAndJoin` with an `onBeforeCommit` hook that increments `usesCount` and marks `EXHAUSTED` if `usesCount + 1 >= maxUses`.
  4. Fenced idempotency lease completion in the same ACID transaction.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "teamId": "65e2b4f910a2b8e3a1f9a010",
      "membership": {
        "id": "65e2b4f910a2b8e3a1f9a099",
        "teamId": "65e2b4f910a2b8e3a1f9a010",
        "userId": "65e2b4f910a2b8e3a1f9a055",
        "role": "MEMBER",
        "status": "ACTIVE",
        "joinedAt": "2026-11-09T22:00:00.000Z"
      }
    }
  }
  ```
- **Failure Cases**:
  - `400 Bad Request`: `INVITATION_REVOKED` / `INVITATION_EXPIRED` / `INVITATION_EXHAUSTED` / `INVITATION_WRONG_ACCOUNT`
  - `404 Not Found`: `INVITATION_NOT_FOUND`
  - `409 Conflict`: `TEAM_FULL` / `ALREADY_IN_TEAM`

---

## 6. Audit & Activity Logs Module (`/audit`)

### 1. `GET /teams/:id/audit-logs`

- **Auth**: Authenticated (Team members only)
- **Query Params**: `page`, `limit`
- **Success Response (200 OK)**: Paginated chronological history from the auditable event log.
