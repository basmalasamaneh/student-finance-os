# Prompt 9 — scope and verification

**Current: Prompt 9 DELIVERED — critical browser flows PASS, with explicit coverage limits.** Prompt 10 is not authorized or started. Prompt 8's family-link/permission prerequisite is retained; its earlier minimal approval did not itself authorize these new flows. This is not an exhaustive visual/device or zero-regression certification.

Contract: `docs/prompt9-api.md`, authoritative `lib/api-spec/openapi.yaml`, generated clients/Zod. Automated results are implementation-worker/main-agent reported; browser results are main-agent reported. The documentation agent did not execute tests. No private identifiers, credentials, invitation values, PII or reusable fixture records are included.

## Scope and surfaces

| Surface | Scope |
|---|---|
| Student `/family/requests`, `/family/requests/:id` | Create/list/detail, conversation reply and cancel; reached from existing Family page |
| Parent `/parent/requests`, `/parent/requests/:id` | Live list/detail, approve/pay, decline and ask-details; replaces the old Coming soon placeholder |
| Existing `/family` and parent child views | Retained invitation/permission lifecycle, pending/accepted/declined/revoked states and removal/revoke controls; live authorized request summaries |
| Shared shell notification bell | Owner unread count and inbox bottom sheet with read/read-all and authorized deep links; no new inbox page |
| Existing parent wallet | Own immutable receipt/history remains available, with student-sensitive fields redacted |
| Existing peer requests, allowances, `/goals/fund` | Contracts retained; original goal funding stays external simulated funding, not a wallet debit |

Backend surfaces: student `/api/family/requests*`, parent `/api/parent/requests*`, student/parent owner-only `/api/notifications*`. Existing verified sessions, role/ownership checks and CSRF/Origin guards apply; no frontend role preview authorizes data. New routes are no-store.

User-approved schema changes are small/additive: **`family_money_requests` and `in_app_notifications`**; existing nullable ledger parent-transfer field is reused. Non-force migration reported applied; no existing data/table deletion, seed or auth change.

## Request and privacy invariants

- **Independent consent:** requests require the original accepted link with `requests=true`, including detail/mutation/idempotent replay. Neither allowance permission nor goal-only consent substitutes. Request receiving account is an ordinary student-owned same-currency account selected per request, independent of allowance account settings. Parent DTOs omit the student receiving-account identifier; ledger IDs expose only the viewer's own leg.
- **State/money:** create → pending; ask-details → details_requested; student reply → pending. Ask/reply/decline/cancel move **no money**. Approval of a live request atomically commits request state, one parent debit/student credit and notifications; the paired transfer is exactly once under account/link/request locks and idempotency guards. Student credit is actual simulated income, not a manual profile-income row or allowance forecast.
- **Retries/revocation:** request POSTs require idempotency keys. Same-key replay rechecks original current consent; conflicting use is rejected. Insufficient funds rolls back all effects, keeps request live and permits retry after top-up. Requests-permission removal/link revocation atomically cancels live requests; regrant never revives them. Replacement family links cannot authorize the old request.
- **Own receipt retention, not sharing bypass:** parent wallet serialization strips student notes/receiving-account identifiers from request receipts, including pre-fix immutable receipts, and counterpart account identifiers from allowance receipts. This applies even after revocation; own financial receipt fields remain. No historical ledger rows are rewritten. Parent-authored allowance notes remain own data.
- **Continuity:** peer-request APIs and original exact-goal external funding are unchanged. Family goals visibility does not authorize funding, requests or parent goal notifications. Prompt 8's allowance worker, forecast envelope and consent protections remain.

## In-app-only notification boundary

- Durable events are limited to request, approval, decline, ask-details, reply, allowance_posted, goal_funded and permission_changed; per-recipient/type/source uniqueness deduplicates events. Failed/cancelled allowance occurrences emit no posted notification.
- **No external email/push/provider delivery or Prompt 14 engine/extras.** This is an in-app inbox, not an external notification promise.
- Parent inbox list, unread count, read/read-all and generated links reauthorize the **original family link** and relevant requests/allowance permission. Goal notifications instead require the **exact original redeemed, unrevoked goal invitation**. Replacement links or new goal grants do not resurrect old scoped entries. Denied items are omitted from counts as well as lists; direct access fails.
- Sharing-change notices remain generic with no student identity, amount, note, account/scope identifier or destination link. Student entries concern only their own activity; no raw outbox/scope payload is exposed.
- Destinations fetch authorized detail again: a link/query string is never authority. Request/inbox/dashboard/finance caches invalidate after relevant mutations; owner caches clear on logout/account switch. Parent resume conceal/refetch protections include requests/inbox. Even with the bell closed, a 20-second inbox-list poll detects new generic sharing-change events and conceals/revalidates active parent queries. Request reads do not retry 403/404; observed gone queries are not repeatedly removed/recreated, and confidential stale detail does not render.
- Existing Gold Fintech tokens/shared components, mobile sheets, bottom tabs/safe areas, EN/AR, Light/Dark and loading/error/empty/refresh patterns remain required. No offline financial caching or second styling approach.

