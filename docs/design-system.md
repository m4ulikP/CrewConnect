# CrewConnect — Design System & Visual Specification

**Design System:** Editorial Alabaster & Deep Architectural Pine<br>
**Standard:** WCAG 2.1 AA / AAA Accessible<br>
**Scope:** Design tokens, typographic scales, interaction physics, and responsive viewport specifications for CrewConnect.

---

## 1. Visual Identity & Art Direction

CrewConnect is designed around a calm, spacious, editorial aesthetic that avoids neon telemetry, artificial glows, and cluttered monitoring consoles:

- **Low-Chroma Mineral Alabaster Ground (`#F6F6F4`)**: Establishes a warm, paper-like ground eliminating glare and visual fatigue during multi-day hackathons.
- **Tinted Stone Chrome (`#EEEDE9`)**: Structures navigation frames and sidebars with a subtle 1px rule separation (`#E4E2DC`).
- **Pure White Sheets (`#FFFFFF`)**: Houses interactive tables, cards, and dossier sheets with high contrast and clear elevation.
- **Deep Architectural Pine (`#115E59`)**: Single restrained accent signifying open availability, active confirmation, and verified commitment. Delivers **7.58 : 1** contrast with white button text (exceeding WCAG AAA).
- **Deep Charcoal Ink (`#18181B`)**: Delivers crisp readability across text and headers.

---

## 2. Design Tokens (3-Layer Architecture)

### Surfaces, Borders & Ink

```css
:root {
  /* Surfaces & Canvas (Low-Chroma Mineral Stone) */
  --ground: #f6f6f4; /* Public Ground & Workspace Outer Canvas */
  --chrome: #eeede9; /* Tinted Stone L-Frame (Sidebar & Topbar) */
  --surface: #ffffff; /* Crisp Pure Sheet */
  --surface-tonal: #f1f0ec; /* Subtle Tonal Container / Panel */
  --surface-hover: #faf9f7; /* Delicate Hover Step */

  /* Hairlines & Control Boundaries */
  --border-subtle: #e4e2dc; /* Delicate 1px Structural Rule */
  --border-strong: #cfcbc2; /* Card / Table Frame */
  --border-control: #8b8982; /* Accessible 3.53:1 Form Input Border */
  --border-focus: #115e59; /* Deep Pine Focus Ring */

  /* Ink Hierarchy */
  --ink-primary: #18181b; /* Deep Charcoal Ink */
  --ink-secondary: #52525b; /* Zinc Slate Body */
  --ink-muted: #64635e; /* Secondary Metadata */
  --ink-on-accent: #ffffff; /* Pure White */

  /* Restrained Single Accent & Functional States */
  --accent: #115e59; /* Deep Architectural Pine */
  --accent-hover: #0f4c48; /* Deeper Pine Hover */
  --accent-tint: #e6f2f0; /* Soft Sage Selection Surface */

  --positive: #166534;
  --positive-bg: #dcfce7;
  --warning: #92400e;
  --warning-bg: #fef3c7;
  --danger: #991b1b;
  --danger-bg: #fee2e2;
  --danger-solid: #b91c1c;
}
```

### Typography System

Pairs `Newsreader` (serif display headlines) with `IBM Plex Sans` (clean UI controls, body copy, and `tabular-nums` counters):

```css
:root {
  --font-serif: "Newsreader", Georgia, serif;
  --font-sans: "IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif;

  /* Typographic Scale */
  --fs-display: clamp(2.25rem, 1.8rem + 2.4vw, 3.75rem);
  --fs-h1: clamp(1.5rem, 1.25rem + 1vw, 2.25rem);
  --fs-h2: 1.25rem;
  --fs-body: 1rem; /* 16px editorial body floor */
  --fs-ui: 0.875rem; /* 14px UI controls */
  --fs-small: 0.8125rem; /* 13px minimum readable caption */
}
```

### Motion & Interaction Physics

