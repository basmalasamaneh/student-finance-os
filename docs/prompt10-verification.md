# Prompt 10 — requirement coverage and verification

**Current: explicitly user-authorized Prompt 10 DELIVERED — targeted critical browser flows PASS, with explicit coverage limits. Prompt 11 is not started.** This is not an exhaustive visual/device or zero-regression certification.

Scope reference: master implementation prompts, lines 1327–1454 (school mode, university mode, configurable university/campus catalog, simulated services and monthly spending). Contract: `docs/prompt10-api.md`, authoritative `lib/api-spec/openapi.yaml`, generated clients/Zod. Frontend paths below are relative to `artifacts/student-financial-os/src/`.

Automated results below are implementation-worker reported, including the focused UUID-filter regression result. Actual browser evidence is main-agent reported. The documentation agent inspected the contract and current frontend implementation but did not execute tests, build, browser checks or workflows. No private identifiers, credentials, invitations, PII or reusable fixture data are recorded.

## Requirement coverage mapping

| Requirement | Current implementation / boundary |
|---|---|
| Distinct school experience: weekly allowance, spending, saving, requests, parent links, school expenses | `components/home/student-dashboard.tsx`, `planning-panels.tsx` and `school-links.tsx` select school blocks and shortcuts into existing `/family/requests`, `/family`, `/goals`, `/transactions`, `/plan` and `/learn`. Existing allowance/finance/goal data is reused; no invented balances. |
| Avoid unnecessary complex university UI for school students | School profile fields replace university education fields; Home omits university context. `features/navigation/nav-config.ts` hides university-only campus navigation for school students and promotes Learn. This is presentation, not an authorization replacement; existing `/campus` route remains reachable. |
| Seven financial-education topics | `/learn`, `pages/learn.tsx`: saving, budgeting, needs vs wants, recurring expenses, goals, income and planning. Searchable bilingual general educational content with topic dialogs using the existing mobile-sheet treatment; explicitly not advice or personalized financial data. Loading, error/retry and no-search-match states are implemented. |
| University identity: institution, campus, city, faculty, major, academic year | `pages/onboarding.tsx` (also existing `/profile`) and `components/campus/catalog-picker.tsx` use the configured University → Campus cascade. `components/home/university-context.tsx` displays saved identity and linked catalog context. Optional IDs must be paired and campus membership is validated server-side; names are canonicalized and refresh after admin rename. |
| Legacy profile fallback and school switching | Empty/unavailable catalog and explicit “Not listed” support manual names, with catalog failure shown rather than fabricated options. Existing free-text profiles remain valid; typed names never infer IDs. Education is whole-object replacement when supplied. School switching strips `universityId`, `campusId`, `university`, `campus`, `faculty`, `major`, `academicYear`, `studyStatus` from education; historical receipts are unchanged. |
| University expenses: tuition, registration, fees, housing, transport, cafeteria, books, printing, internet, academic supplies | University context links to existing `/plan`; existing planning categories, manual lines, recurring expenses and profile housing/commute records support these costs. Configuration text is context only: no automatic charges, plan creation, inferred real fees or tuition due dates. |
| Scholarships, aid and loans | Existing `/profile` scholarship/aid metadata and income sources, including `student_loan`, are reused, with university Home/profile/Plan links. Scholarships remain metadata, **not automatically counted as income**. Only deliberately recorded qualifying income sources enter existing expected-income calculations; no automatic loan posting, credit decision, repayment engine or new financial formula. |
| Dynamic university database and admin configuration | Existing `/admin/institutions`, `pages/admin-campus.tsx`, `components/campus/admin-forms.tsx` reuse catalog CRUD and generated hooks. English/Arabic names, campuses/services/products remain existing fields/relationships. The nine new university/campus metadata fields are listed below. Cafeteria/bookstore/printing availability derives from services, not duplicate booleans. No hardcoded changing real-world institution, price or scholarship information. |
| Campus context and service configuration | Campus name/Arabic name, city/location, transportation/housing context and categorized services come from the persisted admin catalog. University Home uses linked IDs; `/campus` initializes from the saved pair. Unconfigured context is identified as not configured, not unavailable. Parent reassignment is rejected; services/products retain soft-disable behavior and no destructive institution/campus deletion is added. |
| Simulated service payments | Existing `/campus` and `components/campus/checkout-dialog.tsx` reuse food/books/printing/transportation/fees/other services and existing checkout. Simulated-only labeling, server pricing, idempotency, atomic ledger posting and immutable receipt snapshots retain their contract; no bank, QR, wallet or university provider integration. |
| Monthly campus spending and filters | `components/campus/campus-spending-summary.tsx` reads student-only `GET /api/campus/spending-summary`; `pages/campus.tsx` supplies UTC month, selected/all-campus scope and service filters in a shared dialog/sheet, including inactive historical service options. Server totals cover the full owner's debit campus-payment ledger, not the latest ten activity rows. Six category totals map cafeteria→food, bookstore→books, printing, transportation, university payments→fees, plus other. ILS/USD/JOD remain separate exact minor-unit totals; no FX or forecast. |
| Read-only summary and historical continuity | No userId input or ledger mutation. Historical receipt categories/prices remain authoritative even after service changes; legacy payments without campus provenance use immutable service-campus association. Genuine empty results return `totals: []`; safe-integer overflow fails explicitly. Catalog/profile/finance refresh paths invalidate relevant queries; no historical profile or ledger rewrite. |

