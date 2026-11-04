# SafeHer design system

## Visual theme

SafeHer is a calm everyday safety companion for Bangladesh. The public site explains the service without promising outcomes; the authenticated app prioritizes one useful action at a time. The interface feels like a well-kept field guide: warm paper, forest ink, clear spacing, and a small amount of map-blue. When SOS is active, red takes over the emergency state and call action.

The user-provided shopping and analytics screens informed the idea of composed mobile previews and soft secondary surfaces. SafeHer does not use their commerce cards, fabricated metrics, or vivid blue/purple palette.

## Color roles

| Token | Value | Use |
| --- | --- | --- |
| Paper | `#F7F8F3` | Main canvas |
| White surface | `#FFFFFF` | Forms, map controls, and elevated panels |
| Soft sage | `#EEF2EA` | Grouped information and quiet controls |
| Forest ink | `#18332B` | Headings and primary text |
| Secondary ink | `#52665D` | Supporting copy |
| Muted ink | `#68776F` | Hints, timestamps, and metadata |
| Moss | `#486A55` | Primary brand actions, selected navigation, and focus |
| Slate | `#526F82` | Map and data context only |
| Emergency red | `#B5413B` | Active SOS, direct emergency call, critical error |
| Amber | `#8C672D` | Caution and stale/partial data |

Moss is the brand accent. Slate, red, and amber remain semantic colors with narrow roles and do not compete with ordinary actions.

## Typography

- **English UI and headings:** Plus Jakarta Sans, 400–700; headings use controlled negative tracking and balanced wrapping.
- **Bengali copy:** Noto Sans Bengali, 400–700, with a generous 1.65–1.75 line-height.
- **Technical values:** JetBrains Mono for coordinates, status codes, and compact data only.
- Body copy stays close to 65 characters per line and uses relaxed leading.
- The shared locale context supports Bengali and English, stores the choice in the browser, and updates the document `lang` value.
- Load Noto Sans Bengali for Bengali text and avoid Latin tracking adjustments that disrupt Bengali shaping.
- Translate application-owned labels and notices. Keep names, addresses, user input, and assistant replies as data rather than rewriting them.

## Layout and components

- Content uses a 72rem maximum width and a 4/8/12/16/24/32/48/64px spacing scale.
- Landing content is left aligned; app pages use a page heading, one primary task, and supporting context.
- The desktop app uses a narrow vertical brand/navigation rail. Mobile keeps the existing bottom navigation and safe-area spacing.
- Surfaces use 10px controls, 14px panels, and 18px large compositions. Do not wrap every text group in a card.
- Buttons use a moss primary, a quiet outline secondary, and a text tertiary. Press feedback is brief; focus rings remain visible.
- Inputs have persistent labels, visible focus, and inline textual errors. Icon-only actions keep accessible names and 44px targets where practical.
- The SOS hold control can be held with pointer or keyboard input for the same three-second duration.
- Map controls and attribution remain separate, legible, and non-overlapping at mobile widths.

## Motion

Use short transitions to confirm selection, focus, expansion, or state change. Avoid perpetual motion in the everyday UI; keep active location and SOS signals recognizable without requiring animation. Respect `prefers-reduced-motion` globally.

## Safety copy

- Describe SOS as alerting configured trusted contacts; show the 999 call action when it is useful.
- Describe route output as a heuristic estimate, limited to current Chattogram graph coverage, and never guarantee safety.
- Describe CrimeDataBD v4 as approximate news-derived records, without a year or victim-gender field, not as a street-level safety score.
- Explain that active tracking links expire after 24 hours and that anyone holding an active link can open it.
- Never imply continuous microphone/location access, verified contacts, guaranteed delivery, professional monitoring, or emergency dispatch unless the product actually provides it.

## Avoid

- Purple/blue gradients, neon glows, gratuitous scroll animation, repeated equal-card grids, fake metrics, fabricated endorsements, and generic placeholder content.
- Using emergency red for ordinary buttons or branding.
- Hiding route/data limitations in a footer or separating them from the result they qualify.
- Removing working product flows to simplify the visual system.
