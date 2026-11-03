import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { name: 'ui', environment: 'jsdom', setupFiles: ['../../test/setup-dom.ts'] } });
