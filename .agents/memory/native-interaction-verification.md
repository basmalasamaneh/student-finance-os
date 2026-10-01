---
name: Native interaction verification
description: Why mobile gesture and Back-navigation changes need complete browser event sequences.
---

Verify the entire interaction, not just gesture thresholds or a screenshot of the revealed state.

**Why:** A swipe appeared correct until the browser synthesized a click after pointer-up and closed it. Separately, pure scroll math passed while route rendering reassigned a queued scroll event to the destination and erased the saved list position. Both took multiple attempts because the initial checks omitted browser event timing.

**How to apply:** For gesture changes, check pointer-up followed by the resulting click, action activation, cancellation, and RTL direction. For list/detail navigation, record the actual list position, navigate, then use browser Back and compare the restored position after asynchronous content appears. Capture event ordering before another speculative fix. Keep browser-emulated gesture results distinct from physical keyboard, notch, haptic, and app-switcher verification.

Permission-revocation tests must inspect the pending-refetch interval, not only the eventual denied response.

**Why:** TanStack Query v5's visibility-based focus handling did not cover returning through the device privacy cover. Server authorization correctly denied revoked access, yet previously shared child details remained visible until reload. An eventual 404 alone missed the privacy failure.

**How to apply:** Hold the returning reader's request pending after another account revokes access, inspect visible content, then release the response. Test window focus, visibility return and the privacy cover's explicit Return action separately; polling is not proof that each return path revalidates access.