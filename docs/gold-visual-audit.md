# Gold visual migration — Phase 0

PHASE 0 inventory (read-only; no files changed)

BASELINE
- `git --no-optional-locks status --short`: clean (no output).
- Mission fully read: `attached_assets/Pasted-MISSION-Redesign-the-visual-layer-UI-UX-of-the-existing_1790802076298.txt` (130 lines). Safety boundary is presentation-only; preserve backend/API/auth/routes/calculation/money/i18n/data/business logic.

CURRENT STYLING/THEME
- Tailwind v4 + `tw-animate-css` imported in `src/index.css`; no tailwind.config file found. `@theme inline` maps semantic CSS vars to Tailwind utilities.
- Main token/theme source: `artifacts/student-financial-os/src/index.css:7-83,85-176` light and `178-244` dark. Base focus, type roles, motion, reduced-motion, safe-area and elevation utilities are also there (`247-455`). Components overwhelmingly consume semantic classes (`bg-primary`, `text-muted-foreground`, etc.).
- Provider: `src/features/theme/theme-provider.tsx:1-91`, persisted `sfos.theme` light/dark/system and `sfos.motion`; toggles `.dark`, system media query. Inline browser chrome colors remain stale `#0c111d`/`#f8fafc` at lines 57-59.
- Provider nesting/routes entry: `src/App.tsx:77-102`; I18n > Theme > Preview > Query > Tooltip > Wouter > SessionGate > AppShell.
- Fonts: CSS vars `--app-font-sans: Inter, Noto Sans Arabic, ui-sans-serif...`, Arabic equivalent, mono and serif at `index.css:149-152`; `docs/typography.md` documents this. `index.html` is the font-loading/HTML entry point to verify. No separate font package/config found.
- Money boundary: `src/lib/money.ts:1-10` re-exports integer-minor-unit `formatMoney`/helpers from `@workspace/finance-core`; no UI money arithmetic/formatting should be changed. `src/components/finance/money-display.tsx` is canonical display component.
- Existing architecture inventory: `docs/ARCHITECTURE.md:1-36` (explicitly identifies Prompt 1 foundation / Prompt 1.5 gold identity and shared architecture).

CURRENT TOKEN PALETTE VS MISSION REQUEST
- Current light tokens (index.css 99-147): canvas `#FAF9F5` (HSL 45 33% 97), foreground `#172033`, navy `#111827`, primary gold approximately `#D4A72C` (HSL 44 66% 50), gold text `--gold-ink` HSL 38 80% 29, muted foreground slate HSL 216 20% 38, success derived from `#22A06B`, warning deep amber, destructive derived from `#EF4444`; current tokens are already a prior gold migration, not the mission’s exact palette.
- Current dark tokens (178-234): deep navy/blue-black canvas HSL 223 38% 7, surface HSL 223 30% 10.5, warm text HSL 42 30% 94, gold HSL 43 70% 57, muted HSL 220 14% 68.
- Mission target palette is materially different: light `#FBF8F1/#FFFFFF/#F5F0E3/#E9E0C8/#1C1608/#5E5640/#8C8468`, brand `#D4AF37` with gold scale `#FFFBEB` through `#3F2E0D`; dark `#0D0B07/#17130B/#211B0F/#33291A/#F8F1DC/#CDBF96/#8F8465`; exact gradients and semantic status `#2E9E6A`, `#C2410C`, `#DC2626` are specified in mission lines 35-75.
- Existing `docs/ARCHITECTURE.md:29-32` describes current design contract: gold `#D4A72C` fill, `gold-ink` text, warm off-white/navy, deep amber warning, #EF4444 destructive, Inter/Noto Sans Arabic, 10px buttons/12px base radius. This is a useful migration baseline, but conflicts with requested 20px cards/14px controls and exact token values.

