# Tutora web: frontend architecture and build plan

Frontends for the Tutora backend (`DevAndroidify/tutora`). The backend serves three client apps with
separate API areas and tokens; this repo builds one web app for each, sharing code through packages.

## 1. What the backend gives us (and what it requires)

| Backend fact | Consequence for the frontend |
| --- | --- |
| Three API areas: `/student/*`, `/tutor/*`, `/admin/*`, plus `/public/*` | Three separate apps, each talking to its own area. Public browsing is shared. |
| Access tokens carry `aud` = app and work **only** in that app; 15-minute lifetime | Each app keeps its own session. A member signs in to the student and tutor apps separately (same email/password). |
| Refresh tokens rotate on every use; **reusing an old one revokes the whole sign-in** | Refresh must be single-flight per app, including across browser tabs (Web Locks), and always store the newest token. |
| Error body `{ error: { code, message, details, requestId } }`; `details.fields` on validation errors | One `ApiError` type; forms map `details.fields` onto inputs; show `requestId` on unexpected errors. |
| Money-changing calls need an `Idempotency-Key` header (payments) | The client generates one key per user intent and reuses it on retry. |
| Socket.IO namespace `/realtime`, `auth: { token }`; `subscribe` to `request:<id>:owner`, `request:<id>:tutors`, `session:<id>` | One realtime client per app; events only invalidate or patch cached data (REST stays the source of truth). |
| Uploads: presign, then PUT straight to storage, then attach | A shared upload helper with progress, type and size checks. |
| Payments: `checkout` config from the API (fake simulator or Razorpay test mode, UPI Collect hidden) | Student app opens the right checkout; final state is polled or pushed, never assumed. |
| Live sessions: join token + LiveKit URL from the API; mode events; whiteboard snapshots | Student and tutor apps share a session room package (LiveKit client). |
| OpenAPI documents per app (`docs/openapi/*.json` in the backend) | Typed API clients are **generated**, so frontend types follow the backend. |
| CORS is closed unless `CORS_ORIGINS` lists origins; Swagger and `/dev/*` off in production | In development each app proxies the API (same origin, no CORS). In production, set `CORS_ORIGINS` or serve the apps behind the same domain. |

## 2. Shape

```
tutora-web/                    Yarn 4 workspaces, TypeScript strict
  apps/
    student/   :5173           Learner app: browse, requests, bids, pay, sessions, replay, groups
    tutor/     :5174           Tutor app: profile, skills, marketplace, bids, sessions, earnings
    admin/     :5175           Staff portal: verification, catalog, trust & safety, money, metrics
  packages/
    api-client/                Generated OpenAPI types + typed fetch client per app area, ApiError
    core/                      Session store, token refresh, auth provider/guards, query client, realtime, config
    ui/                        Tailwind v4 theme and accessible components shared by all apps
  docs/ARCHITECTURE.md
```

**Stack:** React 19, Vite, TanStack Router (type-safe routes, route guards), TanStack Query (server
state, caching, retries), Tailwind CSS v4, React Hook Form + Zod (forms), openapi-typescript +
openapi-fetch (generated, typed client), socket.io-client, livekit-client (Phase 10), Vitest +
Testing Library + MSW (unit/integration), Playwright (end-to-end against the real backend, Phase 14).

Why Vite single-page apps rather than a server-rendered framework: every screen except public browsing is
behind sign-in and driven by a token-based JSON API. Public catalog and tutor pages can get
server rendering later (a small marketing site) without changing these apps.

## 3. Key rules

1. **Types come from the backend.** `yarn api:sync` copies the backend OpenAPI documents and regenerates
   types. No hand-written request/response types for API calls.
2. **One app, one session.** Session is stored per app (`tutora.<app>.*`). Access token in memory only;
   refresh token in `localStorage` (the backend returns it in the body, not a cookie). Known trade-off: a
   script injection could read it, so the apps use a strict CSP in production and the backend's reuse
   detection limits damage. Moving refresh tokens to an `httpOnly` cookie is a recommended backend change.
