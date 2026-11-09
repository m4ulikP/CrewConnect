# ADR-0010: MongoDB Replica Set via Docker Compose for Transaction Support

**Date**: 2026-11-09  
**Status**: accepted  
**Deciders**: Senior DevOps & Database Architect, Technical Lead  

## Context

MongoDB multi-document ACID transactions (`session.startTransaction()`) strictly require a replica set or sharded cluster; standalone MongoDB instances reject transactions with error `Transaction numbers are only allowed on a replica set member or mongos`.
To ensure local developer environments and CI test environments support transactions identically to production without requiring manual local MongoDB installations on developer host operating systems (e.g. Windows), we need a standardized containerized environment.

## Decision

We standardize on a **containerized MongoDB 7.0 single-node replica set (`rs0`) orchestrated via Docker Compose**:

1. **Service Architecture**:
   - Image: `mongo:7.0`.
   - Command: `mongod --replSet rs0 --bind_ip_all --port 27017`.
   - Replica Set Name: `rs0`.
   - Persistent Volume: `mongo-data` mapped to `/data/db`.
   - Healthcheck: Uses `mongosh` ping to test connection readiness:
     `test: ["CMD-SHELL", "mongosh --eval 'db.adminCommand({ ping: 1 })' --quiet"]`.
2. **Reliable Replica Set Initialization**:
   - An ephemeral initialization service or entrypoint script runs `mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })'`.
   - Idempotent: checks `rs.status().ok === 1` before initiating.
3. **Host Port Configuration**:
   - Default host port: `27017` mapped to container `27017`.
   - Configurable via environment variable: `MONGODB_PORT=${MONGODB_PORT:-27017}`.
   - Pre-startup verification: inspects port availability. If occupied by a local process, falls back to `27018`.
4. **Lifecycle Procedures**:
   - **Startup**: `docker compose up -d mongodb mongo-init`
   - **Status Check**: `docker compose ps`
   - **Replica Set Verification**: `docker compose exec mongodb mongosh --eval "rs.status()"`
   - **Shutdown**: `docker compose down` (preserves volume) or `docker compose down -v` (resets data).

## Alternatives Considered

### Alternative 1: Requiring Local Bare-Metal MongoDB on Windows
- **Pros**: Direct service on host.
- **Cons**: Requires complex Windows service configuration, manual replica set keyfile initialization, and environment variance across team members.
- **Why not**: Violates containerized reproducibility principles and creates developer onboarding friction.

### Alternative 2: In-Memory MongoDB (`mongodb-memory-server`) for Development
- **Pros**: Easy setup in Node.js processes.
- **Cons**: High memory consumption, slow binary downloads on cold starts, and differences in replica set failover semantics compared to real MongoDB 7.0.
- **Why not**: Fine for lightweight unit tests, but inadequate for end-to-end load testing and persistent development.

## Consequences

### Positive
- Identical multi-document transaction semantics across local development, CI runners, and production.
- Zero manual database installation needed on the host OS.
- Persistent data across container restarts.

### Negative
- Requires Docker Desktop to be running on the developer workstation.

### Risks
- Host port conflicts if port 27017 is already in use. Mitigated by configurable `MONGODB_PORT` and automated port availability checks.
