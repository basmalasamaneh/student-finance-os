# Gold visual migration — Phase 1 (tokens + consumption)

Status: COMPLETE. Presentation-only. No backend, API, schema, auth, routing, hooks, i18n keys, money math/formatting, or tests changed.

## Scope
- `src/index.css` is the single colour definition file: gold scale 50–900, light (warm ivory) and dark (black-gold) surfaces/text, brand/on-brand, status bases + accessible aliases, gradient tokens (`--gradient-gold`, `--gradient-gold-soft`, `--gradient-gold-shine`), gold-only chart tokens, warm shadows (light) / gold-hairline + faint inner highlight (dark). Existing `hsl(var(--x))` / `@theme inline` contract preserved; every legacy token name (`--navy`, `--gold-ink`, `--primary-soft`, ...) still exists. New Tailwind utilities: `gold-50..900`, `brand`, `on-brand`, `bg-app`, `bg-surface(-2)`, `border-subtle`, `text-primary/secondary/muted(-accessible)`, `*-base` status.
- Type: display figure 36–44, H1 `type-display` 28 (all breakpoints), H2 `type-h2` 22 (shared `SectionHeading` h2), H3 `type-title` 18 (`SectionHeading as="h3"`), body 16, caption 13 (Arabic 13.5; `.eyebrow` 13).
- Shape: controls 14px (`--radius`), cards/dialogs 20px (`rounded-card`), chips `rounded-full`, bottom sheets 28px (`rounded-sheet`) with safe-area padding, `gutter-x` 16px mobile.
- Utilities: `.surface-gold` (the one gradient hero per screen), `.surface-gold-soft`, `.money-currency/.money-decimal/.money-sign` (size + weight only, no opacity, so tone contrast is unchanged), `.chart-surface`.

## Contrast (WCAG, measured)
| Pair | Ratio | Use |
|---|---|---|
| #1C1608 on #FBF8F1 | 16.96 | body light |
| raw muted #8C8468 on #FBF8F1 / #FFFFFF | 3.53 / 3.74 | FAILS body → kept as `text-muted` (decoration only) |
| alias #6E6750 on #FBF8F1 / #F5F0E3 | 5.32 / 4.96 | `muted-foreground` light |
| gold-700 #8F6B1C on #FBF8F1 / #FFFFFF / #F5F0E3 | 4.62 / 4.90 / 4.30 | focus ring (≥3), large gold text |
| gold-800 #6B4F16 on light surfaces | ≥6.9 | `gold-ink` light |
| gold-500 #D4AF37 on #FBF8F1 | 1.98 | never text |
| on-brand #2A1F05 on gold-500 | 7.70 | button text |
| raw success #2E9E6A on #FFFFFF | 3.38 | fills/icons only → text alias #1F7A50 (5.0 / 5.31) |
| warning #C2410C / error #DC2626 on #FBF8F1 | 4.88 / 4.55 | text ok; white on them 5.18 / 4.83 |
| #F8F1DC on #0D0B07 | 17.42 | body dark |
| dark muted #8F8465 on #0D0B07 / #17130B | 5.30 / 4.99 | `muted-foreground` dark (raw passes) |
| gold-400 #E3B644 on #17130B | 9.73 | dark ring / gold-ink; on-brand #1A1204 on it 9.75 |
| #2E9E6A on #17130B | 5.48 | success dark |
| aliases #F08A5D / #F87171 on #17130B | 7.49 / 6.69 | warning / destructive dark (raw bases fail on near-black) |

Focus: global `:focus-visible` 2px outline + offset in `--ring` (gold-700 light, gold-400 dark); inputs/select/textarea/toast close/error-boundary moved to 2px ring + offset.

## Gold hero (one per screen)
Student Home `BalanceBlock` wrapper (`data-testid="text-balance"`) is the only `.surface-gold` element in the app; all CTAs stay flat. `.surface-gold` locally remaps foreground, muted, gold-ink, success/warning/destructive, ring and borders to `--on-gold` #1A1204. Exception: `--primary` becomes the dark bronze fill with `--primary-foreground` gold-50 (cream), so any primary button inside the hero renders as a flat dark button with light text (never a gold fill on gold); gold-fill buttons elsewhere keep on-brand text. `--on-gold` whose worst case across the theme-invariant gradient is 4.94:1 (#A97C1F end; 8.8 on #D4AF37, 12.1 on #F0CE6B), so every child passes in light and dark. Amounts keep `whitespace-nowrap` + long-figure step-down with `min-w-0` on the wrapper — no clipping.

