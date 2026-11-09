# CrewConnect Shared Package (`packages/shared`)

Shared domain contracts, Zod validation schemas, TypeScript interfaces, and error codes used across both `apps/api` and `apps/web`.

## Scope & Architectural Role
- **Type Safety**: Enforces single source of truth for DTOs and API responses across frontend and backend.
- **Validation**: Reusable Zod schemas executed on client-side form submit and server-side request parsing.
- **Error Codes**: Unified enumeration of domain error codes (e.g., `TEAM_FULL`, `ALREADY_IN_TEAM`, `INVITE_EXPIRED`).

## Contents (Planned for Implementation in Phase 2)
- `src/types/`: Domain models (User, Hackathon, Team, Membership, Invitation)
- `src/schemas/`: Zod schemas for request validation
- `src/errors/`: Standardized error codes and error response shapes
- `src/events/`: WebSocket event names and payload typings

> **Status**: Architecture and specifications defined in Phase 1. Implementation starts upon approval in Phase 2.
