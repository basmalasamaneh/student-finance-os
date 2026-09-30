# Gold visual migration — Phase 3 (screen sweep + Home integration)

Presentation-only. No routes, API/server, auth/session, money calculation/parsing, seed, deps or
translation-system changes. All copy uses the existing `t(en, ar)` pattern. Existing exports/props kept;
only optional props / new named exports added. Verified: `pnpm typecheck`, `pnpm build`, and the targeted browser pass below.

## Browser verification
Fresh isolated student at 390px: mobile Education, Residence, Commute and Income question paging, Back preserving values, required-field validation and no premature saves, review/completion; Scholarship required-name validation (full scholarship submission was not exercised).
Home quick Add money recorded exactly 100 simulated ILS; hide/show survived reload. Send and Request sheets opened and cancelled without records. Campus account/review/receipt recorded exactly 17 ILS, leaving 83. Arabic dark review showed both before/after balances and simulated labels.
Read-only Transactions, Plan, Goals empty state, Profile and Appearance rendered; language/theme/reduced-motion controls worked. Foundation loading/empty/error specimens and dialog Escape/focus return worked. Home was checked at 320px Arabic dark and 1440px English light, with no page-level horizontal overflow or ResizeObserver errors.
This pass did not repeat the earlier complete goal lifecycle or exercise every screen's error branch; the coverage table below describes preserved code branches, not separate browser tests for every cell.

## Emphasis rule applied
Hero screens (`.surface-gold`): Home (balance hero), Auth (welcome panel) → all buttons flat.
Non-hero: one `variant="gradient"` — Onboarding step submit/Finish/Retry (one visible at a time), Money "New account",
Goals "New goal", Goal detail "Add money". Plan "Add budget" (gradient, default 52px size) and Transactions filter sheet "Show results" (gradient). Campus/Settings: flat only.
Explicit `min-h-11` removed from `<Button>`s (transactions pager/filters, goal form, invitations) so Phase 2 52px mobile applies; icon row actions 40→44px. Removed `min-h-11` from filter-sheet buttons: tailwind-merge let it replace the Phase 2 `min-h-[52px]`. A search finds no remaining `<Button>` with a `min-h-*`/`h-*` override outside `components/ui`.

## Coverage map
| Screen | Phase 3 changes | Loading | Empty | Error | RTL / dark |
|---|---|---|---|---|---|
| Auth (login/signup) | Gold welcome panel, existing `BrandMark` (now exported from app-shell), exact tagline EN/AR, role option cards, `loading` submit | button spinner | n/a | existing codes | logical props; tokens |
| Onboarding / Profile | Step progress bar + stepper chips (check for done), option cards (student type, residence, method), **mobile one-question-at-a-time** pager, desktop grouped flow unchanged | form-shaped skeleton | n/a | InlineError + gradient Retry | yes |
| Home | Initials avatar greeting (no notifications — none exist), balance hero with account count + eye toggle (localStorage `sfos.hideBalance.<userId>`, boolean only), quick actions Add/Send/Request (existing `MovementDialog`/`RequestDialog`) + Pay campus (`/campus` link), income/spending horizontal snap on mobile, goals ring carousel. **Section order unchanged incl. School/University planning and PlanTotals** | gold hero skeleton + existing | existing | existing | yes |
| Money | Totals in premium card, accounts as stacked cards, grouped ledger (Today/Yesterday sticky) | existing SkeletonRows | existing | existing | yes |
| Movement / Request / Campus checkout / Contribute sheets | `FlowSteps` progress, `SuccessCheck` (gold draw, reduced-motion safe), premium receipt, `loading` confirm | button | — | existing | yes |
| Transactions | `Input onClear` search, horizontal type chips (existing SEMANTIC_TYPES filter), scrollable active chips, filter sheet (existing), `LedgerList grouped` | existing | existing | existing | yes |
| Plan | Section cards (`.plan-card`), budget bars gold track/fill, calm warning “You are above your planned budget.” (warning-soft, not red) | existing | existing | existing | yes |
| Goals / Goal detail | `GoalRing` in cards (existing remaining/required/target date only), funded card premium, detail ring + gold “Fully funded” status (motion-pop, reduced-motion safe), contribute quick chips 10/25/50/Remaining fill the same validated text field (Remaining via exact BigInt minor→decimal; parsing still `parseAmountInput`) | existing | existing | existing | yes |
| Settings (Appearance) | Grouped iOS-style lists for existing theme/language/motion; no new settings | n/a | n/a | n/a | yes |

## Mobile question paging (how it stays safe)
`useQuestionPager` in `pages/onboarding.tsx` (< 640px only). Each field is tagged `data-q-page`; non-current ones get
`hidden`. On intermediate questions the form is `noValidate` and `onSubmit` first calls `pager.intercept(e)`, which
validates only the current question's controls (`checkValidity`/`reportValidity`) and advances — Enter never saves early.
On the last question native validation runs across the whole form; `onInvalidCapture` jumps back to any hidden invalid
field. The original `saveStep(...)` handlers, required/pattern rules, `AmountField` parsing and mutations are unchanged.
Income (8 questions) and Scholarship (13 questions) add/edit forms are paged the same way on mobile; their saved-record
lists stay lists. They wrap the original `form.handleSubmit(submit)` behind `pager.intercept`, so parsing/validation in
`submit` is unchanged; the pager resets when switching record, cancelling, or after a successful save.
Hidden-invalid handling: `onInvalidCapture` calls `preventDefault()` (suppresses the browser's "not focusable" error),
reveals the question, waits two frames, focuses the control, then calls `reportValidity()` (first invalid only).

## Remainders (not silently omitted)
- Transaction detail stays a page (allowed by brief).
- Campus, admin, parent-fund and profile screens consume shared tokens only (raw-colour/palette-class search clean); no bespoke changes.
- No browser or screenshot checks were run (per brief); verification is typecheck + build only.
