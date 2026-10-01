# Prompt 8 — scope and verification

**Current: Prompt 8 DELIVERED — critical functional flows browser-tested, with explicit remaining limits.** This is not an exhaustive visual/device or zero-regression certification. The user explicitly approved the minimal early Prompt 9 family-link/permission prerequisites required here; full Prompt 9, requests, approval/ask-details and notifications remain deferred.

Contract source: `docs/prompt8-api.md` and `lib/api-spec/openapi.yaml`. Automated results are reported by implementation workers and browser evidence by the main agent; the documentation agent did not independently run tests. No credentials, invitation values, PII or live account/transaction identifiers are recorded.

## Scope and routes

| Surface | Implemented scope / boundary |
|---|---|
| Student `/family` | Create private consent invitation, choose receiving account, edit eight permissions, revoke, view own allowance schedules/history/projection |
| Parent Home `/` | Consent-scoped child dashboard and own simulated wallet |
| `/parent/children`, `/parent/children/:id` | Accept/decline private invitation and view only accepted, permitted child sections |
| `/parent/allowances` | Own wallet account creation/top-up and consented child allowance management |
| `/parent/requests` | Honest Coming soon state; no invented requests or approval workflow |
| Existing `/goals/fund` | Original exact-goal consent/funding contract retained, separate from family linking |
| Student Home, profile and `/plan` | Additive allowance projection/upcoming reconciliation; no scheduled edits to manual income rows |

Backend `/api/family*` manages student consent; `/api/parent/dashboard`, `/api/parent/children/*`, `/api/parent/family-invitations/decide` and `/api/parent/wallet*` use verified parent sessions. Existing authentication, CSRF/Origin guards, exact minor-unit money and resource ownership remain authoritative. Wallet/allowance mutations require idempotency keys; payments/top-ups are explicitly simulated, with no bank or email delivery.

## Implementation invariants

- **Permission isolation:** all eight permissions start off: `monthlySummary`, `balance`, `goals`, `allowance`, `requests`, `transactions`, `upcomingPayments`, `campusSpending`. Accepted links establish a relationship, not automatic access to all data. Server responses omit denied sections rather than zero-filling them; parent activity excludes sensitive notes/counterparties/account details.
- **Campus privacy:** without campusSpending, campus activity is excluded before summary aggregation. Upcoming planning items conservatively omit canonical campus-capable categories and aliases because stored aliases can lose provenance; this may also hide non-campus entries in those categories. Student planning data/calculations remain unchanged.
- **Account privacy:** allowance permission requires a student-selected own ordinary receiving account. The parent receives only `allowanceCurrency`, not that account's identifier or balance. Currency alone does not imply balance permission; allowanceCurrency itself is omitted when allowance permission is denied. Only same-currency parent accounts are usable; no FX.
- **Separate goal consent:** goal-only invitations never grant family permissions. Family goals permission is read-only visibility, not authority to fund; original exact-goal invitation/redemption remains required. Existing simulated external goal funding does not debit the new parent wallet.
- **Ledger and retries:** allowance posting atomically debits the parent and credits the student, with immutable receipts and a unique schedule/date occurrence. Both legs share the occurrence's `parentTransferId`. Duplicate requests/worker races cannot create duplicate occurrences. Insufficient-funds/balance-limit failures persist; manual retry reuses the failed occurrence, with a fresh key for each deliberate retry. An unresolved failure must be retried or explicitly cancelled, never silently edited/repriced away.
- **Server worker:** `artifacts/api-server/src/lib/allowance-worker.ts` is started/stopped by `src/index.ts` server lifecycle; immediate pass then every **30 seconds**, no separate workflow/cron. Up to 50 schedules per pass, at most one occurrence per schedule per pass; failures stop automatic catch-up for that schedule until deliberate retry. Pause retains pending date; resume catch-up is bounded. Cancellation/revocation prevents future posting. UTC weekly/biweekly increments, original-day monthly clamp and inclusive end dates apply.
- **Income versus forecast:** posted student allowance is actual simulated ledger income, not a generic transfer. Future recurring schedule amounts remain estimates, never guaranteed money. Active consented schedules inside their interval contribute to the inclusive manual parent-allowance envelope: per currency compare annual numerators with **max(manual, summed schedules)**, not their sum; add other income normally and round half-up once. No FX or manual-row replacement. Home adds only the exact server `adjustmentMonthly` to its existing income calculation, not scheduled totals or posted actuals. `effectiveMonthly` describes the allowance envelope, not all income.
- **Dated upcoming:** replace a manual allowance expectation only when a visible active scheduled occurrence matches **date and currency** within its start/end interval. Different dates/currencies remain; overdue items cannot suppress future expectations. Parent upcoming sees only that parent's schedules with allowance consent; otherwise permitted manual expectations remain. Goal savings and budget actuals policy stays unchanged.
- **Freshness/design:** family views use focus/mount refetch and 20-second polling, mutation invalidation and revoked/denied stale-view removal. The parent freshness gate conceals confidential content on window focus, visible return, pageshow and security Resume until active parent-query refetches settle; revoked access/error states replace cached data. Existing gold tokens/shared components, EN/AR, Light/Dark, mobile sheets, role tabs, loading/empty/error states and pull-to-refresh remain required; code presence is not physical-device proof. No service worker/offline financial caching.
- **Schema:** additive `family_links`, `allowances`, `allowance_occurrences`; existing nullable ledger parent-transfer field is populated. Reviewed non-force development migration is reported applied. No credential/fund seeding or authentication replacement.

