# CrewConnect — Production Deployment & Operations Guide

This guide details the production architecture, hosting prerequisites, environment configuration, database replica-set requirements, and step-by-step deployment runbooks for CrewConnect.

---

## 1. Production Architecture Overview

CrewConnect is designed as a high-concurrency modular monolith leveraging Node.js, Express, Socket.IO, and MongoDB Replica Set multi-document ACID transactions with a React Vite client SPA.

```
                    ┌─────────────────────────┐
                    │      Client Browser     │
                    │  (React 18 SPA + Vite)  │
                    └───────────┬─────────────┘
                                │ HTTPS / WSS
                                ▼
         ┌───────────────────────────────────────────────┐
         │             Reverse Proxy / CDN               │
         │          (Cloudflare / Render / NGINX)        │
         └──────────────┬─────────────────┬──────────────┘
                        │                 │
            /api/v1/*   │                 │  /socket.io/*
                        ▼                 ▼
         ┌───────────────────────────────────────────────┐
         │           CrewConnect API Service             │
         │    Express REST + Socket.IO Event Engine      │
         │   (Graceful Shutdown, Rate Limiting, CORS)    │
         └──────────────────────┬────────────────────────┘
                                │ MongoDB Driver Pool (maxPoolSize=200)
                                ▼
         ┌───────────────────────────────────────────────┐
         │          MongoDB Replica Set (rs0)            │
         │        (MongoDB Atlas M0+ or Self-Hosted)     │
         │    - Multi-Document ACID Transactions         │
         │    - Write Concern: majority                  │
         │    - Read Concern: majority                   │
         └───────────────────────────────────────────────┘
```

---

## 2. Infrastructure & Hosting Requirements

### A. MongoDB Replica Set (Mandatory)

- **Requirement**: MongoDB **v6.0+ or v7.0+** running as a **Replica Set** (`rs0`).
- **Why**: Multi-document transactions (`session.withTransaction` / `withTransactionRetry`) strictly require a replica set in MongoDB. A standalone MongoDB node cannot execute transactions and will reject seat-reservation operations with `Transaction numbers are only allowed on a storage engine supporting document-level locking and a replica set`.
- **Recommended Provider**: **MongoDB Atlas (Free Tier M0 or Dedicated M10+)**:
  - Automatically configured as a 3-node replica set with automated failover and TLS encryption by default.
  - Connection string format: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/crewconnect?retryWrites=true&w=majority`

### B. Application Compute & WebSocket Support

- **Requirement**: Compute platform supporting long-lived HTTP/1.1 or HTTP/2 connections with **WebSocket upgrades** (`Upgrade: websocket`) and **sticky sessions / polling fallback**.
- **Supported Platforms**:
  1. **Render.com** (Native WebSocket support, automatic HTTPS, zero-config PR previews).
  2. **Railway.app** (Zero-config Docker / Node runtime, WebSockets enabled out-of-the-box).
  3. **Fly.io** (Anycast global routing, lightweight microVMs).
  4. **Self-Hosted VPS (Docker Compose)**: DigitalOcean / Hetzner / AWS EC2 with NGINX reverse proxy.

---

## 3. Environment Variable Reference

| Variable                       | Required | Default / Example                                         | Purpose                                                                       |
| :----------------------------- | :------: | :-------------------------------------------------------- | :---------------------------------------------------------------------------- |
| `NODE_ENV`                     | **Yes**  | `production`                                              | Enforces production security invariants (blocks dev secrets, secures cookies) |
| `PORT`                         |    No    | `5000`                                                    | Port for the HTTP/Socket.IO server                                            |
| `CLIENT_URL`                   | **Yes**  | `https://crewconnect.yourdomain.com`                      | Allowed CORS and CSRF origin for frontend requests                            |
| `MONGODB_URI`                  | **Yes**  | `mongodb+srv://user:pass@cluster.mongodb.net/crewconnect` | Replica set connection URI with credentials and options                       |
| `MONGODB_DB_NAME`              |    No    | `crewconnect`                                             | Target MongoDB database name                                                  |
| `JWT_SECRET`                   | **Yes**  | _32+ byte hex string_                                     | Secret key for signing and verifying JWT authentication tokens                |
| `JWT_EXPIRES_IN`               |    No    | `1d`                                                      | Lifetime of issued authentication JWTs                                        |
| `COOKIE_SECURE`                |    No    | `true`                                                    | When `true`, session cookies are sent exclusively over HTTPS                  |
| `COOKIE_SAME_SITE`             |    No    | `lax`                                                     | SameSite cookie policy (`lax`, `strict`, or `none`)                           |
| `RATE_LIMIT_WINDOW_MS`         |    No    | `900000` (15 mins)                                        | Window duration for general API rate limiting                                 |
| `RATE_LIMIT_MAX_REQUESTS`      |    No    | `100`                                                     | Max API requests permitted per window per IP                                  |
| `JOIN_RATE_LIMIT_WINDOW_MS`    |    No    | `60000` (1 min)                                           | Window duration for seat reservation and invitation endpoints                 |
| `JOIN_RATE_LIMIT_MAX_REQUESTS` |    No    | `10`                                                      | Max join attempts permitted per minute per user/IP                            |

> [!IMPORTANT]
> In `production` mode (`NODE_ENV=production`), the application strictly validates that `JWT_SECRET` is set and does **not** match the development placeholder string. The process will throw a configuration error and exit immediately on startup if a weak or placeholder secret is detected.

