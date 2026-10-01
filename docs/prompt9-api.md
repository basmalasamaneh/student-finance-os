# Prompt 9 backend contract

Prompt 9 implements **simulated** family requests and a durable **in-app-only** inbox. No external provider, bank connection, email, push delivery, or Prompt 14 notification engine. Existing peer requests, family invitation decisions/multiple guardians, allowances, and narrowly consented external goal funding keep their contracts. OpenAPI is authoritative; generated exports are from `@workspace/api-client-react` and `@workspace/api-zod`. Success values are direct DTOs, not envelopes.

## Authorization and errors

All endpoints use the existing authenticated session. `/family/requests*` requires student role; `/parent/requests*` requires parent role. `/notifications*` accepts student/parent and is always principal-owner-only (no recipient parameter). New request reads/writes, including idempotency replay, require the **original accepted family link with requests=true**. Goal-only consent never authorizes requests/allowances; family goals permission never authorizes original goal funding or its parent notifications.

All request POSTs require `Idempotency-Key` (8–128 `[a-zA-Z0-9_:.~-]` characters). Repeat identical operation/body with the same key returns its original receipt only after current authorization. Reuse for different input/operation is 409 CONFLICT. Notification mark-read operations are naturally idempotent and need no key.

Errors retain `{error:{code,message,requestId?}}`: 400 BAD_REQUEST (invalid body/date/amount/key, extra fields, currency mismatch), 401 UNAUTHENTICATED, 403 FORBIDDEN (role), 404 NOT_FOUND (foreign object/account or denied/revoked original consent), 409 CONFLICT (terminal/invalid transition, conflicting key, safe balance limit), 409 INSUFFICIENT_FUNDS. Insufficient funds roll back **everything**, leave status pending/details_requested, and do not consume the idempotency key; retry after top-up. New routes send `Cache-Control: no-store`.

## Student requests

| Hook | Method/path | Arguments |
|---|---|---|
| `useListStudentFamilyRequests()` | GET `/family/requests` | none |
| `useCreateFamilyMoneyRequest()` | POST `/family/requests` | `{data:FamilyMoneyRequestInput}` |
| `useGetStudentFamilyRequest(id)` | GET `/family/requests/{id}` | request UUID |
| `useReplyToFamilyRequest()` | POST `/family/requests/{id}/reply` | `{id,data:{message}}` |
| `useCancelFamilyRequest()` | POST `/family/requests/{id}/cancel` | `{id}` (no body) |

`FamilyMoneyRequestInput` requires `{familyLinkId,receivingAccountId,amount:{minor,currency},reason,note,date}`. Amount is a positive safe integer in minor units (JOD 3 decimals; ILS/USD 2). Reason is nonblank ≤120 chars; note ≤500 chars. Date is a real `YYYY-MM-DD`, descriptive rather than a scheduled payment date. Parent is determined from the accepted link, never a client-supplied arbitrary payer. Receiving account is an **ordinary student-owned same-currency account selected for this request**, independent of family allowance receiving-account settings and allowance permission. It is immutable after creation.

List returns `FamilyMoneyRequest[]`; create/detail/reply/cancel return `FamilyMoneyRequest`. Denied links are omitted from lists and 404 on detail/mutation, including students' access to requests on revoked links. Regrant exposes history but never revives cancelled requests.

## Parent requests

| Hook | Method/path | Arguments |
|---|---|---|
| `useListParentFamilyRequests()` | GET `/parent/requests` | none; only this parent's authorized links |
| `useGetParentFamilyRequest(id)` | GET `/parent/requests/{id}` | request UUID |
| `useApproveFamilyRequest()` | POST `/parent/requests/{id}/approve` | `{id,data:{parentAccountId}}` |
| `useDeclineFamilyRequest()` | POST `/parent/requests/{id}/decline` | `{id}` (no body) |
| `useAskFamilyRequestDetails()` | POST `/parent/requests/{id}/ask-details` | `{id,data:{message}}` |

List returns an array; all others return `FamilyMoneyRequest`. Approval uses a parent-owned ordinary same-currency account and the student's request-selected account; no FX and no automatic top-up. Requests permission suffices without allowance permission.

### DTO and state machine

`FamilyMoneyRequest = {id,familyLinkId,studentId,parentId,amount,reason,note,date,status,history,parentTransferId,transactionIds,createdAt,updatedAt,receivingAccountId?}`.

- `status`: `pending | details_requested | approved | declined | cancelled`.
- `history`: ordered `{id,role:"student"|"parent",message,createdAt}[]`; message is nonblank ≤500 chars.
- `receivingAccountId` is **student-only**, omitted from parent DTOs.
- `parentTransferId` is null until approval; stable unique UUID shared by the paired ledger debit/credit.
- `transactionIds` contains only the viewer's own ledger leg, empty before approval. No opposite-party account ID is disclosed by these DTOs.
- Timestamps are ISO strings. Lists sort newest first.

Create → pending. Ask-details: pending → details_requested and appends the question. Student reply: details_requested → pending and appends the reply. Either live state can be approved, declined or student-cancelled; terminals cannot be acted on with a new key. Ask/reply/decline/cancel never post money. Revoking requests permission or removing a link cancels pending/details_requested requests atomically; regrant never revives them.

Approvals lock original link → request → ordered accounts. `finance.once` plus locked terminal guards handles concurrent different keys. Posting, request status/receipt, and notifications commit together. Student credit is `kind:"family_request", category:"parent_allowance"` (actual income, not generic transfer); parent debit reduces its wallet. No onboarding-income or allowance-forecast row is inserted. Original goal funding remains externally simulated and does not debit the parent wallet.

