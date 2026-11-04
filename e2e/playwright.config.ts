import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end journeys against the real backend (API on :3000, worker running, Postgres/Redis/MinIO
 * up, UPI_PROVIDER=fake). Playwright starts the three Vite apps; the backend is started separately
 * (see e2e/README.md). The live-room spec also needs LiveKit on :7880 and skips without it.
 */
const host = '127.0.0.1';
export const URLS = {
  student: `http://${host}:5173`,
  tutor: `http://${host}:5174`,
  admin: `http://${host}:5175`,
};

const app = (name: 'student' | 'tutor' | 'admin', port: number) => ({
  command: `yarn workspace @tutora/${name}-app dev --host ${host} --port ${port} --strictPort`,
  url: `http://${host}:${port}`,
  reuseExistingServer: true,
  timeout: 120_000,
  cwd: '..',
});

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      // Fake camera and microphone so the live room can publish real media headlessly.
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec/ },
  ],
  webServer: [app('student', 5173), app('tutor', 5174), app('admin', 5175)],
});
