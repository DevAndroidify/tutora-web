import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@tutora/api-client';
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { SessionState, SessionStore } from './session';

const SessionContext = createContext<SessionStore | null>(null);

/** Query defaults: no retries for 4xx (the server said no), a few for network/5xx. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, err) =>
          !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export function AppProviders({
  session,
  queryClient,
  children,
}: {
  session: SessionStore;
  queryClient: QueryClient;
  children: ReactNode;
}) {
  useEffect(() => {
    if (session.getState().status === 'loading') void session.restore();
  }, [session]);
  return (
    <SessionContext.Provider value={session}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionContext.Provider>
  );
}

export function useSessionStore(): SessionStore {
  const store = useContext(SessionContext);
  if (!store) throw new Error('useSessionStore must be used inside <AppProviders>');
  return store;
}

/** Current session state; re-renders on sign-in/out. */
export function useSession(): SessionState {
  const store = useSessionStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** Human message for a sign-in that ended without the user asking. */
export function signedOutMessage(reason: string | undefined): string | null {
  switch (reason) {
    case 'REFRESH_TOKEN_REUSED':
      return 'For your safety you were signed out because this sign-in was used somewhere else. Please sign in again.';
    case 'signedOutElsewhere':
      return 'You signed out in another tab.';
    case 'INVALID_REFRESH_TOKEN':
      return 'Your session expired. Please sign in again.';
    default:
      return null;
  }
}
