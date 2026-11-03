import createClient, { type Client } from 'openapi-fetch';
import { ApiError, toApiError } from './errors';

export interface AuthHooks {
  /** Current access token, or null when signed out. */
  getAccessToken(): string | null;
  /**
   * Obtains a fresh access token (single-flight in the session store).
   * Returns null if the session cannot be refreshed; the caller then gets the original 401.
   */
  refresh(): Promise<string | null>;
}

export interface ApiClientOptions {
  /** '' in development (Vite proxies the API); the API origin in production. */
  baseUrl: string;
  auth?: AuthHooks;
  fetch?: typeof fetch;
}

/** Auth routes never carry or refresh a token. */
const isAuthRoute = (url: string) => /\/(student|tutor|admin)\/auth\//.test(url);

/**
 * fetch wrapper: adds the bearer token and, on a 401 for an expired/invalid token,
 * refreshes once and retries the request once.
 */
export function authFetch(options: ApiClientOptions): typeof fetch {
  // Resolve fetch per call, not at import time, so later instrumentation (or test mocks) is honoured.
  const base: typeof fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  return async (input, init) => {
    const request = new Request(input, init);
    const withToken = (token: string | null) => {
      const r = request.clone();
      if (token && !isAuthRoute(r.url)) r.headers.set('Authorization', `Bearer ${token}`);
      return r;
    };
    let response: Response;
    try {
      response = await base(withToken(options.auth?.getAccessToken() ?? null));
    } catch (err) {
      throw ApiError.network(err);
    }
    if (response.status !== 401 || !options.auth || isAuthRoute(request.url)) return response;

    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { error?: { code?: string } } | null;
    const code = body?.error?.code;
    if (code !== 'INVALID_ACCESS_TOKEN' && code !== 'UNAUTHENTICATED') return response;
    const fresh = await options.auth.refresh();
    if (!fresh) return response;
    try {
      return await base(withToken(fresh));
    } catch (err) {
      throw ApiError.network(err);
    }
  };
}

export function createApiClient<Paths extends object>(options: ApiClientOptions): Client<Paths> {
  return createClient<Paths>({ baseUrl: options.baseUrl, fetch: authFetch(options) });
}

/**
 * Turns an openapi-fetch result into data or a thrown ApiError, so callers (TanStack Query)
 * only ever see successful data or an ApiError.
 */
export async function unwrap<T>(
  promise: Promise<{ data?: unknown; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await promise;
  if (error !== undefined || !response.ok) throw toApiError(response.status, error);
  return data as T;
}