## Money
`MoneyDisplay` still calls the untouched `formatMoney`; the string is split by character class into spans (currency smaller/lighter, fraction smaller, sign bold). Concatenated text equals the formatted string, so ARIA, `<bdi dir="ltr">`, `+` prefix, `≈` prefix, hidden state, whitespace-nowrap/no-clip and long-figure step-down are unchanged. Fraction length is read from the same formatter's zero output (no Number parsing/rounding). Negative amounts keep the formatter's `-` sign.

## Raw-colour migrations
onboarding emerald → `text-success`; error-boundary gray → semantic tokens; toast destructive reds → tokens; chart recharts `#ccc/#fff` selectors moved into `index.css` `.chart-surface`; overlay `bg-black/xx` → `bg-scrim/xx` (warm near-black token) in dialog/alert-dialog/sheet/drawer/app-shell; theme-provider meta theme-color now derived from computed `--background`; foundation `navy` label value → "Deep ink"/"حبر داكن" (key unchanged), colour description "amber" → "burnt orange" (both languages).

## Verification
`pnpm typecheck` and `pnpm build` (with PORT/BASE_PATH env set, as the vite config requires) pass; `rg` for hex/rgb/tailwind palette classes in `src` returns only `src/index.css`. `public/favicon.svg` scaffold orange removed; the existing rect now uses `fill="currentColor"` (no raw colour).

## Coverage

### Final browser verification

Verified with isolated synthetic accounts: signup/login, all onboarding steps and profile editing, student Home, wallet creation and simulated funding, campus checkout and itemized receipts, transaction filters/detail/back navigation, budget actuals, recurring-expense create/edit/delete, and goal create/edit/contribute/pause/resume/complete/archive/history. Existing data sources and financial behavior were retained. Home was inspected at desktop size in both themes and at 390px/320px in Arabic dark mode; rendered theme variables were present, the balance hero was the only strong gradient, and keyboard focus had a visible 2px outline.

The narrow Arabic Profile → Commute check exposed a pre-existing conflicting `w-full`/`w-24` currency-select class combination. Merging presentation classes with the existing `cn` helper fixed it without altering handlers or calculations. Targeted verification measured the select at 96px and the document at its 305px client width in a 320px viewport, with no horizontal overflow. The remaining goal flow then passed at 320px in Arabic dark mode: 83 available → 53 available + 30 reserved, with 83 net retained after completion/archive. Screenshots also confirmed the final Home, Plan, dialogs, and history.

Only presentation files and documentation changed. No routes, schema, migrations, backend/API logic, auth/session behavior, financial calculations, monetary values, translation keys, or seed files were changed.
Phase 1 as briefed is complete: tokens, typography, shape, elevation, money presentation, shared controls, gold hero, raw-colour cleanup, docs. All screens consume the shared tokens/components. Money wrapping verified by script against finance-core's actual supported currencies ILS, USD, JOD (2/2/3 decimals) × en/ar × {0, ±1, ±5, 1000, 123456, -9876543, 100000}: 54 cases, 0 text mismatches, every negative keeps its `-` sign span; Arabic JOD abbreviation dots stay grouped with the currency symbol.

Radius pass (class-only): feature card wrappers/panels/skeletons `rounded-xl|2xl` → `rounded-card` (20px) in account-surface, goal-progress, plan-totals, housing-commute, plan-shared, invitation-panel, student-dashboard insight, account panel, auth, onboarding form wrappers, parent-fund, goals, plan, campus, admin-campus, account-home; control-like elements `rounded-xl|md` → `rounded-lg` (14px) in checkout-dialog, future-integrations, campus options, transactions search/filter, money actions/filters, account-list, not-found, not-implemented, foundation nav, error fallback. Icon tiles/circles untouched; no global radius override.
