# SafeHer frontend redesign review notes

## Work completed

- Added the Calm field guide design contract, token reference, and HTML token preview.
- Replaced the public landing page with an accurate product overview, account paths, SOS preview, route-data limitations, and 999 call link.
- Added a desktop navigation rail while preserving the mobile bottom navigation.
- Updated shared form, auth, SOS, chat, map, tracking, loading, and 404 presentation.
- Restyled map overlays and route controls and added persistent labels for route inputs.
- Clarified that contacts need an email address to receive alert links, that location starts sharing only during SOS, and that public tracking links expire after 24 hours.
- Added visible skip links, keyboard focus styling, reduced-motion handling, keyboard use of the three-second SOS hold, and a keyboard-operable profile-photo picker.

## Rendered review status

- The side-by-side visual companion preview was inspected in Chrome at its desktop layout. The selected direction is Calm field guide.
- The actual React app could not be rendered because dependencies are absent. `npm run dev -- --host 127.0.0.1` stopped with `vite: command not found`.
- `npm ci` could not proceed because the existing lockfile is out of sync with `package.json` and lacks `@emnapi/wasi-threads@1.2.2`.
- A local-only `npm install --no-save --package-lock=false` attempt was stopped after it produced no output; no package manifest or lockfile was intentionally changed.
- Actual app review at 390×844 and 1440×900, keyboard traversal, route/map data states, authenticated pages, and browser permission states remain unverified. No evidence record is marked as passed for those states.

## Verification limits

No tests, production build, or lint command was run, following `AGENTS.md` and `CLAUDE.md`. The React changes received static source inspection only. The project directory is not a Git repository, so a Git diff or branch review was unavailable.