## Additive schema and preserved contracts

The reviewed development **non-force migration** is reported applied successfully. It adds nine non-null text columns with empty-string defaults:

- `campus_universities` (five): `city`, `housingAvailability`, `transportationContext`, `tuitionConfiguration`, `scholarshipConfiguration`.
- `campus_locations` (four): `city`, `locationDescription`, `transportationContext`, `housingContext`.

Empty text means **not configured**, never invented fees or availability. Omitted update metadata is preserved; explicit empty text clears it. Optional profile catalog IDs use the existing education JSON, with no new profile columns or legacy backfill. No new parallel catalog, destructive migration, seeds, credentials, auth/session replacement, workflow change or ledger rewrite is introduced.

Existing planning formulas and precedence remain: expected income − planned expenses − planned savings per currency; budget actuals, housing/commute defaults/override, goal savings requirements and parent-allowance reconciliation retain their contracts. Catalog text and scholarships do not automatically contribute income/expenses. Existing simulated checkout remains unchanged in contract; read-only aggregation does not alter balances or transactions.

Keep all existing routes and resource/session/role/ownership/CSRF checks. School-mode navigation is not a security boundary. Family permissions, goal-only consent, peer requests, allowances and original external simulated goal funding remain separate; this feature grants no broader family access.

## Reported automated evidence

| Check | Status | Evidence / limits |
|---|---|---|
| Backend test suite | **PASS (worker reported)** | **22/22, zero skipped**, including isolated PostgreSQL campus integration fixtures; details in `docs/prompt10-api.md`. |
| Backend codegen and typechecks | **PASS (worker reported)** | OpenAPI codegen, composite-library typecheck and API-server typecheck; backend worker also reports `git diff --check` PASS. |
| Frontend typecheck | **PASS (worker reported)** | Frontend typecheck with required environment available. Documentation agent did not rerun it. |
| Frontend production build with required environment | **PASS (worker reported)** | Environment-provided build passed; no environment values or private data recorded. Not runtime/browser proof. |
| Focused UUID-filter regression | **PASS (worker reported)** | Uppercase/mixed-case campus/service UUID filters produce the same totals; mismatched campus/service association remains rejected. Retain this as automated evidence, not a browser scenario. |
| Prompt 10 critical browser flows | **PASS (main-agent reported, targeted)** | Actual evidence below; not a full device/visual matrix or admin metadata browser CRUD pass. |