RAW COLOR / PALETTE OCCURRENCES (migration candidates)
- `src/index.css:87-88,99-147,155-161,180-243,274,280,308,325-329,374`: token comments/raw hex and HSL definitions (legitimate token-definition location; exhaustive CSS color source).
- `src/pages/onboarding.tsx:186`: raw palette `text-emerald-700 dark:text-emerald-400` (success message; migrate semantic `text-success`).
- `src/components/error-boundary.tsx:40-58`: raw gray classes `bg-gray-50`, `text-gray-900`, `text-gray-600`, `bg-gray-100`, `text-gray-800`, `bg-gray-900`, `text-white`, `hover:bg-gray-700` (outside semantic system; high priority).
- `src/components/ui/toast.tsx:77`: raw red classes `text-red-300`, `hover:text-red-50`, `focus:ring-red-400`, `focus:ring-offset-red-600` in destructive close-button state.
- `src/pages/foundation.tsx:140-141`: dynamic inline `hsl(var(${token}))` color/background swatches; token names are data-driven and intentional specimen UI, inspect before migration. Line 730 uses inline width/height only.
- `src/features/theme/theme-provider.tsx:58`: inline raw `#0c111d`/`#f8fafc` browser theme colors.
- `src/components/ui/chart.tsx:52`: raw SVG selector values `[stroke='#ccc']` and `[stroke='#fff']` (chart presentation selectors), plus dynamic `item.color` inline style at 305-306. Chart wrapper itself is tokenized otherwise.
- `src/components/campus/checkout-dialog.tsx:63` and `src/components/money/create-account-dialog.tsx:47`: arbitrary `accent-[hsl(var(--primary))]` (token-based, not raw palette, but hardcoded styling occurrence).
- `src/components/ui/sidebar.tsx:483`: arbitrary token-derived shadow `shadow-[0_0_0_1px_hsl(var(--sidebar-border))]` (semantic variable, safe).
- No `indigo-*`, `mint-*`, `amber-*`, `emerald-*`, or other raw color palette classes were found in `src` beyond the explicit emerald/gray/red occurrences above. No raw `rgb()`/`rgba()` occurrences found in source. SVG favicon remains `public/favicon.svg:2` raw `fill="#FF3C00"` (brand artifact, not app UI but relevant presentation inventory).
- No chart config with literal color constants was found in application source; chart component supports config-driven `color` and token CSS variables. Search `recharts|dataKey|style` points to `src/components/ui/chart.tsx`, plus progress transform inline styles and layout grid inline styles.

ROUTES/SCREENS (actual App.tsx routes)
- `/login`, `/signup` → `src/pages/auth.tsx` (outside AppShell auth screens).
- `/` → `src/pages/account-home.tsx` (current account/home landing; wraps authenticated shell).
- `/onboarding`, `/profile` → `src/pages/onboarding.tsx` (create/edit profile).
- `/foundation/home` → `src/pages/home.tsx` (student dashboard / design-reference implementation).
- `/foundation` → `src/pages/foundation.tsx` (component/design foundations gallery).
- `/appearance` → `src/pages/appearance.tsx` (theme/motion/accessibility preferences).
- `/money` → `src/pages/money.tsx` (accounts/wallet; account list, create account, movement/request dialogs, ledger).
- `/transactions` → `src/pages/transactions.tsx` (history/filter panel/active filters).
- `/transactions/:id` → `src/pages/transaction-detail.tsx` (detail/receipt).
- `/campus` → `src/pages/campus.tsx` (campus catalog/checkout/receipt).
- `/plan` → `src/pages/plan.tsx` (income, university plan, housing/commute, lines, recurring, budgets).
- `/goals` → `src/pages/goals.tsx` (goals list/progress/actions).
- `/goals/fund` → `src/pages/parent-fund.tsx` (parent goal funding).
- `/goals/:id` → `src/pages/goal-detail.tsx` (goal detail/contribute/edit/pause/resume/complete/archive/history).
- `/admin/institutions` → `src/pages/admin-campus.tsx` (admin institutions/catalog forms).
- Future `NAV_ITEMS` routes render `src/pages/not-implemented.tsx`: `/upcoming`, `/afford`, `/assistant`, `/family`, `/parent/children`, `/parent/allowances`, `/parent/requests`, `/admin`, `/admin/users`, `/admin/students`, `/admin/parents`, `/admin/transactions`, `/admin/categories`, `/admin/settings`.
- fallback is `src/pages/not-found.tsx`; app error states use `src/components/states/app-error-fallback.tsx` and `src/components/error-boundary.tsx`.
- Route/nav source of truth: `src/features/navigation/nav-config.ts:24-110`; groups are money, plan, campus, family, oversight, system; roles student/parent/admin; mobile order is defined there.

SHARED COMPONENT GROUPS/PATHS
- Shell/layout: `src/components/shell/app-shell.tsx`, `shell-controls.tsx`; `layout/page.tsx`; `states/state-panel.tsx`, `app-error-fallback.tsx`; `error-boundary.tsx`.
- Finance primitives: `components/finance/{money-display,balance-display,financial-summary,progress-meter,account-surface,upcoming-payment,status-badge,transaction-row}.tsx`.
- Home/dashboard: `components/home/{student-dashboard,finance-blocks,goals-block,plan-totals-block,planning-panels,home-primitives}.tsx`; specimen `features/specimens/home-specimen.ts`.
- Money/account flows: `components/money/{account-list,ledger-list,requests-list,fields,create-account-dialog,movement-dialog,request-dialog,receipt}.tsx`.
- Planning: `components/planning/{plan-totals,income-section,housing-commute,lines-section,line-dialog,recurring-section,recurring-dialog,budgets-section,budget-dialog,plan-shared}.tsx`.
- Goals: `components/goals/{goal-progress,goal-form-dialog,contribute-dialog,invitation-panel}.tsx`.
- Transactions: `components/transactions/{filter-panel,active-filters}.tsx`.
- Campus: `components/campus/{checkout-dialog,admin-forms,future-integrations}.tsx`.
- UI primitives (shadcn/Radix, all under `components/ui/`): accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, button-group, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, empty, field, form, hover-card, input, input-group, input-otp, item, kbd, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip.

