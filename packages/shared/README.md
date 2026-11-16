# CrewConnect Shared Library (`packages/shared`)

Shared domain contracts, Zod validation schemas, TypeScript interfaces, error definitions, and system constants used across both `apps/api` and `apps/web`.

---

## 1. Responsibilities & Role

- **Single Source of Truth**: Enforces identical Data Transfer Objects (DTOs), request payloads, and response envelopes across backend and frontend codebases.
- **Isomorphic Input Validation**: Shared Zod schemas execute on client-side form submission and server-side request parsing.
- **Canonical Error Codes**: Defines typed domain error constants (e.g., `TEAM_FULL`, `ALREADY_IN_TEAM`, `INVITE_EXPIRED`, `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`).
- **System Invariants**: Houses shared system limits (minimum/maximum team sizes, pagination limits, token lifetimes).

---

## 2. Directory Structure

```
packages/shared/
├── src/
│   ├── constants/       # Role enums, hackathon statuses, and default limits
│   ├── errors/          # Standardized error codes (ERROR_CODES) and error interfaces
│   ├── schemas/         # Zod schemas (auth, team, join request, invitation)
│   ├── types/           # TypeScript interfaces (UserDTO, TeamDTO, MembershipDTO, etc.)
│   └── index.ts         # Library root export barrel
└── tests/               # Vitest contract and schema validation test suite
```

---

## 3. Development Commands

```bash
# Build TypeScript declarations and JavaScript outputs to dist/
npm run build --workspace=@crewconnect/shared

# Typecheck shared package
npm run typecheck --workspace=@crewconnect/shared

# Run Vitest shared test suite
npm test -- packages/shared
```
