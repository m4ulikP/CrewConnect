# CrewConnect — Phase 1.2.1: Visual Direction Correction & Approval Package
## Editorial, Spacious & Motion-Led Design System + Frozen API Contracts

- **Project:** CrewConnect — Race-Proof Hackathon Team Formation Platform
- **Challenge:** Hack4Hack Crew Hiring Challenge 2026 — Problem Statement 1 (PS1)
- **Approved Visual Direction:** **Editorial Alabaster & Deep Architectural Pine** *(Phase 1.2.1 Correction)*
- **Document Version:** 1.2.1
- **Status:** Final Frozen Design & Interaction Contract (Pre-Implementation Gate)
- **Baseline Commit:** `a7f81cf365a1e53381d6f5fd1b5844f7a28bb8c3`

---

## Executive Summary

In Phase 1.2.1, the previous dark Mission Control palette (cyan, neon signals, dense telemetry cards) was replaced with a minimal, modern, editorial, spacious, and motion-led visual direction: **Alabaster & Deep Architectural Pine**.

### Key Deliverables & Verification
1. **Intentional Art Direction:** Built around a low-chroma mineral alabaster canvas (`#F6F6F4`), a tinted stone L-frame (`#EEEDE9`), pure white workspace sheets (`#FFFFFF`), crisp charcoal ink (`#18181B`), and a single restrained Deep Architectural Pine accent (`#115E59`).
2. **Editorial Typography System:** Pairs `Newsreader` (serif display headlines and page titles) with `IBM Plex Sans` (UI controls, body copy, and `tabular-nums` alignment), strictly limiting the system to two typefaces.
3. **Six High-Fidelity Rendered Previews & 18 Viewport Captures:** Self-contained HTML/CSS previews in `docs/design/rendered-previews/` have been visually inspected in headless Chromium across **1440px Desktop, 768px Tablet, and 390px Mobile** via `design-taste-frontend/scripts/inspect.mjs`, exiting cleanly with **zero FAIL findings** and **zero low-contrast pairs**.
4. **Preserved Technical & Contract Rigor:** All backend contracts remain strictly frozen and verified against source code: `UPCOMING` and `ACTIVE` hackathon eligibility, deterministic 7-step reservation state machine (zero optimistic seat decrement), `HTTP 201 Created` on atomic direct join, and single-node in-process Socket.IO reconciliation.

---

## 1. Visual-Direction Rationale

Why **Mineral Alabaster Paper & Deep Architectural Pine (`#115E59`)**?
- **Calm Authority Over Infrastructure Clutter:** Hackathons are intense, multi-day collaborative events. Instead of dark "monitoring console" aesthetics or cliché terracotta warm creams, a low-chroma neutral stone ground (`#F6F6F4`) paired with crisp white work sheets (`#FFFFFF`) eliminates eye fatigue and keeps visual focus on people, roles, and team stories.
- **Purposeful Restraint:** The single restrained Deep Pine accent (`#115E59`) signifies open availability, human growth, and verified commitment ("go / open / confirmed") while delivering **7.58 : 1** contrast with white button text (exceeding WCAG AAA).
- **Anti-Slop Composition:** Zero neon glows, zero gradient headlines, zero glassmorphism, zero pill spam, and zero decorative KPI sparklines. Space, clean 1px hairlines, and typographic scale contrast create clear visual hierarchy.

---

## 2. Final Design Token Specification (3-Layer System)

### Layer 1 & 2: Palette & Semantic Tokens

