import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders, createQueryClient, RealtimeClient } from '@tutora/core';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fakeFactory } from '../../../test/fake-socket';
import { apiError, member, tokens } from '../../../test/fixtures';
import { session } from './api';
import { routeTree } from './router';

let inviteStatus: 'INVITED' | 'ACCEPTED' = 'INVITED';
let poolStatus = 'BIDDING';
let seated = false;
let otherChosen = false;

const invite = () => ({
  id: 'inv1',
  status: inviteStatus,
  requestId: 'r1',
  expiresAt: '2099-01-01T00:00:00Z',
  matchedBy: 'embedding',
  similarity: 0.91,
  pool: {
    id: 'pool1',
    status: poolStatus,
    skill: { id: 'skill-ta', name: 'Technical Analysis' },
    level: 'BEGINNER',
    seatCap: 5,
    joined: inviteStatus === 'ACCEPTED' ? 2 : 1,
    invited: 1,
  },
});
const poolBid = {
  id: 'pb1',
  requestId: null,
  seatPricePaise: 19900,
  currency: 'INR',
  proposedStartAt: '2099-01-02T10:00:00Z',
  durationMinutes: 60,
  approachText: 'Small group, live charts.',
  hasApproachMedia: false,
  status: 'SUBMITTED',
  createdAt: '2026-11-03T10:00:00Z',
  updatedAt: '2026-11-03T10:00:00Z',
  minSeats: 2,
  maxSeats: 5,
  tutor: { userId: 't1', badge: 'VERIFIED', headline: 'Charts', fullName: 'Kiran Rao' },
  approachMediaUrl: null,
  score: { total: 0.8, components: [] },
};

const server = setupServer(
  http.post('*/student/auth/login', () => HttpResponse.json({ ...tokens, user: member })),
  http.post('*/student/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('*/student/notifications', () => HttpResponse.json([])),
  http.get('*/student/pools/invites', () => HttpResponse.json([invite()])),
  http.post('*/student/pools/invites/inv1/accept', () => {
    inviteStatus = 'ACCEPTED';
    return HttpResponse.json(invite());
  }),
  http.get('*/student/pools/pool1/bids', () =>
    HttpResponse.json({
      poolId: 'pool1',
      status: poolStatus,
      acceptedBidId: null,
      bids: [poolBid],
    }),
  ),
  http.post('*/student/pools/pool1/bids/pb1/accept', () => {
    if (otherChosen)
      return HttpResponse.json(
        apiError('OTHER_OFFER_CHOSEN', 'The group already chose a different offer.'),
        {
          status: 409,
        },
      );
    seated = true;
    poolStatus = 'AWAITING_PAYMENTS';
    return HttpResponse.json({
      poolId: 'pool1',
      sessionId: 's1',
      participantId: 'p1',
      amountPaise: 19900,
      currency: 'INR',
      minSeats: 2,
      maxSeats: 5,
      paymentDueAt: '2099-01-01T00:00:00Z',
    });
  }),
  http.get('*/student/sessions', () =>
    HttpResponse.json(
      seated
        ? [
            {
              sessionId: 's1',
              participantId: 'p1',
              requestId: 'r1',
              bidId: 'pb1',
              tutorUserId: 't1',
              sessionStatus: 'PENDING_PAYMENT',
              participantStatus: 'PENDING_PAYMENT',
              startsAt: '2099-01-02T10:00:00Z',
              durationMinutes: 60,
              amountPaise: 19900,
              currency: 'INR',
              paymentDueAt: '2099-01-01T00:00:00Z',
            },
          ]
        : [],
    ),
  ),
  http.get('*/student/requests/r1', () =>
    HttpResponse.json({
      id: 'r1',
      skill: {
        id: 'skill-ta',
        slug: 'technical-analysis',
        name: 'Technical Analysis',
        learnerNotice: null,
      },
      level: 'BEGINNER',
      title: 'Reversal candles',
      description: 'I keep misreading hammers.',
      status: 'RESERVED',
      attachments: [],
      createdAt: '2026-11-03T10:00:00Z',
    }),
  ),
  http.get('*/public/tutors/t1', () =>
    HttpResponse.json({ userId: 't1', fullName: 'Kiran Rao', skills: [], languages: [] }),
  ),
  http.get('*/student/sessions/s1/recording', () =>
    HttpResponse.json({
      sessionId: 's1',
      status: 'NOT_RECORDED',
      consents: [],
      url: null,
      deleteAfter: null,
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(async () => {
  server.resetHandlers();
  await session.logout();
  localStorage.clear();
  sessionStorage.clear();
  inviteStatus = 'INVITED';
  poolStatus = 'BIDDING';
  seated = false;
  otherChosen = false;
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

describe('student: group sessions (phase 13)', () => {
  it('joins a group, accepts an offer for the group and lands on seat payment', async () => {
    await session.login('asha@example.com', 'pw');
    const router = renderAt('/groups');
    expect(await screen.findByText('Invitations · 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Join group' }));
    expect(await screen.findByText('Your Technical Analysis group')).toBeInTheDocument();
    expect(await screen.findByText('Kiran Rao')).toBeInTheDocument();
    expect(screen.getByText(/per seat · 2–5 learners/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Accept for the group' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/fixes the offer for everyone/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Accept and pay' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/sessions/s1'));
    expect(await screen.findByText('Seat held for you')).toBeInTheDocument();
    expect(screen.getByText('₹199')).toBeInTheDocument();
  });

  it('explains when another member already chose a different offer', async () => {
    inviteStatus = 'ACCEPTED';
    otherChosen = true;
    await session.login('asha@example.com', 'pw');
    renderAt('/groups');
    await userEvent.click(await screen.findByRole('button', { name: 'Accept for the group' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Accept and pay' }));
    expect(await within(dialog).findByText(/just chose a different offer/)).toBeInTheDocument();
  });
});
