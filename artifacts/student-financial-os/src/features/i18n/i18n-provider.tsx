import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ar, en, type Dictionary, type TranslationKey } from './dictionary';

export type Language = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';

const STORAGE_KEY = 'sfos.language';
const dictionaries: Record<Language, Dictionary> = { en, ar };
/** Intl locales passed to formatting utilities. */
export const LOCALES: Record<Language, string> = { en: 'en-US', ar: 'ar-PS' };

type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

function makeT(lang: Language) {
  return (key: TranslationKey, vars?: Vars) => interpolate(dictionaries[lang][key] ?? en[key], vars);
}

export interface I18nValue {
  lang: Language;
  dir: Direction;
  locale: string;
  t: (key: TranslationKey, vars?: Vars) => string;
  setLang: (lang: Language) => void;
  resetLang: () => void;
}

function browserDefault(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some((l) => l?.toLowerCase().startsWith('ar')) ? 'ar' : 'en';
}

function readStored(): Language | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'en' || v === 'ar' ? v : null;
  } catch {
    return null;
  }
}

// Default value lets components (e.g. error fallbacks) render outside the provider in English.
const I18nContext = createContext<I18nValue>({
  lang: 'en',
  dir: 'ltr',
  locale: LOCALES.en,
  t: makeT('en'),
  setLang: () => undefined,
  resetLang: () => undefined,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => readStored() ?? browserDefault());
  const dir: Direction = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = dir;
    document.title = dictionaries[lang]['app.name'];
  }, [lang, dir]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — preference lasts for the session */
    }
  }, []);

  const resetLang = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setLangState(browserDefault());
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ lang, dir, locale: LOCALES[lang], t: makeT(lang), setLang, resetLang }),
    [lang, dir, setLang, resetLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
