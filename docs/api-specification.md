# CrewConnect — REST API Specification

**Document:** API Specification & Endpoint Contracts  
**Author:** Senior API Architect  
**Status:** Approved for Implementation  
**Version:** 1.0.0  
**Base URL:** `/api/v1`  

---

## 1. Global Conventions & Standards

### Headers
- `Content-Type: application/json`
- `Authorization: Bearer <jwt_token>` (or transmitted via `httpOnly` cookie `token`)
- `Idempotency-Key: <UUIDv4>` (Required on all mutating `POST`, `PUT`, `DELETE` operations)

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
- **Description**: Registers a new participant account.
- **Request Body**:
  ```json
  {
    "email": "alex.dev@example.com",
    "password": "StrongPassword123!",
    "displayName": "Alex Chen",
    "skills": ["TypeScript", "React", "Node.js"]
  }
  ```
- **Validation**:
  - `email`: Valid email format, lowercase.
  - `password`: Minimum 8 characters, at least 1 number, 1 special character.
  - `displayName`: 2–50 characters.
  - `skills`: Array of 1–20 strings.
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
- **Success Response (200 OK)**: Returns currently logged-in user profile and active memberships.

### 4. `POST /auth/logout`
- **Auth**: Authenticated
- **Success Response (200 OK)**: Clears `token` cookie.

---

## 3. User Profile Module (`/users`)

### 1. `GET /users/:id`
- **Auth**: Authenticated
- **Success Response (200 OK)**: Public profile including bio, skills, GitHub URL, experience level.

### 2. `PATCH /users/me`
- **Auth**: Authenticated (Self only)
- **Request Body**:
  ```json
  {
    "displayName": "Alex Chen",
    "bio": "Full-stack engineer focusing on distributed systems.",
    "skills": ["TypeScript", "MongoDB", "Express", "Docker"],
    "experienceLevel": "INTERMEDIATE",
    "githubUrl": "https://github.com/alexchen"
  }
  ```
- **Success Response (200 OK)**: Updated user entity.

---

## 4. Hackathon Module (`/hackathons`)

### 1. `GET /hackathons`
- **Auth**: Public / Authenticated
- **Query Params**: `status` (`UPCOMING | ACTIVE | COMPLETED`), `page`, `limit`
- **Success Response (200 OK)**: List of hackathons with metadata.

### 2. `GET /hackathons/:id`
- **Auth**: Public / Authenticated
- **Success Response (200 OK)**: Detailed hackathon info, size boundaries (`minTeamSize: 1`, `maxTeamSize: 5`).

---

## 5. Team Module (`/hackathons/:hackathonId/teams`)

### 1. `GET /hackathons/:hackathonId/teams` (Discovery Board)
- **Auth**: Authenticated
- **Query Params**:
  - `page`: default 1
  - `limit`: default 20 (max 50)
  - `search`: string (matches team name or tagline)
  - `hasVacancies`: boolean (if true, filters `memberCount < maxCapacity`)
  - `skills`: comma-separated string (`React,Node.js`)
- **Success Response (200 OK)** (Must meet p95 < 200ms target):
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
- **Validation Rules**:
  - User cannot already belong to any team in this `hackathonId`.
- **Success Response (201 Created)**: Returns created team and leader membership.
- **Failure Cases**:
  - `409 Conflict`: `ALREADY_IN_TEAM` (User already has active team).
  - `409 Conflict`: `TEAM_NAME_TAKEN` (Name must be unique within hackathon).

### 3. `GET /teams/:id`
- **Auth**: Authenticated
- **Success Response (200 OK)**: Complete team details, active roster with members, roles, and open status.

### 4. `PATCH /teams/:id`
- **Auth**: Authenticated (Leader only)
- **Request Body**: Partial team fields (`name`, `tagline`, `description`, `skillsNeeded`, `isOpen`).
- **Failure Cases**:
  - `403 Forbidden`: `NOT_TEAM_LEADER`

---

## 6. Race-Proof Membership Module (`/teams/:id/memberships`)

### 1. `POST /teams/:id/join` (Direct Open Join — Core Concurrency Endpoint)
- **Auth**: Authenticated
- **Header**: `Idempotency-Key: <UUIDv4>` (Mandatory)
- **Description**: Joins an open team with vacant seats. Executes Tier-1 atomic reservation + Tier-2 ACID transaction.
- **Request Body**: `{}` (Empty)
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
  - `409 Conflict`: `CONCURRENCY_CONFLICT` ("Write conflict occurred. Please retry.")

