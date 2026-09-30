---
name: Native interaction verification
description: Why mobile gesture and Back-navigation changes need complete browser event sequences.
---

Verify the entire interaction, not just gesture thresholds or a screenshot of the revealed state.

**Why:** A swipe appeared correct until the browser synthesized a click after pointer-up and closed it. Separately, pure scroll math passed while route rendering reassigned a queued scroll event to the destination and erased the saved list position. Both took multiple attempts because the initial checks omitted browser event timing.

**How to apply:** For gesture changes, check pointer-up followed by the resulting click, action activation, cancellation, and RTL direction. For list/detail navigation, record the actual list position, navigate, then use browser Back and compare the restored position after asynchronous content appears. Capture event ordering before another speculative fix. Keep browser-emulated gesture results distinct from physical keyboard, notch, haptic, and app-switcher verification.