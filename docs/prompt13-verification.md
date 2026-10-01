# Prompt 13 — scope and verification

**Current: explicitly user-authorized Prompt 13 DELIVERED; targeted critical financial browser flows PASS, with qualified visual evidence and a final text-wrap browser-retest gap. Prompt 14 is not started and requires separate authorization.** This separates implementation inspection, worker-reported automated results and main-agent-reported browser evidence. It is not an unqualified whole-visual PASS, exhaustive browser certification, universal regression coverage or zero-regression proof.

Contract: `docs/prompt13-api.md`, `lib/api-spec/openapi.yaml` and generated client/Zod types. Master scope: `attached_assets/Student_Financial_OS_—_Master_Implementation_Prompts_V3_—_Final_1790784386743.md`, lines **1576–1611**, plus the authorized strengthened optional category, purchase-date and account fields. Frontend inspected: `artifacts/student-financial-os/src/pages/afford.tsx`, `components/afford/afford-result.tsx` and `features/afford/afford-model.ts`. Backend evidence is reported in the API contract and its referenced affordability tests. No code, tests, builds, workflows or browser checks were run for this documentation update.

## Master-scope mapping and strengthened boundary

| Requirement | Implemented scope / limits |
|---|---|
| Item and price; scenario comparison | Student `/afford` submits `POST /api/planning/affordability`. One to four alternatives, each with a trimmed item and positive safe-integer minor-unit price. Each subtracts its own price once from the same captured baseline for its currency: independent alternatives, **not a cumulative basket**. |
| Optional category, date and account | Category is canonicalized, excluding savings as a purchase category. Purchase date defaults to captured UTC today and must be inside the inclusive horizon (at most 366 days). Optional account must be owned, ordinary and same-currency; foreign/missing accounts share a non-disclosing 404. Reserve/wrong-currency accounts fail validation. Unknown input fields are rejected. |
| Current balances and expected income | Current cash is today's ordinary same-currency available balance, excluding protected reserves. Optional selected-account cash is a separate check, never a replacement for the whole forecast opening. Existing expected-income and allowance reconciliation are reused. Current shortfall can coexist with a positive future projection. |
| Upcoming payments, recurring expenses, housing, transportation, university expenses and campus commitments | Reuses the existing `forecastSnapshot` and `financialPlanSnapshot` source reconciliation, rather than a second planning formula. Existing housing/commute/campus-capable commitments and recurring/manual priority remain authoritative; covered sources are not added twice. |
| Budgets | Matching current weekly/monthly category budgets compare ledger actuals and before/after remaining separately. Overlapping budgets are not summed and are **not additional forecast expenses**. Missing category or absent budget means not assessed, not zero remaining. A purchase outside a budget's current period has no after-purchase comparison. |
| Savings goals and planned savings | Owned active same-currency goal context uses existing goal math. All same-currency reserves, including archived reserves, stay protected. Effective monthly savings remains the maximum of the manual envelope and goal requirements; horizon planned savings is unchanged. |
| Neutral projection; user decides | Signed before/after cash and projected balances, nonnegative shortfalls, assumptions and localized factual messages are shown without buy/don't-buy verdicts, recommendations, ranking as a preferred choice, or green/red approval/rejection styling. Future projection remains an estimate, not guaranteed cash. |
| Goal timeline example | Potential pressure is contextual, not a quantified delay. Existing baseline estimated completion may be shown, but `timelineImpact:"not_calculated"` explicitly provides **no adjusted goal completion date**. No goal debit, reserve release or contribution change is made. |

Money remains exact integer minor units: ILS/USD cents and JOD fils, separate currencies with no FX, conversion or cross-currency borrowing. Unsafe intermediate/output arithmetic returns 400 rather than rounding or clamping. The aggregate-overflow follow-up explicitly uses BAD_REQUEST for reused goal-overview arithmetic in affordability; existing goal APIs/default money arithmetic retain their 409 policy.

Purchase date is **not** a future-date cash estimate: it does not move the forecast opening or calculate cash on that date. A same-horizon alternative with a later purchase date still uses today's cash and the same end-of-horizon baseline; the date affects applicable current-period budget comparison.

## Snapshot, privacy and preserved behavior

