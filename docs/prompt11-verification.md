# Prompt 11 — requirement coverage and verification

**Current: explicitly user-authorized Prompt 11 DELIVERED; targeted critical browser flows PASS, with explicit coverage limits. Prompt 12 is not started.** This is not exhaustive regression, visual/device or zero-regression proof. The final mobile Filter-sheet wrapper was added after these browser checks and was not separately browser-retested.

Scope: master implementation prompts, **lines 1455–1534**, “Upcoming Payments, Calendar & Forecast.” Contract: `docs/prompt11-api.md`, authoritative `lib/api-spec/openapi.yaml`, generated clients/Zod. Frontend paths below are relative to `artifacts/student-financial-os/src/`; backend paths to `artifacts/api-server/src/`.

Automated results are implementation-worker reported; actual browser evidence below is main-agent reported. The documentation agent inspected the master, contract and current frontend files; it did not run tests, builds, workflows or browser checks. Only sanitized synthetic amounts and screenshot reference IDs are recorded, not private identifiers, credentials or PII.

## Requirement coverage

| Master requirement | Current implementation / boundary |
|---|---|
| Track tuition, installments, registration, fees, rent, utilities, subscriptions, recurring expenses, purchases, savings and campus commitments (1457–1469) | Student `/upcoming` (`pages/upcoming.tsx`) supports owner-created one-off/repeating expense, income and savings commitments using existing planning categories. Backend `routes/scheduled.ts` supplies CRUD and occurrence status. Names/notes distinguish installments or purchases without invented real-world charges. Every new item is an explicitly disclosed **additional commitment**, not replacement of an existing budget, income, recurring expense or goal. |
| Name, amount, due date, category, status, recurrence, notes (1471–1479) | `components/upcoming/scheduled-dialog.tsx` uses existing money/category/date fields and shared dialog/sheet behavior; optional inclusive end date is supported. Positive exact minor units in ILS/USD/JOD, server validation and sanitized errors remain authoritative. List editing and confirmed deletion are implemented. |
| Status and repeating items | `occurrence-sheet.tsx` separates **Only this date** completion/skip/reopen from **Whole series** edit/end/restart/delete. A recurring series cannot be completed as a whole; cancelled-series date reopening does not restart it. Existing occurrence overrides block anchor/recurrence/end-date edits with 409; other edits retain overrides. Deleting a series removes its overrides only. These actions never pay a bill or change ledger/balances. |
| Calendar expenses, income, allowance, salary, scholarship, freelance, savings, university payments, rent, subscriptions (1483–1496) | `components/upcoming/upcoming-views.tsx` supplies monthly calendar, agenda, type filters, occurrence details and separately labeled undated allocations. Backend `lib/forecast.ts` adapts scheduled items, profile income, consented allowances, recurring expenses and dated plan lines. Existing-source entries are **read-only here**, with links to `/profile`, `/family`, `/plan` or `/goals`; only owned scheduled items are mutable. Scholarship metadata is **not income**; deliberately entered scholarship/salary/freelance income follows ordinary income rules. Goals contribute savings allocations without invented goal due dates. |
| Current balance + expected income − upcoming expenses − recurring expenses − planned savings = projected balance (1500–1522) | Student-only `GET /api/planning/forecast` computes the separate dated equation; `ForecastCard` displays server amounts without new frontend money arithmetic. Opening sums ordinary owned accounts, excludes goal reserves; signed projected balances and separate ILS/USD/JOD results use exact money, never FX. Completed/cancelled/posted occurrences are excluded. |
| Housing, transport and applicable campus spending (1524–1528) | Existing monthly expense reconciliation feeds the dated forecast: manual > recurring > housing/commute baseline by canonical category/currency; housing share replaces rent, utilities/internet remain separate, commute override wins. Campus-category commitments/manual lines/recurring expenses are supported where deliberately recorded; historical campus ledger spending is not charged again, and catalog metadata does not invent future fees. Budgets are comparison limits, not extra expenses. |
| **Estimated / Projected** label (1530–1532) | Server `estimate:true`/label/policy/assumptions and localized forecast range/cards disclose estimation, including ordinary income double-count uncertainty, undated allocations and frozen goal requirements. UI offers 30/60/90-day horizons; server ranges are inclusive UTC dates with a 366-day maximum. |
| Frontend continuity and refresh | `App.tsx` registers `/upcoming` and source-mutation invalidation; `features/navigation/nav-config.ts` adds student navigation. `components/home/upcoming-block.tsx` integrates normalized dated items and links to the page. `features/upcoming/upcoming-model.ts` uses generated hooks, 15-second polling, focus/mount refresh and prefix invalidation; pull-to-refresh and scheduled mutations refresh calendar/forecast/items. Loading skeletons, empty states, errors/retry, shared confirmations and bilingual copy are implemented. Targeted Home/source-refresh, mobile CRUD, calendar and persistent-error recovery checks passed; not every state or source link was browser-tested. Mobile Filter-sheet presentation was added afterward and is not separately browser-retested. |

