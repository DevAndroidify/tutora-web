import { describe, expect, it, vi } from 'vitest';
import { authFetch, unwrap } from './client';
import { ApiError, toApiError } from './errors';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const expired = () =>
  json(401, { error: { code: 'INVALID_ACCESS_TOKEN', message: 'Expired', details: {} } });

describe('authFetch', () => {
  it('adds the bearer token, but never on auth routes', async () => {
    const seen: Array<string | null> = [];
    const base = vi.fn(async (r: Request) => {
      seen.push(r.headers.get('authorization'));
      return json(200, {});
    });
    const f = authFetch({
      baseUrl: '',
      fetch: base as typeof fetch,
      auth: { getAccessToken: () => 'tok', refresh: async () => null },
    });
    await f('http://x/student/me');
    await f('http://x/student/auth/login', { method: 'POST' });
    expect(seen).toEqual(['Bearer tok', null]);
  });

  it('refreshes once on an expired token and retries with the new one', async () => {
    let token = 'old';
    const refresh = vi.fn(async () => (token = 'new'));
    const base = vi.fn(async (r: Request) =>
      r.headers.get('authorization') === 'Bearer new' ? json(200, { ok: true }) : expired(),
    );
    const f = authFetch({
      baseUrl: '',
      fetch: base as typeof fetch,
      auth: { getAccessToken: () => token, refresh },
    });
    const res = await f('http://x/student/me');
    expect(res.status).toBe(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it('returns the original 401 when the session cannot be refreshed', async () => {
    const base = vi.fn(async () => expired());
    const f = authFetch({
      baseUrl: '',
      fetch: base as typeof fetch,
      auth: { getAccessToken: () => 'old', refresh: async () => null },
    });
    expect((await f('http://x/student/me')).status).toBe(401);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('does not refresh on other 401s or 403s', async () => {
    const refresh = vi.fn(async () => 'new');
    const base = vi.fn(async () =>
      json(403, { error: { code: 'FORBIDDEN', message: 'No', details: {} } }),
    );
    const f = authFetch({
      baseUrl: '',
      fetch: base as typeof fetch,
      auth: { getAccessToken: () => 't', refresh },
    });
    await f('http://x/admin/users');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('turns network failures into NETWORK_ERROR', async () => {
    const f = authFetch({
      baseUrl: '',
      fetch: (async () => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch,
    });
    await expect(f('http://x/public/skills')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
  });
});

describe('errors', () => {
  it('parses the backend error body including field errors', () => {
    const e = toApiError(400, {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Invalid',
        details: { fields: { email: ['must be an email'] } },
        requestId: 'req_9',
      },
    });
    expect(e).toBeInstanceOf(ApiError);
    expect(e.code).toBe('VALIDATION_FAILED');
    expect(e.fieldErrors).toEqual({ email: ['must be an email'] });
    expect(e.requestId).toBe('req_9');
  });

  it('falls back for non-standard bodies', () => {
    expect(toApiError(502, '<html>')).toMatchObject({ code: 'HTTP_502', status: 502 });
  });

  it('unwrap returns data or throws ApiError', async () => {
    const ok = Promise.resolve({ data: { a: 1 }, response: new Response(null, { status: 200 }) });
    await expect(unwrap<{ a: number }>(ok)).resolves.toEqual({ a: 1 });
    const bad = Promise.resolve({
      error: { error: { code: 'NOT_FOUND', message: 'Missing', details: {} } },
      response: new Response(null, { status: 404 }),
    });
    await expect(unwrap(bad)).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});
