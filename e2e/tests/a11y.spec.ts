import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { URLS } from '../playwright.config';
import { adminPerson, freshSkill, signIn, student, verifiedTutor } from './helpers';

/** WCAG 2.1 A/AA through axe. Serious and critical findings fail the run; the rest are logged. */
async function audit(page: Page, label: string) {
  // Let data load before scanning (spinners are announced but have nothing to audit).
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('status', { name: /loading/i })).toHaveCount(0);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  for (const v of result.violations)
    console.warn(`[a11y] ${label}: ${v.impact} ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')}`);
  expect(
    blocking.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`),
    `${label} has serious accessibility problems`,
  ).toEqual([]);
}

test('student app pages pass axe', async ({ page }) => {
  for (const path of ['/', '/explore', '/tutors', '/login', '/register']) {
    await page.goto(URLS.student + path);
    await audit(page, `student ${path}`);
  }
  const s = await student();
  await signIn(page, 'student', s, '/requests');
  for (const path of ['/requests', '/requests/new', '/groups', '/sessions', '/account']) {
    await page.goto(URLS.student + path);
    await audit(page, `student ${path}`);
  }
});

test('tutor app pages pass axe', async ({ page }) => {
  await page.goto(URLS.tutor + '/login');
  await audit(page, 'tutor /login');
  const skill = await freshSkill('Axe Check');
  const t = await verifiedTutor(skill.id);
  await signIn(page, 'tutor', t, '/');
  for (const path of ['/', '/profile', '/requests', '/groups', '/bids', '/sessions', '/earnings']) {
    await page.goto(URLS.tutor + path);
    await audit(page, `tutor ${path}`);
  }
});

test('admin app pages pass axe', async ({ page }) => {
  await page.goto(URLS.admin + '/login');
  await audit(page, 'admin /login');
  await signIn(page, 'admin', adminPerson(), '/');
  for (const path of [
    '/',
    '/verification',
    '/catalog',
    '/cases',
    '/disputes',
    '/money?tab=payments',
    '/money?tab=payouts',
    '/money?tab=books',
    '/money?tab=connectivity',
  ]) {
    await page.goto(URLS.admin + path);
    await audit(page, `admin ${path}`);
  }
});

test('dialogs trap focus and close on Escape', async ({ page }) => {
  // The report dialog on a tutor's public page: a signed-in learner can always open it.
  const skill = await freshSkill('Focus Check');
  const tutor = await verifiedTutor(skill.id, 'Focus Tutor');
  const s = await student();
  await signIn(page, 'student', s, `/tutors/${tutor.user.id}`);
  const report = page.getByRole('button', { name: /report/i });
  await report.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(report).toBeFocused();
});
