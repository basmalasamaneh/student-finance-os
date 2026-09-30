---
name: Preview JSX instrumentation
description: Development-only JSX instrumentation incompatibility with explicit generic component arguments.
---

Prefer inferred generic props over explicit type arguments in JSX component invocations when possible.

**Why:** The development preview instrumentation inserted metadata between a component name and its generic type arguments, producing invalid JSX. Typechecking and production builds passed while the development page failed.

**How to apply:** If development reports unexpected JSX tokens beside injected metadata, remove explicit JSX generic arguments and preserve type safety through props inference. Confirm the development preview, not only the production build.