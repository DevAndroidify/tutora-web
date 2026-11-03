import { describe, expect, it, vi } from 'vitest';
import { fakeFactory } from '../../../test/fake-socket';
import { RealtimeClient } from './realtime';
import { formatCountdown, sessionPhase } from './sessions';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('RealtimeClient', () => {
  it('authenticates with the current token and re-joins rooms after every reconnect', async () => {
    let token = 'access-1';
    const refresh = vi.fn(async () => (token = 'access-2'));
    const { factory, sockets } = fakeFactory();
    const client = new RealtimeClient(
      { getAccessToken: () => token, refresh },
      '/realtime',
      factory,
    );
    client.subscribe('request:r1:owner');
    client.start();
    await flush();
    const socket = sockets[0]!;
    expect(client.getStatus()).toBe('live');
    expect(socket.authTokens).toEqual(['access-1']);
    expect(socket.joined).toEqual(['request:r1:owner']);

    // Server drops us (expired token): refresh, reconnect with the new token, re-join.
    socket.serverDisconnect();
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(socket.authTokens).toEqual(['access-1', 'access-2']);
    expect(socket.joined).toEqual(['request:r1:owner', 'request:r1:owner']);
  });

  it('delivers events to listeners and stops after off()', async () => {
    const { factory, sockets } = fakeFactory();
    const client = new RealtimeClient(
      { getAccessToken: () => 't', refresh: async () => 't' },
      '/realtime',
      factory,
    );
    client.start();
    await flush();
    const seen: unknown[] = [];
    const off = client.on('bid.created', (d) => seen.push(d));
    sockets[0]!.fire('bid.created', { requestId: 'r1', bidCount: 1 });
    off();
    sockets[0]!.fire('bid.created', { requestId: 'r1', bidCount: 2 });
    expect(seen).toEqual([{ requestId: 'r1', bidCount: 1 }]);
  });

  it('only leaves a room when the last subscriber leaves', async () => {
    const { factory, sockets } = fakeFactory();
    const client = new RealtimeClient(
      { getAccessToken: () => 't', refresh: async () => 't' },
      '/realtime',
      factory,
    );
    client.start();
    await flush();
    const a = client.subscribe('session:s1');
    const b = client.subscribe('session:s1');
    await flush();
    expect(sockets[0]!.joined).toEqual(['session:s1']);
    a();
    expect(sockets[0]!.joined).toEqual(['session:s1']);
    b();
    expect(sockets[0]!.joined).toEqual([]);
  });
});

describe('session helpers', () => {
  it('maps backend statuses to phases', () => {
    expect(sessionPhase({ sessionStatus: 'PENDING_PAYMENT' })).toBe('payment');
    expect(sessionPhase({ sessionStatus: 'SCHEDULED' })).toBe('upcoming');
    expect(sessionPhase({ sessionStatus: 'LIVE' })).toBe('live');
    expect(sessionPhase({ sessionStatus: 'ENDED' })).toBe('ended');
    expect(sessionPhase({ sessionStatus: 'CANCELLED' })).toBe('closed');
  });

  it('formats countdowns', () => {
    expect(formatCountdown(4 * 60_000 + 5_000)).toBe('4:05');
    expect(formatCountdown(2 * 3600_000 + 7 * 60_000)).toBe('2h 07m');
    expect(formatCountdown(-1)).toBe('0:00');
  });
});
