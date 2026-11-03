import { createApiClient, unwrap, type PublicPaths, type TutorPaths } from '@tutora/api-client';
import {
  API_BASE_URL,
  RealtimeClient,
  SessionStore,
  type AppNotification,
  type AttendanceRow,
  type AuthResult,
  type JoinToken,
  type NotificationsApi,
  type Presign,
  type RecordingView,
  type Replay,
  type ReplaySearch,
  type SessionApi,
  type SessionSeat,
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

/** Live updates (bids, sessions, notifications) for this app's signed-in user. */
export const realtime = new RealtimeClient(session);

export const notificationsApi: NotificationsApi = {
  list: () => unwrap<AppNotification[]>(api.GET('/tutor/notifications')),
  markRead: (id) =>
    unwrap(api.POST('/tutor/notifications/{id}/read', { params: { path: { id } } })),
};

const path = (id: string) => ({ params: { path: { id } } });

export const sessionApi: SessionApi = {
  list: () => unwrap<SessionSeat[]>(api.GET('/tutor/sessions')),
  joinToken: (id) => unwrap<JoinToken>(api.POST('/tutor/sessions/{id}/join-token', path(id))),
  consent: (id, granted) =>
    unwrap<RecordingView>(
      api.POST('/tutor/sessions/{id}/consent', { ...path(id), body: { granted } }),
    ),
  recording: (id) => unwrap<RecordingView>(api.GET('/tutor/sessions/{id}/recording', path(id))),
  attendance: (id) => unwrap<AttendanceRow[]>(api.GET('/tutor/sessions/{id}/attendance', path(id))),
  replay: (id) => unwrap<Replay>(api.GET('/tutor/sessions/{id}/replay', path(id))),
  search: (id, q) =>
    unwrap<ReplaySearch>(
      api.GET('/tutor/sessions/{id}/replay/search', { params: { path: { id }, query: { q } } }),
    ),
  modeEvent: (id, body) =>
    unwrap(api.POST('/tutor/sessions/{id}/mode-events', { ...path(id), body })),
  presignSnapshot: (id, body) =>
    unwrap<Presign>(
      api.POST('/tutor/sessions/{id}/whiteboard-snapshots/presign', { ...path(id), body }),
    ),
  saveSnapshot: (id, body) =>
    unwrap(api.POST('/tutor/sessions/{id}/whiteboard-snapshots', { ...path(id), body })),
};
