import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/shell/app-shell';
import { AppErrorFallback } from '@/components/states/app-error-fallback';
import { I18nProvider } from '@/features/i18n/i18n-provider';
import { ThemeProvider } from '@/features/theme/theme-provider';
import { PreviewProvider } from '@/features/preferences/preview-provider';
import { NAV_ITEMS } from '@/features/navigation/nav-config';
import HomePage from '@/pages/home';
import AccountHome from '@/pages/account-home';
import AuthPage from '@/pages/auth';
import OnboardingPage from '@/pages/onboarding';
import { SessionGate } from '@/features/auth/account';
import FoundationPage from '@/pages/foundation';
import AppearancePage from '@/pages/appearance';
import NotImplementedPage from '@/pages/not-implemented';
import NotFound from '@/pages/not-found';
import MoneyPage from '@/pages/money';
import TransactionsPage from '@/pages/transactions';
import TransactionDetailPage from '@/pages/transaction-detail';
import CampusPage from '@/pages/campus';
import AdminCampusPage from '@/pages/admin-campus';
import PlanPage from '@/pages/plan';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const FUTURE_ROUTES = NAV_ITEMS.filter((i) => !i.implemented);

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={AccountHome} />
        <Route path="/onboarding"><OnboardingPage /></Route>
        <Route path="/profile"><OnboardingPage editing /></Route>
        <Route path="/foundation/home" component={HomePage} />
        <Route path="/foundation" component={FoundationPage} />
        <Route path="/appearance" component={AppearancePage} />
        <Route path="/money" component={MoneyPage} />
        <Route path="/transactions" component={TransactionsPage} />
        <Route path="/transactions/:id" component={TransactionDetailPage} />
        <Route path="/campus" component={CampusPage} />
        <Route path="/plan" component={PlanPage} />
        <Route path="/admin/institutions" component={AdminCampusPage} />
        {FUTURE_ROUTES.map((item) => (
          <Route key={item.id} path={item.path}>
            <NotImplementedPage item={item} />
          </Route>
        ))}
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <ErrorBoundary resetKey={location} FallbackComponent={AppErrorFallback}>
      {children}
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <I18nProvider>
        <ThemeProvider>
          <PreviewProvider>
            <QueryClientProvider client={queryClient}>
              <TooltipProvider>
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                  <SessionGate>
                    <Switch>
                      <Route path="/login"><AuthPage signup={false} /></Route>
                      <Route path="/signup"><AuthPage signup /></Route>
                      <Route>
                        <AppShell><Router /></AppShell>
                      </Route>
                    </Switch>
                  </SessionGate>
                </WouterRouter>
                <Toaster />
              </TooltipProvider>
            </QueryClientProvider>
          </PreviewProvider>
        </ThemeProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default App;
