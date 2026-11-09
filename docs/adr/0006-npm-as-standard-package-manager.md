# ADR-0006: npm as Standard Package Manager

**Date**: 2026-11-09  
**Status**: accepted  
**Deciders**: Technical Lead, Project Sponsor  

## Context

A clear and consistent package manager standard is essential for deterministic dependency resolution across local development, Docker builds, and GitHub Actions CI pipelines. We evaluated whether to use npm, pnpm, or yarn.

## Decision

We standardize exclusively on **npm** (version >= 10.0.0). We maintain the existing npm workspaces configuration (`apps/*`, `packages/*`) and a single, authoritative root `package-lock.json`. We will not migrate to pnpm or yarn.

## Alternatives Considered

### Alternative 1: pnpm Workspaces
- **Pros**: Fast symlinking and disk space savings.
- **Cons**: Requires additional CLI installation across developer environments and CI container images; potential phantom dependency hoisting differences.
- **Why not**: npm is pre-installed with Node.js LTS, minimizing setup friction and maintaining maximum compatibility.

### Alternative 2: Yarn (v1 or Berry)
- **Pros**: Established workspace management.
- **Cons**: Introduces extra configuration files (`.yarnrc`, PnP) and potential team friction.
- **Why not**: Adds unnecessary complexity without tangible architectural benefit over modern npm.

## Consequences

### Positive
- Zero prerequisites beyond Node.js LTS (npm is built-in).
- Fully reproducible builds using `npm ci` in Docker and CI workflows.
- Single root `package-lock.json` committed to source control.

### Negative
- Slightly longer initial `npm install` compared to pnpm hardlinks.

### Risks
- Dependency version drift. Mitigated by enforcing `npm ci` in all CI and Docker configurations.
