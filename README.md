# Tutora web

Frontends for the [Tutora backend](https://github.com/DevAndroidify/tutora): a marketplace where
learners post what they want to learn (any skill), verified tutors send sealed bids, and sessions run
live in the browser. Three apps share one design system and set of packages:

| App | Port | For |
| --- | --- | --- |
| `apps/student` | 5173 | Learners: browse skills and tutors, post requests, compare bids, pay (test-mode UPI), join sessions, replays, group sessions |
| `apps/tutor` | 5174 | Tutors: profile and verification, marketplace, sealed and group bids, sessions, earnings |
| `apps/admin` | 5175 | Staff: verification, catalog, trust and safety, disputes, payments, payouts, books |

Architecture, backend contract and the phase plan: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Develop

Requires Node 24 and Yarn 4 (`corepack enable`), and the backend running on `:3000`.

```sh
yarn install
yarn dev            # all three apps; each proxies its API area to :3000
yarn dev:student    # or one app
```

## Check

```sh
yarn lint && yarn typecheck
yarn test           # unit and integration tests (Vitest + Testing Library + MSW)
yarn build && yarn budgets   # production builds and gzip size budgets
yarn e2e            # Playwright against the real backend: see e2e/README.md
yarn api:sync       # regenerate API types from the backend's OpenAPI documents
```

## Ship

`docker build --build-arg APP=student .` builds a non-root nginx image with a CSP, security headers
and the API proxied per app area. See [`docker/README.md`](docker/README.md).

Payments use the backend's test providers only (fake UPI simulator or Razorpay **test** keys); no
real money moves.
