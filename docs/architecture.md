# Student Financial OS — Prompt 1 foundation

The workspace separates the web artifact (`artifacts/student-financial-os`), Express API (`artifacts/api-server`), and reusable TypeScript libraries (`lib/*`). This foundation does **not** implement finance endpoints, persistence models, authorization integration, or a production identity provider. The existing DB layer, OpenAPI specification, and generated packages remain the contract sources; do not hand-edit generated code.

## Monetary boundary

`@workspace/finance-core` exports `Money` (`{ minor: number, currency: "ILS" | "USD" | "JOD" }`), `money`, `parseMoney`, `assertMoney`, `addMoney`, `subtractMoney`, `multiplyMoney`, `formatMoney`, `formatNumber`, `formatPercent`, and `formatDate`. Minor units are safe integers only. Scales are ILS/USD 2 and JOD 3. Parsing accepts plain decimal strings and rejects excess precision; arithmetic uses BigInt intermediates, checks currency equality, and throws on unsafe results. `multiplyMoney` accepts only an integer quantity, never a floating-point rate. Formatting uses integer BigInt input to Intl and exact fractional digits; locale defaults to Arabic with western digits, and dates default to Asia/Hebron. Percent input is a ratio (0.125 → 12.5%). Financial rates, conversion, rounding, and cross-currency aggregation need an explicit future product policy; never infer them from UI display.

## API and identity boundary

The existing `/api/healthz` route remains unchanged. After the API router, generic not-found and error middleware emit `{ "error": { "code": "...", "message": "...", "requestId": "..." } }` (requestId when available). Public messages are fixed and sanitized: unexpected failures return INTERNAL_ERROR/500 without exposing stack traces, SQL, or request contents. Malformed JSON becomes BAD_REQUEST/400. Request logging uses pino; no client-provided role header creates an identity.

`TrustedPrincipal` is a **server-supplied interface**, not authentication. `requirePrincipal`, `requireRole`, and `requireOwner` deny by default. A future verified session adapter must establish the principal on the server before protected handlers use it. Navigation preview state and client role selections are presentation only, never authorization. Future feature modules should colocate route handlers, input/output validation, and service logic by domain under `artifacts/api-server/src/routes/<feature>` and `src/lib/<feature>`; register routers in `routes/index.ts`. Define OpenAPI contracts first, regenerate Zod/client helpers, validate at boundaries, authorize every read/write, and persist via `@workspace/db` only after migrations are designed. No schema/seeds were added in Prompt 1.

## Verification

`pnpm run typecheck:libs`, `pnpm --filter @workspace/api-server run typecheck`, `pnpm --filter @workspace/finance-core run test`, and `pnpm --filter @workspace/api-server run test` check this foundation. Tests use Node's built-in test runner; no extra runtime dependency is needed.