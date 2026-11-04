import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders, createQueryClient, RealtimeClient } from '@tutora/core';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fakeFactory } from '../../../test/fake-socket';
import { member, skillDetail, tokens } from '../../../test/fixtures';
import { session } from './api';
import { routeTree } from './router';

let poolBid: Record<string, unknown> | null = null;

const server = setupServer(
  http.post('*/tutor/auth/login', () => HttpResponse.json({ ...tokens, user: member })),
  http.post('*/tutor/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('*/tutor/notifications', () => HttpResponse.json([])),
  http.get('*/tutor/profile', () =>
    HttpResponse.json({
      userId: 'u1',
      verificationStatus: 'VERIFIED',
      badge: 'VERIFIED',
      payoutUpiId: 'asha@okicici',
      skills: [],
      languages: [],
    }),
  ),
  http.get('*/tutor/earnings', () =>
    HttpResponse.json({
      currency: 'INR',
      availablePaise: 40500,
      pendingGrossPaise: 90000,
      releasedGrossPaise: 45000,
      platformFeeBps: 1000,
      payouts: [
        {
          id: 'po1',
          amountPaise: 20000,
          reference: 'UTR123456',
          createdAt: '2026-11-03T10:00:00Z',
        },
      ],
    }),
  ),
  http.get('*/tutor/pools', () =>
    HttpResponse.json([
      {
        id: 'pool1',
        skillId: 'skill-ta',
        level: 'BEGINNER',
        status: 'FORMING',
        members: 3,
        seatCap: 5,
      },
    ]),
  ),
  http.get('*/public/skills/skill-ta', () => HttpResponse.json(skillDetail)),
  http.post('*/tutor/pools/pool1/bids', async ({ request }) => {
    poolBid = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: 'pb1', status: 'SUBMITTED', ...poolBid }, { status: 201 });
  }),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(async () => {
  server.resetHandlers();
  await session.logout();
  localStorage.clear();
  poolBid = null;
});
afterAll(() => server.close());

function renderAt(path: string) {
  const { factory } = fakeFactory();
  const realtime = new RealtimeClient(session, '/realtime', factory);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <AppProviders session={session} queryClient={createQueryClient()} realtime={realtime}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('tutor: earnings (phase 12)', () => {
  it('shows available, held and released money with payouts', async () => {
    await session.login('asha@example.com', 'pw');
    renderAt('/earnings');
    expect(await screen.findByText('Ready to pay out')).toBeInTheDocument();
    expect(screen.getByText('₹405')).toBeInTheDocument();
    expect(screen.getByText('₹900')).toBeInTheDocument();
    expect(screen.getByText('UTR123456')).toBeInTheDocument();
    expect(await screen.findByText('asha@okicici')).toBeInTheDocument();
    expect(screen.getAllByText('10%').length).toBeGreaterThan(0);
  });
});

describe('tutor: group bids (phase 13)', () => {
  it('bids a seat price with seat limits on a group', async () => {
    await session.login('asha@example.com', 'pw');
    renderAt('/groups');
    expect(await screen.findByText('3 learners want the same thing')).toBeInTheDocument();
    expect(await screen.findByText(/Technical Analysis/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bid on this group' }));
    await userEvent.type(screen.getByLabelText('Price per seat, ₹'), '199');
    const min = screen.getByLabelText('Minimum learners');
    await userEvent.clear(min);
    await userEvent.type(min, '6');
    await userEvent.type(screen.getByLabelText('Your approach'), 'Live charts, small group.');
    await userEvent.click(screen.getByRole('button', { name: 'Send group bid' }));
    // 6 > max (5): caught before sending.
    expect(await screen.findByText('Must be at least the minimum.')).toBeInTheDocument();
    expect(poolBid).toBeNull();
    await userEvent.clear(min);
    await userEvent.type(min, '2');
    await userEvent.click(screen.getByRole('button', { name: 'Send group bid' }));
    expect(await screen.findByText('Group bid sent')).toBeInTheDocument();
    await waitFor(() =>
      expect(poolBid).toMatchObject({
        seatPricePaise: 19900,
        minSeats: 2,
        maxSeats: 5,
        durationMinutes: 60,
        approachText: 'Live charts, small group.',
      }),
    );
  });
});