3. **Refresh is single-flight.** At most one refresh per app at a time, across tabs (Web Locks API, with an
   in-tab fallback). Other requests wait and retry once with the new token. On `REFRESH_TOKEN_REUSED`
   the app signs out everywhere it is open (BroadcastChannel).
4. **REST changes state, sockets announce.** Realtime events invalidate TanStack Query caches or patch
   them; they never become the source of truth.
5. **Errors are data.** Every failure is an `ApiError` with `code`; screens switch on codes (for example
   `TOKEN_APP_MISMATCH`, `ACCOUNT_SUSPENDED`, `RATE_LIMITED`, `CONTENT_BLOCKED`).
6. **Money UI never guesses.** Payment screens show what the server says (`INITIATED`, `HELD`, …) and poll
   or listen until it changes. Idempotency keys are created per intent.
7. **Accessible by default.** Shared components handle labels, focus and keyboard use; colour contrast
   follows WCAG AA.
8. **Test like the backend.** Each phase ships tests; the last phase adds Playwright journeys against the
   running backend.

## 4. Build phases

Each phase: plan briefly, build, run `yarn lint`, `yarn typecheck`, `yarn test`, `yarn build`, do the
manual check against the local backend, commit as `phase-NN: …`, then stop and report.

| Phase | Name | Main screens and work | Backend parts used |
| --- | --- | --- | --- |
| 0 | Foundation | Workspace, three app shells, shared UI kit, generated API client, error type, dev proxy, tooling | 0 |
| 1 | Accounts and sessions | Register/sign-in/sign-out per app, silent refresh, protected routes, `/me`, suspended/banned states, switch between student and tutor apps | 1 |
| 2 | Public catalog and directory | Category tree, skill search, skill pages (learner notices), tutor directory and profiles with Mastery and ratings | 2, 13 |
| 3 | Tutor onboarding | Tutor profile, skill claims with evidence, skill suggestions, verification status | 2, 3 |
| 4 | Admin: verification and catalog | Profile and skill review queues, approve/reject, catalog management, suggestions | 2 |
| 5 | Trust & safety | Report buttons in member apps; admin moderation queue, case detail, actions, sanctions | 3 |
| 6 | Learning requests | Create/edit/publish/cancel, attachments upload, my requests | 4 |
| 7 | Tutor marketplace and bids | Browse requests (bid count only), place/edit/withdraw bids, realtime counts | 5, 6 |
| 8 | Accepting and paying | Ranked bids with score explanation, accept, payment window, UPI checkout (simulator / Razorpay test) | 7, 9, 10 |
| 9 | Notifications and realtime | Notification centre, live updates in all apps | 6 |
| 10 | Live sessions | Session list, LiveKit room, consent to record, low-bandwidth modes, whiteboard snapshots | 11, 14, 17 |
| 11 | After the session | Replay with transcript search, notes, flashcards, quizzes, reviews, disputes | 12-16 |
| 12 | Money views | Tutor earnings; admin disputes, release/refund, payouts, reconciliation, metrics | 8, 12, 17, 20 |
| 13 | Group sessions | Pool invitations, group offers, per-seat payment, tutor group bids | 18, 19 |
| 14 | Hardening and results | Playwright end-to-end journeys, accessibility pass, performance budgets, production images (static + nginx), CSP, results | 20 |

## 5. Design system: Highlighter

The three apps share one look: a student's marked-up notebook rather than a SaaS dashboard.

- **Type:** Bricolage Grotesque (600/800) for headings, DM Sans for interface text. Sentence case everywhere, no tracked uppercase labels.
- **Colour:** warm off-white paper (`#fbfaf5`), ink (`#16161a`) for text and 2px outlines, and highlighter yellow (`--color-brand: #fff27a`) for primary actions, the best offer and the `.mark` highlight behind key words. Mint, pink and sky are supporting fills for notes, tags and alerts. Red only for danger. Dark mode keeps the same structure.
- **Shape:** 12px controls, 18px cards, 2px ink borders, and an offset "printed" shadow (`.lift`, `.lift-lg`) only on the one thing that matters most on a screen.
- **Structure:** white header with the highlighted wordmark, the app label pill (Learn / Teach / Control room) and pill navigation; plain footer.
- **Components** (`@tutora/ui`): `AppShell`, `PageHeader`, `SectionHeader`, `Kicker`, `StoryCard`, `CoverArt` (flat pastel cover with an initial), `Tag`, `StatusTag`, `Tabs`, `Pagination`, `Stat`, `Modal`, `Facts`, plus form controls (`Field`, `Textarea`, `Select`, `Button`, `buttonClass` for router links).
- Tailwind scans `packages/ui`, `packages/core` and each app's `src`; base element styles live in `@layer base` so utilities always win.

