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
import { unwrap } from '@tutora/api-client';
import {
  APP_URLS,
  LoginForm,
  RegisterForm,
  ReportButton,
  RequireSession,
  useSession,
  useSessionStore,
} from '@tutora/core';
import {
  ExplorePage,
  SkillPage,
  TutorPage,
  TutorsPage,
  validateExploreSearch,
  validateTutorsSearch,
} from '@tutora/core/catalog';
import { AppShell, Button, buttonClass, navLinkClass } from '@tutora/ui';
import { useState, type ReactNode } from 'react';
import { api } from './api';
import { AccountPage } from './pages/AccountPage';
import { HomePage } from './pages/HomePage';
import { NewRequestPage } from './pages/NewRequestPage';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { RequestsPage } from './pages/RequestsPage';

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
      appName="Learn"
      strip="Any skill · Verified tutors · Live sessions"
      nav={
        <>
          <Link to="/" className={navLinkClass} activeOptions={{ exact: true }}>
            Front page
          </Link>
          <Link to="/explore" className={navLinkClass}>
            Explore
          </Link>
          <Link to="/tutors" className={navLinkClass}>
            Tutors
          </Link>
          {signedIn && (
            <>
              <Link to="/requests" className={navLinkClass}>
                My requests
              </Link>
              <Link to="/account" className={navLinkClass}>
                Account
              </Link>
            </>
          )}
        </>
      }
      account={
        signedIn ? (
          <>
            <a href={APP_URLS.tutor} className="link hidden text-xs sm:inline">
              Teach on Tutora
            </a>
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
        ) : (
          <>
            <Link to="/login" className={buttonClass('ghost')}>
              Sign in
            </Link>
            <Link to="/register" className={buttonClass('primary')}>
              Join free
            </Link>
          </>
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

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage });

const exploreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore',
  validateSearch: validateExploreSearch,
  component: function Explore() {
    const navigate = useNavigate();
    return (
      <ExplorePage
        search={exploreRoute.useSearch()}
        onSearch={(search) => void navigate({ to: '/explore', search })}
      />
    );
  },
});

const skillRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/skills/$slug',
  component: function Skill() {
    const { slug } = skillRoute.useParams();
    return (
      <SkillPage
        slug={slug}
        cta={(skill) => (
          <>
            <Link
              to="/requests/new"
              search={{ skill: skill.slug }}
              className={buttonClass('primary')}
            >
              Post a request for {skill.name}
            </Link>
            <Link to="/tutors" search={{ skill: skill.id }} className={buttonClass('secondary')}>
              See tutors
            </Link>
          </>
        )}
      />
    );
  },
});

const tutorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tutors',
  validateSearch: validateTutorsSearch,
  component: function Tutors() {
    const navigate = useNavigate();
    return (
      <TutorsPage
        search={tutorsRoute.useSearch()}
        onSearch={(search) => void navigate({ to: '/tutors', search })}
      />
    );
  },
});

const tutorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tutors/$userId',
  component: function Tutor() {
    const { userId } = tutorRoute.useParams();
    const session = useSession();
    return (
      <TutorPage
        userId={userId}
        actions={(t) =>
          session.status === 'signedIn' ? (
            <ReportButton
              subjectUserId={t.userId}
              subjectName={t.fullName}
              entityType="TUTOR_PROFILE"
              entityId={t.userId}
              submit={(body) => unwrap(api.POST('/student/reports', { body }))}
            />
          ) : null
        }
      />
    );
  },
});

const requestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/requests',
  component: () => (
    <Protected>
      <RequestsPage />
    </Protected>
  ),
});

const newRequestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/requests/new',
  validateSearch: (s: Record<string, unknown>): { skill?: string } => ({
    skill: typeof s.skill === 'string' && s.skill ? s.skill : undefined,
  }),
  component: function NewRequest() {
    const { skill } = newRequestRoute.useSearch();
    return (
      <Protected>
        <NewRequestPage skillSlug={skill} />
      </Protected>
    );
  },
});

const requestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/requests/$id',
  component: function Request() {
    const { id } = requestRoute.useParams();
    return (
      <Protected>
        <RequestDetailPage id={id} />
      </Protected>
    );
  },
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
        title="Sign in to Tutora"
        subtitle="One account works for learning and teaching."
        onSuccess={() => void navigate({ to: safeRedirect(redirect) })}
        footer={
          <>
            New here?{' '}
            <Link to="/register" className="link">
              Create an account
            </Link>
          </>
        }
      />
    );
  },
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: function RegisterPage() {
    const navigate = useNavigate();
    const session = useSession();
    if (session.status === 'signedIn') return <Navigate to="/" />;
    return (
      <RegisterForm
        title="Join Tutora"
        subtitle="Already teaching on Tutora? Sign in with the same account instead."
        onSuccess={() => void navigate({ to: '/' })}
        footer={
          <>
            Have an account?{' '}
            <Link to="/login" className="link">
              Sign in
            </Link>
          </>
        }
      />
    );
  },
});

export const routeTree = rootRoute.addChildren([
  homeRoute,
  exploreRoute,
  skillRoute,
  tutorsRoute,
  tutorRoute,
  requestsRoute,
  newRequestRoute,
  requestRoute,
  accountRoute,
  loginRoute,
  registerRoute,
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
