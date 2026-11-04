# SafeHer frontend redesign Implementation Plan

> **For agentic workers:** Execute this plan inline in the current session. Preserve the project’s no-tests/builds/linters rule unless the user later asks for verification.

**Goal:** Apply the approved Calm field guide direction to SafeHer’s public site and existing safety app without changing product behavior.

**Architecture:** Keep React routes and CSS architecture. Define semantic CSS tokens, load a final shared refinement layer after existing page styles, and reshape only the landing and map markup where current structures block accurate content or responsive styling.

**Tech Stack:** React 19, Vite 8, React Router 7, CSS, lucide-react (already installed).

**Spec:** `docs/superpowers/specs/2026-11-04-safeher-visual-system.md`

## Global Constraints

- Preserve the existing route, API, authentication, SOS, location-sharing, and map behavior.
- Add no UI framework or animation dependency.
- CrimeDataBD v4 is news-derived and approximate; it has no year or victim-gender field, and its layer is not a street-level safety score.
- Route comparison is a heuristic estimate limited to the current Chattogram graph coverage and is never a safety guarantee.
- Tracking links expire after 24 hours; anyone holding an active link can view it.
- SOS alerts configured trusted contacts; SafeHer does not dispatch emergency responders.
- Do not run tests, builds, or linters unless the user explicitly requests them.

## Review Focus

- Narrow viewports with long Bengali/English labels must not overflow; review at 390×844 and 1440×900 in the rendered browser.
- SOS active status must remain visually distinct from the calm default state and preserve the direct 999 action.
- Map overlays must not cover each other on mobile; keep CrimeDataBD attribution and limitations readable beside the density and route estimates.
- Expired/missing/stale public tracking states must remain distinguishable and must not look like a live location.
- Keyboard focus, normal text contrast, reduced motion, and target size must be inspected; report provider/auth states not reachable in this environment.

---

### Task 1: Shared design tokens and interaction primitives

**Files:**
- Modify: `frontend/src/styles/theme.css`
- Modify: `frontend/src/styles/index.css`
- Create: `frontend/src/styles/redesign.css`
- Modify: `frontend/src/main.jsx`
- Create: `frontend/DESIGN.md`, `frontend/design-tokens.json`, `frontend/design-preview.html`

**Interfaces:**
- Produces: semantic color, type, spacing, radius, shadow, and motion variables consumed by the page styles.

- [ ] Replace Inter-first typography with Plus Jakarta Sans, Noto Sans Bengali, and JetBrains Mono for technical values.
- [ ] Define the documented paper/forest/moss/slate/emergency tokens and default focus/reduced-motion behavior.
- [ ] Load `redesign.css` after current page styles for shared responsive refinements.
- [ ] Keep button, input, focus, and surface interactions consistent and keyboard visible.
- [ ] Static-inspect imports and CSS selector interactions; no test/build/lint command under project instructions.

### Task 2: Accurate, product-led landing page

**Files:**
- Modify: `frontend/src/pages/Landing/Landing.jsx`
- Modify: `frontend/src/pages/Landing/landing.css`

**Interfaces:**
- Consumes: existing `/login`, `/app/sos`, `/track/:sessionId` routes and shared tokens from Task 1.
- Produces: truthful public explanation of SOS, trusted contacts, map estimates, chat, and 24-hour tracking.

- [ ] Replace unsupported superlatives, false no-signup claims, always-listening claims, fabricated/demo tracking links, and unverified partner logos with capability-specific copy.
- [ ] Keep a clear route to the protected app/sign-in, a direct `tel:999` action, and accessible in-page navigation.
- [ ] Use a left-aligned hero with a static SOS preview whose status clearly says no alert is active.
- [ ] Replace the repeated marquee/count-up layout with a readable capabilities section and visible CrimeDataBD/route caveat.
- [ ] Preserve responsive spacing, semantic headings, and reduced-motion behavior.

### Task 3: Responsive app navigation and shared feature surfaces

**Files:**
- Modify: `frontend/src/pages/AppShell/appshell.css`
- Modify: `frontend/src/features/sos/sos.css`
- Modify: `frontend/src/features/chat/chat.css`
- Modify: `frontend/src/pages/Auth/auth.css`
- Modify: `frontend/src/pages/Circles/Circles.jsx` only if required for semantic labels.

**Interfaces:**
- Consumes: shared tokens from Task 1.
- Preserves: `/app/sos`, `/app/map`, `/app/chat`, `/app/circles`, `/app/you`, sign-in, and sign-up interactions.

- [ ] Use the existing header as a desktop brand rail with vertical navigation; keep a mobile header and bottom navigation under the narrow breakpoint.
- [ ] Give repeated-use screens a calm content frame, clear page headings, non-nested surfaces, and consistent empty/error/loading treatments.
- [ ] Keep the SOS hold action easy to scan; use emergency red only for active SOS and emergency call.
- [ ] Keep the same three-second SOS activation available to keyboard users.
- [ ] Style chat, trusted circles, profile/contact lists, and auth forms without changing their data flow.

### Task 4: Map and public tracking surfaces

**Files:**
- Modify: `frontend/src/features/map/MapContainer.jsx`
- Create: `frontend/src/features/map/map.css`
- Modify: `frontend/src/pages/Track/track.css`

**Interfaces:**
- Consumes: current `/api/heatmap`, geocode, route, incident-report, and Firebase tracking interfaces.
- Preserves: existing map controls, route estimates, incident report modal, status states, and 24-hour expiry.

- [ ] Add stable map wrapper classes and accessible names for origin/destination inputs so overlays can reflow at mobile widths.
- [ ] Restyle the route panel, controls, and attribution note with the shared tokens; retain source and limitation copy.
- [ ] Make live, stale, offline, missing, and expired tracking states readable and visually distinct without hiding the map action controls.
- [ ] Static-inspect JSX structure and CSS; do not run tests/build/lint under project instructions.

### Task 5: Rendered design review and evidence notes

**Files:**
- Create: `docs/superpowers/reviews/2026-11-04-safeher-frontend-redesign/review-notes.md`
- Create: `docs/superpowers/reviews/2026-11-04-safeher-frontend-redesign/evidence.json` only for observations actually collected.

- [ ] Start the existing Vite development server if dependencies and environment allow; do not run a production build.
- [ ] Inspect landing and reachable core screens at 390×844 and 1440×900; inspect focus and reduced-motion styles.
- [ ] Record pages/states that need credentials or external configuration and avoid marking them passed without observation.
- [ ] Summarize changes, visual evidence, and remaining review limits.
