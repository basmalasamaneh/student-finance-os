---
name: Nested responsive layouts
description: Prevent intrinsic-size overflow within sidebars and nested component-gallery layouts.
---

Use container queries and shrinkable tracks for components nested inside the sidebar, section index, and descriptor columns.

**Why:** Viewport-based column breakpoints caused severe gallery overflow even on tablets because the actual component space was much narrower than the viewport. Fixed-width spacing specimens also overflowed at 320px despite correct outer grids.

**How to apply:** Let independent specimen rows wrap and set min-width zero on grid/flex children. Check narrow English as well as Arabic, and account for scrollbar width. Never hide overflow to conceal clipped financial amounts.

Check child bounding rectangles and text visibility, not only document scroll width.

**Why:** An RTL page reported no horizontal document overflow while oversized children extended left of the viewport. After containing the cards, a flex row still compressed option names into unreadable ellipses beside fixed-width action buttons.

**How to apply:** At narrow widths, inspect left/right bounds of controls and results, and compare text scroll width with available width. Give descriptive text its own wrapping row when prices and actions otherwise consume the whole line.