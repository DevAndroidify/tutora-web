// Performance budgets for the production builds (run after `yarn build`).
// "Initial" = everything index.html makes the browser fetch before the first render:
// the entry script, its modulepreloads and stylesheets. Sizes are gzip, like on the wire.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const BUDGETS = {
  // Initial JS per app (measured Phase 14: student 138, tutor 137, admin 126 kB; was 177-186 kB
  // before route splitting). Pages, the auth forms and the live room are separate chunks.
  initialJs: { student: 150 * KB, tutor: 150 * KB, admin: 140 * KB },
  initialCss: 10 * KB,
  // Any single lazy chunk (the LiveKit room is the big one, loaded only when joining).
  lazyChunk: 160 * KB,
};

const gz = (file) => gzipSync(readFileSync(file)).length;
const fmt = (n) => `${(n / KB).toFixed(1)} kB`;
let failed = false;
const rows = [];

for (const app of ['student', 'tutor', 'admin']) {
  const dist = join('apps', app, 'dist');
  let html;
  try {
    html = readFileSync(join(dist, 'index.html'), 'utf8');
  } catch {
    console.error(`No build for ${app}: run "yarn build" first.`);
    process.exit(2);
  }
  const refs = (re) => [...html.matchAll(re)].map((m) => m[1].replace(/^\//, ''));
  const js = [
    ...refs(/<script[^>]+type="module"[^>]+src="([^"]+)"/g),
    ...refs(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
  ];
  const css = refs(/<link[^>]+rel="stylesheet"[^>]+href="(\/assets\/[^"]+)"/g);
  const initialJs = js.reduce((n, f) => n + gz(join(dist, f)), 0);
  const initialCss = css.reduce((n, f) => n + gz(join(dist, f)), 0);
  const initial = new Set([...js, ...css].map((f) => f.split('/').pop()));
  const lazy = readdirSync(join(dist, 'assets'))
    .filter((f) => f.endsWith('.js') && !initial.has(f))
    .map((f) => ({ f, size: gz(join(dist, 'assets', f)) }))
    .sort((a, b) => b.size - a.size);
  const biggest = lazy[0];

  const check = (label, size, budget) => {
    const ok = size <= budget;
    if (!ok) failed = true;
    rows.push(`${ok ? 'ok  ' : 'OVER'}  ${app.padEnd(8)} ${label.padEnd(26)} ${fmt(size).padStart(9)} / ${fmt(budget)}`);
  };
  check('initial JS', initialJs, BUDGETS.initialJs[app]);
  check('initial CSS', initialCss, BUDGETS.initialCss);
  if (biggest) check(`largest lazy (${biggest.f.split('-')[0]})`, biggest.size, BUDGETS.lazyChunk);
  const total = readdirSync(join(dist, 'assets')).reduce((n, f) => n + statSync(join(dist, 'assets', f)).size, 0);
  rows.push(`      ${app.padEnd(8)} ${'chunks / raw total'.padEnd(26)} ${String(lazy.length + js.length).padStart(4)} files, ${fmt(total)}`);
}

console.log(rows.join('\n'));
if (failed) {
  console.error('\nA performance budget is exceeded. Split the code or raise the budget on purpose.');
  process.exit(1);
}
