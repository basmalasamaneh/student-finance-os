# Prompt 12 assistant API contract

`POST /api/assistant/query`, generated hook **useQueryAssistant**, `mutateAsync({data: {question, language, lastQuestion?, goalId?}})`.
Generated DTOs: **AssistantQuery**, **AssistantAnswer**, **AssistantFact**.
Existing customFetch supplies session cookies and trusted origin. Only students are authorized.
Strict body; question/lastQuestion 1–1000 trimmed characters, language `en|ar`, optional UUID goalId (server-local).
No history persistence; lastQuestion is only the previous user question, never an assistant answer or financial snapshot.

Answer: status `answered|clarify|refused`, language, intent, message, asOf ISO timestamp,
period/comparisonPeriod `{from,to}` inclusive UTC or null, facts[], warnings[], links[],
goalChoices[] `{id,name}`, simulated=true, policy.
Facts: key, localized label, **minor as signed integer string**, currency `ILS|USD|JOD`,
basis `actual|estimated`, provenance `ledger|goals|forecast`, policy;
optional category/date/rank/previousMinor/deltaMinor/changePercent.
Percent string rounded half-up to 2 decimals, null when prior amount is zero. Do not add currencies.
Currency scales match finance-core: ILS/USD = 2 minor digits; JOD = 3 minor digits.
Display exact strings with BigInt formatting, never convert aggregates to Number.
Fact basis is independent of simulated: actual means recorded in this app's simulated ledger, not real-bank money.

UI must render server-localized message, fact labels, warnings, policy and link labels, plus as-of,
period, simulated and estimated/actual badges. Locale templates:
- EN Actual (recorded), Estimated / projected, Simulated money, As of, Previous period, Change, Unknown (zero baseline), Retry.
- AR فعلي (مسجل)، تقديري / متوقع، أموال محاكاة، حتى، الفترة السابقة، التغير، غير معروف (القيمة السابقة صفر)، إعادة المحاولة.
For goal clarification, choosing goalChoices[n] resubmits the same question with goalId.
Links are allowlisted local destinations only. UI should not treat responses as markdown or HTML.

Errors: standard `{error:{code,message}}`; 400 invalid input, 401 session expired,
403 role/origin rejected, 429 rate/concurrency limit, **503 ASSISTANT_UNAVAILABLE** provider failure/timeout/invalid output.
503 never has a fabricated answer; UI must provide explicit Retry using the same request.
No automatic retries on POST. Rate: 8/minute/owner, 1 in flight/owner, 32 globally, at most 2048 live owner buckets.

Planner: Replit OpenAI integration, gpt-5.4-mini, strict allowlisted intent JSON.
Only question, language, optional bounded lastQuestion and server UTC clock go to provider.
No account/goal names, IDs, balances, profile, financial rows or generated answers are sent.
User-authored questions can contain personal details; explain this in the composer privacy notice.
Planner cannot execute tools, SQL or mutations and never writes answer prose.
Response prose and exact calculations are deterministic bilingual server templates.

Supported: food (all food), cafeteria (campus subset), bookstore (campus subset),
books (all books, including the campus bookstore subset),
transportation, category ranking, upcoming payments, expected income, reserved savings,
monthly goal requirement, projected balance; summary, comparison, pattern/explanation and organization.
Default actual period is month-to-date; projected period is today through month-end.
Comparison defaults to previous equally long period; explicit periods capped at 366 days each.
Future actual, past forecast, unsupported/ambiguous periods and unknown intent ask clarification.
Goal monthly requirement uses existing ownerGoals metrics; multiple active goals require selection.
goalId is accepted only for monthly-goal questions; supplying it with saved/other intents explicitly
clarifies before reading data, including foreign or nonexistent values. It is never silently ignored.
General books and food include their campus subsets; bookstore and cafeteria are narrower scopes.
Only recorded spending supports category filtering. Other intent/category combinations clarify.
Account, merchant, currency, campus/location, exclusions and amount-threshold filters are unsupported,
as is automatic lookup by a goal's name. Ask a generic monthly-goal question and select a goal.
The planner must emit a strict qualifierStatus (`none|unsupported|ambiguous`), and the executor
clarifies rather than discarding unsupported/ambiguous qualifiers or incompatible categories/modes.
These defenses do not prove perfect interpretation of every adversarial or ambiguous natural-language question.
Savings means currently reserved goal funds including archived goals, not cumulative income or income minus spending.

Read-only repeatable-read owner snapshot, entire selected ledger (not paginated UI rows).
Transfer categories and student goal contributions excluded as in Finance summary; goal reserves excluded.
Amounts/ranking/deltas/percentages use BigInt; no FX. Campus categories remain distinct.
Forecast and goals reuse existing adapters and policies. Forecast assumptions include ordinary income today
possibly already in opening; posted allowances never counted as future income; undated monthly envelopes
remain allocations, never fabricated bill dates. Estimates are not guarantees.
Investment/product recommendations, high-risk advice and guaranteed outcomes are refused in both languages.

## Backend verification

- `node --test test/assistant.test.mjs test/assistant-integration.test.mjs` from `artifacts/api-server`.
- Unit coverage includes full 250+ row sums, owner/reserve/transfer exclusion, all ten required intents
  in EN/AR, exact large BigInt comparisons/rounding, malformed planner output, role/identity injection,
  bounded limiter, dates, goal clarification and localized provider-failure 503.
- Integration test uses existing student data inside read-only repeatable-read transactions; it never seeds
  data and compares assistant values with existing goal/forecast adapters and full ledger totals.
- Opt-in `ASSISTANT_REAL_SMOKE=1 node --test test/assistant-integration.test.mjs` invokes the **API route handler**
  with real gpt-5.4-mini for one English and one Arabic food query, compares returned facts to the local executor.
  Passed. This is not a claim of live HTTP/session/browser coverage.
- During backend work the running preview still used an older bundle. The main agent subsequently
  restarted the workflows and completed targeted live HTTP/session/browser verification, including
  EN/AR grounded facts, forecast agreement, explicit 503 Retry and conversation clearing.
  Actual evidence and remaining limits are recorded in `docs/prompt12-verification.md`.
- Review tests cover saved/other intents with owned/foreign/nonexistent goal selections, incompatible
  categories/modes/qualifier flags without financial reads, explicit date preservation, and distinguishing
  books/bookstore and food/cafeteria with different fixture amounts.
- `ASSISTANT_REVIEW_SMOKE=1 node --test test/assistant.test.mjs` makes four small real-provider calls:
  EN/AR advice refusal plus EN books / AR food mapped onto discriminating local fixtures.
  Review run passed all four calls; combined assistant unit/integration run passed 14 tests and API typecheck.
  The provider sees only question/language/server clock, never those fixtures.
  This is targeted evidence, not proof against all prompt injection or qualifier-loss attempts.
- Forecast source links point only to existing `/plan` and `/upcoming`; no affordability/Prompt 13 feature is implemented.