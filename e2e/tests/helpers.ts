import { expect, type Browser, type Page } from '@playwright/test';
import { URLS } from '../playwright.config';

/** Seeding goes through the same Vite proxies the apps use, so it hits the real backend. */
export const PASSWORD = 'e2e-password-123';
const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
let n = 0;
export const email = (tag: string) => `pw.${tag}.${run}.${++n}@example.test`;

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

export async function api<T = unknown>(
  base: string,
  method: string,
  path: string,
  token?: string | null,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const r = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  const json = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 300)}`);
  return json as T;
}

interface Auth {
  accessToken: string;
  user: { id: string; fullName: string };
}
export interface Person extends Auth {
  email: string;
}

let adminCache: { token: string; at: number } | null = null;

/** One admin sign-in per worker (logins are rate limited); access tokens live for 15 minutes. */
export async function adminToken(): Promise<string> {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD)
    throw new Error('Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (the backend seed admin).');
  if (adminCache && Date.now() - adminCache.at < 10 * 60_000) return adminCache.token;
  const r = await api<Auth>(URLS.admin, 'POST', '/admin/auth/login', null, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  adminCache = { token: r.accessToken, at: Date.now() };
  return r.accessToken;
}

export async function skillBySlug(slug = 'technical-analysis') {
  return api<{ id: string; name: string; slug: string }>(URLS.student, 'GET', `/public/skills/${slug}`);
}

/**
 * A skill created just for this run, so lists (marketplace, groups, payments) only contain what
 * this run made, however many earlier runs left data behind.
 */
export async function freshSkill(label: string) {
  const admin = await adminToken();
  const cats = await api<Array<{ id: string; parentId: string | null }>>(
    URLS.admin,
    'GET',
    '/admin/catalog/categories',
    admin,
  );
  const cat = cats.find((c) => c.parentId === null) ?? cats[0];
  if (!cat) throw new Error('No catalog categories: seed the backend first.');
  const suffix = `${run}${++n}`.slice(-9);
  return api<{ id: string; name: string; slug: string }>(
    URLS.admin,
    'POST',
    '/admin/catalog/skills',
    admin,
    {
      categoryId: cat.id,
      name: `${label} ${suffix}`,
      slug: `${label.toLowerCase().replace(/[^a-z]+/g, '-')}-${suffix}`,
      description: 'Created by the end-to-end tests.',
    },
  );
}

export const unique = () => `${run}${++n}`.slice(-6);

export async function student(fullName = 'Meera Nair'): Promise<Person> {
  const e = email('s');
  const r = await api<Auth>(URLS.student, 'POST', '/student/auth/register', null, {
    email: e,
    password: PASSWORD,
    fullName,
  });
  return { ...r, email: e };
}

/** A verified tutor with an approved skill (the admin steps are what Phase 4 covers in the UI). */
export async function verifiedTutor(skillId: string, fullName = 'Kiran Rao'): Promise<Person> {
  const e = email('t');
  const t = await api<Auth>(URLS.tutor, 'POST', '/tutor/auth/register', null, {
    email: e,
    password: PASSWORD,
    fullName,
  });
  await api(URLS.tutor, 'PUT', '/tutor/profile', t.accessToken, {
    headline: 'Price-action educator',
    bio: 'Eight years teaching charting and risk to beginners.',
    payoutUpiId: 'kiran@okicici',
  });
  await api(URLS.tutor, 'PUT', `/tutor/skills/${skillId}`, t.accessToken, {
    summary: 'Candles, trends and position sizing for beginners.',
    evidenceLinks: ['https://example.com/nism'],
  });
  await api(URLS.tutor, 'POST', '/tutor/profile/verification', t.accessToken);
  const admin = await adminToken();
  await api(URLS.admin, 'POST', `/admin/tutors/${t.user.id}/verification/approve`, admin, {
    badge: 'VERIFIED',
  });
  await api(URLS.admin, 'POST', `/admin/tutors/${t.user.id}/skills/${skillId}/approve`, admin);
  return { ...t, email: e };
}

export async function publishedRequest(
  s: Person,
  skillId: string,
  body: { title: string; description: string; level?: string },
) {
  const r = await api<{ id: string }>(URLS.student, 'POST', '/student/requests', s.accessToken, {
    skillId,
    level: body.level ?? 'BEGINNER',
    title: body.title,
    description: body.description,
  });
  await api(URLS.student, 'POST', `/student/requests/${r.id}/publish`, s.accessToken);
  return r;
}

/** Signs in through the app's own login page. */
export async function signIn(page: Page, app: keyof typeof URLS, who: { email: string }, to = '/') {
  await page.goto(`${URLS[app]}/login?redirect=${encodeURIComponent(to)}`);
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(app === 'admin' ? (ADMIN_PASSWORD ?? '') : PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(new RegExp(`${URLS[app]}${to.replace(/[?]/g, '\\?')}`));
}

export const adminPerson = () => ({ email: ADMIN_EMAIL ?? '' });

/** Separate browser context per person, like separate devices. */
export async function asPerson(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
