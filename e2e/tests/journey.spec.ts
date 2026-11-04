import { expect, test } from '@playwright/test';
import { URLS } from '../playwright.config';
import {
  adminPerson,
  adminToken,
  api,
  asPerson,
  freshSkill,
  signIn,
  student,
  unique,
  verifiedTutor,
} from './helpers';

/**
 * The core money path, clicked through all three apps:
 * learner posts -> tutor bids -> learner sees it live, accepts and pays (test UPI) ->
 * admin releases early and records the payout -> tutor sees it in Earnings.
 */
test('request, sealed bid, test-mode payment, release, payout, earnings', async ({ browser }) => {
  const skill = await freshSkill('Chart Reading');
  const tutorName = `Kiran ${unique()}`;
  const [tutor, learner] = await Promise.all([verifiedTutor(skill.id, tutorName), student()]);
  const title = `Reversal candles ${unique()}`;

  // ---- learner posts a request in the UI
  const L = await asPerson(browser);
  await signIn(L.page, 'student', learner, '/requests/new');
  await L.page.getByLabel('What do you want to learn?').fill(skill.name.split(' ')[0]!);
  await L.page.getByRole('button', { name: new RegExp(skill.name) }).click();
  await L.page.getByLabel('Headline').fill(title);
  await L.page.getByLabel('What should the tutor know?').fill('I keep misreading hammers and dojis on daily charts.');
  await L.page.getByRole('button', { name: 'Publish request' }).click();
  await expect(L.page.getByRole('heading', { name: title })).toBeVisible();
  await expect(L.page.getByText('No bids yet')).toBeVisible();
  const requestId = L.page.url().split('/requests/')[1]!;

  // ---- tutor finds it and bids
  const T = await asPerson(browser);
  await signIn(T.page, 'tutor', tutor, '/requests');
  await T.page.getByRole('link', { name: new RegExp(title) }).click();
  await T.page.getByLabel('Your price for the session, ₹').fill('437');
  await T.page.getByLabel('Your approach').fill('Ten real charts together, then a checklist you keep.');
  await T.page.getByRole('button', { name: 'Send sealed bid' }).click();
  await expect(T.page.getByRole('heading', { name: 'Your sealed bid' })).toBeVisible();
  await expect(T.page.getByText('₹437')).toBeVisible();

  // ---- learner sees the bid arrive without reloading, accepts and pays in test mode
  await expect(L.page.getByRole('link', { name: tutorName })).toBeVisible();
  await L.page.getByRole('button', { name: /why this ranking/i }).click();
  await expect(L.page.getByText('Teaching outcomes')).toBeVisible();
  await L.page.getByRole('button', { name: 'Accept', exact: true }).click();
  await L.page.getByRole('dialog').getByRole('button', { name: 'Accept and pay' }).click();
  await expect(L.page.getByText('Seat held for you')).toBeVisible();
  await expect(L.page.getByText('Test mode')).toBeVisible();
  await L.page.getByRole('button', { name: 'Pay with UPI' }).click();
  await L.page.getByRole('button', { name: 'Approve test payment' }).click();
  await expect(L.page.getByText('Room opens in')).toBeVisible({ timeout: 30_000 });
  await expect(L.page.getByRole('button', { name: 'Join now' })).toBeDisabled();

  // ---- admin releases it early and records the UPI payout
  const admin = await adminToken();
  const seats = await api<Array<{ participantId: string; requestId: string }>>(
    URLS.student, 'GET', '/student/sessions', learner.accessToken,
  );
  const seat = seats.find((s) => s.requestId === requestId)!;
  const payments = await api<Array<{ participantId: string; providerOrderId: string }>>(
    URLS.admin, 'GET', '/admin/payments?status=HELD', admin,
  );
  const order = payments.find((p) => p.participantId === seat.participantId)!.providerOrderId;

  const A = await asPerson(browser);
  await signIn(A.page, 'admin', adminPerson(), '/money');
  const row = A.page.getByRole('row').filter({ hasText: order });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Release' }).click();
  const dialog = A.page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Release now' })).toBeDisabled();
  await dialog.getByLabel('Note').fill('Learner confirmed the session went well.');
  await dialog.getByRole('button', { name: 'Release now' }).click();
  await expect(row).toHaveCount(0);

  await A.page.getByRole('tab', { name: 'Payouts' }).click();
  const owed = A.page.getByRole('listitem').filter({ hasText: tutorName });
  await expect(owed).toContainText('₹393.30');
  await owed.getByRole('button', { name: 'Record payout' }).click();
  const utr = `UTR${unique()}${unique()}`;
  await A.page.getByRole('dialog').getByLabel('UPI transaction reference (UTR)').fill(utr);
  await A.page.getByRole('dialog').getByRole('button', { name: 'Record payout' }).click();
  await expect(A.page.getByText('Payout recorded')).toBeVisible();
  await expect(owed).toHaveCount(0);

  await A.page.getByRole('tab', { name: 'Books' }).click();
  await expect(A.page.getByText('Balanced')).toBeVisible();
  await A.page.getByRole('button', { name: 'Run reconciliation' }).click();
  await expect(A.page.getByText(/payments · \d+ checked with the provider/)).toBeVisible();

  // ---- tutor sees the payout
  await T.page.goto(`${URLS.tutor}/earnings`);
  await expect(T.page.getByText(utr)).toBeVisible();
  await expect(T.page.getByText('Ready to pay out').locator('..')).toContainText('₹0');

  await Promise.all([L.ctx.close(), T.ctx.close(), A.ctx.close()]);
});
