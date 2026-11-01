# Sign-in proof of concept — setup and feasibility check

Spec §10 asks for this slice to be proven in a real deployment before anything
else is built. Run it with the administrator's corporate Google account first:
several steps depend on Google Workspace policies that only a real account reveals.
Record the outcome of each **Check** — a failed check is a finding, not a setup mistake.

Private values (spreadsheet ID, admin email) go only into Apps Script Script
Properties or local, git-ignored files — never into this repository.

## 1. Private spreadsheet

1. Create a new Google Sheet in your Drive, e.g. "Gather data". Do not share it.
2. Copy its ID from the URL: `https://docs.google.com/spreadsheets/d/<ID>/edit`.

The backend creates the `Users` sheet on first sign-in.

## 2. Apps Script project

1. Enable the Apps Script API for your account: <https://script.google.com/home/usersettings>.
   - **Check A:** the toggle is available (Workspace admins can disable it).
2. Create a standalone project at <https://script.google.com> (e.g. "Gather backend")
   and copy its Script ID from _Project Settings_.
3. In the repository: `cp .clasp.json.example .clasp.json` and fill in the Script ID.
4. `npx @google/clasp login` with the corporate account, then `npm run deploy:backend`.
   - **Check B:** the push succeeds.

## 3. OAuth client for Google sign-in

1. In <https://console.cloud.google.com>, create (or pick) a project.
   - **Check C:** you are allowed to create a project / OAuth client in the organisation.
2. _Google Auth Platform → Branding / Audience_: configure the consent screen.
   - **Check D:** the audience can be **External**. _Internal_ only admits
     company accounts; spec §2 also requires personal Gmail accounts.
     Leave it in _Testing_ and add the test users you will try, or publish it.
3. _Clients → Create client → Web application_. Authorised JavaScript origins:
   - `http://localhost:5173` (local testing)
   - `https://psavidis.github.io` (GitHub Pages, later)
4. Copy the client ID.

## 4. Backend configuration and deployment

1. Apps Script editor → _Project Settings → Script Properties_:

   | Property              | Value                         |
   | --------------------- | ----------------------------- |
   | `GOOGLE_CLIENT_ID`    | the OAuth client ID           |
   | `SPREADSHEET_ID`      | the spreadsheet ID            |
   | `INITIAL_ADMIN_EMAIL` | your corporate email address  |

2. _Deploy → New deployment → Web app_: _Execute as_ **Me**, _Who has access_ **Anyone**.
   Authorise the requested scopes (spreadsheets, external requests).
   - **Check E:** **Anyone** is offered. If only "Anyone within <your organisation>"
     is available, the browser cannot call the backend anonymously from GitHub Pages
     and the architecture in spec §10 does not work under this account.
3. Copy the web app URL (ends in `/exec`). After later backend changes, run
   `npm run deploy:backend` and update the deployment to a new version.

## 5. Run the frontend locally

```sh
cp web/.env.example web/.env.local   # fill in the client ID and /exec URL
npm install
npm run dev                          # http://localhost:5173
```

## 6. Feasibility checks

| #   | Action                                                                                 | Expected                                                                |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| F   | Sign in with the corporate account                                                     | "Signed in as … with the role admin"; a `Users` row is created for you  |
| G   | Browser devtools → Network                                                             | One POST, redirect to `script.googleusercontent.com`, no CORS errors    |
| H   | Reload and sign in again                                                               | Still admin; the row's `googleSubject` is unchanged                     |
| I   | Sign in with an account not in the sheet (e.g. a personal Gmail)                      | "Your account is not authorized to use Gather…"                         |
| J   | Add that Gmail address as a row (`role` = `member`, `enabled` = `TRUE`), sign in again | "Signed in as … with the role member"                                   |
| K   | Set that row's `enabled` to `FALSE`, sign in again                                     | "not authorized" message                                                |
| L   | Try in Safari / a mobile browser                                                       | Same results as F (third-party cookie policies differ between browsers) |

Report which checks passed and the exact error text for any that failed.
