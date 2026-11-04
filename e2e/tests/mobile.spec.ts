import { expect, test, type Page } from '@playwright/test';
import { URLS } from '../playwright.config';
import { adminPerson, freshSkill, signIn, student, verifiedTutor } from './helpers';

// The "mobile" project runs this at Pixel 7 size; also check the narrowest common phone.
test.use({ viewport: { width: 360, height: 740 } });

/** No sideways page scroll; wide tables scroll inside their own box instead. */
async function fits(page: Page, label: string) {
  await page.waitForLoadState('networkidle');
  const { scroll, client, culprit } = await page.evaluate(() => {
    const el = document.documentElement;
    const wide = [...document.querySelectorAll<HTMLElement>('body *')].find((n) => {
      const r = n.getBoundingClientRect();
      return r.right > el.clientWidth + 1 && getComputedStyle(n).position !== 'fixed' && !n.closest('[class*="overflow-x-auto"]');
    });
    return {
      scroll: el.scrollWidth,
      client: el.clientWidth,
      culprit: wide ? `${wide.tagName.toLowerCase()}.${String(wide.className).slice(0, 80)}` : null,
    };
  });
  expect(scroll, `${label} scrolls sideways (widest: ${culprit})`).toBeLessThanOrEqual(client);
}

test('student pages fit a phone', async ({ page }) => {
  for (const path of ['/', '/explore', '/tutors', '/login']) {
    await page.goto(URLS.student + path);
    await fits(page, `student ${path}`);
  }
  await signIn(page, 'student', await student(), '/requests');
  for (const path of ['/requests', '/requests/new', '/groups', '/sessions']) {
    await page.goto(URLS.student + path);
    await fits(page, `student ${path}`);
  }
});

test('tutor pages fit a phone', async ({ page }) => {
  const skill = await freshSkill('Phone Check');
  await signIn(page, 'tutor', await verifiedTutor(skill.id), '/');
  for (const path of ['/', '/profile', '/requests', '/groups', '/earnings']) {
    await page.goto(URLS.tutor + path);
    await fits(page, `tutor ${path}`);
  }
});

test('admin pages fit a phone', async ({ page }) => {
  await signIn(page, 'admin', adminPerson(), '/');
  for (const path of ['/', '/disputes', '/money?tab=payments', '/money?tab=books', '/money?tab=connectivity']) {
    await page.goto(URLS.admin + path);
    await fits(page, `admin ${path}`);
  }
});
