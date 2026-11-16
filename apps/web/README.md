# CrewConnect Web Application (`apps/web`)

Frontend Single Page Application (SPA) for the CrewConnect platform, providing an editorial, accessible, and real-time team discovery and collaboration interface.

---

## 1. Responsibilities & Design System

- **Editorial Visual System**: Built using the **Mineral Alabaster & Deep Architectural Pine** design system (`#F6F6F4` canvas, `#115E59` pine accents, `Newsreader` serif headlines, `IBM Plex Sans` body).
- **Sub-Second Real-Time Updates**: Socket.IO client subscribed to room-level capacity changes, join request status, and membership updates with zero polling.
- **Accessible & Keyboard Navigable**: Full WCAG 2.1 AA compliance, accessible focus traps, ARIA live regions for counter updates, and `@media (prefers-reduced-motion)` support.
- **Atomic Concurrency Handling**: Client disables action buttons during reservation requests and reflects server-authoritative seat counts only upon verified completion (zero optimistic decrement).
- **Responsive Layout**: Optimized for Desktop (1440px), Tablet (768px), and Mobile (390px) viewports with minimum 44×44px touch targets.

---

## 2. Directory Structure

```
apps/web/
├── public/              # Favicons, webmanifest, and brand icons
├── src/
│   ├── components/      # Reusable UI controls (Modals, CapacityBadge, Navbar, Footer)
│   │   ├── auth/        # Password companions and auth layout cards
│   │   ├── dashboard/   # Authenticated dashboard widgets and quick actions
│   │   ├── recommendations/ # Skill-match teammate recommendation cards
│   │   └── workspace/   # Roster, join request triage, invite generator, and audit trail
│   ├── context/         # React Context providers (AuthContext, SocketContext, ThemeContext)
│   ├── hooks/           # Custom React hooks (useTeams, useHackathons, useRecommendations)
│   ├── pages/           # Page route components (Landing, Discovery, Dashboard, Workspace, Login, Register)
│   ├── services/        # API client and Axios wrapper with CSRF headers
│   ├── App.tsx          # Router configuration and global error boundary
│   └── main.tsx         # Application entrypoint and React root mount
└── tests/               # Vitest component, route, and accessibility tests (123 tests across 17 files)
```

---

## 3. Development & Operational Commands

Run commands from the monorepo root or directly within `apps/web`:

```bash
# Start Vite development server (http://localhost:5173)
npm run dev --workspace=@crewconnect/web

# Typecheck TypeScript files
npm run typecheck --workspace=@crewconnect/web

# Build optimized production bundle to dist/
npm run build --workspace=@crewconnect/web

# Preview production build locally
npm run preview --workspace=@crewconnect/web

# Run Vitest web test suite (123 tests)
npm test -- apps/web
```

---

## 4. Environment Configuration

The web client reads Vite environment variables prefixed with `VITE_`:

| Variable          | Description                              | Default / Example              |
| :---------------- | :--------------------------------------- | :----------------------------- |
| `VITE_API_URL`    | Base URL for REST API endpoints          | `http://localhost:5000/api/v1` |
| `VITE_SOCKET_URL` | Base URL for Socket.IO server connection | `http://localhost:5000`        |

Refer to [`apps/web/.env.example`](./.env.example) for local configuration.
