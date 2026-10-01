---
name: Additive migrations with existing schema drift
description: Avoid applying unrelated database drift during narrowly scoped feature migrations.
---

Review the proposed SQL before accepting a schema push, even when the code change is purely additive.

**Why:** A full-schema preview included unrelated pre-existing default and foreign-key-name differences during a two-table feature addition. Applying the whole proposal would have changed legacy schema outside the authorized scope.

**How to apply:** If unrelated drift appears, stop that proposal. Use a reviewed table-scoped additive migration where supported, or prepare explicit additive SQL. Do not use force or accept unrelated changes merely to complete a feature.