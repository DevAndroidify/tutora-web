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
import { LoginForm, RequireSession, useSession, useSessionStore } from '@tutora/core';
import { AppShell, Button } from '@tutora/ui';
import { useState, type ReactNode } from 'react';
import { AccountPage } from './pages/AccountPage';
import { HomePage } from './pages/HomePage';

/** Only same-app paths are allowed as a post-login redirect (no open redirects). */
export function safeRedirect(target: unknown): string {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) return '/';
  // Never bounce back to the auth pages themselves (that would nest redirects).
  return /^\/(login|register)(\/|\?|$)/.test(target) ? '/' : target;
}

const navLink =
  'rounded-md px-3 py-1.5 text-muted hover:text-text [&.active]:bg-bg [&.active]:text-text';

function RootLayout() {
  const session = useSession();
  const store = useSessionStore();
  const navigate = useNavigate();
  const signedIn = session.status === 'signedIn';
  return (
    <AppShell
      appName="Admin"
      nav={
        signedIn && (
          <>
            <Link to="/" className={navLink}>
              Home
            </Link>
            <Link to="/account" className={navLink}>
              Account
            </Link>
          </>
        )
      }
      account={
        signedIn ? (
          <>
            <span className="hidden text-muted sm:inline">{session.user.fullName}</span>
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
        ) : (
          <Link to="/login" className={navLink}>
            Sign in
          </Link>
        )
      }
    >
      <Outlet />
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

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <Protected>
      <HomePage />
    </Protected>
  ),
});

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account',
  component: () => (
    <Protected>
      <AccountPage />
    </Protected>
  ),
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
        title="Sign in to Tutora Admin"
        subtitle="Staff accounts only."
        onSuccess={() => void navigate({ to: safeRedirect(redirect) })}
      />
    );
  },
});

export const routeTree = rootRoute.addChildren([homeRoute, accountRoute, loginRoute]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
