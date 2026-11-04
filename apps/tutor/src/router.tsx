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
  NotificationBell,
  ReportButton,
  lazyPage,
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
import { AppShell, Button, buttonClass, Loading, navLinkClass } from '@tutora/ui';
import { Suspense, useState, type ReactNode } from 'react';
import { api, notificationsApi } from './api';

const AccountPage = lazyPage(() => import('./pages/AccountPage'), 'AccountPage');
const BidsPage = lazyPage(() => import('./pages/BidsPage'), 'BidsPage');
const MarketplacePage = lazyPage(() => import('./pages/MarketplacePage'), 'MarketplacePage');
const MarketRequestPage = lazyPage(() => import('./pages/MarketRequestPage'), 'MarketRequestPage');
const SessionPage = lazyPage(() => import('./pages/SessionPage'), 'SessionPage');
const SessionsPage = lazyPage(() => import('./pages/SessionsPage'), 'SessionsPage');
const DashboardPage = lazyPage(() => import('./pages/DashboardPage'), 'DashboardPage');
const EarningsPage = lazyPage(() => import('./pages/EarningsPage'), 'EarningsPage');
const GroupsPage = lazyPage(() => import('./pages/GroupsPage'), 'GroupsPage');
const ProfilePage = lazyPage(() => import('./pages/ProfilePage'), 'ProfilePage');
const LoginForm = lazyPage(() => import('@tutora/core/auth-forms'), 'LoginForm');
const RegisterForm = lazyPage(() => import('@tutora/core/auth-forms'), 'RegisterForm');

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
      appName="Teach"
      strip="Get verified · Bid on requests · Teach live"
      nav={
        <>
          {signedIn && (
            <>
              <Link to="/" className={navLinkClass} activeOptions={{ exact: true }}>
                Desk
              </Link>
              <Link to="/requests" className={navLinkClass}>
                Requests
              </Link>
              <Link to="/groups" className={navLinkClass}>
                Groups
              </Link>
              <Link to="/bids" className={navLinkClass}>
                My bids
              </Link>
              <Link to="/sessions" className={navLinkClass}>
                Sessions
              </Link>
              <Link to="/earnings" className={navLinkClass}>
                Earnings
              </Link>
              <Link to="/profile" className={navLinkClass}>
                Profile &amp; skills
              </Link>
            </>
          )}
          <Link to="/explore" className={navLinkClass}>
            Skills
          </Link>
          {signedIn && (
            <Link to="/account" className={navLinkClass}>
              Account
            </Link>
          )}
        </>
      }
      account={
        signedIn ? (
          <>
            <a href={APP_URLS.student} className="link hidden text-xs sm:inline">
              Learn on Tutora
            </a>
            <span className="hidden text-muted md:inline">{session.user.fullName}</span>
            <NotificationBell
              api={notificationsApi}
              onOpen={(n) => {
                if (n.data.sessionId)
                  void navigate({ to: '/sessions/$id', params: { id: n.data.sessionId } });
                else if (n.data.requestId)
                  void navigate({ to: '/requests/$id', params: { id: n.data.requestId } });
              }}
            />
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
              Start teaching
            </Link>
          </>
        )
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

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <Protected>
      <DashboardPage />
    </Protected>
  ),
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  validateSearch: (s: Record<string, unknown>): { addSkill?: string } => ({
    addSkill: typeof s.addSkill === 'string' && s.addSkill ? s.addSkill : undefined,
  }),
  component: function Profile() {
    const { addSkill } = profileRoute.useSearch();
    return (
      <Protected>
        <ProfilePage addSkillSlug={addSkill} />
      </Protected>
    );
  },
});

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
          <Link to="/profile" search={{ addSkill: skill.slug }} className={buttonClass('primary')}>
            Teach {skill.name}
          </Link>
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
          session.status === 'signedIn' && session.user.id !== t.userId ? (
            <ReportButton
              subjectUserId={t.userId}
              subjectName={t.fullName}
              entityType="TUTOR_PROFILE"
              entityId={t.userId}
              submit={(body) => unwrap(api.POST('/tutor/reports', { body }))}
            />
          ) : null
        }
      />
    );
  },
});

const marketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/requests',
  component: () => (
    <Protected>
      <MarketplacePage />
    </Protected>
  ),
});

const marketRequestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/requests/$id',
  component: function MarketRequest() {
    const { id } = marketRequestRoute.useParams();
    return (
      <Protected>
        <MarketRequestPage id={id} />
      </Protected>
    );
  },
});

const bidsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bids',
  component: () => (
    <Protected>
      <BidsPage />
    </Protected>
  ),
});

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions',
  component: () => (
    <Protected>
      <SessionsPage />
    </Protected>
  ),
});

const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions/$id',
  component: function Session() {
    const { id } = sessionRoute.useParams();
    return (
      <Protected>
        <SessionPage id={id} />
      </Protected>
    );
  },
});

const groupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/groups',
  component: () => (
    <Protected>
      <GroupsPage />
    </Protected>
  ),
});

const earningsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/earnings',
  component: () => (
    <Protected>
      <EarningsPage />
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
        title="Sign in to Tutora Teach"
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
        title="Teach on Tutora"
        subtitle="Already learning on Tutora? Sign in with the same account instead."
        onSuccess={() => void navigate({ to: '/profile' })}
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
  profileRoute,
  marketRoute,
  marketRequestRoute,
  bidsRoute,
  groupsRoute,
  earningsRoute,
  sessionsRoute,
  sessionRoute,
  exploreRoute,
  skillRoute,
  tutorsRoute,
  tutorRoute,
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
