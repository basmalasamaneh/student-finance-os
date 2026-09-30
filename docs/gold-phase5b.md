# Phase 5B — device-only security and trust UI

Presentation / simulated UX only, within Prompts 1–7. No authentication, session,
API contract, schema, route path, backend, ledger, seed or financial calculation changes.
No Prompt 8. The existing `/appearance` page now includes Security; no new route.

## Device security implementation

- `src/features/security/device-security.tsx` exports `DeviceSecurityProvider` and
  `useDeviceSecurity()`. It wraps the existing private AppShell branch under
  SessionGate, so the verified account identity is available; login/signup never use it.
  The internal provider is keyed by account ID to prevent cross-account reuse.
- Consumer contract: `hideBalances`, `setHideBalances(boolean)`, and
  `confirmationThreshold: { minor: number, currency: "ILS" }`. Home's eye control
  should call this shared setter, not keep a second local state. The old scoped
  Home preference is read once on adoption (both historical `"1"` and `"true"`
  encodings are supported). Local preference key:
  `sfos.deviceSecurity.v1.<verified-account-id>`.
- App lock starts off. PIN setup/reconfirmation, change and disable use a touch
  keypad and native password input (4–6 numeric digits; Arabic digits accepted).
  Changes/disabling require the existing PIN. Only a random 16-byte salt and
  PBKDF2-SHA256 hash (210,000 iterations, 256-bit output) are persisted.
  PIN plaintext exists temporarily in component memory, never in storage or a request.
- Every check reserves its attempt in localStorage before hashing. Five checks
  trigger a 60-second persisted cooldown; successful verification resets counters.
  Reloading cannot reset it. Web Locks serialize checks across tabs where supported.
  Without Web Locks, multi-tab check serialization is not guaranteed; this remains a
  bypassable local convenience control, not an authentication boundary.
- Enabling PIN makes reload lock immediately. Idle choices: 1 / 5 / 15 minutes or
  Never, disabled while lock is off. A modal “Still there?” prompt appears 20 seconds
  before timeout. Background elapsed time is checked on return, including BFCache.
  Idle does not extend while the warning/cover is displayed.
- Protected children unmount while locked, discarding sensitive in-progress UI and
  existing finance portals. Radix locks focus in the blocking dialog; Escape cannot
  dismiss it. Forgotten PIN recovery calls the **existing real logout mutation**,
  and only resets local preferences after logout succeeds. Logout errors are explicit.
  Failed local cleanup never blocks a successful real sign-out.
- Visibility/pagehide applies a synchronous opaque, gold-branded, blurred cover;
  a user-scoped sessionStorage flag retains it through reload/BFCache until return.
  A focus-trapped Return action dismisses the cover, not an actual device PIN lock.
  Browsers can capture thumbnails before page events: the UI explicitly does not
  guarantee screenshot prevention. Biometrics: **Coming soon**, with no capability claims.
- Storage/crypto failures surface errors. Invalid stored records use a recovery
  screen, not silent lock removal. This is not encryption of server account data.

## Settings / references / integration

- Hide-balances preference is shared with Home and survives reload/account switching.
- Review threshold defaults to `20_000` integer ILS minor units (₪200.00), permits
  zero, and parses decimal/Arabic digits using BigInt (no floating-money math).
  Settings explain that ILS uses the threshold and other currencies should be
  reviewed without inventing FX conversion. Payment integration is owned separately;
  changing this preference must not change amount parsing, ledger or submission payloads.
- `SensitiveReference` (`features/security/sensitive-reference.tsx`) accepts
  `{ value, label?, copy?, className? }`. It defaults masked, exposes a labeled
  reveal button and optional clipboard action, remasks when the value changes,
  isolates identifiers LTR, reserves stable one-line space, and reports clipboard errors.
  Copy intentionally copies the full reference, not the visible mask.
- Recent activity is up to three actual existing `useGetFinanceSummary`
  transactions, with links to existing details and explicit Simulated labels.
  It is not a login/security audit. Empty/unsupported accounts show honest Coming soon
  information; request errors have Retry.
- Privacy info is an existing-style dialog: city/area only, no exact addresses,
  explicit sharing only, device-local scope, simulated payments. No new route.
- All copy uses existing `useTx` / `useI18n` EN/AR mechanisms; settings/PIN/feedback
  cover RTL, semantic light/dark tokens, Radix focus, native keyboard alternatives,
  ≥44px targets, and reduced motion. Local CSS only; shared tokens/UI were not changed.

## Verification

- Pure helper tests: from `artifacts/student-financial-os`,
  `node --experimental-strip-types --test src/features/security/security-state.test.ts`.
  Covers PBKDF2, fresh salts, wrong PINs, validation, scoped keys, corruption,
  persisted cooldown/reload, exact ILS thresholds and safe-integer boundaries.
- Frontend typecheck: `pnpm --filter @workspace/student-financial-os typecheck`.
- Foundation and design-reference Home routes are React-lazy loaded under a
  localized existing-component skeleton/Suspense boundary inside the routed error
  boundary. Paths, exports, private provider placement and authentication gates
  are unchanged. The unused chart component is not imported by any current route.
- Browser/workflow execution is deliberately delegated to the main agent.
  Tester-reported verification: five failed PIN attempts trigger the cooldown, which
  survives reload; the 1-minute idle setting shows “Still there?” and then locks;
  inspected device storage contains only the salted PIN hash record, never the PIN.
- Physical background/app-switcher behavior with an open financial sheet remains
  **unverified**: the available browser environment always reported the page visible.
  Do not treat simulated events or code inspection as proof of thumbnail protection.
- Provider placement was re-inspected after a transient initial-reload development
  error. SessionGate renders no private children while the session query is pending,
  without account data, or on a public auth route; every device-security consumer is
  under the private provider. The reported message comes from the missing security
  context guard, not the account/session guard. No ordinary query-resolution race
  was identified; a transient HMR context mismatch is consistent with the report.
  The strict guard and verified-account scoping are retained; no anonymous fallback
  state or authentication changes were introduced to suppress a development error.
- Remaining manual checks include setup/change/disable/unlock, hidden-tab/BFCache
  cover + return with an existing finance sheet open, real-logout recovery,
  storage-denied recovery, and EN/light + AR/dark keyboard/mobile coverage.