---
name: Nested responsive layouts
description: Prevent intrinsic-size overflow within sidebars and nested component-gallery layouts.
---

Use container queries and shrinkable tracks for components nested inside the sidebar, section index, and descriptor columns.

**Why:** Viewport-based column breakpoints caused severe gallery overflow even on tablets because the actual component space was much narrower than the viewport. Fixed-width spacing specimens also overflowed at 320px despite correct outer grids.

**How to apply:** Let independent specimen rows wrap and set min-width zero on grid/flex children. Check narrow English as well as Arabic, and account for scrollbar width. Never hide overflow to conceal clipped financial amounts.