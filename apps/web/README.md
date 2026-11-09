# CrewConnect Web Application (`apps/web`)

Frontend Single Page Application (SPA) for the CrewConnect platform.

## Scope & Architectural Role
- **Framework**: React 18+ with TypeScript
- **Bundler & Dev Server**: Vite
- **Styling**: Tailwind CSS
- **State & Data Fetching**: TanStack Query (React Query) / Context API
- **Real-Time Client**: Socket.IO Client for instant UI updates (seat counter changes, join request status)
- **Accessibility**: WCAG 2.1 AA compliant, full keyboard navigation support

## Application Views (Planned for Implementation in Phase 6)
- `/login` & `/register`: Authentication and onboarding
- `/dashboard`: Active hackathons, user's current team status, pending invitations & requests
- `/hackathons/:id/teams`: Interactive team discovery board with live seat count badges and search filters
- `/teams/:id`: Team profile, member roster, role badges, leadership controls, invite code generator
- `/hackathons/:id/teammates`: Recommended teammates matching complementary skills
- `/notifications`: Live event feed with action buttons (Accept/Reject invite, View request)

> **Status**: Architecture and specifications defined in Phase 1. Implementation starts upon approval in Phase 6.
