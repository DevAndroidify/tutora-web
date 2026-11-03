import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders, createQueryClient, RealtimeClient } from '@tutora/core';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fakeFactory } from '../../../test/fake-socket';
import { member, skill, tokens } from '../../../test/fixtures';
import { session } from './api';
import { routeTree } from './router';

const request = {
  id: 'r1',
  skill: { id: skill.id, slug: skill.slug, name: skill.name, learnerNotice: null },
  topicId: null,
  level: 'BEGINNER',
  title: 'Reversal candles',
  description: 'I keep misreading hammers.',
  preferredLanguage: null,
  budgetHintPaise: null,
  currency: 'INR',
  status: 'OPEN',
  publishedAt: '2026-11-03T10:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z',
  createdAt: '2026-11-03T10:00:00Z',
  attachments: [],
};
const bid = {
  id: 'b1',
  requestId: 'r1',
  seatPricePaise: 45000,
  currency: 'INR',
  proposedStartAt: '2099-01-02T10:00:00Z',
  durationMinutes: 60,
  approachText: 'Ten real charts together.',
  hasApproachMedia: false,
  status: 'SUBMITTED',
  createdAt: '2026-11-03T10:00:00Z',
  updatedAt: '2026-11-03T10:00:00Z',
  tutor: { userId: 't1', badge: 'VERIFIED', headline: 'Charts', fullName: 'Kiran Rao' },
  approachMediaUrl: null,
  score: {
    total: 0.7,
    components: [
      {
        key: 'M',
        label: 'Teaching outcomes',
        weight: 0.4,
        value: 0.5,
        placeholder: true,
        note: 'Not enough data yet',
      },
    ],
  },
};
const seat = (status: string) => ({
  sessionId: 's1',
  participantId: 'p1',
  requestId: 'r1',
  bidId: 'b1',
  tutorUserId: 't1',
  sessionStatus: status,
  participantStatus: status === 'PENDING_PAYMENT' ? 'PENDING_PAYMENT' : 'CONFIRMED',
  startsAt: '2099-01-02T10:00:00Z',
  durationMinutes: 60,
  amountPaise: 45000,
  currency: 'INR',
  paymentDueAt: '2099-01-01T00:00:00Z',
});
let state: 'open' | 'reserved' | 'paid' | 'ended' = 'open';
let idempotencyKey: string | null = null;
let simulated = false;
let quizAnswers: unknown = null;

