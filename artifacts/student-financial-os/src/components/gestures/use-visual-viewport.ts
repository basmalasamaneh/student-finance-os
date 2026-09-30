import { useEffect } from 'react';

let users = 0;
let cleanup: (() => void) | null = null;

/**
 * Publishes the on-screen keyboard height as `--kb-inset` on <html> (0px when closed) using
 * window.visualViewport. Sheets and sticky action bars add it to their bottom offset so the primary
 * action stays above the keyboard. Ref-counted: one listener no matter how many consumers.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    users += 1;
    if (users === 1) {
      const root = document.documentElement;
      const update = () => {
        const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        root.style.setProperty('--kb-inset', `${Math.round(inset)}px`);
        root.toggleAttribute('data-keyboard', inset > 80);
      };
      update();
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      cleanup = () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); root.style.removeProperty('--kb-inset'); root.removeAttribute('data-keyboard'); };
    }
    return () => { users -= 1; if (users === 0) { cleanup?.(); cleanup = null; } };
  }, []);
}