## Reported automated evidence

| Check | Status | Evidence / limit |
|---|---|---|
| Backend test suite | PASS (worker reported) | 20 tests; isolated synthetic PostgreSQL rows cleaned up. Includes permission/ownership, token lifecycle, campus omission, goal-consent separation, atomic/idempotent posting, failure retry, projections/upcoming and actual worker processing coverage described in `docs/prompt8-api.md`. |
| Frontend Home model tests | PASS (worker reported) | 9 tests, including additive allowance reconciliation; does not certify browser UI flows. |
| Typecheck | PASS (worker reported) | Reported backend/libs and frontend checks passed; backend commands documented in `docs/prompt8-api.md`. |
| Production build | PASS (worker reported) | Build reported passed; not proof of browser execution or physical installation. |
| Prompt 8 critical browser flows | PASS (main-agent reported) | Evidence below; targeted coverage, not an exhaustive role/device/viewport matrix. |

Prompt 8's isolated DB test evidence is a new run; it does not retroactively change the historical Prompt 7.5 report's intentionally unrun DB integration suites or qualified coverage.

## Actual browser evidence

| Required coverage | Status | Evidence |
|---|---|---|
| Family create/accept and permission denial | PASS | All eight defaults off; accepted relationship did not expose denied sections. Omission confirmed server-side, not merely hidden in UI. |
| Student consent edits/receiving currency | PASS | Student edited permissions and selected ILS receiving account. Parent used its own same-currency wallet. |
| Parent wallet and one-time allowance | PASS | Created wallet, simulated top-up 500, one-time allowance 25: exactly one parent debit and student credit. |
| Future weekly schedule | PASS | Create/edit/pause/resume/cancel exercised; projection updated with schedule state. |
| Insufficient funds/manual retry | PASS | Allowance 600 failed without balance movement; after simulated top-up 200, explicit retry posted exactly once. Student history showed two allowance credits totaling 625, not duplicate retry credits. |
| Revocation/schedule projection | PASS | Revocation cancelled future schedule; scheduled projection became zero while existing manual allowance envelope 100 remained intact. |
| Goal-consent separation | PASS (targeted) | Family permissions did not replace old goal permission; existing `/goals/fund` remained separate and unchanged. |
| Requests boundary | PASS | Requests displayed Coming soon, not an invented workflow. |
| Revocation on parent return | PASS after fix | With child GET held, return showed checking/data-hidden and no child name or balance; completed 404 then showed Access gone. See fixed issue below. |
| Dashboard error/recovery | PASS (targeted) | Held HTTP 500 displayed an actual visible error panel with Try again. After interception was removed, automatic refresh recovered; manual retry click was **not separately tested**. |
| Responsive/localized rendering | PASS (sampled) | Mobile 320/390px and desktop 1440px, targeted AR/dark and EN/light samples: no horizontal overflow. Not every screen/mode at every width. |
| Runtime observations | PASS (qualified) | No uncaught production runtime failure observed. Anonymous-session 401 was expected, not a production crash. |

Sanitized screenshot reference IDs: **iw2lna**, **tpnyd6**, **50b6fm**. References only; no private screenshots or PII are embedded.

## Fixed issue and targeted retest

An initial **revocation cached-data-on-resume bug** was found and fixed. `src/features/family/parent-freshness.ts` under the frontend artifact gates parent confidential content on window focus, visibility return, pageshow and device-security Resume. Content stays concealed/checking until active parent-query refetches settle; 403/404 removes stale permitted data, other query errors show error panels rather than cached confidential content.

Targeted held-request retest passed: no child name/balance appeared while GET was held; revoked 404 produced Access gone. The held-500 dashboard test verified visible error state and subsequent automatic recovery, not a manual retry-button click. This is browser evidence of the freshness gate, not OS/app-switcher thumbnail protection.

## Delivery and limits

- Critical Prompt 8 flows above passed; backend **20 tests**, frontend Home **9 tests**, typechecks and production build remain reported **PASS**.
- Main agent reports API/frontend workflows restarted and running; no workflows were operated by the documentation agent.
- Automated coverage includes broader token boundaries, campus-safe omission, monthly/biweekly/end-date/worker concurrency and dated-income reconciliation. Those automated checks are not relabeled as browser-tested.
- Not exhaustively browser-verified here: every invitation decline/expiry/replay/multi-guardian combination, all date/currency reconciliation permutations, every role/route and every screen × locale/theme × width, full existing Prompts 1–7 regression, or manual dashboard retry-click behavior.
- Physical keyboard/notch/haptics, PWA installation and OS privacy/app-switcher behavior remain **NOT VERIFIED**.
- Only the approved minimal Prompt 9 prerequisite shipped; full requests/notifications and full Prompt 9 remain deferred.

Historical Gold Prompt 7.5 gate/limits remain unchanged in `docs/gold-phase6-verification.md`; Prompt 8 delivery does not retroactively close them.