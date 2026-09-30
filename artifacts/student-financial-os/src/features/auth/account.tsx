import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, getGetMeQueryKey, useGetMe, useLogOut, type Account } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-provider';

const AccountContext = createContext<Account | null>(null);
export function useAccount() {
  const account = useContext(AccountContext);
  if (!account) throw new Error('Account requires a verified session');
  return account;
}
export function SessionGate({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { lang } = useI18n();
  const query = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 30_000 } });
  const publicRoute = location === '/login' || location === '/signup';
  const unauthenticated = query.error instanceof ApiError && query.error.status === 401;
  useEffect(() => {
    if (unauthenticated && !publicRoute) navigate('/login', { replace: true });
    if (query.data && publicRoute) navigate(query.data.onboardingCompleted ? '/' : '/onboarding', { replace: true });
    if (query.data && !query.data.onboardingCompleted && !publicRoute && location !== '/onboarding' && location !== '/profile') {
      navigate('/onboarding', { replace: true });
    }
  }, [unauthenticated, publicRoute, query.data, location, navigate]);
  if (query.isPending) return <div className="grid min-h-dvh place-items-center bg-background p-6 text-muted-foreground" role="status">{lang === 'ar' ? 'جارٍ التحقق من الجلسة…' : 'Checking your session…'}</div>;
  if (query.isError && !unauthenticated) return <div className="grid min-h-dvh place-items-center bg-background p-6"><div role="alert" className="space-y-4 text-center"><p>{lang === 'ar' ? 'تعذّر الاتصال. حاول مجدداً.' : 'Unable to connect. Please try again.'}</p><Button onClick={() => query.refetch()}>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</Button></div></div>;
  if (!query.data) return publicRoute ? <>{children}</> : null;
  if (publicRoute || (!query.data.onboardingCompleted && location !== '/onboarding' && location !== '/profile')) return null;
  return <AccountContext.Provider value={query.data}>{children}</AccountContext.Provider>;
}
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const account = useAccount();
  const { lang } = useI18n();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const logout = useLogOut({ mutation: { onSuccess: () => { qc.clear(); navigate('/login', { replace: true }); } } });
  if (compact) return <div className="flex min-w-0 items-center gap-1">
    <Link href="/profile" className="max-w-28 truncate rounded-lg px-2 py-2 text-xs font-semibold text-gold-ink">{account.name}</Link>
    <Button variant="ghost" size="sm" disabled={logout.isPending} onClick={() => logout.mutate()}>{lang === 'ar' ? 'خروج' : 'Log out'}</Button>
    {logout.isError && <span role="alert" className="sr-only">{lang === 'ar' ? 'تعذّر تسجيل الخروج' : 'Logout failed'}</span>}
  </div>;
  return <div className="flex min-w-0 flex-col gap-2 rounded-card bg-surface-sunken/60 p-3">
    <span className="truncate text-sm font-semibold">{account.name}</span>
    <span className="truncate text-xs text-muted-foreground" dir="ltr">{account.email}</span>
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/profile" className="rounded-lg px-2 py-2 text-xs font-semibold text-gold-ink hover:underline">{lang === 'ar' ? 'الملف الشخصي' : 'Profile'}</Link>
      <Button variant="ghost" size="sm" disabled={logout.isPending} onClick={() => logout.mutate()}>{lang === 'ar' ? 'تسجيل الخروج' : 'Log out'}</Button>
    </div>
    {logout.isError && <p role="alert" className="text-xs text-destructive">{lang === 'ar' ? 'تعذّر تسجيل الخروج. حاول مجدداً.' : 'Could not log out. Please try again.'}</p>}
  </div>;
}