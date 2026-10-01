import { lazy, Suspense, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/shell/app-shell';
import { Page } from '@/components/layout/page';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonRows } from '@/components/states/state-panel';
import { AppErrorFallback } from '@/components/states/app-error-fallback';
import { I18nProvider, useI18n } from '@/features/i18n/i18n-provider';
import { ThemeProvider } from '@/features/theme/theme-provider';
import { PreviewProvider } from '@/features/preferences/preview-provider';
import { DeviceSecurityProvider } from '@/features/security/device-security';
import { NAV_ITEMS } from '@/features/navigation/nav-config';
import AccountHome from '@/pages/account-home';
import AuthPage from '@/pages/auth';
import OnboardingPage from '@/pages/onboarding';
import { SessionGate } from '@/features/auth/account';
import AppearancePage from '@/pages/appearance';
import NotImplementedPage from '@/pages/not-implemented';
import NotFound from '@/pages/not-found';
import MoneyPage from '@/pages/money';
import TransactionsPage from '@/pages/transactions';
import TransactionDetailPage from '@/pages/transaction-detail';
import CampusPage from '@/pages/campus';
import AdminCampusPage from '@/pages/admin-campus';
import PlanPage from '@/pages/plan';
import GoalsPage from '@/pages/goals';
import GoalDetailPage from '@/pages/goal-detail';
import ParentFundPage from '@/pages/parent-fund';
import FamilyPage from '@/pages/family';
import ParentChildrenPage, { ParentChildDetailPage } from '@/pages/parent-children';
import ParentAllowancesPage from '@/pages/parent-allowances';
import ParentRequestsPage, { ParentRequestDetailPage } from '@/pages/parent-requests';
import LearnPage from '@/pages/learn';
import FamilyRequestsPage, { FamilyRequestDetailPage } from '@/pages/family-requests';

// Design/reference surfaces stay out of the ordinary account startup bundle.
const HomePage = lazy(() => import('@/pages/home'));
const FoundationPage = lazy(() => import('@/pages/foundation'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const FUTURE_ROUTES = NAV_ITEMS.filter((i) => !i.implemented);

function Router() {
  return (
    <RoutedErrorBoundary>
      <Suspense fallback={<RouteSkeleton />}>
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
          <Route path="/goals" component={GoalsPage} />
          <Route path="/goals/fund" component={ParentFundPage} />
          <Route path="/goals/:id" component={GoalDetailPage} />
          <Route path="/learn" component={LearnPage} />
          <Route path="/family" component={FamilyPage} />
          <Route path="/family/requests" component={FamilyRequestsPage} />
          <Route path="/family/requests/:id" component={FamilyRequestDetailPage} />
          <Route path="/parent/children" component={ParentChildrenPage} />
          <Route path="/parent/children/:id" component={ParentChildDetailPage} />
          <Route path="/parent/allowances" component={ParentAllowancesPage} />
          <Route path="/parent/requests" component={ParentRequestsPage} />
          <Route path="/parent/requests/:id" component={ParentRequestDetailPage} />
          <Route path="/admin/institutions" component={AdminCampusPage} />
          {FUTURE_ROUTES.map((item) => (
            <Route key={item.id} path={item.path}>
              <NotImplementedPage item={item} />
            </Route>
          ))}
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </RoutedErrorBoundary>
  );
}

function RouteSkeleton() {
  const { t } = useI18n();
  return <Page>
    <div className="mb-8 space-y-3" data-testid="state-route-loading">
      <Skeleton className="h-9 w-2/3 max-w-sm" />
      <Skeleton className="h-4 w-4/5 max-w-lg" />
    </div>
    <SkeletonRows rows={5} label={t('fd.state.loadingLabel')} />
  </Page>;
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
                        <DeviceSecurityProvider><AppShell><Router /></AppShell></DeviceSecurityProvider>
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
