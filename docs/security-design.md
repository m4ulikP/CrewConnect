# CrewConnect — Security Architecture & Hardening Guide

**Document:** Security Architecture  
**Author:** Senior Application Security Architect  
**Status:** Finalized & Approved  
**Version:** 1.2.0  

---

## 1. Security Philosophy: Defense-in-Depth

CrewConnect enforces a strict **Defense-in-Depth** security posture to safeguard user accounts, competitive team rosters, and cryptographically protected invitation tokens.

---

## 2. Core Security Controls

### A. Password Hashing with Argon2id
- **Algorithm**: **Argon2id** (RFC 9106) — mathematically resistant to GPU cracking and side-channel timing attacks.
- **Production Parameters**:
  - Memory cost: **65,536 KiB (64 MB)**
  - Time cost (iterations): **3**
  - Parallelism: **1 thread/core**
  - Hash length: **32 bytes**
  - Salt: **16 cryptographically secure random bytes** (`crypto.randomBytes(16)`)
- **Sanitization**: Plaintext passwords never appear in application logs, database documents, or API error payloads.

### B. Authentication & Token Management
- **Token Mechanism**: Standard JSON Web Tokens (JWT) signed via HMAC-SHA256 (`HS256`) using a 256-bit secret key (`JWT_SECRET`).
- **Storage & Transport**:
  - Delivered via `httpOnly`, `Secure` (in production), and `SameSite=Lax` cookies to prevent Cross-Site Scripting (XSS) token extraction.
  - Optional support for `Authorization: Bearer <token>` headers for automated integration and k6 testing.
- **Token Lifecycles**:
  - Access Token: Short-lived (15 minutes).
  - Refresh Token: 7-day rolling window, stored with hashed fingerprint in database.

### C. Role-Based Access Control (RBAC) & Authorization
- **Domain Roles**: `PLATFORM_ADMIN`, `LEADER`, `MEMBER`, `PARTICIPANT`.
- **Leadership Guards**:
  - Operations modifying team profiles, inviting members, approving join requests, or removing members strictly verify `team.leaderId === req.user.id`.
  - Leadership transfers verify inside an ACID transaction that the target recipient is an active member (`status: "ACTIVE"`) of the same team.

### D. Scoped Idempotency Security & In-Flight Protection
- **Cross-Tenant Isolation**: Idempotency records are scoped to `{ key, userId, endpoint }`. A malicious user cannot guess, hijack, or replay another user's idempotency key.
- **Payload Integrity Fingerprint**: The request payload is hashed (`SHA-256(JSON.stringify(req.body))`) upon receipt. If a client attempts to reuse a key with altered parameters, the request is blocked with `409 Conflict (IDEMPOTENCY_KEY_PAYLOAD_MISMATCH)`.
- **Atomic Two-Phase Lease**: Executed outside the business transaction with a 30-second lease expiry. Parallel concurrent requests within the lease window receive `409 Conflict (REQUEST_IN_PROGRESS)`, preventing concurrent transaction launches.

### E. Cryptographic Secret Invite Code Security
- **High Entropy**: Generated via Node.js `crypto.randomBytes(4)` formatted as `CREW-XXXXXX` (minimum 32-bit to 64-bit entropy).
- **One-Way SHA-256 Hashing**: Only the SHA-256 digest is stored in the database. When a participant redeems a code, the backend hashes the incoming code in-memory and executes an exact-match query against `tokenHash`. Plaintext codes are never stored on disk.

### F. Rate Limiting & Brute-Force Prevention
- **Global API Limiter**: 100 requests per 15-minute window per IP.
- **Authentication Limiter (`/login`, `/register`)**: 5 attempts per 15-minute window per IP.
- **Sensitive Operations (`/join`, `/redeem`)**: 10 requests per minute per IP / user.

### G. Cross-Origin Resource Sharing (CORS) & HTTP Headers
- **CORS**: Explicit origin whitelisting matching `CLIENT_URL`. `Access-Control-Allow-Credentials: true`.
- **Security Headers (`helmet`)**:
  - `Content-Security-Policy`: Restricts scripts and framing.
  - `X-Frame-Options: DENY`: Blocks clickjacking.
  - `X-Content-Type-Options: nosniff`: Prevents MIME confusion.

### H. WebSocket Connection Security
- Socket.IO handshakes require valid JWT tokens. Unauthenticated sockets are severed immediately. Authenticated sockets join isolated rooms scoped by user ID and team ID. External real-time events are emitted only after confirmed database commits.

### I. Auditable Event Log: Scope & Security Boundaries
- **Scope**: Every critical state transition (`TEAM_CREATED`, `MEMBER_JOINED`, `MEMBER_LEFT`, `MEMBER_REMOVED`, `LEADERSHIP_TRANSFERRED`, `TEAM_DISBANDED`) is recorded in `auditLogs` within the same business transaction.
- **Security Clarification & Boundaries**:
  - The audit log provides **operational accountability**, full chronological traceability, and actor identity metadata for competitive fairness.
  - **Limitations**: Records are stored as standard MongoDB documents. They do not constitute an immutable cryptographic blockchain or hardware-backed write-once-read-many (WORM) storage. A privileged MongoDB superuser with direct database write credentials can technically alter or remove documents. This design meets the hackathon challenge requirements cleanly without introducing excessive architectural complexity.
