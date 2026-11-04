import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** The API runs on :3000 in development; proxy its areas so the app is same-origin (no CORS). */
const api = process.env.TUTORA_API_URL ?? 'http://localhost:3000';
const proxied = ['/student/', '/public/', '/health', '/dev/'];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      ...Object.fromEntries(proxied.map((p) => [p, { target: api, changeOrigin: true }])),
      '/socket.io': { target: api, ws: true, changeOrigin: true },
    },
  },
  preview: { port: 5173, strictPort: true },
  test: {
    name: 'student',
    environment: 'jsdom',
    setupFiles: ['../../test/setup-dom.ts'],
    testTimeout: 15_000,
    // Node's fetch needs absolute URLs; in the browser '' means same-origin via the Vite proxy.
    env: { VITE_API_BASE_URL: 'http://localhost:3000' },
  },
});
