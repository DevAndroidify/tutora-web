# Tutora web

The web apps for the [Tutora backend](https://github.com/DevAndroidify/tutora), a marketplace where
learners post what they want to learn, verified tutors send sealed bids, and sessions run live in the
browser. Three apps share one design system: **student**, **tutor** and **admin**.

Built with React, TypeScript and Vite.

## Run it

Needs Node 24, Yarn 4 (`corepack enable`) and the backend running on port 3000.

```bash
yarn install
yarn dev           # student :5173, tutor :5174, admin :5175
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
