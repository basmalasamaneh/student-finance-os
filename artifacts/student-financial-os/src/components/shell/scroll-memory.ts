/**
 * Scroll restoration controller (pure; unit-tested in scroll-memory.test.ts with a fake environment).
 *
 * Timing contract (wouter 3 `use-browser-location`): wouter patches history.pushState/replaceState to
 * dispatch window events "pushState"/"replaceState" right after the URL changes; the browser fires
 * "popstate" on Back/Forward. At that moment the URL is already new but React has NOT rendered the new
 * route, so window.scrollY still belongs to the departing page. We capture it there, synchronously,
 * under the departing key, then freeze writes until the new route has applied its target. No rAF, no
 * timers: a late scroll event from the old page can never land under the new key (or vice versa).
 */
export interface ScrollEnv {
  key(): string; // current URL key: pathname + search
  pathOf(key: string): string;
  y(): number;
  scrollTo(y: number): void;
  canReach(y: number): boolean;
  load?(): Record<string, number> | null;
  save?(m: Record<string, number>): void;
}
export type NavKind = 'push' | 'replace' | 'pop';

export function createScrollController(env: ScrollEnv) {
  const memory = new Map<string, number>(Object.entries(env.load?.() ?? {}));
  let committed = env.key();
  let frozen = false;
  let pending: number | null = null;
  const persist = () => env.save?.(Object.fromEntries(memory));

  return {
    memory,
    get committedKey() { return committed; },
    get frozen() { return frozen; },
    get pending() { return pending; },
    /** window scroll event. */
    onScroll() { if (!frozen) { memory.set(committed, env.y()); } },
    /** pushState/replaceState/popstate event: URL is new, DOM + scrollY are still the departing page's. */
    onNavigate(kind: NavKind) {
      const next = env.key();
      if (next === committed) return;
      if (!frozen) memory.set(committed, env.y());
      persist();
      const samePath = env.pathOf(next) === env.pathOf(committed);
      committed = next;
      if (samePath && kind === 'replace') { memory.set(next, env.y()); return; } // filter change: keep position
      pending = kind === 'pop' ? memory.get(next) ?? 0 : 0;
      frozen = true;
    },
    /** Called from the new route's layout effect (before paint) and whenever content resizes. Returns true when done. */
    apply(): boolean {
      if (pending === null) { frozen = false; return true; }
      if (!env.canReach(pending)) { return false; }
      env.scrollTo(pending);
      memory.set(committed, pending);
      pending = null; frozen = false;
      return true;
    },
    /** User input or unmount while waiting: stop restoring, resume normal recording. */
    abandon() { pending = null; frozen = false; },
  };
}
