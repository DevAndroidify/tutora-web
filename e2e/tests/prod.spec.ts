import { expect, test } from '@playwright/test';
import { PASSWORD, student } from './helpers';

/**
 * Smoke test for a production image (nginx + CSP). Runs only when E2E_PROD_STUDENT_URL points at a
 * running student container, e.g. http://127.0.0.1:8081 (see docker/README.md).
 */
const PROD = process.env.E2E_PROD_STUDENT_URL;
test.skip(!PROD, 'Set E2E_PROD_STUDENT_URL to smoke-test a production image');

test('production image: headers, routing and a signed-in page under the CSP', async ({ page, request }) => {
  const res = await request.get(`${PROD}/requests`);
  expect(res.status()).toBe(200); // client-side route served by index.html
  const h = res.headers();
  expect(h['content-security-policy']).toContain("default-src 'self'");
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['cache-control']).toContain('no-cache');
  expect((await request.get(`${PROD}/dev/fake-upi/orders/x/pay`)).status()).toBe(404);
  expect((await request.get(`${PROD}/healthz`)).status()).toBe(200);

  const violations: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  page.on('pageerror', (e) => violations.push(e.message));

  await page.goto(`${PROD}/`);
  const asset = await page.evaluate(() => (document.querySelector('script[type=module]') as HTMLScriptElement).src);
  const a = await request.get(asset);
  expect(a.headers()['cache-control']).toMatch(/max-age=\d{7,}/);

  // Sign in through the proxied API and load a page that also opens the realtime socket.
  const s = await student();
  await page.goto(`${PROD}/login?redirect=%2Frequests`);
  await page.getByLabel('Email').fill(s.email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'My requests' })).toBeVisible();
  await page.goto(`${PROD}/explore`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(violations).toEqual([]);
});
