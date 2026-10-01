---
name: Ephemeral request privacy
description: Shared request caches can retain sensitive data after a screen clears its local state.
---

Verify every storage layer when promising that sensitive answers disappear on clearing or leaving a screen.

**Why:** Clearing React state and resetting a mutation observer did not immediately erase question variables or financial answers from TanStack's shared mutation cache. Default garbage collection retained inactive requests beyond the visible conversation.

**How to apply:** For deliberately ephemeral interactions, prefer an abortable request with component-local state or explicitly manage cache retention. Invalidate the request generation on clear, account change and unmount so a late response cannot restore cleared content. Test a held response, not only already-completed messages.