### 2. `POST /teams/:id/leave` (Voluntary Departure)
- **Auth**: Authenticated (Member only; Leaders cannot leave without transferring leadership first)
- **Header**: `Idempotency-Key`
- **Description**: Transitions membership to `LEFT`, atomically decrements team `memberCount`, writes audit record.
- **Success Response (200 OK)**: `{ "success": true, "message": "Left team successfully" }`
- **Failure Cases**:
  - `400 Bad Request`: `LEADER_CANNOT_LEAVE` ("Leaders must transfer leadership or disband team.")

### 3. `DELETE /teams/:id/members/:userId` (Remove Member)
- **Auth**: Authenticated (Leader only)
- **Description**: Removes a member from the team. Atomically decrements `memberCount`.
- **Success Response (200 OK)**: `{ "success": true, "message": "Member removed successfully" }`
- **Failure Cases**:
  - `403 Forbidden`: `NOT_TEAM_LEADER`
  - `400 Bad Request`: `CANNOT_REMOVE_SELF` (Leader cannot remove themselves)

### 4. `POST /teams/:id/transfer-leadership`
- **Auth**: Authenticated (Current Leader only)
- **Header**: `Idempotency-Key`
- **Request Body**:
  ```json
  {
    "newLeaderId": "65e2b4f910a2b8e3a1f9a055"
  }
  ```
- **Description**: Atomically demotes current leader to `MEMBER`, promotes `newLeaderId` to `LEADER`, updates `team.leaderId`. All in a single ACID transaction.
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

---

## 7. Invitations & Secret Code Module (`/invitations`)

### 1. `POST /teams/:id/invitations/code` (Generate Secret Code)
- **Auth**: Authenticated (Leader only)
- **Request Body**:
  ```json
  {
    "maxUses": 1,
    "expiresInHours": 24
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "inviteCode": "CREW-7X9K2M",
      "expiresAt": "2026-11-10T22:00:00.000Z",
      "maxUses": 1
    }
  }
  ```
  *(Note: Backend stores only `SHA-256("CREW-7X9K2M")` in database)*

### 2. `POST /invitations/redeem` (Redeem Invite Code)
- **Auth**: Authenticated
- **Header**: `Idempotency-Key`
- **Request Body**:
  ```json
  {
    "inviteCode": "CREW-7X9K2M"
  }
  ```
- **Description**: Hashes input code with SHA-256, looks up invitation, checks expiry and max uses, executes race-proof Tier-1 reservation on target team.
- **Success Response (200 OK)**: Membership entity.
- **Failure Cases**:
  - `400 Bad Request`: `INVITATION_INVALID` / `INVITATION_EXPIRED`
  - `409 Conflict`: `TEAM_FULL` / `ALREADY_IN_TEAM`

---

## 8. Join Requests Module (`/join-requests`)

### 1. `POST /teams/:id/join-requests`
- **Auth**: Authenticated (Non-member)
- **Request Body**:
  ```json
  {
    "message": "Hi, I have 4 years of React and Node experience and would love to build the UI!"
  }
  ```
- **Success Response (201 Created)**: Returns pending request entity.

### 2. `POST /join-requests/:requestId/resolve`
- **Auth**: Authenticated (Leader only)
- **Request Body**:
  ```json
  {
    "decision": "APPROVED" // or "REJECTED"
  }
  ```
- **Description**: If `APPROVED`, executes atomic reservation and creates membership. If team has filled in the meantime, returns `409 TEAM_FULL`.

---

## 9. Recommendations Module (`/recommendations`)

### 1. `GET /hackathons/:hackathonId/recommendations/teams`
- **Auth**: Authenticated
- **Description**: Returns recommended teams for the authenticated user based on complementary skill overlap.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "team": { "id": "...", "name": "Code Crafters" },
        "matchScore": 0.85,
        "matchedSkills": ["TypeScript", "MongoDB"],
        "missingSkills": ["DevOps"]
      }
    ]
  }
  ```

---

## 10. Audit Logs Module (`/audit`)

### 1. `GET /teams/:id/audit-logs`
- **Auth**: Authenticated (Team members only)
- **Query Params**: `page`, `limit`
- **Success Response (200 OK)**: Paginated chronological history of all team mutations.
