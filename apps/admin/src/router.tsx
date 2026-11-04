import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Navigate,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { lazyPage, RequireSession, useSession, useSessionStore } from '@tutora/core';
import { AppShell, Button, Loading, navLinkClass } from '@tutora/ui';
import { Suspense, useState, type ComponentType, type ReactNode } from 'react';
import { AdminLive } from './live';
import type { MoneyTab } from './pages/MoneyPage';

const AccountPage = lazyPage(() => import('./pages/AccountPage'), 'AccountPage');
const CaseDetailPage = lazyPage(() => import('./pages/CaseDetailPage'), 'CaseDetailPage');
const CasesPage = lazyPage(() => import('./pages/CasesPage'), 'CasesPage');
const CatalogPage = lazyPage(() => import('./pages/CatalogPage'), 'CatalogPage');
const DeskPage = lazyPage(() => import('./pages/DeskPage'), 'DeskPage');
const DisputesPage = lazyPage(() => import('./pages/DisputesPage'), 'DisputesPage');
const MoneyPage = lazyPage(() => import('./pages/MoneyPage'), 'MoneyPage');
const SuggestionsPage = lazyPage(() => import('./pages/SuggestionsPage'), 'SuggestionsPage');
const VerificationPage = lazyPage(() => import('./pages/VerificationPage'), 'VerificationPage');
const LoginForm = lazyPage(() => import('@tutora/core/auth-forms'), 'LoginForm');

/** Only same-app paths are allowed as a post-login redirect (no open redirects). */
export function safeRedirect(target: unknown): string {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) return '/';
  // Never bounce back to the auth pages themselves (that would nest redirects).
  return /^\/(login|register)(\/|\?|$)/.test(target) ? '/' : target;
}

function RootLayout() {
  const session = useSession();
  const store = useSessionStore();
  const navigate = useNavigate();
  const signedIn = session.status === 'signedIn';
  return (
    <AppShell
      appName="Control room"
      alertLabel
      strip="Staff only · Every action is audited"
      nav={
        signedIn && (
          <>
            <Link to="/" className={navLinkClass} activeOptions={{ exact: true }}>
              Desk
            </Link>
            <Link to="/verification" className={navLinkClass}>
              Verification
            </Link>
            <Link to="/catalog" className={navLinkClass} activeOptions={{ exact: true }}>
              Catalog
            </Link>
            <Link to="/catalog/suggestions" className={navLinkClass}>
              Suggestions
            </Link>
            <Link to="/cases" className={navLinkClass}>
              Trust &amp; safety
            </Link>
            <Link to="/money" className={navLinkClass}>
              Money
            </Link>
            <Link to="/disputes" className={navLinkClass}>
              Disputes
            </Link>
            <Link to="/account" className={navLinkClass}>
              Account
            </Link>
          </>
        )
      }
      account={
        signedIn ? (
          <>
            <AdminLive />
            <span className="hidden text-muted md:inline">{session.user.fullName}</span>
            <Button
              variant="secondary"
              onClick={async () => {
                await store.logout();
                await navigate({ to: '/login' });
              }}
            >
              Sign out
            </Button>
          </>
        ) : null
      }
    >
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

function Protected({ children }: { children: ReactNode }) {
  // Capture where the visitor was going once: this element stays mounted while the redirect runs.
  const current = useRouterState({ select: (s) => s.location.href });
  const [href] = useState(current);
  return (
    <RequireSession signedOut={<Navigate to="/login" search={{ redirect: href }} />}>
      {children}
    </RequireSession>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });

const protect = (Component: ComponentType) =>
  function ProtectedPage() {
    return (
      <Protected>
        <Component />
      </Protected>
    );
  };

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: protect(DeskPage),
});
const verificationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/verification',
  component: protect(VerificationPage),
});
const catalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/catalog',
  component: protect(CatalogPage),
});
const suggestionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/catalog/suggestions',
  component: protect(SuggestionsPage),
});
const casesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cases',
  component: protect(CasesPage),
});
const MONEY_TABS: MoneyTab[] = ['payments', 'payouts', 'books', 'connectivity'];
const moneyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/money',
  validateSearch: (s: Record<string, unknown>): { tab?: MoneyTab } => ({
    tab: MONEY_TABS.includes(s.tab as MoneyTab) ? (s.tab as MoneyTab) : undefined,
  }),
  component: function Money() {
    const { tab } = moneyRoute.useSearch();
    const navigate = useNavigate();
    return (
      <Protected>
        <MoneyPage
          tab={tab ?? 'payments'}
          onTab={(t) => void navigate({ to: '/money', search: { tab: t } })}
        />
      </Protected>
    );
  },
});
const disputesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/disputes',
  component: protect(DisputesPage),
});

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account',
  component: protect(AccountPage),
});

const caseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cases/$id',
  component: function Case() {
    const { id } = caseRoute.useParams();
    return (
      <Protected>
        <CaseDetailPage id={id} />
      </Protected>
    );
  },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === 'string' ? s.redirect : undefined,
  }),
  component: function LoginPage() {
    const { redirect } = loginRoute.useSearch();
    const navigate = useNavigate();
    const session = useSession();
    if (session.status === 'signedIn') return <Navigate to={safeRedirect(redirect)} />;
    return (
      <LoginForm
        title="Control room sign-in"
        subtitle="Staff accounts only."
        onSuccess={() => void navigate({ to: safeRedirect(redirect) })}
      />
    );
  },
});

export const routeTree = rootRoute.addChildren([
  homeRoute,
  verificationRoute,
  catalogRoute,
  suggestionsRoute,
  casesRoute,
  caseRoute,
  moneyRoute,
  disputesRoute,
  accountRoute,
  loginRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
