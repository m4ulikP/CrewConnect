# CrewConnect API Service (`apps/api`)

Backend REST API and real-time WebSocket service for the CrewConnect platform.

## Scope & Architectural Role

- **Runtime**: Node.js v20+ LTS
- **Framework**: Express with TypeScript
- **Database Engine**: MongoDB (configured with Replica Set for multi-document ACID transactions)
- **Real-Time Communication**: Socket.IO for sub-second event broadcasts
- **Validation**: Zod (consuming contracts from `@crewconnect/shared`)

## Module Structure (Planned for Implementation in Phases 2–5)

- `src/modules/auth`: User authentication, password hashing, JWT issue & validation
- `src/modules/users`: User profile management, skills, preferences
- `src/modules/hackathons`: Hackathon lifecycle, registration rules, team capacity limits
- `src/modules/teams`: Team creation, updating, deletion, team discovery board
- `src/modules/memberships`: Race-proof joining, leaving, member removal, leadership transfer
- `src/modules/invitations`: Secret-code generation (hashed), direct invites, redemption
- `src/modules/join-requests`: User join applications, leader accept/reject workflows
- `src/modules/recommendations`: Skill-matching and teammate recommendation algorithm
- `src/modules/notifications`: In-app notification delivery and real-time dispatch
- `src/modules/audit`: Tamper-evident operational audit logs

> **Status**: Architecture and specifications defined in Phase 1. Implementation starts upon approval in Phase 2.