## 6. Progress

| Phase | Status | Notes |
| --- | --- | --- |
| 0-1 | Done | |
| 2-6 | Done | The public tutor view has no ratings or Mastery fields yet, so directory cards show badge, headline and approved skills. The shared catalog lives in `@tutora/core/catalog` and is used by the student and tutor apps (admin never imports it). |
| 7-11 | Done | Marketplace and sealed bids, ranked bids and test-mode UPI checkout, realtime + notifications, LiveKit room (verified with two real browsers), replay, notes, quiz, review, dispute. |
| 12-13 | Done | Tutor earnings (Earnings page) and admin Money (payments with early release/refund, payouts against `tutor_payable:<id>` ledger balances, books + on-demand reconciliation, low-bandwidth metrics) and Disputes (attendance, audited recording view, release/refund with a note). Groups: learner invitations, group offers with seat limits, per-seat checkout reusing the normal Checkout; tutors bid a seat price with min/max seats. Modal now keeps focus where the user is typing and traps Tab. |
| 14 | Done | See section 7. |

## 7. Results (Phase 14)

**End-to-end (Playwright, real backend, real browsers; `e2e/`):** all 11 tests in 6 specs pass. They cover:
- the money path across all three apps: request, sealed bid seen live, test-mode UPI payment, admin early release, UPI payout, tutor earnings, balanced books;
- group sessions, from invitation to two paid seats;
- the live room with two browsers on fake camera and microphone, with real video decoded on the other side, audio-only switch and leave;
- axe WCAG 2.1 A/AA on 30 pages (no serious or critical findings);
- focus trap and Escape on dialogs;
- no horizontal scroll at 360px;
- a production-image smoke test (headers, zero CSP violations while signed in, socket handshake, `/dev` blocked).

**Bugs the end-to-end pass found and fixed:**
- **Live room:** the room reused one LiveKit `Room` across effect runs. Under StrictMode, the first run's cleanup disconnected the second run, so users were sent back to the pre-join screen. The fix is one `Room` per attempt, and disconnects from cancelled attempts are ignored.
- **Modal focus:** `Modal` re-focused its first control on every render, so typing a space in a dialog's text field could close it. Focus now moves only on open and is restored on close, and Tab is trapped inside the dialog.
- **Admin dev proxy:** the admin dev proxy did not forward `/public/`.

**Performance budgets (`yarn budgets`, gzip):** route-level code splitting (`lazyPage`) and moving the sign-in forms (with zod/mini) into their own chunk brought initial JavaScript from 177–186 kB down to:

| App | Initial JS before | Initial JS after | Budget |
| --- | --- | --- | --- |
| Student | 177 kB | 138 kB | 150 kB |
| Tutor | 186 kB | 137 kB | 150 kB |
| Admin | 185 kB | 126 kB | 140 kB |

- CSS is about 6.4 kB per app, against a 10 kB budget.
- The LiveKit room is 137 kB and loads only when someone joins (budget for any lazy chunk: 160 kB).
- CI fails if any budget is exceeded.

**Production:** one nginx image per app, described in `docker/README.md`.
- Runs as a non-root user and is about 95 MB.
- Proxies the API per app area and resolves the backend at request time.
- Sets a CSP and security headers.
- Caches hashed assets for a year.
- Never exposes `/dev`.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, build and budgets, and builds the three images. The end-to-end tests run locally against the backend; see `e2e/README.md`.

**Not verified here:**
- Razorpay with real test keys. The fake provider is used throughout; the CSP allows Razorpay Checkout's documented origins.
- Recording, Egress and transcripts, which need LiveKit Egress and storage in a deployed setting.
- TLS and HSTS, which belong at the load balancer.
