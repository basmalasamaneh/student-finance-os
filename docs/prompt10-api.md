# Prompt 10 backend contract

Base URL `/api`; existing session and mutation Origin + `X-CSRF-Intent: 1` requirements apply.

## Catalog configuration

`useListCampusCatalog()` / `getListCampusCatalogQueryKey()` return `CampusUniversity[]`, with nested `Campus[]`, existing categorized services and products. Students/admins may read; parents may not.

Existing admin hooks: `useCreateCampusUniversity`, `useUpdateCampusUniversity`, `useCreateCampus`, `useUpdateCampus`, `useCreateCampusService`, `useUpdateCampusService`, `useDeleteCampusService`, `useCreateCampusProduct`, `useUpdateCampusProduct`, `useDeleteCampusProduct`. Mutations take `{data}` or `{id,data}`; delete takes `{id}`. No new parallel catalog.

`CampusUniversityInput`: required `name`, `arabicName` (1–160 chars); optional `city` (≤160), `housingAvailability`, `transportationContext`, `tuitionConfiguration`, `scholarshipConfiguration` (each plain text ≤2000). `CampusInput`: required `universityId`, `name`, `arabicName`; optional `city` (≤160), `locationDescription`, `transportationContext`, `housingContext` (≤2000). Read DTOs include these fields. New/legacy rows default to empty strings meaning **not configured**, never “unavailable” or invented real fees. Omitted metadata on update is preserved; explicit `""` clears it. Configuration text does not post charges or create plans.

Existing service categories remain `food | books | printing | transportation | fees | other`; cafeteria/bookstore/printing availability is derived from services, not duplicate booleans. Services/products retain soft-disable behavior; campus/university parent reassignment is rejected. No destructive university/campus deletion is introduced.

## Student profile

Existing `useGetProfile`, `useSaveProfile` (`{data:{education:…}}`) and `useCompleteProfile`.

`Education` adds optional UUID `universityId`, `campusId`. University mode accepts **both or neither**. IDs must identify a real university and a campus belonging to it. Supplied names are canonicalized server-side; reads refresh linked names after administrator renames. Mismatched/partial IDs return 400; nonexistent IDs 404. No implicit selection or inference from typed names.

Education remains **whole-object replacement** when supplied, not nested merge. Other omitted profile sections remain unchanged. To unlink, submit university-mode education with neither ID and explicit manual `university`/`campus` names. Legacy free-text-only profiles remain valid. To switch campus submit the full new pair. Switching to school removes catalog IDs and university/campus/faculty/major/academicYear/studyStatus fields; historic receipts remain unchanged.

## Campus spending

`useGetCampusSpendingSummary(params?)`, `getGetCampusSpendingSummaryQueryKey(params?)`; `GET /campus/spending-summary?month=YYYY-MM&campusId=UUID&serviceId=UUID`. Student-only; no userId input. Unknown query keys/invalid values: 400; absent catalog filters: 404; inconsistent campus/service filters: 400.

Response `CampusSpendingSummary`:

```ts
{
  month: string; // UTC YYYY-MM, default current UTC month
  campusId: string | null; // requested filter, not inferred
  serviceId: string | null;
  totals: Array<{
    currency: "ILS" | "USD" | "JOD";
    spending: Amount;
    food: Amount; books: Amount; printing: Amount;
    transportation: Amount; fees: Amount; other: Amount;
  }>;
}
// Amount = { minor: number; currency: "ILS" | "USD" | "JOD" }
```

Totals cover the full owner's debit campus-payment ledger within the half-open UTC calendar month, not the latest ten entries. Historical receipt categories drive totals even if the service is renamed, recategorized or disabled. Legacy campus payments lacking campus provenance use their service's immutable campus association. Unknown historic categories fall into `other`. Currencies remain separate, exact integer minor-unit totals; no FX/forecast. Only currencies with matching payments are returned (sorted); `totals: []` is the genuine empty state. Each returned currency has all six category amounts including real zero totals. Safe-integer overflow fails explicitly rather than rounding.

Invalidate catalog after config mutations; profile after profile/config edits; spending summary after campus payments. Existing simulated checkout request, idempotency header, atomic ledger posting and immutable receipts are unchanged.

## Backend verification

Reviewed additive schema: five non-null text columns with empty-string defaults on `campus_universities`, four on `campus_locations`; existing JSON education stores optional IDs without rewriting legacy profiles. Development `pnpm --filter @workspace/db run push` applied successfully without force or destructive changes. No seeds, real fee information, forecast, workflow changes or frontend work are part of this backend change.

`test/campus-integration.test.mjs` invokes actual route handlers against isolated PostgreSQL fixtures (no HTTP server). It covers metadata persistence/defaults/bounds, admin RBAC, profile paired IDs/canonical names/manual fallback/school switching, owner-only UTC full-ledger six-category multi-currency totals, filters, disabled historical services, immutable price receipts, checkout concurrency/idempotency/rollback and safe-money overflow. Existing family-request regression test now selects the intended wallet by ID instead of assuming unordered SQL returns it first.

Verification passed: OpenAPI codegen plus composite-library typecheck; API-server typecheck; API-server test suite **22/22, zero skipped** including PostgreSQL integration tests; `git diff --check`. No browser or managed workflow testing was performed by this backend task.