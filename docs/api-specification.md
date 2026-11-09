# CrewConnect — REST API Specification

**Document:** API Specification & Endpoint Contracts  
**Author:** Senior API Architect  
**Status:** Finalized & Approved  
**Version:** 1.1.0  
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
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "65e2b4f910a2b8e3a1f9a001",
        "email": "alex.dev@example.com",
        "displayName": "Alex Chen",
        "skills": ["TypeScript", "React", "Node.js"]
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```
- **Failure Cases**:
  - `409 Conflict`: `EMAIL_ALREADY_EXISTS`
  - `422 Unprocessable Entity`: Validation failure on email/password format.

### 2. `POST /auth/login`
- **Auth**: Public
- **Description**: Authenticates user and issues signed JWT in cookie and body.
- **Request Body**:
  ```json
  {
    "email": "alex.dev@example.com",
    "password": "StrongPassword123!"
  }
  ```
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
- **Success Response (200 OK)** (p95 < 200ms target):
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
- **Request Body**:
  ```json
  {
    "name": "Distributed Titans",
    "tagline": "Solving PS1 with race-proof algorithms",
    "description": "Experienced backend developers building high-throughput systems.",
    "skillsNeeded": ["Node.js", "MongoDB", "TypeScript"]
  }
  ```
- **Success Response (201 Created)**: Returns created team and leader membership.
- **Failure Cases**:
  - `409 Conflict`: `ALREADY_IN_TEAM` (User already has active team in this hackathon).
  - `409 Conflict`: `TEAM_NAME_TAKEN` (Name must be unique within hackathon).

### 3. `POST /teams/:id/disband` (Disband Team)
- **Auth**: Authenticated (Leader only)
- **Header**: `Idempotency-Key` (Required)
- **Description**: Atomically transitions team status to `DISBANDED`, sets `isOpen = false`, marks all active memberships as `LEFT`, and writes audit log.
- **Success Response (200 OK)**: `{ "success": true, "message": "Team disbanded successfully" }`
- **Failure Cases**:
  - `403 Forbidden`: `NOT_TEAM_LEADER`

---

## 4. Race-Proof Membership Module (`/teams/:id/memberships`)

### 1. `POST /teams/:id/join` (Direct Open Join — Core Concurrency Endpoint)
- **Auth**: Authenticated
- **Header**: `Idempotency-Key: <UUIDv4>` (Mandatory)
- **Description**: Executes the unified session-aware Mongoose transaction:
  1. Atomic capacity check & reservation on team document
  2. Increment memberCount
  3. Insert active membership
  4. Insert audit log
  5. Persist idempotency record
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
  - `409 Conflict`: `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` ("Idempotency key reused with different payload.")
  - `409 Conflict`: `CONCURRENCY_CONFLICT` ("Write conflict occurred under extreme contention. Please retry.")

### 2. `POST /teams/:id/leave` (Voluntary Departure)
- **Auth**: Authenticated (Member only)
- **Header**: `Idempotency-Key`
- **Description**: Atomically transitions membership to `LEFT`, decrements `memberCount`, writes audit record.
  - If the user is the **sole remaining member** (count = 1), the team is automatically transitioned to `status: "DISBANDED"`, `isOpen: false`, and `memberCount: 0`.
  - If the user is the **leader** and other members remain, departure is blocked until leadership is transferred.
- **Success Response (200 OK)**: `{ "success": true, "message": "Left team successfully" }`
- **Failure Cases**:
  - `400 Bad Request`: `LEADER_CANNOT_LEAVE` ("Leader cannot leave a multi-member team without transferring leadership.")

### 3. `DELETE /teams/:id/members/:userId` (Remove Member)
- **Auth**: Authenticated (Leader only)
- **Description**: Leader removes a member. Atomically decrements `memberCount`.
- **Success Response (200 OK)**: `{ "success": true, "message": "Member removed successfully" }`
- **Failure Cases**:
  - `403 Forbidden`: `NOT_TEAM_LEADER`
  - `400 Bad Request`: `CANNOT_REMOVE_SELF` (Leader cannot remove self)

### 4. `POST /teams/:id/transfer-leadership`
- **Auth**: Authenticated (Current Leader only)
- **Header**: `Idempotency-Key`
- **Request Body**:
  ```json
  {
    "newLeaderId": "65e2b4f910a2b8e3a1f9a055"
  }
  ```
- **Description**: Atomically inside an ACID transaction:
  1. Verifies `req.user.id` matches current `team.leaderId`.
  2. Verifies `newLeaderId` holds an active membership with `status: "ACTIVE"` in `teamId`.
  3. Updates `team.leaderId = newLeaderId`.
  4. Demotes old leader to `role: "MEMBER"`.
  5. Promotes new leader to `role: "LEADER"`.
  6. Appends `auditLogs` record.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "teamId": "65e2b4f910a2b8e3a1f9a010",
      "previousLeaderId": "65e2b4f910a2b8e3a1f9a001",
      "newLeaderId": "65e2b4f910a2b8e3a1f9a055"
    }
  }
  ```
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
  *(Database stores only `SHA-256("CREW-7X9K2M")`)*

### 2. `POST /invitations/redeem` (Redeem Invite Code)
- **Auth**: Authenticated
- **Header**: `Idempotency-Key`
- **Request Body**: `{ "inviteCode": "CREW-7X9K2M" }`
- **Description**: Hashes code, checks token validity, and routes through the unified transaction reservation engine.
- **Success Response (200 OK)**: Membership details.
- **Failure Cases**:
  - `400 Bad Request`: `INVITATION_INVALID` / `INVITATION_EXPIRED`
  - `409 Conflict`: `TEAM_FULL` / `ALREADY_IN_TEAM`

---

## 6. Join Requests Module (`/join-requests`)

### 1. `POST /teams/:id/join-requests`
- **Auth**: Authenticated (Non-member)
- **Request Body**: `{ "message": "Full-stack engineer with React/Node expertise" }`
- **Success Response (201 Created)**: Pending request entity.

### 2. `POST /join-requests/:requestId/resolve`
- **Auth**: Authenticated (Leader only)
- **Request Body**: `{ "decision": "APPROVED" }` (or `"REJECTED"`)
- **Description**: If `APPROVED`, executes the unified transaction reservation engine. If full, returns `409 TEAM_FULL`.