Parent wallet receipts are permanent **own financial history**, not a second student-sharing channel: family request debit receipts never store student notes or student receiving-account IDs; student credits may retain their own note. Parent wallet serialization also strips those fields from pre-fix immutable request receipts and strips counterparty account IDs from allowance receipts, regardless of current permission. Own transaction/account IDs, amount, balance-after, date and pairing `parentTransferId` remain available after revocation. Parent-authored allowance notes remain own data. No historical ledger rows are rewritten.

`ParentChild.requests` preserves its field name: `{status:"live",items:FamilyMoneyRequest[]}`, omitted without requests permission. `ParentDashboard.requestsStatus` is `"live"`; both enums retain `"coming_soon"` for backward type compatibility. Items are restricted to the viewing parent's exact family link.

## In-app inbox

| Hook | Method/path | Result |
|---|---|---|
| `useListNotifications()` | GET `/notifications` | `{items:InAppNotification[],unreadCount}` |
| `useGetNotificationUnreadCount()` | GET `/notifications/unread-count` | `{unreadCount}` |
| `useMarkNotificationRead()` | POST `/notifications/{id}/read`, `{id}`, no body | `InAppNotification` |
| `useMarkAllNotificationsRead()` | POST `/notifications/read-all`, no body | `{unreadCount:0}` for that transaction's visible set |

`InAppNotification = {id,type,title,createdAt,readAt:string|null,href?,amount?}`. No raw outbox payload or domain scope columns are exposed. Titles are server-provided neutral text; localize using `type`. Categories ONLY: `request`, `approval`, `decline`, `ask_details`, `reply`, `allowance_posted`, `goal_funded`, `permission_changed`.

- New request → parent; question → student; reply → parent; approval/decline → both parties.
- Posted allowance occurrence → both parties exactly once, emitted inside `processOccurrence`, not per ledger leg. Failed/cancelled occurrences emit nothing.
- Goal contribution → student and, for parent external funding, funding parent. Emitted once per contribution in the existing goal transaction.
- Actual accepted-link permission/receiving-account changes and removal → both parties. No-op updates/repeated removal emit nothing.
- Durable uniqueness is `(recipientId,type,sourceId)`; question/reply have their own conversation event IDs, allowance uses occurrence ID, goal uses history entry ID. No in-memory notification queue or external delivery.

Every parent inbox response, unread count, mark-read and generated `href` reauthorizes the **original link** and appropriate permission (`requests` or `allowance`) under scope locks. Denied records are omitted, including from counts; direct mark-read returns 404. Family replacement links do not authorize older notifications. Goal funding notifications instead require the **exact original redeemed, unrevoked goal invitation** for the parent and exact goal; family permissions cannot substitute. A replacement goal consent does not resurrect old notifications.

Permission-change notifications always remain generic `"Sharing settings changed"` with **no identity, amount, note, account ID, scope ID or href**. Other scoped entries are never downgraded into stale detail. Student notifications disclose only their own activity. Inbox mark-all updates only visible owner records.

Application-relative deep links: requests `/family/requests/{id}` (student) or `/parent/requests/{id}` (parent); allowance `/family` (student), `/parent/allowances` (parent); goals `/goals/{id}` (student), `/goals/fund?goalId={id}` (parent). Destination views must fetch their authorized backend detail again; no route/query string is authorization.

## Cache freshness

Generated query helpers are `getListStudentFamilyRequestsQueryKey()`, `getGetStudentFamilyRequestQueryKey(id)`, `getListParentFamilyRequestsQueryKey()`, `getGetParentFamilyRequestQueryKey(id)`, `getListNotificationsQueryKey()`, `getGetNotificationUnreadCountQueryKey()`. Query keys start with their API paths (`/api/family/requests`, `/api/parent/requests`, `/api/notifications`, etc.).

After request mutations invalidate request lists/details, parent dashboard/child, inbox/count. After approval also invalidate parent wallet and student finance accounts/summary/history/planning/profile. After permission changes/removal clear affected request details/lists and parent/inbox caches immediately; do not retain old data on 404/refetch failure. Clear all principal-specific caches on logout/account switch. Recheck on mount/focus and polling (15–30s); suppress stale parent scoped content until revalidated after resume, using existing Prompt 8 consent freshness conventions. After mark-read invalidate inbox/count.

## Migration and verification

OpenAPI was extended and generated **before** implementation. Additive tables: `family_money_requests`, `in_app_notifications`; no existing table/data deletion, seed or auth change. Existing nullable ledger `parent_transfer_id` is reused. Applied with non-force `pnpm --filter @workspace/db run push`.

Synthetic integration tests exercise permissions, cross-owner/guardian isolation, different-key concurrency, insufficient-funds rollback/retry, question/reply state/history, revoked cached replay and regrant cancellation, durable inbox dedupe/count/read scoping, allowance occurrence notification, exact-goal-consent separation, and original peer/goal/allowance regressions. No workflows or browsers are run for backend implementation.

Verified: `pnpm --filter @workspace/api-spec run codegen`, `pnpm run typecheck` (workspace), and `pnpm --filter @workspace/api-server run test` pass; 21 tests, 0 failed/0 skipped with PostgreSQL available. New integration fixtures delete only their synthetic users and associated rows in `finally`. No production or pre-existing seed data is deleted.