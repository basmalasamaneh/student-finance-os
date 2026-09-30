---
name: Visual token verification
description: Verify emitted semantic tokens after stylesheet changes; build success can miss malformed theme blocks.
---

After substantial token edits, verify the rendered colors or emitted root variables, not just build success.

**Why:** Tailwind accepted a malformed theme block with missing delimiters and omitted the root token declarations. Both typecheck and production build passed while the UI rendered in black and white.

**How to apply:** Inspect the actual preview and computed root tokens after canonical stylesheet changes. For overlay focus tests, wait beyond the configured exit transition before asserting focus restoration; checking during the transition produces false failures.