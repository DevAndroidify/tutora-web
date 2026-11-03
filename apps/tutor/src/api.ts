import { createApiClient, unwrap, type PublicPaths, type TutorPaths } from '@tutora/api-client';
import {
  API_BASE_URL,
  SessionStore,
  type AuthResult,
  type SessionUser,
  type TokenBundle,
} from '@tutora/core';

/** This app's sign-in. Tokens from it only work on /tutor routes. */
export const session = new SessionStore('tutor');

export const api = createApiClient<TutorPaths & PublicPaths>({
  baseUrl: API_BASE_URL,
  auth: { getAccessToken: session.getAccessToken, refresh: session.refresh },
});

session.attach({
  login: (email, password) =>
    unwrap<AuthResult>(api.POST('/tutor/auth/login', { body: { email, password } })),
  register: (body) => unwrap<AuthResult>(api.POST('/tutor/auth/register', { body })),
  refresh: (refreshToken) =>
    unwrap<TokenBundle>(api.POST('/tutor/auth/refresh', { body: { refreshToken } })),
  logout: async (refreshToken) => {
    await unwrap<unknown>(api.POST('/tutor/auth/logout', { body: { refreshToken } }));
  },
  me: () => unwrap<SessionUser>(api.GET('/tutor/me')),
});
