import { createApiClient, unwrap, type PublicPaths, type StudentPaths } from '@tutora/api-client';
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

/** Live updates (bids, sessions, notifications) for this app's signed-in user. */
export const realtime = new RealtimeClient(session);

export const notificationsApi: NotificationsApi = {
  list: () => unwrap<AppNotification[]>(api.GET('/student/notifications')),
  markRead: (id) =>
    unwrap(api.POST('/student/notifications/{id}/read', { params: { path: { id } } })),
};

const path = (id: string) => ({ params: { path: { id } } });

export const sessionApi: SessionApi = {
  list: () => unwrap<SessionSeat[]>(api.GET('/student/sessions')),
  joinToken: (id) => unwrap<JoinToken>(api.POST('/student/sessions/{id}/join-token', path(id))),
  consent: (id, granted) =>
    unwrap<RecordingView>(
      api.POST('/student/sessions/{id}/consent', { ...path(id), body: { granted } }),
    ),
  recording: (id) => unwrap<RecordingView>(api.GET('/student/sessions/{id}/recording', path(id))),
  attendance: (id) =>
    unwrap<AttendanceRow[]>(api.GET('/student/sessions/{id}/attendance', path(id))),
  replay: (id) => unwrap<Replay>(api.GET('/student/sessions/{id}/replay', path(id))),
  search: (id, q) =>
    unwrap<ReplaySearch>(
      api.GET('/student/sessions/{id}/replay/search', { params: { path: { id }, query: { q } } }),
    ),
  modeEvent: (id, body) =>
    unwrap(api.POST('/student/sessions/{id}/mode-events', { ...path(id), body })),
  presignSnapshot: (id, body) =>
    unwrap<Presign>(
      api.POST('/student/sessions/{id}/whiteboard-snapshots/presign', { ...path(id), body }),
    ),
  saveSnapshot: (id, body) =>
    unwrap(api.POST('/student/sessions/{id}/whiteboard-snapshots', { ...path(id), body })),
};
