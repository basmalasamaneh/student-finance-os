# Gold visual migration — Phase 2 (shared component library)

Scope: shared components + `src/index.css` only. No pages, Home components, onboarding/auth, backend,
schema, routes, hooks, money formatting or dependencies changed. All filenames/exports/props preserved;
only optional props and new named exports added. Raw colours live only in `index.css`.

## Delivered checklist
- [x] **Buttons** (`ui/button.tsx`): 52px mobile / 44px desktop, `active:scale-[.97]` + pressed colour, disabled = dimmed + desaturated.
  Variants: `default` (flat gold), **new** `gradient` (gold gradient + on-brand; the ONE emphasised primary per screen),
  `outline` (outlined gold), `secondary`, **new** `tertiary` (text), `ghost`, `link`, `destructive`.
  **New optional** `loading` prop: spinner overlay, width preserved, disabled + `aria-busy`. `asChild` path untouched (Slot, loading ignored).
  `.surface-gold .btn-gradient` collapses to the hero's flat primary (hero context = flat).
- [x] **Inputs/selects**: `Input` 52px/44px, gold focus ring, invalid ring; **new optional** `onClear`/`clearLabel` (caller-owned handler, no internal state), `amount` (large centred tabular). `SelectTrigger` 52px. `money/fields.tsx` `inputClass` 52px; `AmountInput` keeps `inputMode="decimal"` + handlers, **new optional** `large`. Inline errors animate in.
- [x] **Cards** (`ui/card.tsx`): 20px radius flat surface; **new optional** `variant: 'default'|'premium'|'sunken'`. Premium = soft gold wash + shine (not a strong gradient). Money `Receipt` now uses premium styling.
- [x] **Transaction rows**: `TransactionRow` 40px circular gold-tinted icon container; **new optional** `icon` (category) and `trailing`. **New exports** `TransactionDateHeader` (sticky) and `groupByDay()`. `LedgerList` category icons (food/books/printing/transport/fees/income/transfer/withdrawal) and **new optional** `grouped` (Today/Yesterday/date sticky headers).
- [x] **Progress**: `ui/progress` + `ProgressMeter` gradient fill on gold-200 / #33291A track, grow-on-mount; status fills (done=success, over=warning) kept. **New export** `GoalRing` (SVG gradient ring, sweep-in, `done` state, accessible progressbar). Reduced motion honoured by global rules.
- [x] **Badges**: soft tinted; new `success`/`warning` variants; destructive now soft.
- [x] **Tabs**: pill segmented control with measured, animated gold-edged indicator (LTR/RTL, wraps; CSS fallback).
- [x] **Charts**: tooltip on popover tokens, soft grid (existing), **new** `ChartContainer srSummary` text alternative, **new export** `CHART_BAR_RADIUS` for rounded bars.
- [x] **States**: `StatePanel` gold line-art mark (dashed + hairline rings), **new optional** `align`; `Skeleton` = shimmer (RTL-aware); `SkeletonRows` matches row geometry.
- [x] **Toasts**: top under safe-area on mobile, bottom-end on desktop; status icon per variant; **new** `variant: 'success'`; destructive is soft, not a red block.
- [x] **Dialogs**: every `DialogContent` and `AlertDialogContent` gets `.sheet-mobile` → bottom sheet < 640px (slide-up, grabber, safe-area padding, full-width stacked footer), centred ≥ 640px. CSS only; Radix portal/focus trap/Escape/outside-click unchanged.
- [x] **Icons**: global lucide 1.75 stroke + round caps; directional glyphs mirrored in RTL via `scale` unless already mirrored by a `*scale-x*` utility.

## Integration (Phase 3)
- Emphasis rule: screen with a `.surface-gold` hero → all buttons flat; screen without hero → give its first primary `variant="gradient"`, others `default`/`outline`.
- Balance hero: wrap in `.surface-gold` (only one per screen); use `Card variant="premium"` for goal highlight / campus receipt. Hide-balance persistence and quick actions are Phase 3 (Home); `MoneyDisplay hidden`/`TransactionRow hidden` already exist.
- Lists: `<LedgerList grouped …/>` on Transactions/Money; sticky headers need the scroll container to be the page (no `overflow` on ancestors).
- Goals: `<GoalRing value={pct(goal)} label={goal.name} done={isFunded(goal)} />`.
- Search: `<Input value={q} onChange={…} onClear={() => setQ('')} clearLabel={t('Clear','مسح')} />`.
- Async buttons: prefer `loading={mutation.isPending}` over manual disabled+text swaps.
- Success toasts: `toast({ variant: 'success', title })`.
- Charts: `<ChartContainer srSummary="…">`, `<Bar radius={CHART_BAR_RADIUS} fill="var(--color-x)" />`.

## Verification
`pnpm typecheck` and `pnpm build` pass. No browser/workflow run (per brief).
