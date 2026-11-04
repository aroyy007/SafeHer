# Bengali and English interface switch review notes

## Implemented

- Added a shared locale context and Bengali message catalog with no new runtime dependency.
- Persisted the user's language choice in local storage and synchronized the document language, title, and description.
- Added an accessible language control to the public landing page, authentication screens, app shell, public tracking page, loading state, and 404 page.
- Localized application-owned copy across landing, auth, contacts, circles, SOS, chat chrome, map controls/data notes, incident reporting, public tracking, and common errors.
- Kept user data, addresses, chat input, and AI replies unchanged. Preserved phone numbers, source/license attribution, and emergency behavior.
- Added Bengali font fallback and relaxed tracking/line-height rules for Bengali script.

## Static review

- Source scan found translations for all literal `t()` calls and no duplicate message keys.
- Project instructions prohibit running tests, builds, and lint unless requested; none were run.
- The actual app could not be rendered in the previous frontend review because dependencies were absent and `npm ci` reported an existing lockfile mismatch. Browser review of both locales and all viewport states remains outstanding.