- One captured clock and a PostgreSQL **read-only repeatable-read** transaction cover forecast, financial plan, goals, ordinary-account selection and budget actuals. This is a consistent snapshot, not a sequence of independently refreshed financial reads.
- No AI/provider calls, database schema changes or migrations, ledger postings, money transfers, scenario/history records or persisted financial snapshots are introduced. Reading PostgreSQL is required; “no DB changes” does not mean “no DB reads.”
- Frontend uses generated plain `compareAffordability`, not the shared mutation-cache hook. Drafts, requests, results and errors remain in page component memory, not browser storage or a scenario-history database.
- Clear and account changes invalidate/abort in-flight requests; unmount aborts and discards page state. Late responses are guarded from repopulating invalidated results. The browser clear check held a request, observed its abort and an empty screen; **a late fulfilled response was not observed**, so this is not browser proof of fulfilled-late-response suppression. Account-change and unmount boundaries remain code-inspected, not separately browser-proven.
- Result displays `asOf` and horizon, with explicit rerun using current data and pull-to-refresh. Continuous polling is not necessary for a user-triggered snapshot comparison and is not claimed. Editing/removing an option or changing the horizon invalidates the old result; Retry is explicit rather than an automatic POST retry.
- Existing verified student session and same-origin/CSRF guards apply despite the read-only POST. No parent/admin affordability access, other-owner data or expanded family consent is added. Output omits raw occurrences, income descriptions, account names, goal notes/history and third-party identifiers; frontend account labels come from the existing authorized account query.
- Existing authentication, routes, immutable ledger, planning/forecast formulas, goals, allowances, requests/inbox and separately scoped family/original goal-funding consent remain the preserved boundary. Financial data remains app-simulated, not connected bank funds. No Prompt 14 engine or external notification delivery is added.

## Gold, localization and full states — qualified evidence

The page reuses Gold semantic tokens and shared Page/Card/Button/Input/Select/Dialog/AlertDialog, StatePanel, Skeleton, MoneyDisplay and PullToRefresh components. EN/AR copy, RTL and Light/Dark are supported through the existing providers; no second styling system is introduced. Forms use the shared responsive dialog/mobile-sheet pattern; remove/clear use explicit confirmations. Existing focus, reduced-motion, safe-area and touch-target patterns remain required.

Inspected states include empty options, idle/no comparison, validation errors, loading skeleton, successful results, absent/unassessed budgets, explicit request error with Retry, and rerun/clear. These branches and frontend compilation do not certify rendered wrapping, keyboard behavior, accessibility, every state transition or the complete EN/AR × Light/Dark × viewport matrix.

## Reported automated evidence — separate checkpoints

| Gate | Worker-reported result | Evidence boundary |
|---|---|---|
| OpenAPI codegen and library TypeScript build | **PASS** | Contract/build evidence, not browser interaction proof. |
| Backend TypeScript check | **PASS** | Reported in `docs/prompt13-api.md`, including the follow-up. |
| Full backend tests before overflow follow-up | **46 PASS, 1 opt-in AI-provider test SKIPPED, 0 failures** | Affordability tests ran against the provisioned database; none of those were skipped. The skipped provider test belongs to existing AI coverage, not an AI dependency of affordability. |
| Focused affordability/finance tests after aggregate-overflow fix | **8 PASS, 0 failures/skips** | Separate later checkpoint; not added to 46 as disjoint coverage. The full backend suite was **not rerun** for this focused fix. |
| Frontend typecheck | **PASS** | Initial worker report and main-agent-reported final check after the option-label wrapping fix; not a documentation-agent rerun. |
| Frontend production build | **PASS** | Initial worker report and main-agent-reported final build after the option-label wrapping fix; compile/build evidence does not close that fix's browser-retest gap. |
| Critical financial browser flows | **PASS — targeted, main-agent reported** | Actual comparison, optional fields, validation, neutral shortfall, currency, read-only and Retry samples below. Not the full live authorization/CSRF matrix or whole-visual PASS. |

Reported backend assertions cover strict inputs/roles, bounded dates, ownership and currency/account separation, signed JOD arithmetic/overflow, independent ordering, current shortage despite positive future projection, same-horizon future-date behavior, separate overlapping budgets and missing/out-of-period assessments, unchanged savings/reserves, goal context with no invented timeline, and complete owner financial-state immutability. A real concurrent PostgreSQL commit between snapshot reads verifies an all-old in-flight response followed by an all-new request. The later overflow regression combines a valid ordinary MAX_SAFE_INTEGER balance with reserve 1, verifies affordability 400 versus existing goal/default arithmetic 409, and checks unchanged account balances/ledger.

These are targeted reported assertions, not universal proof that every financial flow or historical regression gate is closed.

## Actual browser evidence — targeted financial PASS, qualified visuals

