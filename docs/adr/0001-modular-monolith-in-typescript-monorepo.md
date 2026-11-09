# ADR-0001: Modular Monolith Architecture in TypeScript Monorepo

**Date**: 2026-11-09  
**Status**: accepted  
**Deciders**: Senior Software Architect, Technical Lead  

## Context

CrewConnect requires end-to-end type safety, high cohesion between shared validation schemas and frontend/backend code, and single-digit millisecond transaction latency across teams, memberships, invitations, and audit records. We needed to choose between a microservices architecture, a multi-repo setup, and a modular monolith inside a TypeScript monorepo.

## Decision

We adopt a **Modular Monolith** architecture housed inside a clean TypeScript monorepo (`apps/api`, `apps/web`, `packages/shared`). All domain modules (`auth`, `teams`, `memberships`, `invitations`) reside within the same backend runtime with strict internal domain boundaries.

## Alternatives Considered

### Alternative 1: Microservices Architecture
- **Pros**: Independent deployability of discovery vs. membership services.
- **Cons**: Requires distributed transactions (Sagas / 2PC) for race-proof joining, introducing network hops, partition hazards, and eventual consistency delays that jeopardize the hard invariants of PS1.
- **Why not**: Over-engineering that directly hurts transaction performance and ACID guarantees.

### Alternative 2: Multi-Repository Setup
- **Pros**: Separate access controls per codebase.
- **Cons**: Duplicated Zod schemas and TypeScript interfaces; versioning overhead between client and server.
- **Why not**: Hinders rapid full-stack iteration and increases risk of API drift.

## Consequences

### Positive
- Single-point MongoDB ACID transactions across collections without distributed overhead.
- Direct code reuse of Zod schemas and domain contracts between frontend and backend via `@crewconnect/shared`.
- Simplified CI/CD pipeline and single Docker Compose local development setup.

### Negative
- All backend modules share the same process memory and execution thread pool.

### Risks
- Domain boundary bleeding if engineers bypass module public APIs. Mitigated by strict module folder structure and lint boundaries.
