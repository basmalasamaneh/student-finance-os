# Prompt 13: read-only affordability comparison

**Delivery/evidence update:** Prompt 13 is explicitly authorized and delivered with main-agent-reported targeted critical financial browser PASS and **qualified visual evidence**, not an unqualified whole-visual pass. The final option-name wrapping fix passed frontend typecheck/build but was not browser-retested; clear observed request abort/empty state, not a late fulfilled response. Current scope, browser results and remaining limits are in `docs/prompt13-verification.md`. Backend results below retain their historical checkpoint boundaries. Prompt 14 is not started.

`POST /api/planning/affordability`, generated `useCompareAffordability` mutation / `compareAffordability` function. Student session and trusted origin required. No AI, persistence, ledger posting, reserve transfer, FX, or recommendation.

## Exact boundary

Use generated `AffordabilityRequest`, `AffordabilityComparison`, `AffordabilityScenario`, `AffordabilityMessageCode` types; OpenAPI is authoritative.

Request: `{ through: "YYYY-MM-DD", alternatives: [{ item, price: { minor, currency }, category?, purchaseDate?, accountId? }] }`.

- 1–4 alternatives. Item trimmed, 1–120 characters. Positive safe integer minor units (ILS/USD cents, JOD fils); supported currencies ILS/USD/JOD. Unknown fields rejected at every input level.
- `through` inclusive from captured UTC today, at most 366 days. `purchaseDate` defaults to today and must be within that interval. It never changes the forecast opening or estimates cash on that future date.
- `category` uses `PlanningCategory`; savings is not a purchase category. Aliases canonicalized.
- Optional account must be owned, ordinary, and same currency. Missing/foreign account gives the same 404, with no foreign details. Reserve/wrong-currency account gives 400.
- All alternatives independently subtract their own price once from the same currency's baseline. They are not a basket.

Response: `{asOf, through, estimate:true, comparisonPolicy:"independent_additional_purchase", assumptionCodes, sourceAssumptions, scenarios}`.

Each scenario returns:

- `index`, `item`, `price`, canonical `category?`, resolved `purchaseDate`.
- `baseline: ForecastCurrency` (availableOpening, expectedIncome, upcomingExpenses, recurringExpenses, plannedSavings, projectedBalance). Existing housing, commuting, university/campus commitments, source reconciliation and goal savings are reused, not rebuilt.
- `currentCash:{before,after,shortfall}`: all ordinary same-currency cash today; after is signed. It is not purchase-date cash.
- `projectedAfterPurchase` signed; `projectedShortfall` nonnegative. A positive future projection does not eliminate current cash insufficiency.
- `accountComparison:null | {accountId,cash:{before,after,shortfall}}`: separate current account cash check, never replaces whole opening.
- `budgetAssessment:"category_not_provided" | "not_configured" | "current_periods"` and `budgets[]`. Empty list means not assessed, never zero remaining. Each matched current weekly/monthly budget has `period`, `periodStart`, `periodEnd`, `category`, `limit`, `actualSpent`, `remainingBefore`, `remainingAfter`, `shortfallAfter`, `assessment`. `assessment:"outside_current_period"` has null after/shortfall. Compare only when purchase date is inside that budget's current period. Never sum overlapping budgets or subtract them from forecast.
- `goalContext`: `goals[]` contains only owned active same-currency goal `id`, `name`, `target`, `current`, `remaining`, `targetDate`, nullable `requiredContributionMonthly`, nullable `baselineEstimatedCompletion` from existing goal math. No notes/history/parent information. `protectedReserves` includes all same-currency reserves, even archived. `requiredMonthly`, `effectiveMonthlySavings` use existing maximum-manual-or-goals plan. `plannedSavingsInHorizon` stays unchanged. `projectedHeadroomAfter` is signed after all baseline savings and the purchase; `projectedShortfallAfter` is nonnegative. `potentialPressure` means active goals and negative after-purchase projection, not a predicted delay. `timelineImpact:"not_calculated"`: never invent an adjusted goal date, debit, or contribution.
- `messageCodes[]` contextual facts. Render neutrally, not green/red approval or rejection.

All amounts are `{minor:number,currency}`; signed values retain negatives. Unsafe intermediate/output arithmetic fails 400 rather than rounding/clamping. Absent forecast currency has an explicit zero baseline, with no conversion or borrowing.

This 400 policy includes overflow in the reused goal overview's available/reserved/net/required aggregates. Affordability explicitly selects `BAD_REQUEST` for those arithmetic checks; existing goal APIs and money-write checks retain their default `CONFLICT` (409). No blanket conflict-to-bad-request conversion is applied.

## Localized message codes

Render `assumptionCodes` and scenario `messageCodes` through local EN/AR dictionaries. `sourceAssumptions` carries the original forecast's verbatim English assumptions for provenance, not UI localization. Suggested faithful copy:

