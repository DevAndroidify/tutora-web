import { expect, test } from '@playwright/test';
import { URLS } from '../playwright.config';
import {
  api,
  asPerson,
  freshSkill,
  publishedRequest,
  signIn,
  student,
  unique,
  verifiedTutor,
} from './helpers';

/**
 * Group sessions: near-identical requests become a group; members join from an invitation, a tutor
 * bids a seat price with seat limits, a member accepts for the group and pays their own seat.
 */
test('group invitation, group bid, accept for the group, pay a seat', async ({ browser }) => {
  const skill = await freshSkill('Options Basics');
  const tutorName = `Ritu ${unique()}`;
  const [tutor, a, b] = await Promise.all([
    verifiedTutor(skill.id, tutorName),
    student('Asha Verma'),
    student('Ravi Kumar'),
  ]);
  const brief = {
    title: `Calls and puts from zero ${unique()}`,
    description: 'Why most beginners lose money on weekly expiries, with real option chains.',
    level: 'BEGINNER',
  };
  const reqA = await publishedRequest(a, skill.id, brief);
  await publishedRequest(b, skill.id, brief);

  // Matching runs in the worker after publish.
  type Invite = { id: string; status: string; pool: { id: string } };
  let inviteB: Invite | undefined;
  await expect
    .poll(
      async () => {
        const [ia, ib] = await Promise.all([
          api<Invite[]>(URLS.student, 'GET', '/student/pools/invites', a.accessToken),
          api<Invite[]>(URLS.student, 'GET', '/student/pools/invites', b.accessToken),
        ]);
        inviteB = ib[0];
        return ia.length > 0 && ib.length > 0;
      },
      { timeout: 45_000 },
    )
    .toBe(true);

  // ---- learner A joins from the UI; B joins via the API
  const A = await asPerson(browser);
  await signIn(A.page, 'student', a, '/groups');
  await expect(A.page.getByRole('heading', { name: 'Invitations · 1' })).toBeVisible();
  await A.page.getByRole('button', { name: 'Join group' }).click();
  await expect(A.page.getByRole('heading', { name: `Your ${skill.name} group` })).toBeVisible();
  await expect(A.page.getByText('No offers yet')).toBeVisible();
  await api(URLS.student, 'POST', `/student/pools/invites/${inviteB!.id}/accept`, b.accessToken);

  // The request page now points at the group instead of individual bids.
  await A.page.goto(`${URLS.student}/requests/${reqA.id}`);
  await expect(A.page.getByText("You're in a group for this request")).toBeVisible();

  // ---- tutor bids on the group
  const T = await asPerson(browser);
  await signIn(T.page, 'tutor', tutor, '/groups');
  await expect(T.page.getByText('2 learners want the same thing')).toBeVisible();
  await T.page.getByRole('button', { name: 'Bid on this group' }).click();
  await T.page.getByLabel('Price per seat, ₹').fill('199');
  await T.page.getByLabel('Minimum learners').fill('2');
  await T.page.getByLabel('Your approach').fill('Small group with live option chains and a paper-trading drill.');
  await T.page.getByRole('button', { name: 'Send group bid' }).click();
  await expect(T.page.getByText('Group bid sent')).toBeVisible();

  // ---- learner A accepts it for the group and lands on the seat checkout
  await A.page.goto(`${URLS.student}/groups`);
  await expect(A.page.getByRole('link', { name: tutorName })).toBeVisible();
  await expect(A.page.getByText(/per seat · 2–\d learners/)).toBeVisible();
  await A.page.getByRole('button', { name: 'Accept for the group' }).click();
  await A.page.getByRole('dialog').getByRole('button', { name: 'Accept and pay' }).click();
  await expect(A.page.getByText('Seat held for you')).toBeVisible();
  await expect(A.page.getByText('₹199', { exact: true })).toBeVisible();
  await A.page.getByRole('button', { name: 'Pay with UPI' }).click();
  await A.page.getByRole('button', { name: 'Approve test payment' }).click();
  await expect(A.page.getByText('Paid')).toBeVisible({ timeout: 30_000 });

  // ---- learner B sees the chosen offer and takes the second seat; minimum reached
  const B = await asPerson(browser);
  await signIn(B.page, 'student', b, '/groups');
  await expect(B.page.getByText('Your group chose an offer')).toBeVisible();
  await B.page.getByRole('button', { name: 'Take my seat' }).click();
  await B.page.getByRole('dialog').getByRole('button', { name: 'Take my seat and pay' }).click();
  await B.page.getByRole('button', { name: 'Pay with UPI' }).click();
  await B.page.getByRole('button', { name: 'Approve test payment' }).click();
  await expect(B.page.getByText('Room opens in')).toBeVisible({ timeout: 30_000 });

  // ---- the tutor has a scheduled group session
  await T.page.goto(`${URLS.tutor}/sessions`);
  await expect(T.page.getByText(/scheduled/i).first()).toBeVisible();

  await Promise.all([A.ctx.close(), B.ctx.close(), T.ctx.close()]);
});
