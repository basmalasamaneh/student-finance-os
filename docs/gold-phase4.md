# Gold · Phase 4 (native-feeling mobile) + Phase 5 matrix

Scope: UI only (Prompt 7.5). No backend, routes, auth, money math, seed or dependency changes. No service worker.

## What shipped (code)
| Area | Implementation | Files |
|---|---|---|
| Bottom tab bar ≤767px | Existing role items (`mobileItemsForRole`, max 5) unchanged; overflow stays in **More** sheet. Translucent blur (`.tabbar`), safe-area bottom, gold pill indicator animating scale/opacity, hides while keyboard is open. | `components/shell/app-shell.tsx`, `index.css` |
| Tablet 768–1023 | Existing icon rail with tooltips. | app-shell |
| Desktop ≥1024 | Sidebar now **collapsible** (persisted `sfos.sidebarCollapsed`), collapsed = icon rail + tooltips. | app-shell |
| App bar | Sticky, blur, `env(safe-area-inset-top)`. Page H1 is the large title; compact title fades in after 56px scroll (`data-compact`). Deep routes (`/transactions/:id`, `/goals/:id`, `/goals/fund`, `/profile`, …) show **Back**: pops real history when navigated in-app, else parent route. Chevron mirrored by the global RTL icon rule. | app-shell |
| Route transition | `.route-enter` 200ms opacity+translate; killed by reduced-motion rules (OS or in-app). | index.css |
| Scroll restoration | Manual `history.scrollRestoration`; per path+query memory, restored on popstate (retries ≤20 frames while cached lists render), top on fresh nav. Filters live in URL so they return with the entry. | app-shell |
| Sheets | `DialogContent` & `SheetContent side=bottom`: drag-to-dismiss (grabber zone or content scrolled to top; touch/pen only), snaps full(≤90dvh)/half(50dvh), dismissal clicks Radix Close so onOpenChange/focus return/scroll-lock are unchanged. Props/handlers preserved (consumer pointer handlers composed). AlertDialog: keyboard-aware only, never drag-dismissed. | `ui/dialog.tsx`, `ui/sheet.tsx`, `ui/alert-dialog.tsx`, `gestures/use-sheet-drag.ts` |
| Keyboard | `useKeyboardInset` publishes `--kb-inset` + `html[data-keyboard]` from visualViewport; sheets sit above keyboard, max-height shrinks. | `gestures/use-visual-viewport.ts` |
| Pull-to-refresh | Home (`summary`+`accounts` refetch) and Transactions (`history`+`filterOptions` refetch). Gold spinner, touch-only, ignores dialogs and `[data-no-ptr]` scrollers. No placeholder data. | `gestures/pull-to-refresh.tsx`, `home/student-dashboard.tsx`, `pages/transactions.tsx` |
| Swipe | Goal cards: swipe toward start edge (reversed in RTL) → Details (pause lives there). Card remains a normal link. | `gestures/swipe-actions.tsx`, `pages/goals.tsx` |
| Touch polish | tap highlight off, `touch-action: manipulation`, press scale/opacity on hover-less devices, chrome unselectable while `.tabular`/`bdi`/inputs stay selectable, `overscroll-behavior`, `overflow-x: clip`, snap scrollers contain overscroll, ≥16px inputs on coarse pointers, 44px date inputs, chips 44px. | index.css |
| Sticky form actions | Opt-in `.form-action-bar` (above tab bar + keyboard; static ≥768; flush inside dialogs). Not applied globally so other buttons are never hidden. | index.css |
| Hide balances | Home now consumes `useDeviceSecurity().hideBalances/setHideBalances`; old Home-only localStorage hook removed. | student-dashboard |
| Layout | `Page` max width 1200px. | `layout/page.tsx` |
| PWA | `manifest.webmanifest` (=en), `manifest.en/.ar.webmanifest` (lang/dir), name "Student Financial OS", standalone, relative start_url/scope (correct under BASE_URL), icons 192/512/maskable/SVG + apple-touch-icon, all generated locally (ImageMagick from `public/icon.svg`). ThemeProvider swaps manifest href by language. Viewport `viewport-fit=cover`, apple meta tags, media-scoped theme-color (#D4AF37 / #0D0B07) that then follow the resolved in-app theme. **No service worker, no offline cache.** | `index.html`, `public/*`, `features/theme/theme-provider.tsx` |

## Follow-up pass (this round)
| Item | Status | Detail |
|---|---|---|
| Transaction row swipe | Done (C) | `components/money/ledger-list.tsx`: rows with `hrefFor` are wrapped in `SwipeActions` → "Details" (same URL). The row `<Link>` is unchanged (still the non-gesture path, same aria-label/testid). Rows got an opaque `bg-background` so the action sits underneath. |
| Sticky form actions | Done (C) | `.form-action-bar` applied to `PagerControls` in `pages/onboarding.tsx` (used by profile/education, residence, commute, income, scholarship forms). Class only; buttons, handlers, `loading`, testids untouched. Sticky ≤768px above tab bar + `env(safe-area-inset-bottom)`; with keyboard open (`html[data-keyboard]`) it sits on `--kb-inset`; static ≥769px. Other buttons in the page are not affected (opt-in class). |
| Keyboard / autocomplete (onboarding only) | Done (C) | name → `autoComplete="name"` + `autoCapitalize="words"`; cities → `address-level2`; school/university/provider → `organization`; email (read-only) → `type=email autoComplete=email`; trips & percentage → `inputMode="numeric"`; amounts keep `inputMode="decimal"` + `autoComplete="off"`; `enterKeyHint="next"` on pager fields. Dates remain native `type="date"` (44px min, dark-tinted picker icon). Presentation attributes only — no value/validation changes. |
| Breakpoints | Confirmed + aligned | Tailwind `md` = 768px (`min-width`), so previously 768px exactly counted as tablet. Shell now uses `min-[769px]:` for tab bar/rail/app-bar switches and `Page` bottom padding → **mobile ≤768, tablet 769–1023 (rail), desktop ≥1024 (`lg`, sidebar)**. Mobile sheets (`.sheet-mobile`, drag hook) moved from ≤639.98px to **≤768px**, so tablet/desktop get centered dialogs. `.form-action-bar` uses the same 768/769 split. Verified in built CSS (`@media (max-width:768px)` ×3, `(min-width:769px)`). Onboarding's one-question pager now also switches at `(max-width: 768px)` (presentation breakpoint aligned with the shell; pager logic untouched). |
| Scroll restoration fix | Done (C) | Scroll key now re-keyed in `useLayoutEffect` (before the browser's clamp scroll on the new page can overwrite the list's saved offset) and on search-only changes (filters) without resetting scroll. Push/replace to a new path → top; only popstate (Back/Forward, including the app-bar Back) restores. |
| Touch spacing | Done (C) | Tabs ≥64px tall, nav links 44–48px, filter chips 44px with `gap-2` (8px), swipe actions 88px wide, sheet grabber has an enlarged invisible hit zone, form action bar buttons ≥48px on coarse pointers with 8px gap. |
| Confirmation sheets drag-dismiss | **Intentionally not added** | `AlertDialog` (destructive/financial confirmations: pause/archive goal, delete, payment confirm) keeps explicit Cancel/Confirm only — no drag, no backdrop dismissal (Radix AlertDialog default). Rationale: an accidental downward swipe must never be read as either answer on a money action; Cancel is always visible and Esc still cancels on desktop. It does get the mobile bottom-sheet presentation, grabber visual and keyboard-inset positioning. Regular `Dialog`/bottom `Sheet` confirmations are drag-dismissable (dismiss = cancel). |

## Breakpoint robustness (768 / 820)
| Width | Shell | Sheets / form bar / onboarding pager |
|---|---|---|
| 768px (iPad mini portrait) | Mobile: bottom tab bar (`min-[769px]:hidden` still visible), no rail | Bottom sheets, sticky `.form-action-bar`, one-question pager (all `max-width: 768px`) |
| 769px | Tablet rail | Centered dialogs, static action bar, full form |
| 820px (iPad Air portrait) | Tablet rail with tooltips (769–1023), no sidebar | Same as 769 |
| 1024px+ | Collapsible sidebar (`lg`) | Same as 769 |
No gap and no overlap at the edges: the mobile rules are `max-width:768px` and the tablet rules are `min-width:769px`. This was checked in the built CSS (code only), not measured in a browser.

## Launch / splash (PWA)
- The manifest has `display: standalone`, `background_color #FBF8F1`, `theme_color #D4AF37` and icons. Android/Chromium **generates its own splash** from these; that screen is owned by the browser and cannot be customised further without extra tooling.
- iOS: portrait `apple-touch-startup-image` links in `index.html` for 750×1334, 1170×2532, 1179×2556, 1290×2796 and 1640×2360 (iPad Air 820). Files are in `public/splash/`, made locally with ImageMagick: the gold icon centred on `#FBF8F1`. Devices without a match (landscape, other models) fall back to the plain icon/standalone launch, which is acceptable. There is no dark splash variant. Not checked on a device.

## Sheet drag — review fixes
- `pointercancel` and `lostpointercapture` now only **reset** (spring back, clear inline transform); they never snap or dismiss. Commit happens exclusively in `pointerup` for the tracked `pointerId`.
- Gesture state is cleared *before* committing/releasing capture, so the `lostpointercapture` that follows `pointerup` is a no-op — no duplicated dismiss.
- Pointer capture is taken **only** when the drag starts on the grabber zone (top 36px); drags starting in content are only tracked while content is at `scrollTop 0` and moving down, and are never captured, so inner scrolling isn't stolen.
- `touch-action: none` is applied to the grabber handle only (`.sheet-grabber`, `.sheet-grabber-always`, incl. its enlarged hit zone); sheet content keeps native panning.
- Consumer `onPointerCancel` / `onLostPointerCapture` props are still forwarded first.

## Confirmation dialogs — decision
AlertDialog confirmations deliberately have **no drag-dismiss and no backdrop dismiss**. Accidental dismissal of a financial/destructive confirmation is treated as a worse failure than a missing gesture; Cancel is always visible and Esc cancels on desktop. Accepted deviation from the "sheets hold confirmations with drag-dismiss" wording.

## Still handed back
- **Lazy charts + security migration**: owned by the security agent (App.tsx). The old Home hook stored `'1'`; migration should accept `'1'` as well as `'true'`.
- Form keyboard attributes in money/goal/payment dialogs (other owners).
- Haptics: payment worker.

## Tester blocker fixes (swipe, Back-scroll, sheet snap)
Causes found by reading the code, not by running a browser:
1. **Swipe action not clickable (Home, Campus row, 390px).**
   - **Stale release value:** `onTouchEnd` read the offset from React state (`x`) captured in the render closure. When the touch end arrived before the re-render (fast CDP or device touches in one frame), it saw `x = 0` and snapped the row closed. The content (later in the DOM and painted on top) then covered the action again, so clicks hit the transaction link.
   - **Mouse:** the row handled only `touch*` events, so it could not be opened with a mouse at all. While closed, the action is intentionally underneath the content.
   - **Direction:** the side was chosen from `useI18n().dir` with physical `left-0`/`right-0`, which could disagree with the element's real direction.
   - **Fix** (`gestures/swipe-actions.tsx`):
     - The offset now lives in a ref, so the release decision reads the live value.
     - Pointer events for touch, pen and mouse. The row captures the pointer only after a horizontal lock; `pointercancel` restores the previous position.
     - The action layer uses logical `end-0` and the direction is read from the element's computed `direction`.
     - The action layer is `inert` while closed and raised with `z-10` while open, so nothing overlaps it. The action's click stops propagating.
     - The row link is unchanged.
2. **Back returned to scrollY 0 instead of 1607.**
   - **Too few frames:** restoring retried for at most 20 animation frames (about 330ms). Home's queried blocks render later, so the document was still too short and the restore gave up.
   - **Saved offset overwritten:** during that window the scroll listener wrote the clamped small value into Home's saved offset.
   - **Fix** (`shell/app-shell.tsx`):
     - Event-driven restore: a `ResizeObserver` on `<main>` and `<body>` scrolls as soon as `canReachScroll` holds.
     - It stops on success, on user input (wheel, touch, key, pointer), or when the route changes (effect cleanup). No polling loop and no timers.
     - Saving scroll positions is paused while a restore is pending.
     - The popstate flag is set in the capture phase. Push/replace → top.
3. **Sheet snap with no visible change.**
   - `half` only set `max-height: 50dvh`, so a sheet already shorter than that didn't change size. Half snap is offered only to sheets taller than 62% of the viewport.
   - **Fix:** `half` now sets an explicit `height: 50dvh` (content scrolls inside). `full` keeps the natural height, capped at 90dvh, so short dialogs are not stretched. Short sheets have no half snap by design; they only dismiss or spring back.
   - **Handle detection:** the handle is now `target.closest('.sheet-grabber')` (its enlarged `::before` hit area reports the span as the target) or the top 36px strip.
   - **Mouse:** mouse drag is allowed from the handle only, so text selection keeps working. Buttons, links and inputs never start a drag. `touch-action: none` stays on the handle only.
   - Release logic is in pure `resolveSheetRelease`.
4. **Pull-to-refresh** is touch-only by design (mouse is ignored). Verify it with CDP touch events.

**Pure tests:** `src/components/gestures/gesture-math.test.ts` (run with `node_modules/.bin/tsx --test …`) — 4/4 pass: swipe clamp and settle (LTR/RTL), sheet release (reset, half, full, dismiss, short sheet, fling), and scroll reachability.

## Back-scroll — final fix (browser result after the previous round: still 1996 → 0)
**Root cause** (proven by the timing in the code and by the unit tests, not in a browser):
- Offsets were saved in a `requestAnimationFrame` callback that read `currentKey` when the callback **ran**, not when the scroll happened.
- The route effect re-keyed during the commit. So a scroll queued on the departing page, or the browser's clamp to 0 when the short detail page mounted, was written under whichever key was current when the frame ran.
- On return, the restore ran in a passive `useEffect` after paint, while Home's skeleton was short. The clamp to 0 was written into Home's entry, so the target read was 0.

**Fix** (`shell/scroll-memory.ts`, a pure controller, wired in `shell/app-shell.tsx`):
- **Capture before render:** wouter 3 (`use-browser-location.js`) already dispatches window `pushState`/`replaceState` events right after the URL changes, and the browser fires `popstate`. At that point React hasn't rendered the new route, so `scrollY` still belongs to the departing page. The controller saves it synchronously under the departing key, sets the pending target (Back/Forward → saved value, push/replace → 0) and **freezes writes** before the router renders. No monkey-patching of `history`.
- **Restore before paint:** the new route applies the target in `useLayoutEffect`. If the content is still too short, a `ResizeObserver` finishes it on the first resize that makes the target reachable. It stops on user input or the next route. No rAF loop, no timers.
- **Filters:** a same-path `replaceState` keeps the scroll position and re-keys without freezing.
- **Back button depth:** push +1, pop −1, replace unchanged (replace used to count as +1).
- **Persistence:** the map is stored in `sessionStorage` (`sfos.scroll`: path+query → y only, no financial data).

**Tests:** `src/components/shell/scroll-memory.test.ts` (4) proves that old-route writes land under the old key, the clamp can't overwrite either key, Back/Forward waits until the page is tall enough, filter replace keeps position, and a pending restore can be abandoned. Together with `gesture-math.test.ts`: 8/8 pass.

**Status:** Sheet gestures (50/90/dismiss/cancel) — **B PASS**. Swipe actions — **B PASS**, after the main agent's `onClickCapture` synthetic-click fix, which is preserved. Back-scroll — **B PASS** (1900 → detail 0 → Back 1900; screenshot r55nvt).

## Phase 5 matrix — final (browser)
Legend: **B** = browser-verified · **C** = code-checked only.

| Check | Result |
|---|---|
| 4 modes (EN/AR × light/dark) × 8 screens | **B PASS** |
| 320px, no horizontal overflow | **B PASS** |
| Receipts: reveal, wrap, copy to clipboard (stubbed) | **B PASS** |
| 768px = mobile (tab bar, sheets) / 820px = tablet rail | **B PASS** |
| Sheets: 50/90 snap, cancel, dismiss | **B PASS** |
| Swipe → Details (transactions, goals) | **B PASS** |
| Back-scroll restore (1900 → 0 → 1900, r55nvt) | **B PASS** |
| Pure tests (`gesture-math`, `scroll-memory`) | 8/8 pass |
| Typecheck + build | pass |

**Still unverified — needs a physical device (browser/CDP limits):** physical-touch pull-to-refresh feel, haptics, on-screen keyboard insets, notch/safe areas, iOS launch images, standalone PWA and app-switcher thumbnail/theme-color. Pull-to-refresh ignores the mouse by design.
