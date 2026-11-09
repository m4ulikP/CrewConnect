# ADR-0009: Team Leadership Invariants and Lifecycle State Machine

**Date**: 2026-11-09  
**Status**: accepted  
**Deciders**: Senior Software Architect, Technical Lead

## Context

In hackathon platforms, ambiguous team leadership lifecycle rules cause critical orphaned states:

- A leader leaves a team without transferring leadership, leaving a headless team.
- A leader attempts to transfer leadership concurrently while the target member leaves.
- The last member of a team leaves, leaving an empty team that still appears in discovery searches.

## Decision

We establish strict **Team Leadership Invariants and Lifecycle Rules** enforced within ACID transactions:

1. **Leader Must Always Be Active Member**: `teams.leaderId` must reference a user who possesses an active record in `memberships` with `role: "LEADER"` and `status: "ACTIVE"`.
2. **Departure / Removal Protection**: A leader cannot leave (`POST /teams/:id/leave`) or be removed (`DELETE /teams/:id/members/:userId`) from a multi-member team without first transferring leadership (`POST /teams/:id/transfer-leadership`) or explicitly disbanding the team (`POST /teams/:id/disband`).
3. **Atomic Leadership Transfer**: Transfer operations verify in a single transaction that the requester is the current leader and the recipient is an active member of the same team. If valid, both membership roles and `team.leaderId` are swapped atomically.
4. **Last Member Disbandment**: When the final remaining member leaves or is removed, the team atomically transitions to `status: "DISBANDED"`, `isOpen: false`, and `memberCount: 0`. Disbanded teams are excluded from discovery searches and cannot accept join requests.

## Alternatives Considered

### Alternative 1: Automatic Leadership Succession to Oldest Member

- **Pros**: Allows leader to leave without an explicit transfer step.
- **Cons**: Unintended transfer of authority to a non-consenting or inactive teammate; complex arbitration logic.
- **Why not**: Explicit transfer ensures clear responsibility and accountability.

### Alternative 2: Allowing Headless Teams

- **Pros**: Simpler departure logic.
- **Cons**: Nobody can manage invitations, accept join requests, or disband the team, creating orphaned records.
- **Why not**: Violates fundamental system integrity.

## Consequences

### Positive

- Guaranteed that every active team has an active, accountable leader at all times.
- Safe lifecycle handling under all concurrent join, leave, transfer, and removal scenarios.
- Empty teams are automatically archived/disbanded cleanly.

### Negative

- Requires a two-step process for leaders wishing to exit a multi-member team (transfer first, then leave).

### Risks

- Race conditions during transfers. Mitigated by wrapping all role updates and leader ID assignments in a single Mongoose transaction session.
