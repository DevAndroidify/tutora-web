import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders, createQueryClient } from '@tutora/core';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  apiError,
  categories,
  member,
  page,
  skill,
  skill2,
  skillDetail,
  tokens,
} from '../../../test/fixtures';
import { session } from './api';
import { routeTree } from './router';

const created: unknown[] = [];
const draft = {
  id: 'req-1',
  skill: { id: skill.id, slug: skill.slug, name: skill.name, learnerNotice: skill.learnerNotice },
  topicId: null,
  level: 'BEGINNER',
  title: 'Read candlestick charts',
  description: 'Call me on [hidden], I want the basics of candles.',
  preferredLanguage: null,
  budgetHintPaise: 50000,
  currency: 'INR',
  status: 'DRAFT',
  publishedAt: null,
  expiresAt: null,
  createdAt: '2026-11-03T10:00:00Z',
  attachments: [],
};

const server = setupServer(
  http.get('*/public/categories', () => HttpResponse.json(categories)),
  http.get('*/public/skills', ({ request }) => {
    const q = new URL(request.url).searchParams.get('q');
    const items = [skill, skill2].filter(
      (s) => !q || s.name.toLowerCase().includes(q.toLowerCase()),
    );
    return HttpResponse.json(page(items));
  }),
  http.get('*/public/skills/:id', () => HttpResponse.json(skillDetail)),
  http.get('*/public/tutors', () => HttpResponse.json(page([]))),
  http.post('*/student/auth/login', () => HttpResponse.json({ ...tokens, user: member })),
  http.post('*/student/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.post('*/student/requests', async ({ request }) => {
    const body = await request.json();
    created.push(body);
    return HttpResponse.json(draft, { status: 201 });
  }),
  http.post('*/student/requests/req-1/publish', () =>
    HttpResponse.json({
      ...draft,
      status: 'OPEN',
      publishedAt: '2026-11-03T10:00:00Z',
      expiresAt: '2099-01-01T00:00:00Z',
    }),
  ),
  http.get('*/student/requests/req-1/bids', () => HttpResponse.json([])),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(async () => {
  server.resetHandlers();
  await session.logout();
  localStorage.clear();
  created.length = 0;
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

describe('student: catalog (phase 2)', () => {
  it('shows the front page publicly and searches skills', async () => {
    const router = renderAt('/');
    expect(await screen.findByRole('heading', { name: /learn anything/i })).toBeInTheDocument();
    expect((await screen.findAllByText('Technical Analysis')).length).toBeGreaterThan(0);

    await router.navigate({ to: '/explore' });
    await userEvent.type(await screen.findByLabelText('Search skills'), 'video');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ q: 'video' }));
    expect(await screen.findByRole('heading', { name: 'Results for “video”' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Technical Analysis')).not.toBeInTheDocument());
    expect(screen.getByText('Video Editing')).toBeInTheDocument();
  });

  it('shows the learner notice and a request call to action on a skill page', async () => {
    renderAt('/skills/technical-analysis');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Technical Analysis' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/not investment advice/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Post a request for Technical Analysis' }),
    ).toHaveAttribute('href', '/requests/new?skill=technical-analysis');
  });
});

describe('student: learning requests (phase 6)', () => {
  it('validates, creates and publishes a request', async () => {
    await session.login('asha@example.com', 'pw');
    const router = renderAt('/requests/new?skill=technical-analysis');

    // Preset skill from the skill page link.
    expect(await screen.findByText('Technical Analysis', { selector: 'span' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Publish request' }));
    expect(await screen.findByText(/give it a short headline/i)).toBeInTheDocument();
    expect(created).toHaveLength(0);

    await userEvent.type(screen.getByLabelText('Headline'), 'Read candlestick charts');
    await userEvent.type(
      screen.getByLabelText('What should the tutor know?'),
      'Call me on 9876543210, I want the basics.',
    );
    await userEvent.type(screen.getByLabelText('Budget per session, ₹ (optional)'), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Publish request' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/requests/req-1'));
    expect(created[0]).toMatchObject({
      skillId: 'skill-ta',
      level: 'BEGINNER',
      budgetHintPaise: 50000,
    });
    expect(await screen.findByText(/contact details were hidden/i)).toBeInTheDocument();
    const facts = screen.getByText('Budget').parentElement!;
    expect(within(facts).getByText('₹500')).toBeInTheDocument();
  });

  it('shows server field errors next to the field', async () => {
    server.use(
      http.post('*/student/requests', () =>
        HttpResponse.json(
          apiError('VALIDATION_FAILED', 'Some fields are invalid.', {
            fields: { title: ['title is too long'] },
          }),
          {
            status: 400,
          },
        ),
      ),
    );
    await session.login('asha@example.com', 'pw');
    renderAt('/requests/new?skill=technical-analysis');
    await screen.findByText('Technical Analysis', { selector: 'span' });
    await userEvent.type(screen.getByLabelText('Headline'), 'Valid title here');
    await userEvent.type(
      screen.getByLabelText('What should the tutor know?'),
      'Long enough description.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    expect(await screen.findByText('title is too long')).toBeInTheDocument();
  });
});