Motion communicates state change without distracting loops or unearned optimism:

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-press: 100ms; /* Button & list row active compression */
  --dur-fast: 180ms; /* Hover steps, dropdowns, underline shifts */
  --dur-panel: 220ms; /* Detail pane cross-fade, modal & mobile sheet transitions */
  --dur-reveal: 600ms; /* One-time landing hero masked rise on load */
}
```

**Core Interaction Rules:**

1. **Zero Premature Animation:** Seat counters and capacity badges never animate or decrement optimistically. They update only when authoritative `HTTP 201 Created` or Socket.IO sync events are received.
2. **Tactile Feedback:** Buttons and interactive cards apply `transform: scale(0.97)` on `:active` with 100ms `--ease-out`.
3. **Respect Reduced Motion:** `@media (prefers-reduced-motion: reduce)` sets all transition durations to `0.01ms` and removes all `transform` offsets.

---

## 3. Mathematical Accessibility & Contrast Ratios (WCAG 2.1 AA/AAA)

All color combinations have been mathematically validated using the WCAG relative luminance formula $(L_1 + 0.05) / (L_2 + 0.05)$:

| Element Pair                       | Foreground | Background | Contrast Ratio |   WCAG Compliance   |
| :--------------------------------- | :--------- | :--------- | :------------: | :-----------------: |
| Primary Ink on Alabaster Ground    | `#18181B`  | `#F6F6F4`  | **16.26 : 1**  |   **PASS (AAA)**    |
| Primary Ink on White Sheet         | `#18181B`  | `#FFFFFF`  | **17.72 : 1**  |   **PASS (AAA)**    |
| Secondary Body on Alabaster Ground | `#52525B`  | `#F6F6F4`  |  **7.09 : 1**  |   **PASS (AAA)**    |
| Secondary Body on White Sheet      | `#52525B`  | `#FFFFFF`  |  **7.73 : 1**  |   **PASS (AAA)**    |
| Muted Metadata on White Sheet      | `#64635E`  | `#FFFFFF`  |  **5.98 : 1**  |    **PASS (AA)**    |
| White Text on Pine Primary Button  | `#FFFFFF`  | `#115E59`  |  **7.58 : 1**  |   **PASS (AAA)**    |
| Pine Text on Sage Surface          | `#115E59`  | `#E6F2F0`  |  **6.62 : 1**  |    **PASS (AA)**    |
| Warning Text on Amber Tint         | `#92400E`  | `#FEF3C7`  |  **6.37 : 1**  |    **PASS (AA)**    |
| Danger White on Crimson Solid      | `#FFFFFF`  | `#B91C1C`  |  **6.47 : 1**  |    **PASS (AA)**    |
| Form Input Border on White Sheet   | `#8B8982`  | `#FFFFFF`  |  **3.57 : 1**  | **PASS (UI Floor)** |
| Pine Focus Ring on Ground          | `#115E59`  | `#F6F6F4`  |  **6.96 : 1**  | **PASS (UI Floor)** |

---

## 4. Visual Evidence & Viewport Previews

Authentic captures of the deployed application across desktop and mobile viewports are archived in [`docs/screenshots/`](./screenshots/):

- **[Landing Page (Desktop)](./screenshots/landing-desktop.jpg)** & **[Landing Page (Mobile)](./screenshots/landing-mobile.jpg)**: Hero typography, 4-step workflow, and live squad preview.
- **[Team Discovery (Desktop)](./screenshots/discovery-desktop.jpg)** & **[Team Discovery (Mobile)](./screenshots/discovery-mobile.jpg)**: Master list + detail dossier, live seat counters, and vacancy filters.
- **[Dashboard (Desktop)](./screenshots/dashboard-desktop.jpg)**: Active team overview, pending invitations, and quick actions.
- **[Team Workspace (Desktop)](./screenshots/workspace-desktop.jpg)**: Roster management, join request triage, invite generation, and transactional audit trail.
- **[Authentication](./screenshots/login-desktop.jpg)**: Dual email/password and Google OAuth tabs with accessible focus management.
