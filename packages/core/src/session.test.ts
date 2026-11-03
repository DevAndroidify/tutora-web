import { ApiError } from '@tutora/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionStore, type AuthApi, type AuthResult } from './session';

const user = {
  id: 'u1',
  email: 'a@example.com',
  fullName: 'Asha',
  accountType: 'MEMBER',
  staffRole: null,
  status: 'ACTIVE',
} as const;
const bundle = (n: number) => ({
  accessToken: `access-${n}`,
  accessTokenExpiresIn: 900,
  refreshToken: `refresh-${n}`,
});

function makeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  let n = 1;
  return {
    login: vi.fn(async (): Promise<AuthResult> => ({ ...bundle(1), user })),
    refresh: vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return bundle(++n);
    }),
    logout: vi.fn(async () => undefined),
    me: vi.fn(async () => user),
    ...overrides,
  };
}

afterEach(() => localStorage.clear());

describe('SessionStore', () => {
  it('stores only the refresh token and keeps the access token in memory', async () => {
    const store = new SessionStore('student');
    store.attach(makeApi());
    await store.login('a@example.com', 'pw');
    expect(store.getState()).toEqual({ status: 'signedIn', user });
    expect(store.getAccessToken()).toBe('access-1');
    expect(localStorage.getItem('tutora.student.refreshToken')).toBe('refresh-1');
    expect(JSON.stringify(localStorage)).not.toContain('access-1');
  });

  it('shares one refresh between concurrent callers (rotating tokens must not be reused)', async () => {
    const api = makeApi();
    const store = new SessionStore('tutor');
    store.attach(api);
    await store.login('a@example.com', 'pw');
    const results = await Promise.all([store.refresh(), store.refresh(), store.refresh()]);
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(api.refresh).toHaveBeenCalledWith('refresh-1');
    expect(results).toEqual(['access-2', 'access-2', 'access-2']);
    expect(localStorage.getItem('tutora.tutor.refreshToken')).toBe('refresh-2');
  });

  it('signs out with the reason when the refresh token was reused', async () => {
    const store = new SessionStore('student');
    store.attach(
      makeApi({
        refresh: vi.fn(async () =>
          Promise.reject(new ApiError(401, 'REFRESH_TOKEN_REUSED', 'Reused')),
        ),
      }),
    );
    localStorage.setItem('tutora.student.refreshToken', 'stale');
    await store.restore();
    expect(store.getState()).toEqual({ status: 'signedOut', reason: 'REFRESH_TOKEN_REUSED' });
    expect(localStorage.getItem('tutora.student.refreshToken')).toBeNull();
  });

  it('keeps the refresh token on network errors so a retry can succeed', async () => {
    const store = new SessionStore('student');
    store.attach(
      makeApi({
        refresh: vi.fn(async () => Promise.reject(ApiError.network(new TypeError('offline')))),
      }),
    );
    localStorage.setItem('tutora.student.refreshToken', 'keep-me');
    expect(await store.refresh()).toBeNull();
    expect(localStorage.getItem('tutora.student.refreshToken')).toBe('keep-me');
  });

  it('restores a stored session on start and signs out cleanly', async () => {
    const api = makeApi();
    const store = new SessionStore('admin');
    store.attach(api);
    localStorage.setItem('tutora.admin.refreshToken', 'refresh-1');
    await store.restore();
    expect(store.getState().status).toBe('signedIn');
    await store.logout();
    expect(api.logout).toHaveBeenCalledWith('refresh-2');
    expect(store.getState().status).toBe('signedOut');
    expect(store.getAccessToken()).toBeNull();
  });

  it('keeps apps separate', () => {
    localStorage.setItem('tutora.student.refreshToken', 'x');
    const tutor = new SessionStore('tutor');
    tutor.attach(makeApi());
    void tutor.restore();
    expect(tutor.getState().status).toBe('signedOut');
    expect(localStorage.getItem('tutora.student.refreshToken')).toBe('x');
  });
});
