# Student Financial OS

Student finance workspace with a shared exact-money foundation and an API skeleton; Prompt 1 contains no financial data routes or DB schema.

## Run & Operate

- Managed artifact workflows run the web/API; do not start root `pnpm dev`.
- `pnpm run typecheck` — libs first, then artifact checks; `pnpm run build` — checks and builds.
- `pnpm --filter @workspace/finance-core run test` and `pnpm --filter @workspace/api-server run test` — foundation tests.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate clients/Zod from OpenAPI.
- `pnpm --filter @workspace/db run push` — apply DB schema changes in dev only (none in Prompt 1).
- `DATABASE_URL` is required by the DB package when imported; API runtime requires workflow-provided `PORT`.

## Map & decisions

- `lib/finance-core` owns Money parsing, integer-minor-unit arithmetic, and Arabic/western-digit formatting; ILS/USD use 2 decimals, JOD uses 3. Use its exported `money`, `parseMoney`, `assertMoney`, `addMoney`, `subtractMoney`, `multiplyMoney`, `formatMoney`, `formatNumber`, `formatPercent`, `formatDate`. Never use floating-point arithmetic for financial amounts.
- `artifacts/api-server/src/lib/authorization.ts` holds deny-by-default helpers for a **trusted server-side** principal. Client roles and navigation previews are not identities. No auth provider is installed yet.
- `artifacts/api-server/src/middlewares/errors.ts` emits sanitized consistent errors after the existing health router. Unknown errors must not leak internals.
- `lib/db` is the DB source, `lib/api-spec/openapi.yaml` the contract, `lib/api-zod` and `lib/api-client-react` generated libraries. Preserve them until a feature explicitly changes them.
- Implement future features contract-first, validate inputs and outputs, and authorize per resource; see `docs/architecture.md` for boundaries and suggested feature-module structure.

## Constraints

Prompt 1 only: no DB tables, seeds, finance endpoints, real login, or role-based client authorization. Maintain strict integer-money validation and sanitized error messages. Node 24, pnpm workspaces, TypeScript, Express 5, PostgreSQL/Drizzle, Zod and Orval are the existing stack.

Approved UI direction: calm, spacious, premium student fintech rather than a generic dashboard. The gold redesign supersedes the original indigo palette: signature gold `#D4A72C`, deep navy `#111827`, warm canvas `#FAF9F5`, white, primary text `#172033`, slate `#64748B`, calm green `#22A06B`, and red `#EF4444` for errors/critical or destructive states. Use semantic tokens and accessible derived shades; gold is a restrained interaction accent, not a universal fill. Inter + Noto Sans Arabic, 4px spacing, English/Arabic LTR/RTL, Light/Dark/System, WCAG 2.2 AA focus and reduced motion remain foundational constraints. Prefer open hierarchy/dividers over nested cards, gratuitous gradients, and decorative charts. A financial-home reference is permitted only as explicitly labeled design specimens with centralized static fixtures; never represent it as real financial activity or enable financial actions.