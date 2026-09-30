import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { NavRole } from '@/features/navigation/nav-config';

/**
 * NAVIGATION PREVIEW ONLY.
 * This is NOT authentication or authorization. It selects which navigation
 * structure is rendered so the role-aware shell can be reviewed. Real roles
 * will come from a server-verified session; authorization is enforced server-side.
 */
export type InstitutionMode = 'university' | 'school';

const ROLE_KEY = 'sfos.preview.role';
const MODE_KEY = 'sfos.preview.mode';

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

interface PreviewValue {
  role: NavRole;
  setRole: (r: NavRole) => void;
  mode: InstitutionMode;
  setMode: (m: InstitutionMode) => void;
  reset: () => void;
}

const PreviewContext = createContext<PreviewValue | null>(null);

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<NavRole>(() => read(ROLE_KEY, ['student', 'parent', 'admin'] as const, 'student'));
  const [mode, setModeState] = useState<InstitutionMode>(() => read(MODE_KEY, ['university', 'school'] as const, 'university'));

  const persist = (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  };
  const setRole = useCallback((r: NavRole) => {
    setRoleState(r);
    persist(ROLE_KEY, r);
  }, []);
  const setMode = useCallback((m: InstitutionMode) => {
    setModeState(m);
    persist(MODE_KEY, m);
  }, []);
  const reset = useCallback(() => {
    setRoleState('student');
    setModeState('university');
    persist(ROLE_KEY, null);
    persist(MODE_KEY, null);
  }, []);

  const value = useMemo(() => ({ role, setRole, mode, setMode, reset }), [role, setRole, mode, setMode, reset]);
  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}

export function usePreview() {
  const ctx = useContext(PreviewContext);
  if (!ctx) throw new Error('usePreview must be used within PreviewProvider');
  return ctx;
}
