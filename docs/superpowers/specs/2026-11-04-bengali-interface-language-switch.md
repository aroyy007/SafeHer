# Bengali and English interface switch

## Intent

Let a user switch SafeHer's interface between Bengali and English. Keep the choice across routes and browser restarts, and expose the control on public, authenticated, and public tracking screens.

## Approach

Use a small local React context and checked-in message dictionary. Persist the selected locale in local storage and synchronize the document language for assistive technology. Avoid a new runtime dependency, backend localization work, or changing emergency behavior.

## Scope

- Translate the landing page, authentication, app navigation/profile, trusted circles, SOS states, map controls and explanations, chat chrome, incident report form, public tracker, and not-found/loading UI.
- Keep user-entered content, AI replies, names, addresses, and API-provided dataset metadata as data; translate only application-owned labels and known interface errors.
- Keep numeric values, emergency numbers, source licenses, and map data semantics intact.
- Support the Bengali typeface already loaded by the frontend and set the document `lang` attribute when the choice changes.

## Acceptance

- The language switch is keyboard accessible and announces its action in the active language.
- Selection is available on every user-facing page and persists across route changes and reloads.
- Bengali changes visible application copy, form labels/placeholders, ARIA labels, status/error/empty states, and browser document language.
- English remains the fallback for dynamic provider text with no approved translation.
- SOS, account, map, tracking, and API behavior remain unchanged.

## Verification limits

Project instructions prohibit tests/build/lint unless requested. Use source inspection only and report that rendered locale coverage could not be visually verified if the local frontend dependencies remain unavailable.
