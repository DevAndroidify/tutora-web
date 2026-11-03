import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders, createQueryClient } from '@tutora/core';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { apiError, categories, member, page, skill, tokens } from '../../../test/fixtures';
import { session } from './api';
import { routeTree } from './router';

const profile = {
  userId: 'u1',
  headline: 'Charts teacher',
  bio: 'Teaching price action.',
  experienceYears: 5,
  languages: ['English'],
  badge: 'NONE',
  verificationStatus: 'NOT_SUBMITTED',
  payoutUpiId: 'asha@okicici',
  verificationSubmittedAt: null,
  verificationDecidedAt: null,
  verificationRejectionReason: null,
  skills: [] as unknown[],
};
let putSkillBody: unknown = null;

const server = setupServer(
  http.post('*/tutor/auth/login', () => HttpResponse.json({ ...tokens, user: member })),
  http.post('*/tutor/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('*/tutor/profile', () => HttpResponse.json(profile)),
  http.get('*/tutor/skill-suggestions', () => HttpResponse.json([])),
  http.get('*/public/categories', () => HttpResponse.json(categories)),
  http.get('*/public/skills', () => HttpResponse.json(page([skill]))),
  http.post('*/tutor/profile/verification', () =>
    HttpResponse.json(
      apiError('PROFILE_INCOMPLETE', 'Complete your profile before submitting.', {
        missing: ['at least one skill'],
      }),
      {
        status: 400,
      },
    ),
  ),
  http.put('*/tutor/skills/:skillId', async ({ request }) => {
    putSkillBody = await request.json();
    return HttpResponse.json({
      ...profile,
      skills: [
        {
          skill,
          status: 'PENDING',
          experienceYears: null,
          summary: 'x'.repeat(25),
          evidenceLinks: [],
          rejectionReason: null,
          decidedAt: null,
        },
      ],
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(async () => {
  server.resetHandlers();
  await session.logout();
  localStorage.clear();
  putSkillBody = null;
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

describe('tutor: onboarding (phase 3)', () => {
  it('lists what is missing when verification is submitted too early', async () => {
    await session.login('asha@example.com', 'pw');
    renderAt('/profile');
    await userEvent.click(await screen.findByRole('button', { name: 'Submit for review' }));
    expect(await screen.findByText('at least one skill')).toBeInTheDocument();
  });

  it('adds a skill claim, checking summary length and https evidence first', async () => {
    await session.login('asha@example.com', 'pw');
    renderAt('/profile');
    await userEvent.click(await screen.findByRole('button', { name: '+ Add a skill' }));
    await userEvent.click(await screen.findByRole('button', { name: /Technical Analysis/ }));
    await userEvent.type(screen.getByLabelText('How you teach it'), 'Too short');
    await userEvent.type(screen.getByLabelText('Evidence links'), 'http://insecure.example');
    await userEvent.click(screen.getByRole('button', { name: 'Add skill for review' }));
    expect(await screen.findByText(/at least 20 characters/)).toBeInTheDocument();
    expect(screen.getByText(/must start with https/)).toBeInTheDocument();
    expect(putSkillBody).toBeNull();

    await userEvent.type(screen.getByLabelText('How you teach it'), ' but now it is long enough');
    await userEvent.clear(screen.getByLabelText('Evidence links'));
    await userEvent.type(screen.getByLabelText('Evidence links'), 'https://example.com/cert');
    await userEvent.click(screen.getByRole('button', { name: 'Add skill for review' }));
    expect(await screen.findByRole('heading', { name: 'Technical Analysis' })).toBeInTheDocument();
    expect(putSkillBody).toMatchObject({ evidenceLinks: ['https://example.com/cert'] });
  });
});
