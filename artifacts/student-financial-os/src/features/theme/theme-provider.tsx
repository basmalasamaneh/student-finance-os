import { useI18n } from '@/features/i18n/i18n-provider';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type MotionPreference = 'system' | 'reduce' | 'full';

const THEME_KEY = 'sfos.theme';
const MOTION_KEY = 'sfos.motion';

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

const media = () => window.matchMedia('(prefers-color-scheme: dark)');

interface ThemeValue {
  theme: ThemePreference;
  resolved: ResolvedTheme;
  setTheme: (t: ThemePreference) => void;
  motion: MotionPreference;
  setMotion: (m: MotionPreference) => void;
  reset: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => read(THEME_KEY, ['light', 'dark', 'system'] as const, 'system'));
  const [systemDark, setSystemDark] = useState(() => media().matches);
  const [motion, setMotionState] = useState<MotionPreference>(() => read(MOTION_KEY, ['system', 'reduce', 'full'] as const, 'system'));

  useEffect(() => {
    const mq = media();
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    // Browser chrome colour: gold #D4AF37 in light, black-gold #0D0B07 in dark. index.html ships two
    // media-scoped metas for first paint; once the user's resolved theme is known both follow it so an
    // explicit in-app choice wins over the OS setting.
    const color = resolved === 'dark' ? '#0D0B07' : '#D4AF37';
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    if (metas.length) metas.forEach((m) => m.setAttribute('content', color));
    else document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color', content: color }));
  }, [resolved]);

  // Install metadata follows the UI language: swap to the pre-generated localized manifest
  // (public/manifest.{en,ar}.webmanifest) — static files, relative URLs, correct under BASE_URL.
  const { lang } = useI18n();
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (link) link.href = `${import.meta.env.BASE_URL}manifest.${lang === 'ar' ? 'ar' : 'en'}.webmanifest`;
  }, [lang]);

  useEffect(() => {
    const root = document.documentElement;
    if (motion === 'system') root.removeAttribute('data-motion');
    else root.setAttribute('data-motion', motion);
  }, [motion]);

  const setTheme = useCallback((t: ThemePreference) => {
    setThemeState(t);
    write(THEME_KEY, t);
  }, []);
  const setMotion = useCallback((m: MotionPreference) => {
    setMotionState(m);
    write(MOTION_KEY, m === 'system' ? null : m);
  }, []);
  const reset = useCallback(() => {
    setThemeState('system');
    setMotionState('system');
    write(THEME_KEY, null);
    write(MOTION_KEY, null);
  }, []);

  const value = useMemo(() => ({ theme, resolved, setTheme, motion, setMotion, reset }), [theme, resolved, setTheme, motion, setMotion, reset]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