PROMPTS 1–7 COVERAGE / PROTECTION MAP
- Prompt 1 foundation/design system: `pages/foundation.tsx`, `pages/home.tsx`, `features/specimens/home-specimen.ts`, layout/state/finance/UI primitives, theme/i18n/navigation.
- Prompt 2 account/profile/auth/onboarding: `pages/auth.tsx`, `pages/onboarding.tsx`, `pages/account-home.tsx`, `features/auth/account.tsx`.
- Prompt 3 Money/accounts/wallet: `pages/money.tsx`, money components/model, `src/lib/money.ts`.
- Prompt 4 campus payments/catalog/receipts: `pages/campus.tsx`, `admin-campus.tsx`, campus components, money receipt.
- Prompt 5 transactions/history/filters: transaction pages, transaction components, `features/transactions/{history-filters,labels}.ts`.
- Prompt 6 Budget/Plan: `pages/plan.tsx`, all planning components, `features/planning/{planning-model,planning-math}.ts`.
- Prompt 7 Savings Goals + parent funding: goals pages/components, `features/goals/goals-model.ts`, `pages/parent-fund.tsx`.
- Cross-cutting i18n: `features/i18n/{dictionary,i18n-provider}.tsx`; preferences: `features/preferences/preview-provider.tsx`; do not alter existing translation keys or role/session logic.

ACCESSIBILITY / CONTRAST FLAGS FOR MIGRATION
- Good existing pattern: `--gold-ink` is explicitly intended for gold text on light; focus ring is global 2px/offset at `index.css:273-279`; `primary-foreground` is dark navy on gold rather than white; tabular money and Arabic handling exist.
- Mission conflict: current token system’s exact values/semantics differ from requested palette and sizing (current radius 12px/16px, type roles body 15px, display 26-32px vs requested cards 20px, controls 14px, body 16px, display 36-44px).
- Risky requested colors if used as text: gold-300/400/500 (`#F0CE6B/#E3B644/#D4AF37`) on light white/ivory; use gold-700 `#8F6B1C` or darker (`#6B4F16`, `#3F2E0D`) for text/icons. Never white text on gold fills; use requested `on-brand #2A1F05`. Treat `#8C8468` muted light and `#8F8465` muted dark as body text only after contrast verification at actual surface; preserve a darker semantic alias if needed.
- Current raw `text-emerald-700/dark:text-emerald-400`, gray error fallback, and red toast utilities bypass semantic aliases and can diverge in dark mode. Current dark `--gold-ink` is a light gold intended for dark backgrounds; do not reuse it on light surfaces.
- Safe semantic aliases to preserve/extend: `background`/`surface`/`surface-sunken`, `foreground`, `muted-foreground`, `border/divider`, `primary`/`primary-foreground`/`primary-soft`, `gold-ink`, `success`/`success-soft`, `warning`/`warning-soft`, `destructive`/`destructive-soft`, `ring`, `chart-1..5`, sidebar equivalents. Add explicit requested `text-primary/text-secondary/text-muted`, `brand/brand-pressed/on-brand`, `bg-app/bg-surface/bg-surface-2`, gradient tokens, and gold scale only in the token definition file; keep component classes semantic.

SEARCHABLE STYLE-MIGRATION FILE SET
- Primary: `src/index.css`, `src/features/theme/theme-provider.tsx`, `src/components/finance/money-display.tsx`, `src/components/shell/app-shell.tsx`, `src/components/layout/page.tsx`, `src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `dialog.tsx`, `sheet.tsx`, `sidebar.tsx`, `toast.tsx`, `chart.tsx`, `progress.tsx`, `badge.tsx`, `calendar.tsx`, `tabs.tsx`.
- Screens: every file under `src/pages/` listed above.
- Feature composites: every file under `src/components/{finance,home,money,planning,goals,transactions,campus,shell,layout,states}` listed above.
- Supporting docs: `docs/ARCHITECTURE.md`, `docs/typography.md`; route/theme/i18n sources `src/features/{navigation,theme,i18n,preferences}`; artifact branding `public/favicon.svg`.
