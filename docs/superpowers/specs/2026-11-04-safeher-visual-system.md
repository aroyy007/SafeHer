# SafeHer visual system

## Intent

Make SafeHer feel like a calm, dependable everyday companion for women in Bangladesh and the people they trust. In an active SOS state, the interface must become unmistakably urgent and make the next useful action easy to find.

## Goals

- Give the landing page, sign-in and sign-up, app shell, SOS, map, chat, circles, profile, and public tracking page one coherent visual language.
- Make the existing product and its supported capabilities clear without implying dispatch, guaranteed safety, verified street-level crime risk, or capabilities that are unavailable.
- Give the authenticated app a useful desktop layout and preserve the compact mobile bottom navigation.
- Keep controls readable, keyboard-visible, responsive, and respectful of reduced-motion preferences.
- The SOS hold action remains three seconds for pointer and keyboard use.
- Preserve existing route, API, authentication, SOS, location-sharing, and map behavior.

## Non-goals

- No backend, database, model, route-scoring, emergency-delivery, Firebase, or deployment changes.
- No new UI framework or animation dependency.
- No change to how/when the SOS is activated, where alerts are sent, or which location data is shared.

## Approaches

1. **Token refresh only:** update colors and fonts while keeping the current layouts. This is low risk, but leaves the long marketing page, mobile-only desktop shell, and map controls visually inconsistent.
2. **Calm field guide across the product (chosen):** keep the existing React/CSS architecture, introduce a shared semantic token set, rebuild the landing page around the real SOS flow, make the app shell responsive, and restyle existing feature surfaces. This addresses the whole product without changing its services or adding dependencies.
3. **Illustration-led rebuild:** replace the current surfaces with bespoke illustrations and animated scenes. This would require more assets and introduce distraction and maintenance cost in a safety product.

The chosen direction follows the user’s preference for calm everyday use and urgency only during SOS. User-provided commerce and analytics screens are treated as loose layout inspiration; their content and palette are not copied.

## Visual direction

- **Atmosphere:** quiet, human, clear, mobile-first; a field guide that lets people scan rather than perform.
- **Memorable detail:** a compact, honest SOS preview with an explicit inactive status and a single hold action.
- **Canvas:** paper `#F7F8F3`; raised surface `#FFFFFF`; soft surface `#EEF2EA`.
- **Ink:** forest `#18332B`; secondary text `#52665D`; muted text `#68776F`.
- **Brand accent:** moss `#486A55`; use for primary actions, selection, and focus.
- **Map information:** slate `#526F82` and soft slate `#E8EFF2`; reserved for map/data context.
- **Emergency:** red `#B5413B`; reserved for active SOS, emergency call action, and critical errors.
- **Typography:** Plus Jakarta Sans for English UI and headings, Noto Sans Bengali for Bengali text, JetBrains Mono only for compact technical values.
- **Shape:** 10–18px radii according to hierarchy; circles reserved for the SOS control and status dots; soft tinted shadows only where elevation helps.
- **Motion:** brief state-change transitions; no decorative continuous motion in normal use; reduced-motion support remains enabled.

## Evidence contract

| Surface | User job | Primary action | Hierarchy | Review viewports |
| --- | --- | --- | --- | --- |
| Landing | Understand what SafeHer currently does and open it | Open SafeHer / sign in | Product promise → SOS preview → real capabilities → data limits | 390×844, 1440×900 |
| Auth | Sign in or create an account | Submit current form step | Form title → fields/errors → submit → recovery/navigation | 390×844, 1280×900 |
| App shell | Reach SOS, Map, Chat, Circles, or profile | Active tab action | Current surface → primary action → supporting details | 390×844, 1440×900 |
| SOS | Activate or cancel an alert, or call 999 | Hold SOS for three seconds | SOS state → activation status → direct emergency call | 390×844, 1024×768 |
| Map | Explore map, route estimates, density layer, or report | Compare routes / map controls | Map → route panel → data-source limitation | 390×844, 1440×900 |
| Chat | Ask a general safety-information question | Send message | Conversation → input → emergency fallback | 390×844, 1024×768 |
| Circles/profile | Review and edit trusted people and account details | Add or manage contact/circle | Page heading → current records → form/empty state | 390×844, 1024×768 |
| Public tracking | Understand whether a shared session is live, stale, or expired | Call 999 / share link | Person/session status → map → emergency action | 390×844, 1440×900 |

Applicable content states: loading, empty, error, partial data, success, and browser permission. Keep existing state behavior and style it consistently; do not invent successful data or permission grants. For the map, unavailable heatmap/route data is partial or error state. For public tracking, missing/expired sessions are empty/expired states. For auth and forms, validation/server errors remain visible in text.

## Safety and content constraints

- CrimeDataBD v4 is news-derived, has approximate coordinates, and contains no year or victim-gender field. Its density layer is not a street-level safety score.
- Route comparison is a heuristic estimate limited to the current Chattogram graph coverage. Never call it a safe route or guarantee.
- Tracking links expire after 24 hours. Do not imply they are private to the named recipient; anyone holding the link can view it while active.
- SOS is a user-triggered alert to configured trusted contacts. Do not imply SafeHer dispatches emergency responders.
- Say a capability is available only when the current frontend/backend supports it. Remove unsupported superlatives, guarantees, and false claims about signup or permissions.
- Do not add logging or expose personal, location, tracking, or credential data.

## Review requirements

- Preserve React 19, Vite, React Router, CSS, and the existing dependency list.
- Inspect the rendered landing and core app surfaces at the contract viewports when the local app can be started.
- Inspect focus visibility and reduced-motion rules in CSS. Report any screen/state that could not be opened without credentials or provider configuration.
- The project guide says not to run tests, builds, or linters unless explicitly requested; this visual pass does not override that rule.