| Code | English | العربية |
|---|---|---|
| today_dated_income_may_already_be_in_opening | Today's ordinary expected income may already be in current cash and counted twice. Review the original expectation. | قد يكون الدخل المتوقع العادي اليوم ضمن الرصيد الحالي بالفعل ويُحتسب مرتين. راجع التوقع الأصلي. |
| utc_inclusive_horizon | Dates use UTC, inclusive, at most 366 days. Posted allowances are already in opening cash. | التواريخ بالتوقيت العالمي ومن ضمن الفترة، بحد أقصى 366 يوماً. المخصصات المسجلة ضمن الرصيد الافتتاحي بالفعل. |
| recurrence_and_scholarship_policy | Recurrences keep their original anchor; scholarship metadata is not income. | يحافظ التكرار على تاريخه الأصلي؛ معلومات المنحة ليست دخلاً. |
| reconciled_expense_sources | Manual category envelopes replace recurring/profile estimates; covered dated markers are not added again. | تحل المبالغ اليدوية للفئة محل تقديرات النفقات المتكررة والملف؛ لا تُضاف التواريخ المشمولة مرة أخرى. |
| constant_housing_commute_and_savings | Current housing, commute and monthly goal requirements are held constant. Savings uses the larger of manual savings and goal requirements. | تبقى تقديرات السكن والتنقل ومتطلبات الأهداف الشهرية الحالية ثابتة. يُستخدم الأكبر من الادخار اليدوي ومتطلبات الأهداف. |
| exact_monthly_allocations_not_cash_dates | Monthly amounts are allocated exactly across days; this does not establish payment dates or guarantee cash. | تُوزع المبالغ الشهرية بدقة على الأيام؛ لا يحدد ذلك مواعيد الدفع ولا يضمن توفر النقد. |
| inclusive_allowance_envelope | Manual parent allowance and consented schedules overlap; only the residual manual amount is added. | تتداخل مخصصات الوالد اليدوية والجداول المصرح بها؛ يُضاف المتبقي اليدوي فقط. |
| inactive_occurrences_excluded | Completed/cancelled items are excluded; unposted allowance remains uncertain. | تُستبعد العناصر المكتملة والملغاة؛ وتبقى المخصصات غير المسجلة غير مؤكدة. |
| independent_additional_purchase | Each option is independent and assumes an additional purchase not already in the plan. | كل خيار مستقل ويفترض شراءً إضافياً غير مدرج في الخطة. |
| current_cash_not_purchase_date_cash | Current cash is today's balance, not the balance on a future purchase date. | النقد الحالي هو رصيد اليوم، وليس رصيد تاريخ شراء مستقبلي. |
| future_projection_not_guaranteed | Future balances are estimates, not guaranteed cash or a recommendation. | الأرصدة المستقبلية تقديرات وليست نقداً مضموناً أو توصية. |
| reserves_protected_no_fx | Goal reserves stay protected; currencies are not converted or combined. | تبقى احتياطيات الأهداف محمية؛ ولا تُحوّل العملات أو تُجمع معاً. |
| budgets_comparison_only | Budgets are comparisons, not extra forecast expenses. Weekly and monthly budgets can overlap. | الميزانيات للمقارنة وليست نفقات إضافية في التوقع. قد تتداخل الميزانيات الأسبوعية والشهرية. |
| goal_timeline_not_calculated | Goal funds and planned savings are unchanged. No adjusted completion date is calculated. | لا تتغير أموال الأهداف والادخار المخطط. لا يُحسب تاريخ إنجاز معدّل. |
| current_cash_shortfall | This price exceeds current available cash in this currency. | يتجاوز هذا السعر النقد المتاح حالياً بهذه العملة. |
| projected_shortfall | The after-purchase projection has a shortfall. | يوجد عجز في التوقع بعد الشراء. |
| account_cash_shortfall | This price exceeds the selected account's current cash. | يتجاوز هذا السعر الرصيد الحالي للحساب المحدد. |
| budget_category_not_provided | Budget impact is not assessed without a category. | لم يُقيّم أثر الميزانية لعدم تحديد فئة. |
| budget_not_configured | No matching budget is configured; impact is not assessed. | لا توجد ميزانية مطابقة؛ لم يُقيّم الأثر. |
| budget_outside_current_period | Purchase date is outside this budget's current period; no after-purchase comparison is made. | تاريخ الشراء خارج الفترة الحالية لهذه الميزانية؛ لا تُجرى مقارنة لما بعد الشراء. |
| budget_comparison_available | Current matching budgets are shown separately. | تُعرض الميزانيات الحالية المطابقة كل على حدة. |
| goal_pressure_possible | The projected shortfall may put pressure on the unchanged saving plan; no delay is quantified. | قد يضغط العجز المتوقع على خطة الادخار غير المتغيرة؛ لم تُقدّر مدة تأخير. |

## Snapshot and safety

One captured clock and PostgreSQL read-only repeatable-read transaction cover the exact existing `forecastSnapshot`, `financialPlanSnapshot`, `ownerGoals`, account selection and budget actuals. Optional clock injection preserves existing helper calculations. No application-owned money or scenario records are written. Response omits raw occurrences, income descriptions, account names, goal notes/history and third-party identifiers.

## Verification

`artifacts/api-server/test/affordability.test.mjs` exercises strict inputs/roles, date bounds, currency/account ownership, exact signed JOD arithmetic and overflow, independent ordering, current shortage despite positive future projection, same-horizon future-date behavior, separate overlapping weekly/monthly actuals, absent/out-of-period budgets, unchanged planned savings/protected reserves, active goal metrics and null timeline estimates, complete owner financial-state immutability, and an actual concurrent PostgreSQL commit between snapshot reads. That barrier changes ordinary/reserve balances, budget limits and planning lines atomically; the in-flight response remains entirely old and the following request entirely new.

OpenAPI codegen, library TypeScript build, backend TypeScript check, and full backend tests passed: 46 passed, 1 opt-in provider test skipped, 0 failures. The affordability tests all ran against the provisioned database; no affordability test was skipped. No workflows were started or restarted for these checks.

Aggregate-overflow follow-up: backend typecheck and targeted affordability/finance suites passed (8 tests, no failures or skips). The added database regression uses a valid ordinary balance of `MAX_SAFE_INTEGER` and a valid reserve of `1`: affordability returns 400 for the unsafe combined net aggregate, while the existing goal overview and default money arithmetic still return 409. Account balances and ledger remain unchanged. The earlier full-suite count above predates this additional regression; the full suite was not rerun for this focused fix.