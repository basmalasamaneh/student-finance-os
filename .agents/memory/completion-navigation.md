---
name: Onboarding completion navigation
description: Avoid stale identity-cache redirects immediately after successful onboarding.
---

Publish server-confirmed completion into both profile and identity caches before navigating to the authenticated home.

**Why:** Invalidating queries and navigating immediately left the session guard reading an incomplete cached account. It redirected a successfully completed student back to the first onboarding step.

**How to apply:** Treat completion and any future account-state transition as a coordinated cache update, using the successful server response. Invalidation alone does not make fresh state available synchronously.