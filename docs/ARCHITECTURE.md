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

## 5. Design system: editorial

The three apps share one look, modelled on news and nature-magazine front pages rather than on SaaS dashboards.

- **Type:** Playfair Display (black weights) for headlines, Inter for interface text; small uppercase tracked kickers above headlines.
- **Colour:** newsprint paper (`#f5f3ee`), ink-black text, one signature yellow (`--color-brand: #ffcc00`) for buttons, kicker squares, active-nav underlines and link underlines. Red only for danger and the admin "Control room" label. Full dark mode.
- **Structure:** black dateline strip, serif wordmark masthead with the app's section label (Learn / Teach / Control room), ruled section navigation, heavy 4px rules above every section, black footer.
- **Art without photos:** `CoverArt` generates a deterministic cover per skill or tutor (deep natural gradients with contour-map lines), so cards read as editorial stories.
- **Components** (`@tutora/ui`): `AppShell`, `PageHeader`, `SectionHeader`, `Kicker`, `StoryCard`, `CoverArt`, `Tag`, `StatusTag`, `Tabs`, `Pagination`, `Stat`, `Modal`, `Facts`, plus form controls (`Field`, `Textarea`, `Select`, `Button`, `buttonClass` for router links).
- Tailwind scans `packages/ui`, `packages/core` and each app's `src`; base element styles live in `@layer base` so utilities always win.

## 6. Progress

| Phase | Status | Notes |
| --- | --- | --- |
| 0-1 | Done | |
| 2-6 | Done | The public tutor view has no ratings or Mastery fields yet, so directory cards show badge, headline and approved skills. The shared catalog lives in `@tutora/core/catalog` and is used by the student and tutor apps (admin never imports it). |
| 7-11 | Done | Marketplace and sealed bids, ranked bids and test-mode UPI checkout, realtime + notifications, LiveKit room (verified with two real browsers), replay, notes, quiz, review, dispute. |
