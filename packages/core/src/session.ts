import { ApiError } from '@tutora/api-client';

export type AppName = 'student' | 'tutor' | 'admin';

/** User fields every app shows. Matches the backend UserView. */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  accountType: 'MEMBER' | 'STAFF';
  staffRole: 'ADMIN' | 'MODERATOR' | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
}

/** What the backend returns from login/register/refresh. */
export interface TokenBundle {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

export interface AuthResult extends TokenBundle {
  user: SessionUser;
}

/** The app's auth endpoints. Injected so the store has no dependency on a specific API area. */
export interface AuthApi {
  login(email: string, password: string): Promise<AuthResult>;
  register?(input: { email: string; password: string; fullName: string }): Promise<AuthResult>;
  refresh(refreshToken: string): Promise<TokenBundle>;
  logout(refreshToken: string): Promise<void>;
  me(): Promise<SessionUser>;
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut'; reason?: string }
  | { status: 'signedIn'; user: SessionUser };

type Listener = () => void;

/** Refresh this long before the access token expires. */
const REFRESH_EARLY_MS = 60_000;

/**
 * Holds one app's sign-in. Rules from the backend:
 * - access tokens live 15 minutes and only work in this app (kept in memory only);
 * - refresh tokens rotate on every use and re-using an old one revokes the sign-in,
 *   so refresh is single-flight within the tab and, via the Web Locks API, across tabs.
 */
export class SessionStore {
  private state: SessionState = { status: 'loading' };
  private accessToken: string | null = null;
  private inflight: Promise<string | null> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly channel: BroadcastChannel | null;
  private api: AuthApi | null = null;

  constructor(
    readonly app: AppName,
    private readonly storage: Storage = globalThis.localStorage,
  ) {
    this.channel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel(`tutora.${app}.session`);
    this.channel?.addEventListener('message', (e: MessageEvent<{ type: string }>) => {
      if (e.data?.type === 'signedOut') this.clear('signedOutElsewhere');
      if (e.data?.type === 'signedIn' && this.state.status !== 'signedIn') void this.restore();
    });
  }

  /** Set once the app's API client exists (the client itself needs this store for tokens). */
  attach(api: AuthApi): void {
    this.api = api;
  }

  private get key(): string {
    return `tutora.${this.app}.refreshToken`;
  }

  // ---------- reading ----------

  getState = (): SessionState => this.state;

  getAccessToken = (): string | null => this.accessToken;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(next: SessionState): void {
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  // ---------- flows ----------

  /** On app start: resume from a stored refresh token, if any. */
  async restore(): Promise<void> {
    if (!this.storage.getItem(this.key)) {
      this.set({ status: 'signedOut' });
      return;
    }
    const token = await this.refresh();
    if (!token) return;
    try {
      this.set({ status: 'signedIn', user: await this.requireApi().me() });
    } catch (err) {
      this.clear(err instanceof ApiError ? err.code : 'RESTORE_FAILED');
    }
  }

  async login(email: string, password: string): Promise<SessionUser> {
    return this.accept(await this.requireApi().login(email, password));
  }

  async register(input: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<SessionUser> {
    const api = this.requireApi();
    if (!api.register) throw new Error(`${this.app} app has no registration`);
    return this.accept(await api.register(input));
  }

  async logout(): Promise<void> {
    const token = this.storage.getItem(this.key);
    this.clear();
    this.channel?.postMessage({ type: 'signedOut' });
    if (token)
      await this.requireApi()
        .logout(token)
        .catch(() => undefined);
  }

  /**
   * Returns a fresh access token, or null if the session is gone.
   * Concurrent callers share one refresh; other tabs wait on the same lock and pick up
   * the rotated token from storage instead of re-using the old one.
   */
  refresh = (): Promise<string | null> => {
    this.inflight ??= this.withLock(() => this.doRefresh()).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  };

  private async doRefresh(): Promise<string | null> {
    const stored = this.storage.getItem(this.key);
    if (!stored) {
      this.clear();
      return null;
    }
    try {
      const bundle = await this.requireApi().refresh(stored);
      this.storeTokens(bundle);
      return bundle.accessToken;
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'REFRESH_FAILED';
      // Network trouble: keep the stored token so the next attempt can succeed.
      if (code === 'NETWORK_ERROR') return null;
      this.clear(code);
      if (code === 'REFRESH_TOKEN_REUSED') this.channel?.postMessage({ type: 'signedOut' });
      return null;
    }
  }

  private accept(result: AuthResult): SessionUser {
    this.storeTokens(result);
    this.set({ status: 'signedIn', user: result.user });
    this.channel?.postMessage({ type: 'signedIn' });
    return result.user;
  }

  private storeTokens(bundle: TokenBundle): void {
    this.accessToken = bundle.accessToken;
    this.storage.setItem(this.key, bundle.refreshToken);
    if (this.timer) clearTimeout(this.timer);
    const wait = Math.max(5_000, bundle.accessTokenExpiresIn * 1000 - REFRESH_EARLY_MS);
    this.timer = setTimeout(() => void this.refresh(), wait);
  }

  private clear(reason?: string): void {
    this.accessToken = null;
    this.storage.removeItem(this.key);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.set({ status: 'signedOut', reason });
  }

  private requireApi(): AuthApi {
    if (!this.api) throw new Error('SessionStore.attach(api) was not called');
    return this.api;
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const locks = (globalThis.navigator as Navigator | undefined)?.locks;
    if (!locks) return fn();
    return locks.request(`tutora.${this.app}.refresh`, fn) as Promise<T>;
  }
}
