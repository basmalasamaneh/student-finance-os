# Student Financial OS — Frontend Architecture (Prompt 1 foundation · Prompt 1.5 gold identity)

## Layout
```
src/
  features/
    i18n/          dictionary.ts (typed EN source + AR Record<Key,string>), i18n-provider.tsx
    theme/         theme-provider.tsx (light/dark/system + motion preference, persisted)
    preferences/   preview-provider.tsx (NAVIGATION PREVIEW role + institution mode — NOT auth)
    navigation/    nav-config.ts (single source of truth for routes, roles, groups, mobile order)
  components/
    shell/         app-shell.tsx (sidebar ≥1024 with preview-profile + controls footer, rail 768–1023 + top bar, bottom bar + More sheet <768), shell-controls.tsx
    layout/        page.tsx (Page, PageHeader, Section, SectionHeading, SpecimenTag)
    states/        state-panel.tsx (StatePanel incl. permission-limited, Notice, SkeletonRows, RetryButton), app-error-fallback.tsx
    finance/       money-display (tones: default/positive/negative/neutral/planned/projected/highlight), balance-display,
                   financial-summary, upcoming-payment, progress-meter (savings/budget), account-surface, transaction-row, status-badge
  features/specimens/home-specimen.ts   static, translation-keyed fixture for the design-reference home ONLY
    ui/            shadcn/Radix primitives (button focus ring + touch sizes tuned)
  lib/money.ts     the ONLY import point for @workspace/finance-core in the app
  pages/           home (design-reference specimen, not a dashboard), foundation (gallery: Foundations, Actions, Inputs,
                   Financial, Feedback, Overlays, Navigation), appearance, not-implemented, not-found
```

## Rules for later prompts
- **Routes**: add/flip entries in `NAV_ITEMS`. `implemented: false` renders the shared `NotImplementedPage`. Implemented routes get an explicit `<Route>` in `App.tsx`.
- **Money**: never format or compute amounts in components. Use `MoneyDisplay` and helpers from `@/lib/money` (integer minor units, explicit currency). No floats.
- **Copy**: every string goes in `dictionary.ts`; Arabic must be complete (type-enforced). Use `{var}` interpolation.
- **Direction**: use logical utilities (`ms-/me-/ps-/pe-/start-/end-/border-s/e`), `rtl:-scale-x-100` for directional icons, `<bdi dir="ltr">` for numbers/amounts.
- **Colour (Gold signature, Phase 1 migration)**: semantic tokens only, all defined in `src/index.css`. Gold scale gold-50 #FFFBEB → gold-900 #3F2E0D; `primary`/`brand` = gold-500 #D4AF37 (light) / gold-400 #E3B644 (dark) used as a FILL with `on-brand` text (#2A1F05 / #1A1204, never white). Gold TEXT/icons use `gold-ink` (gold-800 light, gold-400 dark). Light canvas warm ivory #FBF8F1, surfaces #FFFFFF / #F5F0E3, border #E9E0C8, text #1C1608 / #5E5640; `muted-foreground` is the accessible alias #6E6750 (raw #8C8468 kept as `text-muted` for decoration only). Dark is a designed black-gold palette (#0D0B07 / #17130B / #211B0F, border #33291A, text #F8F1DC). Status: success #2E9E6A (text alias #1F7A50 on light), warning burnt orange #C2410C (dark alias #F08A5D), error #DC2626 (dark alias #F87171). Gradients `--gradient-gold`, `--gradient-gold-soft`, `--gradient-gold-shine`; max ONE gold gradient hero per screen (`.surface-gold`). Charts use gold tints/warm neutrals only. Radius: cards 20px (`rounded-card`), controls 14px, chips full-round, bottom sheets 28px (`rounded-sheet`). `--navy` is a legacy token name now mapped to deep ink. See docs/gold-visual-migration.md.
- **Type**: Inter / Noto Sans Arabic. Hero amount `figure-hero` (32–48px, tabular), page title 28–32, section 18–20, body 16, supporting 14, compact 12–13. Weights 400/500/600. Arabic: no letter-spacing/uppercase, line-height 1.7.
- **Buttons**: one gold primary per view; secondary = quiet surface/border; ghost/link = tertiary; 14px radius, not pills. Pills are for status/tags/filters.
- **Surfaces**: three levels — canvas → open section/divider (`Section`, `SectionHeading`) → raised surface (`AccountSurface`) only when grouping is genuinely useful. Never nest cards. Shadows are reserved for overlays.
- **States**: use `StatePanel` / `SkeletonRows` for empty/error/success/loading. No spinners for content loading.
- **Motion**: controls 120–180ms (150ms), overlays 180–240ms; `motion-rise`, `motion-fade`, `stagger`. No counting balances, bounces or page transitions. Global reduced-motion respects OS and `data-motion` override.
- **Auth**: the role switcher is a navigation preview. Real roles must come from a server-verified session; authorization is enforced server-side. Client-side role checks are UX only.
- **Specimens**: values on `/foundation` and the `HOME_SPECIMEN` fixture are labelled constants for design verification and must never be reused as data. Specimen actions only toast or are disabled — no pretend payments.
