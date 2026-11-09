# CrewConnect — Security Architecture & Hardening Guide

**Document:** Security Architecture  
**Author:** Senior Application Security Architect  
**Status:** Approved for Implementation  
**Version:** 1.0.0  

---

## 1. Security Philosophy: Defense-in-Depth

CrewConnect handles sensitive participant accounts, high-stakes competition team memberships, and private secret invite codes. Security is not an afterthought; it is built into every architectural layer through the principle of **Defense-in-Depth**.

---

## 2. Core Security Controls

### A. Password Hashing & Storage
- **Algorithm**: Argon2id (default) or bcrypt with work factor 12.
- **Salt Generation**: Cryptographically secure random salt generated per user (16 bytes minimum).
- **Enforcement**: Plaintext passwords never touch logs, database documents, or error messages.

### B. Authentication & Token Management
- **Token Format**: Standard JSON Web Tokens (JWT) signed using HMAC-SHA256 (`HS256`) with a minimum 256-bit random key (`JWT_SECRET`).
- **Transport Security**:
  - Tokens are transmitted primarily via `httpOnly`, `Secure` (in production), and `SameSite=Lax` cookies to prevent Cross-Site Scripting (XSS) extraction.
  - Optional support for `Authorization: Bearer <token>` headers for programmatic API/CLI testing.
- **Token Lifecycles**:
  - **Access Token**: Short-lived (15 minutes to 1 hour).
  - **Refresh Token**: 7-day rolling window, stored with hashed fingerprint in database; revoked on logout.

### C. Role-Based Access Control (RBAC) & Authorization
- **Domain Roles**:
  - `PLATFORM_ADMIN`: Global management (hackathon configuration).
  - `LEADER`: Hackathon participant holding active leadership of a specific team.
  - `MEMBER`: Hackathon participant belonging to a team.
  - `PARTICIPANT`: Solo registered participant without a team.
- **Authorization Guard**:
  Every team-mutating operation verifies ownership:
  ```typescript
  export async function requireTeamLeader(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const { teamId } = req.params;
    const team = await TeamModel.findById(teamId);
    if (!team) throw new AppError("Team not found", "NOT_FOUND", 404);
    if (team.leaderId.toString() !== req.user.id) {
      throw new AppError("Only the team leader can perform this action", "FORBIDDEN", 403);
    }
    next();
  }
  ```

### D. Strict Input Validation & Schema Whitelisting
- 100% of incoming data (request body, route params, query strings) must pass strict Zod validation schemas before reaching business logic.
- **No Direct Injection**: MongoDB query selectors never consume unparsed raw user objects, neutralizing NoSQL injection risks (e.g. `{ $gt: "" }`).

### E. Rate Limiting & Brute-Force Prevention
CrewConnect implements multi-tiered rate limiting using `express-rate-limit`:
1. **Global API Limiter**: 100 requests per 15-minute window per IP.
2. **Auth Limiter (`/api/v1/auth/login`, `/register`)**: 5 requests per 15-minute window per IP to eliminate credential stuffing.
3. **Sensitive Mutating Limiter (`/join`, `/invitations/redeem`)**: 10 requests per minute per IP / user to prevent brute-forcing secret invite codes.

### F. Cryptographic Secret Invite Code Security
- **Never Store Plaintext**: Invite codes (e.g. `CREW-7X9K2M`) are generated using Node.js `crypto.randomBytes` with high entropy.
- **One-Way Hash**: When stored in MongoDB, only `SHA-256(inviteCode)` is written to the `tokenHash` field:
  ```typescript
  const rawCode = `CREW-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const tokenHash = crypto.createHash("sha256").update(rawCode).digest("hex");
  ```
- **Redemption Verification**: During redemption, the user's submitted code is hashed in-memory and queried with an exact match index:
  ```typescript
  const candidateHash = crypto.createHash("sha256").update(inputCode).digest("hex");
  const invite = await InvitationModel.findOne({ tokenHash: candidateHash, status: "ACTIVE" });
  ```
  Even a total read-leak of the database provides zero usable invite codes.

### G. Cross-Origin Resource Sharing (CORS) & Security Headers
- **CORS Configuration**: Explicit origin whitelisting matching `CLIENT_URL` (e.g., `http://localhost:5173` or production domain). `Access-Control-Allow-Credentials: true`.
- **Security Headers (`helmet`)**:
  - `Content-Security-Policy`: Disables untrusted scripts and inline frames.
  - `X-Frame-Options: DENY`: Prevents clickjacking.
  - `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing.
  - `Strict-Transport-Security` (HSTS): Enforces HTTPS in production.

### H. WebSocket Connection Security
- Socket.IO handshakes are authenticated at the connection boundary:
  ```typescript
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.request.headers.cookie;
    try {
      const decoded = verifyJwt(token);
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error("Unauthorized WebSocket handshake"));
    }
  });
  ```
- Unauthorized sockets cannot listen to private team rooms or trigger events.

### I. Environment Secrets Management
- Sensitive values (`JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `MONGODB_URI`) are strictly loaded via `process.env`.
- `.env*` files are strictly added to `.gitignore`.
- Git commits are verified to ensure zero API keys or secrets are committed.

### J. Tamper-Evident Audit Logging
- Every critical security and membership event is appended to the `auditLogs` collection inside the same transaction that performed the mutation.
- Includes actor user ID, client IP address, user agent, target user, and before/after capacity metadata.