Backend integration scope includes metadata persistence/defaults/bounds and admin RBAC; profile paired IDs, membership/canonical names, manual fallback and school switching; owner-only full UTC-month ledger totals, six categories, multiple currencies and filters; disabled historical services, immutable price receipts, checkout concurrency/idempotency/rollback and overflow. Existing family-request regression setup selects the intended wallet by ID instead of depending on unordered SQL row order.

## Actual browser evidence

| Check | Status | Main-agent-reported evidence |
|---|---|---|
| University → Campus persistence | **PASS** | Selected catalog pair persisted; `/campus` defaulted to the saved selection after hard reload. |
| Manual fallback and relinking | **PASS** | “Not listed” unlinked catalog IDs; manual institution/campus names persisted, then catalog relinking succeeded. |
| Single simulated checkout and ledger | **PASS** | Owned ILS wallet received a simulated 100 top-up and one 5 coffee checkout. Exactly two ledger rows total: one credit and one debit; resulting balance 95. This is a single-checkout browser check, not independent browser concurrency/idempotent-replay proof. |
| Monthly summary and service/month filters | **PASS** | Monthly total 5, food 5; matching service filter showed 5. Other bookstore service and older month returned genuine empty states. |
| Mobile filter sheet | **PASS (390px sample)** | Bottom sheet opened, filters applied and sheet closed. |
| Summary error and explicit recovery | **PASS** | Intercepted summary HTTP 500 displayed an error; clicking Retry restored the summary. |
| Same profile switched to school | **PASS** | University IDs and university-specific academic fields cleared; recorded spending 5 remained with no ledger change. Home hid campus action/context block and navigation exposed Learn. |
| School direct campus route continuity | **PASS — intentional behavior** | Direct `/campus` remained reachable after school switching. Education mode is intentionally not a permission gate; this preserves prior route behavior and existing student/session authorization. |
| Learn topics, keyboard and search | **PASS** | All seven topics checked; Enter opened and Escape dismissed topic sheets. No-match search and Clear search worked. |
| Arabic/dark narrow viewport | **PASS (320px sample)** | Sampled AR/RTL dark layout had no horizontal overflow; not a complete localization/theme/viewport matrix. |

Sanitized screenshot reference IDs: **oj0hky**, **ay1o08**, **8rhvhd**, **7k83i1**. References only; no private screenshots or PII are embedded.

## Browser and historical verification limits

- New admin metadata UI is **code-verified and API-tested, not browser CRUD-tested**.
- Lower university Home details and all university context/Plan/profile link combinations were **not exhaustively browser-reviewed**.
- Browser evidence is targeted; multi-currency/full-ledger ownership boundaries, disabled historic services, overflow, checkout concurrency/rollback/idempotent replay and broad regressions retain automated evidence, not browser coverage of every scenario.
- Full screen × EN/AR × Light/Dark × viewport, comprehensive keyboard/accessibility and every loading/error/empty/refresh state are **not verified**. The recorded 390px sheet, 320px Arabic/dark and Learn keyboard samples do not imply a complete matrix.
- Physical-device keyboard/notch/gesture/haptics, PWA installation and OS privacy/app-switcher behavior remain **not verified**. Build success alone does not establish these outcomes.

All existing Gold rules remain mandatory: the shared semantic tokens/components only, no raw colors or parallel styling system, mobile-first navigation/safe areas/44px targets and shared sheets, EN/AR and Light/Dark, accessible focus/reduced motion and non-judgmental copy. No service worker or offline financial caching; device-local privacy/PIN UX is not server authentication or guaranteed OS screenshot protection.

Historical Prompt 7.5 gate/device/admin/coverage qualifications in `docs/gold-phase6-verification.md` and Prompt 8/9 limits in their verification reports remain unchanged. Their earlier Prompt 10 deferral statements describe those historical checkpoints; today's explicit approval supersedes start-status only, not verification qualifications. This report claims neither exhaustive visual/device coverage nor absence of regressions. Prompt 11 and later work require separate authorization.