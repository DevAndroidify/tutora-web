import { defineConfig } from 'vitest/config';

/** One test run across every app and package. */
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
  },
});
