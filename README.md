# Gather

A lightweight, free-to-run web app that helps a team decide where and when to go out:
the administrator opens a weekly vote, members share availability and preferences in
under two minutes, and the decision is published as a public event page.

- Product specification: [`docs/gather-spec.md`](docs/gather-spec.md) (including recorded assumptions, §15)
- Behaviour specifications: [`features/`](features)
- First deployment and feasibility checklist: [`docs/poc-setup.md`](docs/poc-setup.md)

## Architecture

| Part                  | Where          | What                                                                   |
| --------------------- | -------------- | ---------------------------------------------------------------------- |
| Frontend              | `web/`         | React + TypeScript (Vite), hosted on GitHub Pages, hash-based routes   |
| Backend               | `backend/src/` | Google Apps Script web app: token verification, authorization, logic   |
| Storage               | —              | A private Google Sheet, one sheet per table, created on first use      |
| Maps                  | `web/src/`     | Leaflet + OpenStreetMap tiles; no Google Maps API key                  |

Every browser request is a `POST` of `{ action, idToken?, ...payload }` sent as `text/plain`
to the Apps Script `/exec` URL. The backend verifies the Google ID token and the caller's
role for every non-public action (`backend/src/api.ts`). Behaviour lives in plain TypeScript
modules; `backend/src/main.ts` is the only Apps Script–specific code.

## Development

```sh
npm install
cp web/.env.example web/.env.local   # Google OAuth client ID and Apps Script /exec URL
npm run dev
```

| Command                  | Checks                                                               |
| ------------------------ | -------------------------------------------------------------------- |
| `npm run format:check`   | Prettier                                                             |
| `npm run lint`           | ESLint                                                               |
| `npm run typecheck`      | TypeScript (web, backend, tooling)                                   |
| `npm test`               | Backend behaviour and frontend unit tests (Vitest)                   |
| `npm run build`          | Frontend bundle (`dist/web`) and Apps Script bundle (`dist/backend`) |
| `npm run test:e2e`       | Playwright journeys, desktop and mobile                              |

End-to-end tests run the real backend logic in-process against an in-memory spreadsheet;
only Google sign-in, map tiles and the clock are replaced (`e2e/support/fixtures.ts`).

## Deployment

**Backend:** follow `docs/poc-setup.md` once (spreadsheet, Apps Script project, OAuth client,
Script Properties). Afterwards: `npm run deploy:backend`, then create a new version of the
existing web-app deployment in the Apps Script editor so the `/exec` URL stays the same.

**Frontend:** pushes to `main` deploy to GitHub Pages after CI passes. One-time setup:

1. _Settings → Pages → Source:_ **GitHub Actions**.
2. _Settings → Secrets and variables → Actions → Variables:_ `GOOGLE_CLIENT_ID` and
   `BACKEND_URL` (both end up in the public bundle; neither is secret).
3. Add `https://<owner>.github.io` to the OAuth client's authorised JavaScript origins.

Public links look like `https://<owner>.github.io/gather/#/events/<event id>`.