## Reported automated evidence

| Check | Status | Evidence / limits |
|---|---|---|
| Backend tests | PASS (reported) | 21 integration tests, zero failed/skipped; latest suite strengthened requests-permission-OFF terminal-state preservation. Contract documents isolated synthetic PostgreSQL cleanup and request/inbox/peer/goal/allowance regression coverage. |
| API typecheck | PASS (worker reported) | Backend/API check reported passed. |
| Frontend/workspace typecheck | PASS (worker reported) | Frontend/workspace checks passed; authoritative codegen/backend commands in `docs/prompt9-api.md`. |
| Production build | PASS (worker reported) | Build passed; not browser/device proof. |
| Critical browser flows | PASS (main-agent reported) | Evidence below; targeted coverage, not every mode/size or every regression scenario. |

Automated scope includes permission/cross-owner isolation, approval concurrency, insufficient-funds rollback/retry, question/reply transitions, revoked replay/regrant cancellation, durable inbox dedupe/count/read scoping, allowance events, exact-goal separation and existing-contract regressions. Do not promote this to browser results.

## Actual browser evidence

| Required check | Status | Evidence |
|---|---|---|
| Independent requests permission | PASS | Requests-only family link with Allowance OFF supported the full request flow; allowance permission was not required. |
| Student create/detail and conversation | PASS | Request 25 with reason/note/date created; parent asked for details and student replied; conversation persisted. Neither conversation transition posted money. |
| Approval and idempotency | PASS | Approval 25 returned success and exactly one paired parent debit/student credit; idempotency key used without duplicate posting. |
| High-value keyboard confirmation | PASS | Threshold temporarily set to 10; Enter confirmed request 17. Across both approvals, exactly two parent debits, not duplicate confirmation postings. |
| Decline/student cancellation | PASS | Declined request 10 and student-cancelled request 8 produced no ledger movement. |
| Insufficient funds | PASS (targeted) | Request 1000 returned 409, then student cancelled; no ledger movement. Browser did not exercise successful top-up/retry for this request; rollback/retry is integration-tested. |
| Inbox unread/read-all | PASS | Mark-all reduced unread count to zero. |
| Forced error/manual recovery | PASS | Request list/inbox forced HTTP 500 showed actual error state; Retry was clicked and rows restored. |
| Requests OFF while parent detail open | PASS after fix | New pending request, permission disabled: same URL/no reload reached parent GET 404 within the poll interval. No amount, note, name or actions remained; only generic sharing notifications were visible. |
| Student list/regrant consistency | PASS | Requests OFF hid student requests. After regrant, the former pending request appeared Cancelled, matching backend state; no revival. |
| Parent own wallet/privacy | PASS | Own receipts remained available with no student request notes or student account identifiers. |
| Responsive/localized samples | PASS (sampled) | 320px student forms/details/Family; desktop parent detail/list; AR/RTL sample. Not an all-modes/all-widths matrix. |

Sanitized screenshot reference IDs: **lhb4zw**, **ykqa6e**, **q5g6q1**, **qjxhm6**. References only; private screenshots are not embedded.

## Fixed privacy issue and retest limits

An initial **stale parent request-detail bug** was found and fixed. The closed notification bell now polls the inbox list every 20 seconds, not just an unread count; a new generic sharing-change event triggers concealment and revalidation of active parent queries. Gone request queries retain their error state instead of entering an observed-query remove/recreate loop; `retryUnlessGone` prevents 403/404 retries.

Targeted retest: with a pending request open, turning requests OFF caused 404 at the unchanged parent URL within polling, without reload or disclosure of amount/note/name/actions. The student list hid denied requests, and regrant exposed the old request as Cancelled. Generic sharing notifications remained non-identifying. A later focus preserved the cleared state, but **focus was not isolated as the first trigger**; this retest proves poll-triggered clearing, not independent first-focus behavior or OS privacy protection.

## Delivery and remaining limits

- Critical flows above **PASS**; latest API integration suite **21 PASS**, API/frontend/workspace typechecks and production build reported **PASS**.
- Allowance-posted and exact-goal funding notification paths are backend-tested, **not browser-retested** here. Full peer-request/goal-funding flows remain contractually unchanged but were **not rerun** in this browser round.
- Original-link/exact-goal-grant isolation, broad ownership/concurrency/retry boundaries and terminal preservation have integration evidence; do not relabel every backend scenario as browser-tested.
- Visual coverage is targeted: not every screen × EN/AR × Light/Dark × viewport or a comprehensive keyboard/accessibility sweep. Physical keyboard/notch/haptics, PWA/OS privacy/app-switcher behavior remain **NOT VERIFIED**.
- Notifications are **IN-APP ONLY**: no email, push, external provider or future Prompt 14 engine/extras. Prompt 10 remains not started.

Historical Prompt 7.5 gate and Prompt 8 verification limits remain unchanged in their reports; Prompt 9 delivery does not retroactively close them.