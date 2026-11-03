import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders, createQueryClient, RealtimeClient } from '@tutora/core';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fakeFactory } from '../../../test/fake-socket';
import { apiError, member, skill, tokens } from '../../../test/fixtures';
import { session } from './api';
import { routeTree } from './router';

const marketRequest = {
  id: 'r1',
  skill: { id: skill.id, slug: skill.slug, name: skill.name, learnerNotice: skill.learnerNotice },
  topicId: null,
  level: 'BEGINNER',
  title: 'Reversal candles',
  description: 'I keep misreading hammers.',
  preferredLanguage: null,
  budgetHintPaise: 50000,
  currency: 'INR',
  status: 'OPEN',
  publishedAt: '2026-11-03T10:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z',
  createdAt: '2026-11-03T10:00:00Z',
  attachments: [],
  studentDisplayName: 'Meera N.',
  bidCount: 0,
  myBid: null,
};
let bidBody: Record<string, unknown> | null = null;
let verified = true;

const server = setupServer(
  http.post('*/tutor/auth/login', () => HttpResponse.json({ ...tokens, user: member })),
  http.post('*/tutor/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('*/tutor/notifications', () => HttpResponse.json([])),
  http.get('*/tutor/profile', () =>
    HttpResponse.json({
      userId: 'u1',
      verificationStatus: 'VERIFIED',
      badge: 'VERIFIED',
      skills: [{ skill, status: 'APPROVED' }],
      languages: [],
    }),
  ),
  http.get('*/tutor/requests', () =>
    verified
      ? HttpResponse.json({ items: [marketRequest], total: 1, limit: 20, offset: 0 })
      : HttpResponse.json(apiError('TUTOR_NOT_VERIFIED', 'Your tutor profile must be verified.'), {
          status: 403,
        }),
  ),
  http.get('*/tutor/requests/r1', () => HttpResponse.json(marketRequest)),
  http.post('*/tutor/requests/r1/bids', async ({ request }) => {
    bidBody = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      { id: 'b1', requestId: 'r1', status: 'SUBMITTED', ...bidBody },
      { status: 201 },
    );
  }),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(async () => {
  server.resetHandlers();
  await session.logout();
  localStorage.clear();
  bidBody = null;
  verified = true;
});
afterAll(() => server.close());

function renderAt(path: string) {
  const { factory, sockets } = fakeFactory();
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
  return { router, sockets };
}

describe('tutor: marketplace and bids (phases 7, 9)', () => {
  it('lists open requests and updates bid counts live', async () => {
    await session.login('t@example.com', 'pw');
    const { sockets } = renderAt('/requests');
    const card = (await screen.findByRole('heading', { name: 'Reversal candles' })).closest('li')!;
    expect(within(card).getByText('0')).toBeInTheDocument();
    await waitFor(() => expect(sockets[0]?.joined).toContain('request:r1:tutors'));
    sockets[0]!.fire('request.bid_count_changed', { requestId: 'r1', bidCount: 3 });
    expect(await within(card).findByText('3')).toBeInTheDocument();
  });

  it('explains how to get access when not verified', async () => {
    verified = false;
    await session.login('t@example.com', 'pw');
    renderAt('/requests');
    expect(await screen.findByText('Get verified to see requests')).toBeInTheDocument();
  });

  it('validates and sends a sealed bid in paise with an ISO start time', async () => {
    await session.login('t@example.com', 'pw');
    renderAt('/requests/r1');
    await userEvent.click(await screen.findByRole('button', { name: 'Send sealed bid' }));
    expect(await screen.findByText('Enter a price of at least ₹1.')).toBeInTheDocument();
    expect(screen.getByText('Tell the learner how you would teach this.')).toBeInTheDocument();
    expect(bidBody).toBeNull();

    await userEvent.type(screen.getByLabelText('Your price for the session, ₹'), '450');
    await userEvent.type(screen.getByLabelText('Your approach'), 'Ten real charts together.');
    await userEvent.click(screen.getByRole('button', { name: 'Send sealed bid' }));
    await waitFor(() => expect(bidBody).not.toBeNull());
    expect(bidBody).toMatchObject({
      seatPricePaise: 45000,
      durationMinutes: 60,
      approachText: 'Ten real charts together.',
    });
    expect(new Date(String(bidBody!.proposedStartAt)).getTime()).toBeGreaterThan(
      Date.now() + 15 * 60_000,
    );
  });
});
