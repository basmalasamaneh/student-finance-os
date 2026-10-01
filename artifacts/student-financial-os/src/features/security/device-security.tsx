import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLogOut } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useKeyboardInset } from '@/components/gestures/use-visual-viewport';
import { useToast } from '@/hooks/use-toast';
import { useAccount } from '@/features/auth/account';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTx } from '@/features/money/money-model';
import { PinKeypad } from './pin-keypad';
import {
  decodeSecurityState, defaultSecurityState, hashPin, isUserIdleActivity, legacyHideBalances, remainingCooldown,
  reserveAttempt, securityKey, verifyPin, type IdleMinutes, type SecurityState,
} from './security-state';
import './security.css';

type DeviceSecurity = {
  hideBalances: boolean;
  setHideBalances: (hidden: boolean) => void;
  confirmationThreshold: { minor: number; currency: 'ILS' };
  setConfirmationThreshold: (minor: number) => boolean;
  lockEnabled: boolean;
  idleMinutes: IdleMinutes;
  setIdleMinutes: (minutes: IdleMinutes) => void;
  savePin: (next: string | null, current?: string) => Promise<boolean>;
  lockNow: () => void;
  cooldownSeconds: number;
  busy: boolean;
  error: string;
  clearError: () => void;
};
const SecurityContext = createContext<DeviceSecurity | null>(null);
export function useDeviceSecurity(): DeviceSecurity {
  const value = useContext(SecurityContext);
  if (!value) throw new Error('DeviceSecurityProvider requires a verified account');
  return value;
}

/** Mount ONLY under SessionGate's private branch. Keying prevents cross-account state reuse. */
export function DeviceSecurityProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  return <AccountSecurity key={account.id} accountId={account.id}>{children}</AccountSecurity>;
}

function load(accountId: string): { state: SecurityState; damaged: boolean; covered: boolean } {
  try {
    const raw = localStorage.getItem(securityKey(accountId));
    const state = decodeSecurityState(raw);
    // Preserve the existing, account-scoped Home eye preference on first adoption.
    if (raw === null) state.hideBalances = legacyHideBalances(localStorage.getItem(`sfos.hideBalance.${accountId}`));
    let covered = false;
    try { covered = sessionStorage.getItem(`${securityKey(accountId)}.privacy`) === '1'; } catch { /* transient cover still works */ }
    return { state, damaged: false, covered };
  } catch {
    return { state: defaultSecurityState(), damaged: true, covered: false };
  }
}

