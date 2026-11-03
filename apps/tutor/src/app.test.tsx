import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders, createQueryClient } from '@tutora/core';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { session } from './api';
import { routeTree, safeRedirect } from './router';

const user = {
  id: 'u1',
  email: 'asha@example.com',
  fullName: 'Asha Verma',
  accountType: 'MEMBER',
  staffRole: null,
  status: 'ACTIVE',
  createdAt: '2026-11-01T00:00:00Z',
};
const tokens = {
  accessToken: 'access-1',
  accessTokenExpiresIn: 900,
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: '',
  tokenType: 'Bearer',
};

const server = setupServer(
  http.get('*/tutor/notifications', () => HttpResponse.json([])),
  http.post('*/tutor/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password !== 'correct-horse-battery') {
      return HttpResponse.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email or password is incorrect.',
            details: {},
            requestId: 'req_1',
          },
        },
        { status: 401 },
      );
    }
    return HttpResponse.json({ ...tokens, user });
  }),
  http.post('*/tutor/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('*/tutor/me', ({ request }) =>
    request.headers.get('authorization') === 'Bearer access-1'
      ? HttpResponse.json(user)
      : HttpResponse.json(
          { error: { code: 'UNAUTHENTICATED', message: 'Sign in', details: {} } },
          { status: 401 },
        ),
  ),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
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

describe('tutor app: accounts', () => {
  it('sends signed-out visitors to sign in, then back to where they were going', async () => {
    const router = renderAt('/account');
    const email = await screen.findByLabelText('Email');
    await userEvent.type(email, 'asha@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/account'));
    expect(await screen.findByText('asha@example.com')).toBeInTheDocument();
    expect(localStorage.getItem('tutora.tutor.refreshToken')).toBe('refresh-1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('shows the backend error for wrong credentials', async () => {
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'asha@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument();
  });

  it('only allows same-app redirects after sign-in', () => {
    expect(safeRedirect('/account')).toBe('/account');
    expect(safeRedirect('//evil.example')).toBe('/');
    expect(safeRedirect('https://evil.example')).toBe('/');
    expect(safeRedirect(undefined)).toBe('/');
    expect(safeRedirect('/login?redirect=%2Faccount')).toBe('/');
    expect(safeRedirect('/logins')).toBe('/logins');
  });
});
