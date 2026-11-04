# Production images

One image per app, built from the repo root:

```sh
docker build --build-arg APP=student -t tutora-student .
docker build --build-arg APP=tutor   -t tutora-tutor .
docker build --build-arg APP=admin   -t tutora-admin .
```

Each image is nginx (non-root, ~95 MB) serving the built app. Production builds call the API on the
same origin: nginx forwards only that app's API area plus the public catalog (`/student/` +
`/public/` for the student site, and so on) and the realtime socket (`/socket.io/`) to
`API_UPSTREAM`. The backend's `/dev/` routes (fake UPI simulator) are never forwarded.

## Runtime settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `API_UPSTREAM` | `http://api:3000` | Backend address. Resolved per request, so the container starts before the API does. |
| `PORT` | `8080` | Listen port. |
| `CSP_CONNECT_EXTRA` | empty | Extra `connect-src` origins: the LiveKit URL (`wss://live.example.com`) and object storage for presigned uploads (`https://storage.example.com`). |
| `CSP_MEDIA_EXTRA` | empty | Extra `media-src`/`img-src` origins serving recordings and whiteboard snapshots. |

Build args `VITE_STUDENT_APP_URL`, `VITE_TUTOR_APP_URL`, `VITE_ADMIN_APP_URL` set the links between
the apps (for example "Teach on Tutora").

## Headers

- `Content-Security-Policy`: scripts only from the site and Razorpay Checkout; frames only Razorpay;
  `object-src 'none'`, `frame-ancestors 'none'`, `base-uri`/`form-action` `'self'`. Styles allow
  `'unsafe-inline'` because Razorpay Checkout styles its overlay inline (no script runs from it).
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera and microphone
  for this site only), `Cross-Origin-Opener-Policy: same-origin-allow-popups` (UPI app hand-off).
- `/assets/*` (hashed) are cached for a year; `index.html` and client routes are `no-cache`.

TLS and HSTS belong on the load balancer in front of these containers.

`e2e/tests/prod.spec.ts` checks a running image: headers, a sign-in with zero CSP violations, the
socket handshake, and that `/dev/` is blocked.
