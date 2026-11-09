# ADR-0007: Mongoose as Unified Data-Access Layer

**Date**: 2026-11-09  
**Status**: accepted  
**Deciders**: Senior Database Architect, Technical Lead  

## Context

We evaluated whether to use the low-level official MongoDB Node.js driver directly, Prisma ORM, or Mongoose ODM as our primary data-access layer. The solution requires strict schema validation, type safety, connection pooling, and seamless support for multi-document ACID transactions with session propagation.

## Decision

We standardize on **Mongoose** (v8.x+) as the sole, consistent data-access layer across all backend modules. All transactional operations and atomic conditional updates must use session-aware Mongoose operations (`.session(session)`). The native MongoDB driver will only be considered for a specific operation if there is an explicit, documented technical limitation in Mongoose.

## Alternatives Considered

### Alternative 1: Direct Native MongoDB Node.js Driver
- **Pros**: Bare-metal execution without ODM abstractions.
- **Cons**: Requires building custom schema validation, hook lifecycle management, and relationship population logic from scratch.
- **Why not**: Mongoose 8.x provides robust TypeScript definitions and first-class transaction sessions while retaining full access to low-level collection methods when needed.

### Alternative 2: Prisma ORM for MongoDB
- **Pros**: Strong type generation.
- **Cons**: Prisma's MongoDB connector has notable limitations around complex atomic array updates, conditional `$expr` increments, and low-level transaction session control compared to Mongoose.
- **Why not**: Sub-optimal for race-condition-sensitive atomic operations.

## Consequences

### Positive
- Unified modeling, validation, and schema definitions across all 8 collections.
- Clean session propagation via `Model.operation(..., { session })` for transactions.
- Automated timestamp tracking (`createdAt`, `updatedAt`) and query helpers.

### Negative
- Minor memory overhead compared to raw driver.

### Risks
- Accidental omission of `{ session }` in transactional operations. Mitigated by standardized transaction runner (`executeInTransaction`).
