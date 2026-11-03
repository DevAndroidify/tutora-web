import { createApiClient, unwrap, type AdminPaths } from '@tutora/api-client';
import {
  API_BASE_URL,
  RealtimeClient,
  SessionStore,
  type AuthResult,
  type SessionUser,
  type TokenBundle,
} from '@tutora/core';

/** This app's sign-in. Tokens from it only work on /admin routes. */
export const session = new SessionStore('admin');

export const api = createApiClient<AdminPaths>({
  baseUrl: API_BASE_URL,
  auth: { getAccessToken: session.getAccessToken, refresh: session.refresh },
});

session.attach({
  login: (email, password) =>
    unwrap<AuthResult>(api.POST('/admin/auth/login', { body: { email, password } })),
  refresh: (refreshToken) =>
    unwrap<TokenBundle>(api.POST('/admin/auth/refresh', { body: { refreshToken } })),
  logout: async (refreshToken) => {
    await unwrap<unknown>(api.POST('/admin/auth/logout', { body: { refreshToken } }));
  },
  me: () => unwrap<SessionUser>(api.GET('/admin/me')),
});

/** Live updates: new cases, case changes, disputes and payment alerts. */
export const realtime = new RealtimeClient(session);
