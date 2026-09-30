# Phase 5B: existing simulated money-flow UI

## Exact scope

- Presentation-only changes in existing movement, request, receipt, account-list, create-account, campus checkout, transaction detail, and goal contribution/detail UI.
- Existing send and internal-transfer review steps, and campus checkout reviews, use an enhanced confirmation when the reviewed ILS amount is strictly above the device-configured ILS minor-unit threshold. Other currencies always require enhanced confirmation: no FX conversion or exchange-rate assumption.
- Enhanced reviews retain real selected account/recipient/service and exact amount data, show fee “None” and today's local date, and provide a directional slide control plus an ordinary keyboard-accessible confirmation button. Both invoke the existing confirmation handler, with shared pending disabling and a re-entry latch. Existing validation, mutation request bodies, idempotency, ledger refresh, and calculation helpers are unchanged.
- Sensitive account and reference IDs already displayed in these surfaces use the shared `SensitiveReference` component: last four characters by default, explicit reveal, and copying the full intended reference. Editable ID inputs stay editable; money is never masked by this change.
- Existing simulated receipt/status notes remain. Movement, request, campus checkout and account creation dialogs show a persistent small Simulated badge on every step. Account creation and request success also show the existing simulated note. No real banking/security claim, backend change, or new Coming soon feature.
- Optional feature-detected vibration runs from an effect on successful movement/campus/contribution receipt transitions or an explicitly successful complete-goal action. No render-time vibration, vibration on drag, initial goal-page celebration, or unsuccessful action. Reduced motion suppresses vibration.
- Shared device security preferences and reference behavior are supplied by the separate security implementation. No new dependency, API, route, auth, offline financial logic, or goal-progress change.
- Mobile form follow-up: the owned payment dialogs and goal-contribution dialog use the existing `.form-action-bar` footer hook, with keyboard/safe-area behavior supplied by the shared mobile CSS and visualViewport implementation. Text/UUID inputs explicitly use text keyboards, appropriate autocomplete-off, and next/done hints; UUID fields disable capitalization/autocorrection. Existing shared amount inputs already use decimal keyboards. These forms have no email/telephone inputs to relabel and introduce no date or validation changes.
- Audited every integrated reference: `SensitiveReference` receives the original full account, payer, counterparty, transaction, user, or linked entity ID from existing fields, never a shortened/prefix display value. Reference copying therefore targets the full source ID.
- Receipt overflow follow-up: shared review rows now use shrinkable `minmax(0, …)` grid tracks, stack labels/values on mobile and wrap labels. Receipt containers and purchased-item rows shrink/wrap rather than clipping. With authorization, only shared reference CSS was changed: full UUIDs wrap anywhere, reference text can shrink, and reveal/copy buttons retain 44px targets and wrap. No overflow hiding, money truncation, or reference behavior change.
- Hide-balances follow-up: account-row balances and Money-page total/available/reserved/net balances consume the existing device `hideBalances` preference through `MoneyDisplay.hidden` with EN/AR accessible labels. Transaction/payment amounts remain visible. Hooks are unconditional; no stored preference, calculation, or mutation behavior changes.

## Testing

Validation completed: `pnpm --filter @workspace/student-financial-os typecheck` passed after the security components became available; `git diff --check` passed. No browser, app run, workflow, or dependency changes were performed. Browser/workflow testing is owned by the main agent, not this implementation subtask.

After the mobile receipt and balance-privacy follow-up, TypeScript and whitespace checks passed again. Production build passed with `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/student-financial-os build` (the unchanged Vite config requires both environment values even for builds). Existing sourcemap-reporting and bundle-size warnings are non-fatal. No browser or workflow was run by this subtask.

Manual acceptance checklist for EN/AR, light/dark, and 320px/mobile/desktop:

1. Review ILS sends/transfers/campus payments below, equal to, and above the configured threshold. Only strictly above uses enhanced confirmation.
2. Review USD/JOD flows: enhanced confirmation always; the ILS-only/no-FX message is visible.
3. Verify actual source, recipient/service, exact amount, fee none and today's date; edit/back restores the original form without submitting.
4. Drag fully to confirm (LTR right, RTL left); partial or cancelled drag must not submit. Enter/Space on the control and the ordinary button are alternatives.
5. While pending, both confirmation paths and edit/back are disabled. Repeated inputs cannot create duplicate calls. On failure preserve the existing error and safely retry with original idempotency behavior.
6. Check masked IDs, explicit reveal/hide, full-reference copying and clipboard errors using the shared security component. Amounts remain exact, visible, and LTR-isolated.
7. Successful payment/contribution and explicit goal completion can vibrate once on supported hardware. Loading old receipts/pages, validation failures, server errors, retries before success, and drag feedback never vibrate. Reduced motion and unsupported devices remain functional.
8. Verify persistent simulation wording and existing Coming soon labels; native dates, RTL focus/order and original validation are preserved.