## Calculation policy and disclosed assumptions

- Existing `/planning` monthly formulas are unchanged. A separate dated forecast reuses the extracted `financialPlanSnapshot` reconciliation; it does not rewrite the monthly plan or add scheduled commitments to that legacy endpoint.
- Recurrence expands actual anchors, clamps the original day at month end without drift, respects inclusive end dates and handles leap years. Past overdue items have **no automatic carryover**. No profile housing bill date or undated goal date is invented.
- Winning recurring expense dates are counted once, not again as a monthly estimate. Manual expense envelopes/profile baselines are exact prorated **undated monthly allocations**; dated manual lines are informational markers within their envelope. Savings uses max(manual savings envelope, active dated-goal monthly requirements), allocated once from a frozen current snapshot.
- Allowance uses max(manual recurring expectation, active consented schedule coverage), not their sum. Posted allowance is already represented in opening and excluded from future income; posted interval amounts reduce manual coverage. The schedule starts at persisted `nextPayment`, even off-anchor, and follows the actual worker recurrence. Revoked/denied schedules and their identifiers are not disclosed; the student's own posted credits may still privately reduce their manual expectation.
- **Ordinary income expected today may already be in opening.** The machine code `today_dated_income_may_already_be_in_opening` and localized UI warning disclose that ordinary profile/additional scheduled income is not transaction-linked. There is no guessed matching by amount/date; expectations remain until changed/completed/cancelled. This uncertainty is distinct from authoritative posted-allowance exclusion.
- Monthly allocations use exact deterministic calendar-day remainder distribution, not floating-point money. Unsafe amounts/aggregates fail explicitly rather than truncate. No guaranteed future income, automatic saving contribution or inferred future expense is promised.
- Calendar/forecast use one **repeatable-read transaction** for financial sources, available opening and goal reserve/requirements. A concurrent goal contribution cannot mix an old requirement with new opening. Legacy planning formulas and the default goal API transaction behavior remain unchanged.

## Additive schema and security boundaries

The backend worker reports a reviewed **table-scoped, non-force development Drizzle migration**, restricted to `src/schema/scheduled.ts` and `scheduled_*`, creating only:

1. `scheduled_items`
2. `scheduled_occurrence_overrides`

Their constraints/indexes are additive. **No old schema defaults/constraints, legacy tables or ledger rows were changed.** An initial full-schema preview exposed unrelated pre-existing default/FK-name drift and was **not applied**. The review follow-up needed no additional migration.

All new endpoints are authenticated **student-owner-only**; another owner sees 404, wrong role 403, and existing same-origin/CSRF mutation requirements remain. No parent/family access is granted by Prompt 11; source allowance access retains existing consent. Planning status changes neither post ledger payments nor reserve/move funds, generate notifications or change old receipts. Existing routes, authentication, budgets, family requests/permissions, peer requests, allowance worker and original external simulated goal-funding consent remain separate and preserved.

## Reported automated evidence

| Check | Reported result | Scope / limits |
|---|---|---|
| Full backend suite after review follow-up | **PASS — 29/29** | Worker-reported API regression/integration suite; supersedes initial 27/27 checkpoint, not exhaustive app proof. |
| Focused forecast suite | **PASS — 7/7** | Includes off-anchor worker `nextPayment` recurrence/manual allowance suppression and a controlled real goal contribution during the forecast snapshot. In-flight forecast keeps old opening/old requirement; next forecast sees new opening/new requirement, without double-charging. |
| Frontend typecheck | **PASS** | Reported PASS including the final mobile Filter-sheet wrapper; not browser proof of that wrapper. |
| Frontend production build | **PASS** | Reported PASS including the final mobile Filter-sheet wrapper; not browser proof of that wrapper. |
| Earlier existing frontend pure regressions | **PASS — 29/29** | Backend handoff reports existing pure tests with installed tsx loader; not new browser tests or an exhaustive UI regression suite. |
| Earlier finance-core suite | **PASS — 3/3** | Backend handoff result, not a newly rerun documentation-agent check. |
| Codegen/workspace typecheck/diff check | **PASS** | Backend review follow-up reports OpenAPI codegen, workspace-wide typecheck and `git diff --check`; exact generated hooks are documented in the API handoff. |
| Prompt 11 critical browser flows | **PASS — targeted, main-agent reported** | Actual evidence below; final mobile Filter-sheet wrapper is not separately browser-retested. |