```css
:root {
  /* Surfaces & Canvas (Low-Chroma Mineral Stone) */
  --ground:           #F6F6F4; /* Public Ground & Workspace Outer Canvas */
  --chrome:           #EEEDE9; /* Tinted Stone L-Frame (Sidebar & Topbar) */
  --surface:          #FFFFFF; /* Crisp Pure Sheet */
  --surface-tonal:    #F1F0EC; /* Subtle Tonal Container / Panel */
  --surface-hover:    #FAF9F7; /* Delicate Hover Step */

  /* Hairlines & Control Boundaries */
  --border-subtle:    #E4E2DC; /* Delicate 1px Structural Rule */
  --border-strong:    #CFCBC2; /* Card / Table Frame */
  --border-control:   #8B8982; /* Accessible 3.53:1 Form Input Border */
  --border-focus:     #115E59; /* Deep Pine Focus Ring */

  /* Ink Hierarchy */
  --ink-primary:      #18181B; /* Deep Charcoal Ink */
  --ink-secondary:    #52525B; /* Zinc Slate Body */
  --ink-muted:        #64635E; /* Secondary Metadata */
  --ink-on-accent:    #FFFFFF; /* Pure White */

  /* Restrained Single Accent & Functional States */
  --accent:           #115E59; /* Deep Architectural Pine */
  --accent-hover:     #0F4C48; /* Deeper Pine Hover */
  --accent-tint:      #E6F2F0; /* Soft Sage Selection Surface */

  --positive:         #166534;
  --positive-bg:      #DCFCE7;
  --warning:          #92400E;
  --warning-bg:       #FEF3C7;
  --danger:           #991B1B;
  --danger-bg:        #FEE2E2;
  --danger-solid:     #B91C1C;

  /* Typography (Strict 2-Typeface Discipline) */
  --font-serif: 'Newsreader', Georgia, serif;
  --font-sans:  'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;

  /* Type Scale */
  --fs-display: clamp(2.25rem, 1.8rem + 2.4vw, 3.75rem);
  --fs-h1:      clamp(1.5rem, 1.25rem + 1vw, 2.25rem);
  --fs-h2:      1.25rem;
  --fs-body:    1rem;      /* 16px editorial body floor */
  --fs-ui:      0.875rem;  /* 14px UI controls */
  --fs-small:   0.8125rem; /* 13px minimum readable caption */

  /* Spacing & Radii */
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --radius-sm:    4px;
  --radius-md:    6px;
  --radius-lg:    10px;
  --radius-sheet: 14px;
}
```

### Layer 3: Component Variants & States
- **Buttons:**
  - *Primary:* Solid `#115E59`, `#FFFFFF` text, 40px height (`44px` on forms/mobile), `6px` radius. Hover: `#0F4C48`. Active: `scale(0.97)`.
  - *Secondary:* Crisp `#FFFFFF`, `1px solid #CFCBC2`, `#18181B` ink.
  - *Ghost:* Transparent, `#52525B` ink, hover `#F1F0EC`.
  - *Danger:* Solid `#B91C1C`, `#FFFFFF` text (strictly for irreversible actions like Disband or Leave).
- **Member Initials Avatars (Human Identity):** Distinct, harmonious botanical/earth tints:
  - `.av-pine` (`#E6F2F0` / `#115E59`)
  - `.av-ochre` (`#F7EFE2` / `#854D0E`)
  - `.av-slate` (`#EBEDF0` / `#334155`)
  - `.av-clay` (`#F6EAE6` / `#9A3412`)
  - `.av-moss` (`#EDF2E6` / `#3F6212`)

---

## 3. Rendered Visual Previews & Browser Inspection Evidence