const server = setupServer(
  http.post('*/student/auth/login', () => HttpResponse.json({ ...tokens, user: member })),
  http.post('*/student/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('*/student/notifications', () => HttpResponse.json([])),
  http.get('*/student/requests/r1', () =>
    HttpResponse.json({ ...request, status: state === 'open' ? 'OPEN' : 'RESERVED' }),
  ),
  http.get('*/student/requests/r1/bids', () => HttpResponse.json([bid])),
  http.get('*/public/skills/:id', () =>
    HttpResponse.json({ ...skill, category: { name: 'Finance' }, topics: [] }),
  ),
  http.get('*/public/tutors/t1', () =>
    HttpResponse.json({
      userId: 't1',
      fullName: 'Kiran Rao',
      skills: [],
      languages: [],
      badge: 'VERIFIED',
    }),
  ),
  http.post('*/student/bids/b1/accept', () => {
    state = 'reserved';
    return HttpResponse.json(seat('PENDING_PAYMENT'), { status: 201 });
  }),
  http.get('*/student/sessions', () =>
    HttpResponse.json(
      state === 'open'
        ? []
        : [
            seat(
              state === 'reserved' ? 'PENDING_PAYMENT' : state === 'paid' ? 'SCHEDULED' : 'ENDED',
            ),
          ],
    ),
  ),
  http.post('*/student/participants/p1/payments', ({ request: req }) => {
    idempotencyKey = req.headers.get('idempotency-key');
    return HttpResponse.json(
      {
        id: 'pay1',
        participantId: 'p1',
        provider: 'fake',
        status: 'INITIATED',
        amountPaise: 45000,
        currency: 'INR',
        providerOrderId: 'order_fake_1',
        failureReason: null,
        refundReason: null,
        createdAt: '2026-11-03T10:00:00Z',
        checkout: {
          provider: 'fake',
          simulatePaymentUrl: '/dev/fake-upi/orders/{orderId}/pay',
          orderId: 'order_fake_1',
          amount: 45000,
          currency: 'INR',
        },
      },
      { status: 201 },
    );
  }),
  http.post('*/dev/fake-upi/orders/order_fake_1/pay', () => {
    simulated = true;
    state = 'paid';
    return HttpResponse.json({ received: true });
  }),
  http.get('*/student/payments/pay1', () =>
    HttpResponse.json({
      id: 'pay1',
      participantId: 'p1',
      provider: 'fake',
      status: simulated ? 'HELD' : 'INITIATED',
      amountPaise: 45000,
    }),
  ),
  http.get('*/student/sessions/s1/recording', () =>
    HttpResponse.json({
      sessionId: 's1',
      status: 'NOT_RECORDED',
      consents: [{ userId: 'u1', role: 'STUDENT', granted: null }],
      url: null,
      deleteAfter: null,
    }),
  ),
  http.get('*/student/sessions/s1/replay', () =>
    HttpResponse.json({
      sessionId: 's1',
      recording: {
        sessionId: 's1',
        status: 'NOT_RECORDED',
        consents: [],
        url: null,
        deleteAfter: null,
      },
      transcript: { status: 'NOT_RECORDED', segments: [] },
      notes: {
        status: 'READY',
        source: 'TUTOR',
        provider: 'tutor',
        model: null,
        content: {
          summary: 'We read hammers.',
          keyPoints: [{ text: 'Wait for confirmation', atMs: 0 }],
        },
      },
      flashcards: null,
      whiteboard: [],
    }),
  ),
  http.get('*/student/sessions/s1/attendance', () => HttpResponse.json([])),
  http.get('*/student/quizzes', () =>
    HttpResponse.json([
      {
        id: 'q1',
        sessionId: 's1',
        kind: 'EXIT',
        mode: 'QUIZ',
        status: quizAnswers ? 'SUBMITTED' : 'OPEN',
        availableAt: '2026-11-03T10:00:00Z',
        dueAt: '2099-01-01T00:00:00Z',
        questions: [
          {
            id: 'x1',
            prompt: 'A stop-loss is used to',
            options: ['guarantee profit', 'limit a loss'],
          },
        ],
        result: null,
      },
    ]),
  ),
  http.post('*/student/quizzes/q1/submit', async ({ request: req }) => {
    quizAnswers = await req.json();
    return HttpResponse.json({
      id: 'q1',
      sessionId: 's1',
      questions: [],
      status: 'SUBMITTED',
      result: { correct: 1, total: 1, passed: true },
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(async () => {
  server.resetHandlers();
  await session.logout();
  localStorage.clear();
  sessionStorage.clear();
  state = 'open';
  idempotencyKey = null;
  simulated = false;
  quizAnswers = null;
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

describe('student: accept and pay (phase 8)', () => {
  it('explains the ranking, accepts a bid, pays in test mode and lands on the scheduled session', async () => {
    await session.login('asha@example.com', 'pw');
    const { router, sockets } = renderAt('/requests/r1');
    expect(await screen.findByText('Kiran Rao')).toBeInTheDocument();
    await waitFor(() => expect(sockets[0]?.joined).toContain('request:r1:owner'));

    await userEvent.click(screen.getByRole('button', { name: /why this ranking/i }));
    expect(screen.getByText('Teaching outcomes')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Accept and pay' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/sessions/s1'));
    expect(await screen.findByText('Seat held for you')).toBeInTheDocument();
    expect(screen.getByText('Test mode')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Pay with UPI' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Approve test payment' }));
    expect(idempotencyKey).toMatch(/.{16,}/);
    expect(await screen.findByText('Room opens in', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join now' })).toBeDisabled();
  }, 15_000);
});

describe('student: after the session (phase 11)', () => {
  it('shows tutor notes and submits the exit quiz', async () => {
    state = 'ended';
    await session.login('asha@example.com', 'pw');
    renderAt('/sessions/s1');
    expect(await screen.findByText('We read hammers.')).toBeInTheDocument();
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
    await userEvent.click(await screen.findByLabelText('limit a loss'));
    await userEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
    expect(await screen.findByText('Passed')).toBeInTheDocument();
    expect(quizAnswers).toEqual({ answers: [1] });
    expect(screen.getByRole('radiogroup', { name: 'Rating' })).toBeInTheDocument();
  });
});
