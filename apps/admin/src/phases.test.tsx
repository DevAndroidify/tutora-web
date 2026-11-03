import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders, createQueryClient } from '@tutora/core';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { skill, staff, tokens } from '../../../test/fixtures';
import { session } from './api';
import { routeTree } from './router';

const pendingProfile = {
  userId: 't1',
  fullName: 'Neha Shah',
  email: 'neha@example.com',
  headline: 'Price-action educator',
  bio: 'Eight years.',
  experienceYears: 8,
  languages: ['English'],
  badge: 'NONE',
  verificationStatus: 'PENDING',
  payoutUpiId: 'neha@okhdfcbank',
  verificationSubmittedAt: '2026-11-03T10:00:00Z',
  verificationDecidedAt: null,
  verificationRejectionReason: null,
  skills: [
    {
      skill,
      status: 'PENDING',
      experienceYears: 8,
      summary: 'Candles.',
      evidenceLinks: [],
      rejectionReason: null,
      decidedAt: null,
    },
  ],
};
const caseDetail = {
  case: {
    id: 'case-1',
    status: 'OPEN',
    priority: 5,
    assignedTo: null,
    resolution: null,
    openedAt: '2026-11-03T10:00:00Z',
    closedAt: null,
  },
  subject: { id: 't1', fullName: 'Neha Shah', email: 'neha@example.com', status: 'ACTIVE' },
  history: { strikes: 0, dismissed: 0 },
  reports: [
    {
      id: 'r1',
      reporterUserId: 'u1',
      reason: 'FINANCIAL_TIPS',
      entityType: null,
      entityId: null,
      details: 'Told me which stock to buy',
      reportedFromApp: 'student',
      createdAt: '2026-11-03T10:00:00Z',
    },
  ],
  flags: [],
  actions: [],
  sanctions: [],
};
const calls: Array<{ path: string; body: unknown }> = [];
let profiles = [pendingProfile];

const server = setupServer(
  http.post('*/admin/auth/login', () => HttpResponse.json({ ...tokens, user: staff })),
  http.post('*/admin/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('*/admin/tutors/profile-reviews', () => HttpResponse.json(profiles)),
  http.get('*/admin/tutors/skill-reviews', () => HttpResponse.json([])),
  http.post('*/admin/tutors/:userId/verification/approve', async ({ request, params }) => {
    calls.push({ path: `approve:${params.userId}`, body: await request.json() });
    profiles = [];
    return HttpResponse.json({ ...pendingProfile, verificationStatus: 'VERIFIED' });
  }),
  http.get('*/admin/moderation/cases/case-1', () => HttpResponse.json(caseDetail)),
  http.post('*/admin/moderation/cases/case-1/actions', async ({ request }) => {
    const body = (await request.json()) as { action: string; reason: string };
    calls.push({ path: 'action', body });
    return HttpResponse.json({
      ...caseDetail,
      case: {
        ...caseDetail.case,
        status: 'ACTIONED',
        resolution: body.reason,
        closedAt: '2026-11-03T11:00:00Z',
      },
      actions: [
        {
          id: 'a1',
          actorUserId: 'admin-1',
          action: body.action,
          reason: body.reason,
          durationDays: null,
          createdAt: '2026-11-03T11:00:00Z',
        },
      ],
    });
  }),
  http.get('*/admin/moderation/cases', () => HttpResponse.json([])),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(async () => {
  server.resetHandlers();
  await session.logout();
  localStorage.clear();
  calls.length = 0;
  profiles = [pendingProfile];
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

describe('admin: verification (phase 4)', () => {
  it('approves a pending tutor with a badge and clears the queue', async () => {
    await session.login('admin@example.com', 'pw');
    renderAt('/verification');
    expect(await screen.findByRole('heading', { name: 'Neha Shah' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve · Expert' }));
    await waitFor(() =>
      expect(calls).toContainEqual({ path: 'approve:t1', body: { badge: 'EXPERT' } }),
    );
    expect(await screen.findByText('Queue is clear')).toBeInTheDocument();
  });
});

describe('admin: trust & safety (phase 5)', () => {
  it('records a warning on a case', async () => {
    await session.login('admin@example.com', 'pw');
    renderAt('/cases/case-1');
    expect(await screen.findByText('Gave stock tips or investment advice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record decision' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Reason'), 'No stock tips in sessions');
    await userEvent.click(screen.getByRole('button', { name: 'Record decision' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        path: 'action',
        body: { action: 'WARN', reason: 'No stock tips in sessions' },
      }),
    );
    expect(await screen.findByText('Actioned')).toBeInTheDocument();
  });
});
