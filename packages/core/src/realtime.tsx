import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './config';
import { useSession } from './react';
import type { SessionStore } from './session';

export type RealtimeStatus = 'idle' | 'connecting' | 'live' | 'offline';
type Handler = (data: unknown) => void;
type SocketFactory = (url: string, opts: Parameters<typeof io>[1]) => Socket;

/**
 * One Socket.IO connection to the backend's /realtime namespace per app.
 * - Authenticates with the app's current access token on every (re)connect.
 * - When the server rejects the token, refreshes it once and reconnects.
 * - Remembers joined rooms and re-joins them after every reconnect.
 */
export class RealtimeClient {
  private socket: Socket | null = null;
  private readonly rooms = new Map<string, number>();
  private readonly handlers = new Map<string, Set<Handler>>();
  private readonly statusListeners = new Set<() => void>();
  private status: RealtimeStatus = 'idle';
  private refreshing = false;

  constructor(
    private readonly session: Pick<SessionStore, 'getAccessToken' | 'refresh'>,
    private readonly url: string = `${API_BASE_URL}/realtime`,
    private readonly factory: SocketFactory = io,
  ) {}

  getStatus = (): RealtimeStatus => this.status;

  subscribeStatus = (fn: () => void): (() => void) => {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  };

  private setStatus(s: RealtimeStatus): void {
    this.status = s;
    this.statusListeners.forEach((l) => l());
  }

  start(): void {
    if (this.socket) return;
    this.setStatus('connecting');
    const socket = this.factory(this.url, {
      transports: ['websocket', 'polling'],
      // Evaluated on every connection attempt, so reconnects use the latest token.
      auth: (cb: (data: object) => void) => cb({ token: this.session.getAccessToken() }),
    });
    this.socket = socket;
    socket.on('ready', () => {
      this.setStatus('live');
      for (const room of this.rooms.keys()) void this.join(room);
    });
    socket.on('error', (e: { code?: string } | undefined) => {
      if (e?.code === 'UNAUTHENTICATED') void this.reauth();
    });
    socket.on('disconnect', (reason: string) => {
      this.setStatus('offline');
      // The server closed us (usually an expired token): refresh, then reconnect ourselves.
      if (reason === 'io server disconnect') void this.reauth();
    });
    socket.on('connect_error', () => this.setStatus('offline'));
    socket.onAny((event: string, data: unknown) => {
      this.handlers.get(event)?.forEach((h) => h(data));
      this.handlers.get('*')?.forEach((h) => h({ event, data }));
    });
  }

  stop(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.setStatus('idle');
  }

  private async reauth(): Promise<void> {
    if (this.refreshing || !this.socket) return;
    this.refreshing = true;
    try {
      const token = await this.session.refresh();
      if (token && this.socket && !this.socket.connected) this.socket.connect();
    } finally {
      this.refreshing = false;
    }
  }

  private async join(room: string): Promise<void> {
    if (!this.socket?.connected) return;
    try {
      await this.socket.timeout(5000).emitWithAck('subscribe', { room });
    } catch {
      // A timed-out join is retried on the next reconnect.
    }
  }

  /** Joins a request or session room; the server checks access. Returns a leave function. */
  subscribe(room: string): () => void {
    const count = this.rooms.get(room) ?? 0;
    this.rooms.set(room, count + 1);
    if (count === 0 && this.status === 'live') void this.join(room);
    return () => {
      const left = (this.rooms.get(room) ?? 1) - 1;
      if (left > 0) return this.rooms.set(room, left) as unknown as void;
      this.rooms.delete(room);
      if (this.socket?.connected) this.socket.emit('unsubscribe', { room });
    };
  }

  /** Listens for one event name ('*' receives everything as { event, data }). */
  on(event: string, handler: Handler): () => void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler);
    this.handlers.set(event, set);
    return () => set.delete(handler);
  }
}

const RealtimeContext = createContext<RealtimeClient | null>(null);

/** Connects while signed in, disconnects on sign-out. Apps without it simply get no live updates. */
export function RealtimeProvider({
  client,
  children,
}: {
  client: RealtimeClient;
  children: ReactNode;
}) {
  const session = useSession();
  const signedIn = session.status === 'signedIn';
  useEffect(() => {
    if (!signedIn) return;
    client.start();
    return () => client.stop();
  }, [client, signedIn]);
  return <RealtimeContext.Provider value={client}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeClient | null {
  return useContext(RealtimeContext);
}

const idle = () => 'idle' as const;
const noop = () => () => undefined;

export function useRealtimeStatus(): RealtimeStatus {
  const client = useRealtime();
  return useSyncExternalStore(
    client?.subscribeStatus ?? noop,
    client?.getStatus ?? idle,
    client?.getStatus ?? idle,
  );
}

/** Calls `handler` for each matching event. The latest handler is always used. */
export function useRealtimeEvent<T = unknown>(
  event: string | string[],
  handler: (data: T, event: string) => void,
): void {
  const client = useRealtime();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  const key = Array.isArray(event) ? event.join('|') : event;
  useEffect(() => {
    if (!client) return;
    const offs = key.split('|').map((ev) => client.on(ev, (d) => ref.current(d as T, ev)));
    return () => offs.forEach((off) => off());
  }, [client, key]);
}

/** Joins a room while the component is mounted (null = nothing to join yet). */
export function useRoom(room: string | null): void {
  const client = useRealtime();
  useEffect(() => {
    if (!client || !room) return;
    return client.subscribe(room);
  }, [client, room]);
}
