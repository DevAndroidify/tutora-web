import type { Socket } from 'socket.io-client';

type Fn = (...args: never[]) => void;

/** Minimal stand-in for a socket.io-client Socket, driven by tests. */
export class FakeSocket {
  connected = false;
  readonly joined: string[] = [];
  readonly authTokens: Array<string | null> = [];
  private readonly listeners = new Map<string, Set<Fn>>();
  private readonly any = new Set<(event: string, data: unknown) => void>();

  constructor(private readonly opts: { auth?: (cb: (d: { token: string | null }) => void) => void }) {}

  on(event: string, fn: Fn) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(fn);
    this.listeners.set(event, set);
    return this;
  }
  onAny(fn: (event: string, data: unknown) => void) {
    this.any.add(fn);
    return this;
  }
  removeAllListeners() {
    this.listeners.clear();
    this.any.clear();
    return this;
  }
  timeout() {
    return this;
  }
  async emitWithAck(event: string, body: { room: string }) {
    if (event === 'subscribe') this.joined.push(body.room);
    return { ok: true, room: body.room };
  }
  emit(event: string, body: { room: string }) {
    if (event === 'unsubscribe') this.joined.splice(this.joined.indexOf(body.room), 1);
    return this;
  }
  /** Simulates a successful (re)connect: reads auth, then the server's `ready`. */
  connect() {
    this.opts.auth?.((d) => this.authTokens.push(d.token));
    this.connected = true;
    this.fire('ready', { app: 'test', userId: 'u1' });
    return this;
  }
  disconnect() {
    this.connected = false;
    return this;
  }
  /** Delivers a server event to the client. */
  fire(event: string, data: unknown) {
    this.listeners.get(event)?.forEach((fn) => (fn as (d: unknown) => void)(data));
    if (!['ready', 'disconnect', 'error', 'connect_error'].includes(event)) this.any.forEach((fn) => fn(event, data));
  }
  /** Server-side disconnect (e.g. expired token). */
  serverDisconnect() {
    this.connected = false;
    this.listeners.get('disconnect')?.forEach((fn) => (fn as (r: string) => void)('io server disconnect'));
  }
}

/** A socket factory for RealtimeClient that remembers the sockets it made. */
export function fakeFactory() {
  const sockets: FakeSocket[] = [];
  const factory = (_url: string, opts: unknown) => {
    const s = new FakeSocket(opts as ConstructorParameters<typeof FakeSocket>[0]);
    sockets.push(s);
    queueMicrotask(() => s.connect());
    return s as unknown as Socket;
  };
  return { factory, sockets };
}