All outcomes below are **main-agent reported**, not documentation-agent browser runs. Amounts are sanitized synthetic app-simulated funds, not bank activity.

| Check | Outcome / boundary |
|---|---|
| Baseline and independent alternatives | **PASS.** Wallet setup 1000, followed by a goal contribution/reserve of 50, left 950 available. Laptop 100 showed 850 after purchase; Phone 200 showed 750, independently from the same 950 baseline, not a basket deduction. |
| Edit and confirmed removal | **PASS.** Editing Laptop to 125 showed 825 after purchase. Removal used the confirmation flow. |
| Future-date validation | **PASS.** A purchase 50 days ahead was valid in the 90-day horizon. Switching to 30 days made it invalid and disabled Compare until the date was corrected. This tests horizon validation, not future-date cash forecasting. |
| Neutral shortfall | **PASS.** Price 2000 against available 950 showed cash and projection −1050, with shortfall 1050 and no yes/no purchase verdict. |
| JOD precision / no FX | **PASS.** JOD 1.234 rendered correctly against an explicit zero JOD baseline, without borrowing or conversion from the funded currency. |
| Budget and goal context | **PASS.** Weekly 100 and monthly 150 shopping budgets were shown as separate contextual comparisons, not extra expenses or a combined limit. Goal reserves/savings remained protected; no adjusted goal date was invented. |
| Error and explicit Retry | **PASS.** Forced HTTP 503 showed an explicit error/Retry; Retry after restoring the response succeeded. This is recovery from an intercepted failure, not proof of a real server outage. |
| Read-only financial state | **PASS — tested sequence.** Before/after account, summary, ledger, goal and planning snapshots were unchanged across the comparisons. Wallet/goal setup was deliberate prior test preparation, not a write by affordability. |
| Clear with held request | **PASS — abort/empty only.** Clear aborted the held request and kept the screen empty. A late fulfilled response was **not observed**; do not infer a fulfilled-late-response browser pass. |
| EN/AR assumptions | **PASS — sampled.** Assumptions were localized in English and Arabic rather than displaying the forecast's verbatim English provenance as Arabic UI copy. |
| Mobile forms and confirmations | **PASS — 390px sample.** Shared form and confirmation flows passed the targeted mobile check; not physical-device keyboard/safe-area certification. |
| Arabic/dark 320px containment | **Initial clipping found and fixed; targeted containment retest PASS.** A min-width/grid fix resolved outer clipping. Retested actual rectangles for cards, cash, budget, goals and buttons were within the viewport, and the nesting warning was gone. This is narrower than whole-screen visual certification. |
| Final option-name wrapping fix | **Build/typecheck PASS; NOT browser-retested.** The containment retest exposed option names ellipsized into about 32.5px. The main agent then replaced truncated rows with a wrapping grid label and separate price/actions row. Final frontend typecheck/production build passed, but the final text wrapping was **not browser-retested**. |

Sanitized screenshot reference IDs: **dj1rn1**, **q8mzpq**, **h1ibby**, **nqbngp**, **xy4qfu**. References only; no private screenshots or records are embedded.

## Remaining limits and historical gates

- Critical financial browser flows passed in the tested sequence; this is **not an unqualified full visual PASS**. The final option-name wrapping change has no separate browser retest, even though final compilation/build passed.
- Clear-abort/empty evidence does not establish suppression of a late fulfilled response. Account-switch/unmount privacy, every loading/empty/error/refresh permutation, all accounts/currencies/large values and the complete live authorization/CSRF rejection matrix remain non-exhaustive.
- The 390px forms and targeted AR/dark 320px containment retest do not constitute the full EN/AR × Light/Dark × viewport/state matrix. Physical-device keyboard/notch/safe-area, exhaustive accessibility and device gestures remain unverified.
- Earlier full backend **46 PASS + 1 opt-in AI-provider skip** and later post-overflow focused **8 PASS** are separate checkpoints, not summed; no full backend rerun after that fix or universal regression proof is claimed.

Historical results and limitations remain unchanged in `docs/gold-phase6-verification.md` and Prompt 8–12 verification reports: notably Prompt 10's admin/browser/device limits, Prompt 11's final mobile Filter-sheet separate browser-retest gap and Prompt 12's interpretation/security/device limits. Older “Prompt 13 not started” statements in those reports describe their historical checkpoint, not this authorization. No universal regression, exhaustive browser completion or zero-regression claim is made. **Prompt 14 remains not started and separately gated.**