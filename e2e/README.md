# End-to-end tests (Playwright)

Real browsers against the real backend. Nothing is mocked: payments go through the backend's fake
UPI provider (test mode only), the live room uses a real LiveKit server.

| Spec | What it proves |
| --- | --- |
| `journey.spec.ts` | Learner posts a request → tutor bids → learner sees it live, accepts, pays (test UPI) → admin releases early and records the UPI payout → tutor sees it in Earnings. Books stay balanced. |
| `groups.spec.ts` | Two identical requests form a group → invitations → tutor group bid with seat limits → one member accepts for the group, both pay their own seat → session scheduled. |
| `live.spec.ts` | Tutor and learner join the LiveKit room from the session page (fake camera/mic), the learner decodes the tutor's video, switches to audio only, both leave. Skips if LiveKit is down. |
| `a11y.spec.ts` | axe (WCAG 2.1 A/AA) on the main pages of all three apps, signed out and in. Serious/critical findings fail. Dialogs trap focus and close on Escape. |
| `mobile.spec.ts` | No sideways scrolling at 360px on the main pages of all three apps. |
| `prod.spec.ts` | A production image: security headers, CSP with no violations while signing in, `/dev` blocked, long-lived asset caching. Runs only with `E2E_PROD_STUDENT_URL`. |

## Running

1. Start the backend from `../tutora` (Postgres, Redis and MinIO via `docker compose up -d`, then
   the API and the worker). `UPI_PROVIDER=fake`. For `live.spec.ts`, also run LiveKit with
   `--node-ip 127.0.0.1` so a local browser can reach it.
2. Export the seeded admin login and run:

```sh
export E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=...
yarn e2e                      # starts the three Vite apps itself (or reuses running ones)
yarn e2e journey.spec.ts      # one spec
```

The suite signs in many fresh accounts. The backend allows 5 logins per 15 minutes per account and
IP, so for repeated local runs start the API with a higher `LOGIN_RATE_LIMIT_MAX`.

Each run creates its own skill in the catalog, so earlier runs' requests, groups and payments never
get in the way. Reports land in `e2e/playwright-report/`.

Playwright is pinned to 1.62.1 (Chromium build 1234); `npx playwright install chromium` if the
browser is missing.