---

## 4. Production Deployment Options

### Option A: Render.com (Recommended for Cloud Demonstration)

Render provides automated git-driven deployments, free managed TLS certificates, and native WebSocket support.

#### Step 1: Provision MongoDB Atlas Replica Set

1. Log in to [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a free **M0 Sandbox** (or dedicated M10) cluster in your preferred region.
3. In **Database Access**, create a database user (e.g. `crewconnect_admin`) with Read/Write privileges to `crewconnect`.
4. In **Network Access**, add `0.0.0.0/0` (or Render's outbound IP ranges) to allow cloud application access.
5. In **Database** > **Connect** > **Drivers (Node.js)**, copy the connection URI:
   ```
   mongodb+srv://crewconnect_admin:<PASSWORD>@crewcluster.mongodb.net/crewconnect?retryWrites=true&w=majority
   ```

#### Step 2: Deploy Blueprint via `render.yaml`

1. Push your repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** > **Blueprint**.
3. Select the `CrewConnect` repository. Render automatically reads the checked-in `render.yaml`.
4. Fill in the requested secret environment variables:
   - `MONGODB_URI`: Atlas connection string from Step 1.
   - `CLIENT_URL`: URL of the frontend web service (e.g. `https://crewconnect-web.onrender.com`).
   - `JWT_SECRET`: Generate a random 64-char hex string:
     ```bash
     openssl rand -hex 32
     ```
5. Click **Apply Blueprint**. Both the API Web Service and Web Static Site will compile and deploy automatically.

---

### Option B: Self-Hosted Docker Compose on VPS (EC2 / Hetzner / DigitalOcean)

For a self-contained production deployment running MongoDB `rs0`, API, and NGINX Web SPA on a single VPS:

#### Step 1: Clone Repository and Configure Production Environment

```bash
git clone https://github.com/m4ulikP/CrewConnect.git
cd CrewConnect

# Generate production environment file
cat <<EOF > .env.prod
NODE_ENV=production
PORT=5000
CLIENT_URL=http://YOUR_SERVER_IP
MONGODB_URI=mongodb://mongodb:27017/crewconnect?replicaSet=rs0
MONGODB_DB_NAME=crewconnect
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=1d
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
JOIN_RATE_LIMIT_WINDOW_MS=60000
JOIN_RATE_LIMIT_MAX_REQUESTS=10
EOF
```

#### Step 2: Launch the Stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

#### Step 3: Verify Container Health

```bash
docker compose -f docker-compose.prod.yml ps
```

Output confirms all containers are healthy:

- `crewconnect-prod-mongodb`: Up (healthy)
- `crewconnect-prod-mongo-init`: Exited (0) (replica set initialized)
- `crewconnect-prod-api`: Up (healthy)
- `crewconnect-prod-web`: Up (healthy)

---

## 5. Health & Readiness Verification

Once deployed, verify container health, liveness, and database replica set state using standard HTTP probes:

### 1. Process Liveness Probe

```bash
curl -I https://api.yourdomain.com/health/live
```

**Expected Response**: `HTTP/1.1 200 OK`

```json
{
  "status": "ok",
  "uptime": 128.4,
  "timestamp": "2026-11-10T08:00:00.000Z"
}
```

### 2. Container Readiness Probe

```bash
curl -I https://api.yourdomain.com/health/ready
```

**Expected Response**: `HTTP/1.1 200 OK`

```json
{
  "status": "ok",
  "timestamp": "2026-11-10T08:00:00.000Z",
  "uptime": 128.4,
  "database": {
    "connected": true,
    "status": "connected",
    "isReplicaSet": true,
    "replicaSet": "rs0"
  }
}
```

### 3. Comprehensive Health Status

```bash
curl https://api.yourdomain.com/health
```

Returns 200 with full replica set metadata and system version.

---

## 6. Database Initialization & Index Synchronization

On server startup, `apps/api/src/server.ts` automatically executes `syncAllIndexes()`, ensuring:

1. `User.email`: Unique, lowercase, sparse index.
2. `Membership`: Unique compound partial index `{ hackathonId: 1, userId: 1 }` where `status: "ACTIVE"` (Invariant: 1 active team per hackathon).
3. `Team`: Compound discovery sort index `{ hackathonId: 1, status: 1, isOpen: 1, createdAt: -1 }` (powers sub-200ms latency at 2,000 teams).
4. `Invitation.tokenHash`: Unique index on SHA-256 hashed secret tokens.
5. `IdempotencyRecord`: TTL expiration index on `expiresAt` (24-hour automatic document expiration).

To manually verify all database indexes from the CLI:

```bash
npx tsx scripts/verify-database-indexes.ts
```

---

## 7. Graceful Shutdown & Zero-Downtime Rolling Restarts

The API server intercepts `SIGTERM` and `SIGINT` signals:

1. Stops accepting new inbound HTTP requests (`server.close()`).
2. Broadcasts disconnect notices to all active Socket.IO clients and closes socket server.
3. Flushes ongoing database transactions and closes Mongoose connections.
4. Bounded by a 10-second unref watchdog timer to guarantee prompt exit.

Logs emitted on shutdown:

```
Received SIGTERM. Gracefully shutting down...
HTTP server closed.
Socket server closed.
Database connection closed.
```
