import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders, createQueryClient } from '@tutora/core';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { apiError, staff, tokens } from '../../../test/fixtures';
import { session } from './api';
import { routeTree } from './router';

const TUTOR = '11111111-1111-4111-8111-111111111111';
let resolved: unknown = null;
let payout: unknown = null;
let released: unknown = null;

const dispute = {
  id: 'd1',
  sessionId: 's1',
  participantId: 'p1',
  paymentId: 'pay1',
  studentUserId: 'u1',
  tutorUserId: TUTOR,
  reason: 'TUTOR_ABSENT_OR_LATE',
  details: 'Tutor joined 40 minutes late.',
  status: 'OPEN',
  resolutionNote: null,
  openedAt: '2026-11-03T10:00:00Z',
  resolvedAt: null,
};
const heldPayment = {
  id: 'pay2',
  participantId: 'p2',
  provider: 'fake',
  status: 'HELD',
  amountPaise: 45000,
  currency: 'INR',
  providerOrderId: 'order_fake_2',
  failureReason: null,
  refundReason: null,
  createdAt: '2026-11-03T10:00:00Z',
};

const server = setupServer(
  http.post('*/admin/auth/login', () => HttpResponse.json({ ...tokens, user: staff })),
  http.post('*/admin/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('*/admin/disputes', () => HttpResponse.json(resolved ? [] : [dispute])),
  http.post('*/admin/disputes/d1/resolve', async ({ request }) => {
    resolved = await request.json();
    return HttpResponse.json({ ...dispute, status: 'RESOLVED_REFUND' });
  }),
  http.get('*/admin/sessions/s1/attendance', () =>
    HttpResponse.json([
      {
        identity: 'student:u1',
        role: 'STUDENT',
        userId: 'u1',
        firstJoinedAt: '2026-11-03T10:00:00Z',
        seconds: 3600,
      },
    ]),
  ),
  http.get('*/public/tutors/:id', () =>
    HttpResponse.json({ userId: TUTOR, fullName: 'Kiran Rao' }),
  ),
  http.get('*/admin/payments', () => HttpResponse.json(released ? [] : [heldPayment])),
  http.post('*/admin/payments/pay2/release', async ({ request }) => {
    released = await request.json();
    return HttpResponse.json({ paymentId: 'pay2', status: 'RELEASED' });
  }),
  http.get('*/admin/ledger/balances', () =>
    HttpResponse.json([
      {
        code: 'held_funds',
        type: 'LIABILITY',
        debitsPaise: 0,
        creditsPaise: 45000,
        balancePaise: 45000,
      },
      {
        code: `tutor_payable:${TUTOR}`,
        type: 'LIABILITY',
        debitsPaise: 0,
        creditsPaise: 40500,
        balancePaise: 40500,
      },
    ]),
  ),
  http.get('*/admin/ledger/reconciliation', () =>
    HttpResponse.json({
      totalDebitsPaise: 90000,
      totalCreditsPaise: 90000,
      balanced: true,
      unbalancedTransactions: [],
      transactionCount: 3,
    }),
  ),
  http.get('*/admin/reconciliation', () =>
    HttpResponse.json({
      ok: false,
      ledger: { balanced: true },
      heldFundsPaise: 45000,
      paymentsChecked: 2,
      providerChecked: 1,
      mismatches: [{ paymentId: 'pay9', check: 'held_funds_vs_payments', expected: 1, actual: 2 }],
    }),
  ),
  http.post('*/admin/payouts', async ({ request }) => {
    const body = (await request.json()) as { reference: string };
    if (body.reference === 'DUPLICATE')
      return HttpResponse.json(
        apiError('DUPLICATE_PAYOUT_REFERENCE', 'This reference was already recorded.'),
        { status: 409 },
      );
    payout = body;
    return HttpResponse.json(
      {
        id: 'po1',
        amountPaise: 40500,
        reference: body.reference,
        createdAt: '2026-11-03T10:00:00Z',
      },
      { status: 201 },
    );
  }),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(async () => {
  server.resetHandlers();
  await session.logout();
  localStorage.clear();
  resolved = payout = released = null;
});
afterAll(() => server.close());

function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <AppProviders session={session} queryClient={createQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('admin: money (phase 12)', () => {
  it('resolves a dispute with a written note', async () => {
    await session.login('admin@example.com', 'pw');
    renderAt('/disputes');
    expect(await screen.findByText('Tutor was absent or very late')).toBeInTheDocument();
    expect(await screen.findByText('Kiran Rao')).toBeInTheDocument();
    expect(await screen.findByText(/60 min/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refund the learner' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Refund' });
    expect(confirm).toBeDisabled();
    await userEvent.type(
      within(dialog).getByLabelText('Decision note'),
      'Attendance shows no tutor.',
    );
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(resolved).toEqual({ outcome: 'REFUND', note: 'Attendance shows no tutor.' }),
    );
    expect(await screen.findByText('No open disputes')).toBeInTheDocument();
  });

  it('releases a held payment early with a note', async () => {
    await session.login('admin@example.com', 'pw');
    renderAt('/money');
    expect(await screen.findByText('order_fake_2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Release' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Note'), 'Learner confirmed by email.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Release now' }));
    await waitFor(() => expect(released).toEqual({ note: 'Learner confirmed by email.' }));
  });

  it('records a UPI payout for an owed tutor and shows server conflicts', async () => {
    await session.login('admin@example.com', 'pw');
    renderAt('/money?tab=payouts');
    expect(await screen.findByText('Kiran Rao')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Record payout' }));
    const dialog = await screen.findByRole('dialog');
    const ref = within(dialog).getByLabelText('UPI transaction reference (UTR)');
    await userEvent.type(ref, 'DUPLICATE');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record payout' }));
    expect(await within(dialog).findByText(/already recorded/)).toBeInTheDocument();
    await userEvent.clear(ref);
    await userEvent.type(ref, 'UTR998877');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record payout' }));
    await waitFor(() =>
      expect(payout).toEqual({ tutorUserId: TUTOR, amountPaise: 40500, reference: 'UTR998877' }),
    );
    expect(await screen.findByText('Payout recorded')).toBeInTheDocument();
  });

  it('shows the books and runs reconciliation on demand', async () => {
    await session.login('admin@example.com', 'pw');
    renderAt('/money?tab=books');
    expect(await screen.findByText('Balanced')).toBeInTheDocument();
    expect(screen.getByText('Learner money held')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Run reconciliation' }));
    expect(await screen.findByText('1 mismatches')).toBeInTheDocument();
    expect(screen.getByText('held funds vs payments')).toBeInTheDocument();
  });
});
