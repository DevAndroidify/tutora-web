import { createApiClient, unwrap, type PublicPaths, type StudentPaths } from '@tutora/api-client';
import {
  API_BASE_URL,
  SessionStore,
  type AuthResult,
  type SessionUser,
  type TokenBundle,
} from '@tutora/core';

/** This app's sign-in. Tokens from it only work on /student routes. */
export const session = new SessionStore('student');

export const api = createApiClient<StudentPaths & PublicPaths>({
  baseUrl: API_BASE_URL,
  auth: { getAccessToken: session.getAccessToken, refresh: session.refresh },
});

session.attach({
  login: (email, password) =>
    unwrap<AuthResult>(api.POST('/student/auth/login', { body: { email, password } })),
  register: (body) => unwrap<AuthResult>(api.POST('/student/auth/register', { body })),
  refresh: (refreshToken) =>
    unwrap<TokenBundle>(api.POST('/student/auth/refresh', { body: { refreshToken } })),
  logout: async (refreshToken) => {
    await unwrap<unknown>(api.POST('/student/auth/logout', { body: { refreshToken } }));
  },
  me: () => unwrap<SessionUser>(api.GET('/student/me')),
});
