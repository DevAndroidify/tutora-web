import { defineConfig } from 'vitest/config';

/** One test run across every app and package. */
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    // jsdom app tests are memory-heavy; a few workers keeps small machines (and CI) from timing out.
    maxWorkers: 2,
  },
});