All six core screens are deployed as live HTML/CSS previews in `docs/design/rendered-previews/` and unified in [index.html](file:///c:/Users/mauli/OneDrive/Documents/CrewConnect/docs/design/rendered-previews/index.html). Rendered screenshots across all 3 viewports are archived in `docs/design/rendered-previews/screenshots/`.

| # | Screen | HTML Preview | Captured Desktop (1440px) & Mobile (390px) Screenshots | Inspection Verdict |
| :--- | :--- | :--- | :--- | :---: |
| **1** | **Public Landing** | [landing.html](file:///c:/Users/mauli/OneDrive/Documents/CrewConnect/docs/design/rendered-previews/landing.html) | `landing-desktop-fold.jpg`, `landing-tablet-fold.jpg`, `landing-mobile-fold.jpg` | **0 FAIL** |
| **2** | **Team Discovery** | [discovery.html](file:///c:/Users/mauli/OneDrive/Documents/CrewConnect/docs/design/rendered-previews/discovery.html) | `discovery-desktop-fold.jpg`, `discovery-tablet-fold.jpg`, `discovery-mobile-fold.jpg` | **0 FAIL** |
| **3** | **Dashboard** | [dashboard.html](file:///c:/Users/mauli/OneDrive/Documents/CrewConnect/docs/design/rendered-previews/dashboard.html) | `dashboard-desktop-fold.jpg`, `dashboard-tablet-fold.jpg`, `dashboard-mobile-fold.jpg` | **0 FAIL** |
| **4** | **Team Workspace** | [workspace.html](file:///c:/Users/mauli/OneDrive/Documents/CrewConnect/docs/design/rendered-previews/workspace.html) | `workspace-desktop-fold.jpg`, `workspace-tablet-fold.jpg`, `workspace-mobile-fold.jpg` | **0 FAIL** |
| **5** | **Sign-In** | [login.html](file:///c:/Users/mauli/OneDrive/Documents/CrewConnect/docs/design/rendered-previews/login.html) | `login-desktop-fold.jpg`, `login-tablet-fold.jpg`, `login-mobile-fold.jpg` | **0 FAIL** |
| **6** | **Registration** | [register.html](file:///c:/Users/mauli/OneDrive/Documents/CrewConnect/docs/design/rendered-previews/register.html) | `register-desktop-fold.jpg`, `register-tablet-fold.jpg`, `register-mobile-fold.jpg` | **0 FAIL** |

### Desktop (1440px), Tablet (768px) & Mobile (390px) Composition Comparison
- **Public Landing Page:**
  - *Desktop:* Generous 88px top space, two-line `Newsreader` statement (`Race-proof squads, formed cleanly.`), asymmetrical 7/5 supporting paragraph + primary CTA band, 5/7 split for formation workflow + expandable squad cards, and calm 2-column architectural proof band.
  - *Mobile:* Headline scales cleanly to 40px staying strictly at 2 lines; sections stack naturally with 16px equal outer margins; expandable cards remain tap-accessible with zero horizontal overflow.
- **Team Discovery:**
  - *Desktop:* Framed L-chrome (`#EEEDE9`) transitioning onto white `#FFFFFF` inner sheet; 390px master list on left + spacious dossier on right with instant tab-free switching.
  - *Mobile:* Full-width squad list initially (`<h1>Team Directory</h1>`); tapping a squad smoothly transitions to the detail dossier with an explicit `"← All squads"` return button and pinned 60px bottom navigation bar.
- **Dashboard & Workspace:**
  - *Desktop:* `editorial-greeting` layout on Dashboard (`Good afternoon, Maulik`); clean tabbed Workspace (`Roster & Mission`, `Join Requests (1)`, `Invitations`, `Activity History`, `Settings`) with a 2px pine underline indicator and toggleable Leader vs. Ordinary Member view.
  - *Mobile:* Sidebar collapses cleanly into a 60px fixed bottom navigation bar (`Overview`, `Discover`, `My Squad`, `Account`) with >=44×44px touch targets.

---

## 4. Motion Design System (`improve-animations`)

Motion in CrewConnect communicates state clarity without distracting loops or premature success cues:

```css
:root {
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-press:   100ms;  /* Button & list row active compression */
  --dur-fast:    180ms;  /* Hover steps, dropdowns, underline shifts */
  --dur-panel:   220ms;  /* Detail pane cross-fade, modal & mobile sheet transitions */
  --dur-reveal:  600ms;  /* One-time landing hero masked rise on load */
}
```

### Frozen Interaction Motion Rules
1. **Landing Masked Line Reveal:** Two headline lines rise from behind their baseline (`translateY(18px) &rarr; 0`, `opacity: 0 &rarr; 1`, 600ms `--ease-out`, 80ms stagger). Never repeats or loops.
2. **Master-Detail & Tab Switching:** Selecting a team or switching workspace tabs triggers a snappy 220ms `fadeSlideIn` (`translateY(6px) &rarr; 0`, `opacity: 0 &rarr; 1`).
3. **Accordion Squad Expansion:** Expandable squad previews transition smoothly via `max-height` + `opacity` over 260ms `--ease-out`.
4. **Tactile Press Feedback:** Buttons and interactive rows apply `transform: scale(0.97)` on `:active` (100ms `--ease-out`).
5. **No Premature Reservation Animation:** Clicking "Instant direct join" disables the button and enters a calm `"Reserving seat..."` pending state. Capacity pips and badges **never** animate or decrement optimistically prior to receiving authoritative server `HTTP 201 Created`.
6. **Zero Idle Loops:** Strictly no constant floating, glowing, or infinite pulsing animations.
7. **Reduced Motion (`@media (prefers-reduced-motion: reduce)`):** Sets all animation/transition durations to `0.01ms` and removes all `transform` offsets.

---

## 5. Mathematical Accessibility & Contrast Verification (WCAG 2.1/2.2 AA)

Computed using the WCAG 2.1 relative luminance standard $(L_1 + 0.05) / (L_2 + 0.05)$:

| Element Pair | Foreground ($L_1$) | Background ($L_2$) | Contrast Ratio | WCAG Target | Status |
| :--- | :--- | :--- | :---: | :---: | :---: |
| Primary Ink on Alabaster Ground | `#18181B` ($0.0093$) | `#F6F6F4` ($0.922$) | **16.26 : 1** | >= 4.5 : 1 | **PASS (AAA)** |
| Primary Ink on Pure White Sheet | `#18181B` ($0.0093$) | `#FFFFFF` ($1.000$) | **17.72 : 1** | >= 4.5 : 1 | **PASS (AAA)** |
| Secondary Body Ink on Alabaster | `#52525B` ($0.0858$) | `#F6F6F4` ($0.922$) | **7.09 : 1** | >= 4.5 : 1 | **PASS (AAA)** |
| Secondary Body Ink on White Sheet | `#52525B` ($0.0858$) | `#FFFFFF` ($1.000$) | **7.73 : 1** | >= 4.5 : 1 | **PASS (AAA)** |
| Muted Metadata on White Sheet | `#64635E` ($0.125$) | `#FFFFFF` ($1.000$) | **5.98 : 1** | >= 4.5 : 1 | **PASS (AA)** |
| White Text on Pine Primary Button | `#FFFFFF` ($1.000$) | `#115E59` ($0.0885$) | **7.58 : 1** | >= 4.5 : 1 | **PASS (AAA)** |
| Pine Accent Text on Sage Surface | `#115E59` ($0.0885$) | `#E6F2F0` ($0.8662$) | **6.62 : 1** | >= 4.5 : 1 | **PASS (AA)** |
| Warning Text on Amber Tint | `#92400E` ($0.0981$) | `#FEF3C7` ($0.8930$) | **6.37 : 1** | >= 4.5 : 1 | **PASS (AA)** |
| Danger Crimson on Solid Danger Btn | `#FFFFFF` ($1.000$) | `#B91C1C` ($0.1123$) | **6.47 : 1** | >= 4.5 : 1 | **PASS (AA)** |
| Form Input Border on White Sheet | `#8B8982` ($0.244$) | `#FFFFFF` ($1.000$) | **3.57 : 1** | >= 3.0 : 1 | **PASS (UI Floor)** |
| Pine Focus Ring on Ground | `#115E59` ($0.0885$) | `#F6F6F4` ($0.922$) | **6.96 : 1** | >= 3.0 : 1 | **PASS (UI Floor)** |

### Accessibility Items Requiring Interactive Browser Verification in Phase 2
1. **Radix Focus Traps & Escape Handling:** Verify focus rings trap reliably inside modal dialogs and return focus to triggering elements on Escape/Close.
2. **ARIA Live Region Announcements (`aria-live="polite"`):** Verify NVDA/VoiceOver read real-time capacity increments (`"Capacity updated to 5 of 5"`) without interrupting active form typing.
3. **OS Reduced-Motion Toggle:** Manually verify zero layout jump when toggling OS-level `Reduce Motion`.
4. **44×44px Mobile Hit Boxes:** Verify mobile bottom bar and inline filter chip tap boundaries in Chrome DevTools Device Mode.

---

## 6. Preserved Technical & API Contracts (Unchanged)

All backend contracts verified in Phase 1.2 remain strictly unchanged:
1. **Hackathon Eligibility Policy (`apps/api/tests/membership-race.test.ts:1054`):** Both `UPCOMING` and `ACTIVE` hackathons permit team creation, direct joins, join requests, and invitations. Only `COMPLETED` hackathons are rejected (`HTTP 400`, `HACKATHON_NOT_ACTIVE`).
2. **Reservation State Machine (Zero Optimistic Decrement):**
   `IDLE (Server capacity)` &rarr; `PENDING_COMMIT (Idempotency-Key sent, counter unchanged)` &rarr; `HTTP 201 Created (Reconcile capacity, join socket room)` OR `HTTP 409 TEAM_FULL (Reconcile 5/5 full state, disable join)`.
3. **Exact REST Contracts:**
   - `POST /api/v1/teams/:id/join` (`201 Created`, requires `Idempotency-Key`)
   - `GET /api/v1/teams/:id/members` (`200 OK`)
   - `DELETE /api/v1/teams/:id/members/:userId` (`200 OK`, post-commit room eviction)
   - `POST /api/v1/invitations/accept` (`201 Created`, requires `Idempotency-Key`)
   - `GET /api/v1/teams/:id/audit-logs` (`200 OK`, persistent history distinct from transient Socket.IO notifications)
4. **Cataloged Backend Gaps (No mock backend changes made):**
   - `PATCH /api/v1/auth/me` (Profile editing — read-only with notice)
   - `GET /api/v1/auth/my-join-requests` (Candidate-wide pending requests)
   - `GET /api/v1/notifications` (Persistent cross-session inbox)
   - `GET /api/v1/auth/my-teams` (Global cross-hackathon squad query)

---

## 7. Readiness Verdict & Approval Request

The redesigned **Alabaster & Deep Architectural Pine** visual direction, all six responsive HTML/CSS rendered previews, 18 browser-captured viewport screenshots, WCAG AA contrast proofs, motion rules, and frozen API contracts are complete and verified.

**Recommendation:** Approve this Phase 1.2.1 package to unlock **Phase 2 Implementation**.