Reported integration scope covers owner/role isolation, CRUD, per-date completion/cancellation/reopen, anchor-edit conflicts, cascade deletion, ledger/balance nonmutation, reserve exclusion, signed/exact currency equations, category/goal priority, housing/commute override, scholarship metadata exclusion versus explicit scholarship income, one-off/no-overdue behavior, allowance max/posted coverage and consent-removal confidentiality. Pure scope includes inclusive bounds, anchor clamping, leap years/end dates, recurrence frequencies, exact allocation and overflow rejection.

## Actual browser evidence

All amounts below are synthetic test amounts, not real-bank activity or reusable private fixture records.

| Check | Status | Main-agent-reported evidence / boundary |
|---|---|---|
| Exact one-off forecast and editing | **PASS** | Opening 1,000 + expected income 200 − expense 100 − savings 50 = projected 1,050. Editing expense to 125 changed projection to 1,025. Completing only that expense date changed projection to 1,150; reopening restored 1,025. |
| Weekly recurrence, inclusive end and per-date skip | **PASS** | Weekly amount 10 expanded to two dates through the inclusive end date, total recurring expense 20. Skipping one date reduced it to 10; restoring the date returned it to 20. |
| Whole-series access/end/restart | **PASS** | End/restart controls were accessible through the all-items list even when the series was outside the displayed calendar month. Per-date controls remained distinct from whole-series controls. |
| Mobile temporary-item CRUD | **PASS — 390px sample** | Created, edited and deleted a temporary scheduled item; removal and correct forecast were checked. Calendar-day tap opened details. This does not certify all mobile controls or physical devices. |
| Home upcoming and original-source refresh | **PASS** | Home upcoming reflected planning changes. Existing profile commute set to one trip at cost 1 produced legacy monthly estimate 4.33 and updated dated allocation; restoring commute to zero restored the baseline. Existing-source policy remains read-only here, edited at its original source. |
| Ledger/balance nonmutation | **PASS — tested sequence** | Wallet remained 1,000 and ledger retained exactly one initial simulated top-up of 1,000 throughout planning create/edit/status/recurrence/delete actions. No planning action posted money. This is targeted browser evidence, not an exhaustive ledger/concurrency certification. |
| Arabic/dark narrow viewport | **PASS — 320px sample** | Full Arabic assumptions were inspected in dark mode; sampled layout had no horizontal overflow. Not a full translation/theme/viewport matrix. |
| Persistent forecast error and explicit recovery | **PASS** | Intercepting all forecast requests with HTTP 500 exhausted retries and showed the actual error with visible Retry. Removing interception and clicking Retry restored the 60-day forecast, projection 1,005. An earlier single injected 500 automatically recovered through normal query retry; that expected behavior was not treated as a defect or the explicit error-state check. |

Sanitized screenshot reference IDs: **mi606w**, **1gg4cd**, **egkexb**, **8t8xjc**, **13thu2**. References only; no private screenshots or PII are embedded. No new admin feature is required by Prompt 11, and no admin browser pass is claimed.

## Remaining browser limits and historical gates

- **Final mobile Filter-sheet wrapper: implemented after browser checks, typecheck/build PASS, not separately browser-retested.** It shares the unchanged `kindFilter` state/logic used by list/calendar and the desktop inline filters; shared logic and build success do not prove sheet interaction/layout.
- Browser evidence is limited to the recorded sequences and samples. Every validation/range/overflow case, source-link combination, calendar navigation/filter permutation, horizon/disclosure combination and loading/empty/refresh state is not exhaustively browser-tested.
- Owner/role isolation, MVCC concurrency, multi-currency/overflow and detailed allowance-consent/posted-coverage policies retain automated/code evidence, not browser coverage of every scenario.
- Full screen × EN/AR × Light/Dark × viewport, comprehensive keyboard/accessibility and physical-device keyboard/notch/gesture/PWA/privacy behavior remain **unverified**. Targeted PASS and automated success close none of these broader gates.

Preserve all Gold rules: existing semantic tokens/shared components only, no raw colors or second styling system, mobile-first shared sheets, safe areas/44px targets, role-aware navigation, EN/AR/RTL and Light/Dark, accessible focus/reduced motion and non-judgmental language. No service worker/offline financial caching; local privacy/PIN UX is not authentication or guaranteed OS screenshot prevention.

Prompt 7.5's qualified gates in `docs/gold-phase6-verification.md`, Prompt 8/9 limits and Prompt 10's targeted browser/admin/device limitations remain unchanged. Their older authorization/start-status statements describe historical checkpoints; today's explicit Prompt 11 authorization changes start status only, not historical verification evidence. **No exhaustive regression certification, real-bank/provider integration, AI, new notification engine or external notification delivery is claimed. Prompt 12 and later work require separate authorization.**