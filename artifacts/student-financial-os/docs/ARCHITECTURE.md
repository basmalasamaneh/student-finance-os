# Student Financial OS — Frontend Architecture (Prompt 1 foundation)

## Layout
```
src/
  features/
    i18n/          dictionary.ts (typed EN source + AR Record<Key,string>), i18n-provider.tsx
    theme/         theme-provider.tsx (light/dark/system + motion preference, persisted)
    preferences/   preview-provider.tsx (NAVIGATION PREVIEW role + institution mode — NOT auth)
    navigation/    nav-config.ts (single source of truth for routes, roles, groups, mobile order)
  components/
    shell/         app-shell.tsx (sidebar ≥1024, rail 768–1023, bottom bar + More sheet <768), shell-controls.tsx
    layout/        page.tsx (Page, PageHeader, Section, SpecimenTag)
    states/        state-panel.tsx (StatePanel, SkeletonRows, RetryButton), app-error-fallback.tsx
    finance/       money-display, progress-meter, account-surface, transaction-row, status-badge
    ui/            shadcn/Radix primitives (button focus ring + touch sizes tuned)
  lib/money.ts     the ONLY import point for @workspace/finance-core in the app
  pages/           home, foundation (component gallery), appearance, not-implemented, not-found
```

## Rules for later prompts
- **Routes**: add/flip entries in `NAV_ITEMS`. `implemented: false` renders the shared `NotImplementedPage`. Implemented routes get an explicit `<Route>` in `App.tsx`.
- **Money**: never format or compute amounts in components. Use `MoneyDisplay` and helpers from `@/lib/money` (integer minor units, explicit currency). No floats.
- **Copy**: every string goes in `dictionary.ts`; Arabic must be complete (type-enforced). Use `{var}` interpolation.
- **Direction**: use logical utilities (`ms-/me-/ps-/pe-/start-/end-/border-s/e`), `rtl:-scale-x-100` for directional icons, `<bdi dir="ltr">` for numbers/amounts.
- **Colour**: semantic tokens only (`primary`, `success`, `warning`, `destructive`, `*-soft`, `surface`, `divider`). Red is errors/destructive only. Never convey status by colour alone.
- **Surfaces**: open sections separated by dividers (`Section`). One raised surface (`AccountSurface`) max; never nest cards.
- **States**: use `StatePanel` / `SkeletonRows` for empty/error/success/loading. No spinners for content loading.
- **Motion**: `motion-rise`, `motion-fade`, `stagger`. Global reduced-motion respects OS and `data-motion` override.
- **Auth**: the role switcher is a navigation preview. Real roles must come from a server-verified session; authorization is enforced server-side. Client-side role checks are UX only.
- **Specimens**: values on `/foundation` are labelled constants for formatting verification and must never be reused as data.
