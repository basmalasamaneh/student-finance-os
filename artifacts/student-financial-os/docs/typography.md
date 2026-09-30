# Typography & mobile shell (Prompt 1.6)

## Arabic typeface decision
**Noto Sans Arabic is retained.** It is a humanist-Kufi UI face designed as the Arabic companion of the Noto/Inter-style
sans family: matching x-height/stroke contrast with Inter, full 400/500/600 range, reliable Arabic punctuation (، ؛ ؟),
and no extra dependency (already loaded via Google Fonts). Previous awkwardness came from 700 weights and English
line-heights, not the face. Both families now load **only 400/500/600**; bold maps to 600 in Arabic.

## Canonical type roles (`src/index.css`)
`type-display`, `type-title`, `type-subtitle`, `type-body`, `type-label`, `type-caption`, `type-nav`.
Same sizes/weights in both scripts; `html[lang='ar']` raises line-height (body 1.75–1.8, headings 1.45–1.55) and
nudges labels/captions/nav up ~0.5px — never smaller. Tracking is zeroed in Arabic. Amounts (`.tabular`) render in Inter
tabular figures inside LTR `<bdi>` in both locales. Do not add per-page Arabic overrides; use the roles.

## Mobile shell
- Header (<768px): brand mark · current page title · More. Language, theme and role preview moved into the More sheet
  as 44px segmented controls. No notification icon (no such feature yet).
- Bottom nav: 5 items, 64px + safe-area, active = gold-soft pill with ring behind icon + semibold label + `aria-current`.
- Page gutters 16px mobile, bottom padding respects safe area.
- Home: concise one-line specimen disclosure; context → balance → primary action (full width) → support.

## Prompt 1.6 follow-up
- Type roles live in `@layer components`, so utilities (e.g. `font-medium`) can still override them. Gallery, Appearance, state panels and finance components use the roles.
- Touch targets: checkbox has a 44px wrapper and an enlarged hit area; switches have a hit area of at least 44px tall, and their labels are 44px rows; select trigger/items are 44px on mobile; tabs are 44px and scroll inside their own row; dialog and sheet close buttons are 44px.
- Dialog: `calc(100% - 2rem)` width (16px margins), `max-h: calc(100dvh - 2rem)`, scrolls inside. Bottom sheets: `max-h: 90dvh`, scroll, safe-area padding.
- MoneyDisplay never truncates and has no overflow hiding. Amounts longer than 11 characters step the hero/xl size down (`.figure-long`).