function AccountSecurity({ accountId, children }: { accountId: string; children: ReactNode }) {
  const t = useTx();
  const { dir } = useI18n();
  const [initial] = useState(() => load(accountId));
  const [state, setState] = useState(initial.state);
  const stateRef = useRef(state);
  const [damaged, setDamaged] = useState(initial.damaged);
  const [locked, setLocked] = useState(!!initial.state.pin);
  const [covered, setCovered] = useState(initial.covered);
  const [warning, setWarning] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState('');
  const lastActivity = useRef(Date.now());
  const key = securityKey(accountId);
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const logout = useLogOut();
  const { toast } = useToast();
  const storageMessage = t('Device preferences could not be saved. Check browser storage and try again.', 'تعذّر حفظ تفضيلات الجهاز. تحقق من مساحة تخزين المتصفح وحاول مجدداً.');

  const read = useCallback(() => {
    const raw = localStorage.getItem(key);
    return raw === null ? stateRef.current : decodeSecurityState(raw);
  }, [key]);
  const persist = useCallback((next: SecurityState) => {
    localStorage.setItem(key, JSON.stringify(next));
    stateRef.current = next;
    setState(next);
  }, [key]);
  const preference = useCallback((patch: Partial<SecurityState>): boolean => {
    try { persist({ ...read(), ...patch }); setError(''); return true; }
    catch {
      setError(storageMessage);
      toast({ title: storageMessage, variant: 'destructive' });
      return false;
    }
  }, [persist, read, storageMessage, toast]);

  // Other tabs never silently overwrite settings or their attempt/cooldown records.
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== key && event.key !== null) return;
      try {
        const next = decodeSecurityState(localStorage.getItem(key));
        if (next.pin?.hash !== stateRef.current.pin?.hash) setLocked(!!next.pin);
        stateRef.current = next;
        setState(next);
        setDamaged(false);
      } catch { setDamaged(true); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key]);

  // Synchronous DOM cover is deliberate: hidden-page React updates may be deferred.
  useEffect(() => {
    const hide = () => {
      document.documentElement.setAttribute('data-device-privacy', '');
      try { sessionStorage.setItem(`${key}.privacy`, '1'); } catch { /* CSS cover remains active */ }
      setCovered(true);
    };
    const visibility = () => { if (document.visibilityState === 'hidden') hide(); };
    if (initial.covered || document.visibilityState === 'hidden') hide();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', hide);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', hide);
      document.documentElement.removeAttribute('data-device-privacy');
    };
  }, [key, initial.covered]);

  const lockNow = useCallback(() => {
    if (stateRef.current.pin) {
      setLocked(true); setWarning(false); setPin(''); setError('');
    }
  }, []);
  const stay = () => { lastActivity.current = Date.now(); setWarning(false); };

  useEffect(() => {
    if (!state.pin || !state.idleMinutes || locked) return;
    const timeout = state.idleMinutes * 60_000;
    let lastGesture = Number.NEGATIVE_INFINITY;
    const activity = (event: Event) => {
      if (warning || covered || document.visibilityState !== 'visible') return;
      const timestamp = Date.now();
      if (!isUserIdleActivity(event, timestamp, lastGesture)) return;
      if (event.type !== 'scroll') lastGesture = timestamp;
      // Wheel/touch/drag streams only update the clock four times a second.
      if (timestamp - lastActivity.current >= 250) lastActivity.current = timestamp;
    };
    const check = () => {
      const elapsed = Date.now() - lastActivity.current;
      if (elapsed >= timeout) lockNow();
      else if (elapsed >= timeout - 20_000) setWarning(true);
    };
    // Capture includes non-bubbling scrolls in portalled Radix sheets/inner scrollers.
    const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchmove', 'scroll'] as const;
    for (const event of activityEvents) window.addEventListener(event, activity, { passive: true, capture: true });
    document.addEventListener('visibilitychange', check);
    window.addEventListener('pageshow', check);
    const timer = window.setInterval(check, 1000);
    return () => {
      clearInterval(timer);
      for (const event of activityEvents) window.removeEventListener(event, activity, true);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('pageshow', check);
    };
  }, [state.pin, state.idleMinutes, locked, warning, covered, lockNow]);

  useEffect(() => {
    setNow(Date.now());
    if (!state.cooldownUntil) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.cooldownUntil]);

  /** Uses Web Locks when available to serialize PIN attempts across same-origin tabs. */
  const pinOperation = async (operation: () => Promise<boolean>): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true; setBusy(true); setError('');
    try {
      return navigator.locks
        ? await navigator.locks.request(`${key}.pin-check`, operation)
        : await operation();
    } catch {
      setError(t('Could not check or save this device PIN. Secure browser storage and WebCrypto are required. You can still sign out.', 'تعذّر التحقق من رمز الجهاز أو حفظه. يلزم تخزين المتصفح وWebCrypto الآمن. يمكنك تسجيل الخروج.'));
      return false;
    } finally { inFlight.current = false; setBusy(false); }
  };
  const checkCurrent = async (current: string): Promise<boolean> => {
    const latest = read();
    if (!latest.pin) return true;
    if (remainingCooldown(latest, Date.now())) {
      stateRef.current = latest; setState(latest); setNow(Date.now());
      setError(t('Take a moment, then try again when the countdown ends.', 'انتظر قليلاً ثم حاول بعد انتهاء العد التنازلي.'));
      return false;
    }
    persist(reserveAttempt(latest, Date.now()));
    if (!await verifyPin(current, latest.pin)) {
      setError(t('That PIN did not match. Please try again.', 'الرمز غير مطابق. حاول مجدداً.'));
      return false;
    }
    persist({ ...read(), attempts: 0, cooldownUntil: 0 });
    return true;
  };
  const savePin = (next: string | null, current = '') => pinOperation(async () => {
    if (!await checkCurrent(current)) return false;
    const pinHash = next === null ? null : await hashPin(next);
    persist({ ...read(), pin: pinHash, attempts: 0, cooldownUntil: 0 });
    lastActivity.current = Date.now();
    setWarning(false); setLocked(false);
    return true;
  });
  const unlock = async () => {
    const candidate = pin;
    setPin('');
    await pinOperation(async () => {
      if (!await checkCurrent(candidate)) return false;
      setLocked(false); lastActivity.current = Date.now();
      return true;
    });
  };
  const resetBySignOut = async () => {
    setError('');
    try {
      // The local reset is ONLY performed after the existing real logout succeeds.
      await logout.mutateAsync();
    } catch {
      setError(t('Could not sign out. Check your connection and retry; your device lock is unchanged.', 'تعذّر تسجيل الخروج. تحقق من الاتصال وحاول مجدداً؛ قفل الجهاز لم يتغيّر.'));
      return;
    }
    try {
      localStorage.removeItem(key);
      localStorage.removeItem(`sfos.hideBalance.${accountId}`);
      sessionStorage.removeItem(`${key}.privacy`);
    } catch { /* Real sign-out must never be blocked by inaccessible local storage. */ }
    qc.clear();
    navigate('/login', { replace: true });
  };
  const resume = () => {
    document.documentElement.removeAttribute('data-device-privacy');
    try { sessionStorage.removeItem(`${key}.privacy`); } catch { /* not required to return */ }
    setCovered(false);
    // Documented signal for confidential views (parent-freshness.ts) to revalidate. No auth effect.
    window.dispatchEvent(new CustomEvent('sfos:privacy-resume'));
    const current = stateRef.current;
    if (current.pin && current.idleMinutes && Date.now() - lastActivity.current >= current.idleMinutes * 60_000) lockNow();
  };
  const cooldownSeconds = remainingCooldown(state, now);
  const value: DeviceSecurity = {
    hideBalances: state.hideBalances,
    setHideBalances: (hidden) => { preference({ hideBalances: hidden }); },
    confirmationThreshold: { minor: state.thresholdMinor, currency: 'ILS' },
    setConfirmationThreshold: (minor) => Number.isSafeInteger(minor) && minor >= 0 && preference({ thresholdMinor: minor }),
    lockEnabled: !!state.pin, idleMinutes: state.idleMinutes,
    setIdleMinutes: (minutes) => {
      if (state.pin && [0, 1, 5, 15].includes(minutes) && preference({ idleMinutes: minutes })) stay();
    },
    savePin, lockNow, cooldownSeconds, busy, error, clearError: () => setError(''),
  };
  return <SecurityContext.Provider value={value}>
    {/* Unmount protected UI while locked: never leave sensitive dialogs or focusable portals behind. */}
    {!locked && !damaged ? <div inert={covered || undefined}>{children}</div> : null}
    {(locked || damaged) && !covered && <BlockingDialog title={t('Your space, paused', 'مساحتك متوقفة مؤقتاً')} description={t('A convenience lock on this device — not a replacement for your account login.', 'قفل للراحة على هذا الجهاز — لا يحل محل تسجيل الدخول إلى حسابك.')} dir={dir}>
      <LockKeyhole className="mx-auto size-9 text-gold-ink" aria-hidden />
      {damaged ? <p role="alert" className="text-sm">{t('Device preferences cannot be read. Sign out to reset them, then sign in with your account password.', 'تعذّرت قراءة تفضيلات الجهاز. سجّل الخروج لإعادة ضبطها، ثم ادخل بكلمة مرور حسابك.')}</p>
        : <PinKeypad value={pin} onChange={setPin} onSubmit={() => void unlock()} label={t('Device PIN', 'رمز الجهاز')} submitLabel={busy ? t('Checking…', 'جارٍ التحقق…') : t('Unlock', 'فتح القفل')} disabled={busy || cooldownSeconds > 0 || logout.isPending} />}
      <Cooldown seconds={cooldownSeconds} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">{t('Forgot your PIN? Sign out to reset local security preferences. Your account password is required to sign in again.', 'نسيت الرمز؟ سجّل الخروج لإعادة ضبط تفضيلات الأمان المحلية. ستحتاج كلمة مرور حسابك للدخول مجدداً.')}</p>
      <Button variant="outline" disabled={busy || logout.isPending} data-testid="button-security-signout-reset" onClick={() => void resetBySignOut()}>{logout.isPending ? t('Signing out…', 'جارٍ تسجيل الخروج…') : t('Sign out & reset device preferences', 'تسجيل الخروج وإعادة ضبط تفضيلات الجهاز')}</Button>
    </BlockingDialog>}
    {warning && !locked && !covered && <BlockingDialog title={t('Still there?', 'هل ما زلت هنا؟')} description={t('Your device lock will pause this screen shortly. Stay to keep going.', 'سيوقف قفل الجهاز هذه الشاشة قريباً. اختر البقاء للمتابعة.')} dir={dir}>
      <Button data-testid="button-security-stay" onClick={stay}>{t('I’m still here', 'ما زلت هنا')}</Button>
      <Button variant="outline" data-testid="button-security-lock-warning" onClick={lockNow}>{t('Lock now', 'القفل الآن')}</Button>
    </BlockingDialog>}
    {createPortal(<div className="security-privacy" dir={dir} data-testid="cover-device-privacy" aria-hidden>
      <div className="max-w-sm space-y-5 text-center">
        <ShieldCheck className="mx-auto size-12 text-gold-ink" aria-hidden />
        <p className="security-privacy-brand text-2xl">{t('Student Financial OS', 'النظام المالي للطلاب')}</p>
      </div>
    </div>, document.body)}
    {covered && <BlockingDialog privacy title={t('Student Financial OS', 'النظام المالي للطلاب')} description={t('Your screen is covered while you’re away.', 'شاشتك مغطاة أثناء غيابك.')} dir={dir}>
      <ShieldCheck className="mx-auto size-12 text-gold-ink" aria-hidden />
      <Button data-testid="button-security-resume" onClick={resume}>{t('Return to my space', 'العودة إلى مساحتي')}</Button>
    </BlockingDialog>}
  </SecurityContext.Provider>;
}

function BlockingDialog({ title, description, children, dir, privacy = false }: { title: string; description: string; children: ReactNode; dir: 'ltr' | 'rtl'; privacy?: boolean }) {
  useKeyboardInset();
  return <DialogPrimitive.Root open modal>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={`fixed inset-0 bg-background ${privacy ? 'z-[260]' : 'z-[210]'}`} />
      <DialogPrimitive.Content dir={dir} className={`security-dialog-layout fixed inset-x-4 mx-auto grid max-w-sm -translate-y-1/2 gap-4 overflow-y-auto rounded-card border bg-background p-5 shadow-lg ${privacy ? 'z-[270]' : 'security-blocking-content'}`}
        onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogPrimitive.Title className="type-title">{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

export function Cooldown({ seconds }: { seconds: number }) {
  const t = useTx();
  if (!seconds) return null;
  return <p role="status" data-testid="status-pin-cooldown" className="text-sm text-muted-foreground">{t(`Let’s pause. Try again in ${seconds} seconds.`, `لننتظر قليلاً. حاول مجدداً بعد ${seconds} ثانية.`)}</p>;
}