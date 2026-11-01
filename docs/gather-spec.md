# Team Outing Coordinator

**Product specification — Version 1.2**

## 1. Overview

A lightweight web application that helps a team decide where and when to go out together.

The application replaces scattered conversations and polls with a simple weekly voting process:

1. An administrator initiates a voting round for a particular week.
2. Team members submit their availability and preferences.
3. Voting closes when everyone has voted or the deadline is reached.
4. The administrator reviews the results and decides on the outing.
5. The decision is published as a public event page.
6. The event is archived and remains accessible as part of the team's outing history.


The application should be free to operate, simple to use, mobile-friendly, and respectful of participants' privacy.

## 2. Users and access

### Team members

- Authenticate using their Google account.
- Can participate in active voting rounds.
- Can update their own submission until voting closes.
- Can view the final published event and historical outings.
- Cannot access individual votes or aggregate voting results before voting closes.


### Administrator

The administrator has all team-member capabilities, plus:

- Manage the list of authorized users.
- Initiate and manage voting rounds.
- Manage the venue catalog.
- Close or reopen voting.
- Review voting results.
- Select and publish the final outing.
- Access historical event information and administrative details.

### User management

The administrator manages authorized users entirely through the application UI.

The allowlist is stored in a private Google Sheet and supports:

- Adding and removing email addresses.
- Enabling and disabling users.
- Assigning administrator or member roles.
- Viewing the current list of authorized users.

The initial administrator is configured through private server-side configuration.

Users can authenticate with either a company Google Workspace account or a personal Gmail account, provided their verified email address is on the allowlist.

## 3. Weekly voting workflow

### 3.1 Initiating a voting round

An administrator initiates a new voting round by selecting the **week of interest**.

The application should:

- Identify the relevant dates in that week.
- Create a snapshot of the eligible team members.
- Open voting for those participants.
- Allow the administrator to configure a voting deadline.
- Prevent multiple active voting rounds at the same time.

There is no automatic recurring event creation. A new round exists only when the administrator initiates one.

### 3.2 Member voting

The voting experience should be a short, mobile-friendly wizard that takes less than two minutes.

**Step 1 — Availability**

For each relevant day of the selected week, participants can indicate:

- Available after work — 18:30.
- Available after going home first — 21:00.
- Unavailable.
- No preference / Flexible.

The application should make it clear that selecting a time indicates availability, not a guaranteed commitment to attend.

**Step 2 — Activity preference**

Participants select one:

- Drinks.
- Food.
- Both food and drinks.
- No preference / Flexible.

**Step 3 — Location preference**

Participants select one:

- Near the office.
- Near home.
- Central area.
- Anywhere convenient.
- Another preferred area.
- No preference / Flexible.

For privacy, the application should not request precise home addresses. A neighborhood or nearby metro station is sufficient if someone chooses to specify an area.

**Step 4 — Venue preferences**

Display the available venues on an interactive map and in a list.

Participants can:

- Select one or multiple preferred venues.
- Express no preference / flexibility.
- Skip venue selection if they have no particular preference.

**Step 5 — Review and submit**

Show a concise summary of the participant's choices before submission.
Participants can return to previous steps and modify their answers.
Once submitted, they can update their vote until voting closes.

### 3.3 Missing votes

A participant who does not submit a vote is counted as a **No vote**.

This is deliberately different from selecting "No preference":

- **No preference** means the person participates in the vote but is flexible.
- **No vote** means there is no information about their availability or intention to join.

The report must clearly distinguish submitted votes from missing responses. A missing response must never be interpreted as availability.

## 4. Venue catalog and map

The application maintains a reusable catalog of venues.

Initial categories:

- Restaurants.
- Bars.
- Pubs.
- Cafes.
- Other social venues.

Each venue can contain:

- Name.
- Category.
- Address or approximate location.
- Latitude and longitude.
- Google Maps URL.
- Optional rating.
- Optional price range.
- Optional notes.

### Adding venues

The administrator should be able to add venues conveniently, especially when discovering them through Google Maps.

Possible input methods:

1. Paste a Google Maps share URL and enter or confirm the venue details.
2. Enter the venue name and address manually.
3. Select a location directly on the application's map and provide the venue details.

The application should retain the Google Maps URL as an external navigation link.

It should not depend on Google Places API or another paid mapping service.

### Map technology

Use:

- **Leaflet** for interactive map rendering.
- **OpenStreetMap** for free map data and tiles, subject to the selected tile provider's usage policy.

The map should support:

- Displaying all catalog venues.
- Markers for individual venues.
- Selecting venues during voting.
- Viewing venue details.
- Opening external Google Maps directions.

The application must not require a Google Maps API key or paid Google Maps API usage.

For geocoding, prefer a free option with an appropriate usage policy, or let the administrator place a marker manually. Do not assume that public OpenStreetMap infrastructure provides unlimited free geocoding or tile capacity.

## 5. Voting lifecycle

A voting round has the following lifecycle:

1. **Draft** — administrator is preparing the round.
2. **Open** — eligible members can submit or update votes.
3. **Closed** — voting is no longer available and results can be reviewed.
4. **Published** — administrator has selected and published the outing.
5. **Archived** — the completed event is retained in the historical outing collection.

Voting closes when either:

- Every eligible participant in the opening snapshot has submitted a vote; or
- The configured deadline is reached.


The administrator can also manually close or reopen voting.

The eligible participant snapshot ensures that adding a new team member during an active round does not silently change its participation denominator.

Missing responses remain No votes when voting closes.

## 6. Voting results and report

After voting closes, the administrator can access the full report.

The report should include:

### Participation

- Number of eligible participants.
- Number of submitted votes.
- Number of missing responses.
- Participation percentage.

### Availability

- Available participants per day.
- Availability at 18:30 versus 21:00.
- Custom Availability during a time window e.g 19:00 - 22:00
- Participants with no preference.
- Missing responses shown separately.

### Preferences

- Activity preference breakdown.
- Location preference breakdown.
- Venue popularity and vote counts.

### Recommendations

Produce a ranked list of candidate combinations:

- Date.
- Time.
- Venue.
- Number of potentially available participants.
- Relevant activity and location preferences.

The scoring algorithm should be deterministic and transparent. It should be possible to understand why one combination ranks above another.

AI must not be required to calculate results or rank candidates.

## 7. Final decision

The administrator has the final say.

From the results, the administrator selects:

- Final date.
- Final time.
- Final venue.
- Optional alternative venue or plan.
- Optional notes for participants.

The application stores:

- The selected event details.
- The administrator who made the decision.
- The publication timestamp.
- The associated voting round.

The administrator can make a decision that differs from the highest-ranked recommendation.

## 8. Publishing and outing history

Once the administrator publishes the event, the application creates a public, shareable event page.

The public page displays only information intended to be shared:

- Event title.
- Date and time.
- Venue name.
- Location and address.
- Google Maps link.
- Optional notes.
- Optionally, the number of participants.

It must never expose:

- Individual votes.
- Participant email addresses.
- Individual availability.
- Private voting reports.
- Google Sheet contents or identifiers.
- Administrative information.

### Archived outings

Published outings automatically become part of the team's public historical archive.

The archive should allow anyone with the public URL to:

- Browse past outings.
- Open individual event pages.
- See where the team went and when.

Archived events are read-only historical artifacts, not active voting rounds.

### Image export

The administrator should be able to export the published event as a PNG image suitable for sharing in Slack.

The exported image should have a clean, attractive layout containing the event's public details.

## 9. Optional AI functionality

AI can be introduced later to help with:

- Discovering new venues.
- Suggesting venues based on team preferences.
- Explaining the voting results in natural language.
- Generating a concise event summary.

AI recommendations must be grounded in actual venue information and voting results.

The core voting workflow, scoring, reporting, and publication must work without AI or paid AI services.

For the MVP, a structured report that can be copied into ChatGPT is sufficient.

## 10. Architecture

The application should use free services and avoid introducing a separately hosted backend or paid infrastructure.

### Proposed architecture

|Component|Technology|Responsibility|
|---|---|---|
|Frontend|React + TypeScript|Application UI|
|Hosting|GitHub Pages|Public application hosting|
|Backend|Google Apps Script|Authentication, authorization, business logic and persistence access|
|Database|Private Google Sheets|Users, venues, voting rounds, votes and published events|
|Authentication|Google Identity Services|Google account authentication|
|Maps|Leaflet + OpenStreetMap|Free interactive maps|
|Source and deployment|GitHub + clasp|Version control and Apps Script deployment|

### Important security requirements

GitHub Pages is static hosting. It cannot protect application data or enforce team access by itself.

All access control must happen in the backend.

The frontend should authenticate users using Google Identity Services and send the resulting Google ID token to the backend.

The backend must:

1. Verify the ID token.
2. Verify the token's issuer, audience, expiry and signature.
3. Obtain the verified email address and stable Google subject identifier.
4. Check the user against the private allowlist.
5. Check the user's role and permissions.
6. Authorize every requested operation.

Never trust an email address, user ID or role supplied directly by the frontend.

Do not store authentication tokens in localStorage.

Google Sheets must remain private in the administrator's Google account. Participants should never need direct access to the spreadsheet or other private Google resources.

The Apps Script backend accesses these resources using the owner's permissions.

The spreadsheet ID and other private configuration must remain server-side and must not be committed to the public GitHub repository.

### Backend integration risk

GitHub Pages and Apps Script are hosted on different origins. Apps Script web-app redirects, CORS behavior and browser request restrictions need to be validated early.

Do not assume that a conventional REST `fetch()` integration will work without testing.

A minimal proof of concept should verify:

- Google authentication from the GitHub Pages frontend.
- Sending a token to Apps Script.
- Backend token verification.
- Authorized and unauthorized responses.
- Reading and writing private Sheet data.
- Browser behavior across redirects and CORS.

This should be one of the first implementation tasks, before building the full application.

### Google Apps Script constraints

Apps Script has execution-time, concurrency and daily quota limits.

The application should therefore:

- Keep backend operations short.
- Avoid unnecessary spreadsheet reads and writes.
- Batch related operations.
- Use locking where concurrent writes could conflict.
- Handle quota and transient failures gracefully.
- Keep the data model simple enough for Google Sheets.

For a small team and a weekly voting workflow, this architecture should be a reasonable starting point.

## 11. Suggested data model

The spreadsheet can contain the following logical tables:

### Users

- User ID.
- Google subject ID.
- Email.
- Display name.
- Role.
- Enabled status.
- Created timestamp.

### Venues

- Venue ID.
- Name.
- Category.
- Address.
- Latitude.
- Longitude.
- Google Maps URL.
- Rating.
- Price range.
- Notes.
- Enabled status.

### Voting rounds

- Round ID.
- Week start date.
- Status.
- Created by.
- Created timestamp.
- Voting deadline.
- Eligible participant snapshot.

### Votes

- Vote ID.
- Round ID.
- User ID.
- Availability by day and time.
- Activity preference.
- Location preference.
- Venue preferences.
- Submission timestamp.
- Last updated timestamp.

### Events

- Event ID.
- Round ID.
- Title.
- Date.
- Time.
- Venue ID.
- Alternative venue.
- Notes.
- Published timestamp.
- Published by.
- Archive status.

The model should preserve historical records. Disabling or removing a user must not destroy historical voting or event information.

## 12. Non-functional requirements

- Mobile-first, responsive design.
- Fast and lightweight interface.
- Voting should take less than two minutes.
- Clear distinction between No preference and No vote.
- No public exposure of private participant information.
- No paid map APIs or paid hosting.
- No dependency on AI for core functionality.
- Clear error handling and recovery from backend failures.
- Simple deployment and maintenance.
- Public event pages should remain accessible independently of the active voting workflow.

## 13. MVP scope

### MVP — Required

1. Google authentication.
2. Backend token verification and allowlist authorization.
3. Administrator UI for managing authorized users.
4. Initiating a weekly voting round.
5. Member voting wizard.
6. No preference / Flexible options.
7. Venue catalog management.
8. Free interactive map.
9. Voting closure and missing-response handling.
10. Administrative results report.
11. Final event selection and publication.
12. Public event pages.
13. Public archive of past outings.
14. PNG export for Slack.

### Later enhancements

- AI-assisted venue discovery.
- AI-generated result summaries.
- More sophisticated venue recommendations.
- Additional event statistics.
- More advanced archive presentation.

## 14. Guiding principles

- **One application:** all administration and participation happen through the same hosted app.
- **Free by design:** avoid paid hosting, databases, map APIs and mandatory AI services.
- **Privacy first:** private voting data must never leak into public event pages.
- **Simple participation:** members should be able to vote quickly without learning the system
- **Transparent decisions:** rankings should be explainable, not mysterious.
- **Human decision-making:** the administrator makes the final choice.
- **Historical continuity:** published outings become permanent, shareable artifacts of the team's history.
- **Avoid overengineering:** build only what the weekly coordination workflow actually needs.
## 15. Recorded assumptions

These resolve ambiguities in the sections above. Each one stands until the product owner changes it; the feature files under `features/` encode them.

### A1 — Automatic closure when everyone has voted (§3.2, §5)

Voting closes automatically as soon as every participant in the eligible snapshot has submitted, exactly as §5 states, even if the deadline has not passed. After that, nobody can change their vote unless the administrator reopens voting. Reopening restores the ability to update votes until the round closes again.

### A2 — Custom availability window (§6)

Participants only state an arrival time (18:30 or 21:00), not a leaving time. For a custom window such as 19:00–22:00, the report shows:

- **Available from the start** — participants whose arrival time is at or before the window's start.
- **Joining later** — participants whose arrival time falls inside the window, with that time.
- **No preference** — participants who chose No preference / Flexible for that day, shown separately and never merged into the counts above.
- **Unavailable** and **missing responses** — shown separately.

Participants are assumed to stay until the end of any window they can arrive for.

### A3 — Published versus Archived (§5, §8)

Archived is not a separate administrator action. A published event appears in the public archive immediately and is shown as **upcoming** until its date has passed, then as **past** (the Archived state). Both are read-only.

### A4 — Deadline enforcement (§5)

A round whose deadline has passed is treated as closed by every backend operation, whether or not a background job has run. Apps Script time-driven triggers may be added for convenience but correctness must not depend on them.

### A5 — Initial administrator bootstrap (§2)

The initial administrator's email is set in private Apps Script configuration. When that person first signs in and has no row in the Users sheet, the backend creates an enabled administrator row for them. After that, the Users sheet is the single source of truth: if that row is later disabled or demoted, the configuration does not override it.

### A6 — Identity binding (§2, §10)

Allowlist entries are matched by verified email address, case-insensitively. On first successful sign-in, the backend records the user's Google subject identifier. If a later sign-in presents the same email with a different subject identifier (for example, a deleted and re-created Google account), access is refused until an administrator resets the entry.

### A7 — Token verification in Apps Script (§10)

Apps Script cannot verify RS256 signatures natively. The backend sends the ID token to Google's `tokeninfo` endpoint (which validates the signature) and then itself checks the audience, issuer, expiry and that the email is verified. Unverified emails are refused.

### A8 — Browser-to-backend transport (§10)

The frontend calls the Apps Script web app with `POST` requests whose body is JSON sent as `text/plain`, with the ID token inside the body. This avoids a CORS preflight, which Apps Script cannot answer. Apps Script always responds with HTTP 200, so success and failure are expressed in the JSON body. This must be confirmed by the proof of concept in a real deployment.

### A9 — Administrators cannot lock themselves out (§2)

An administrator cannot disable, remove or remove the administrator role from their own account. Another administrator must do it. This guarantees there is always at least one administrator able to sign in.

### A10 — Adding venues from Google Maps links (§4)

When a pasted Google Maps link contains coordinates or a place name, they pre-fill the venue form. Short share links (`maps.app.goo.gl/…`) cannot be expanded by the browser without a paid or server-side service, so the administrator either pastes the full link from the browser's address bar or places the venue by clicking the map. Every venue must have coordinates so it can appear on the map; the address is optional. Disabled venues stay in the catalog (for history) but are not offered for voting. Venues are never deleted.

### A11 — Days of a voting round (§3.1)

A round covers the working days, Monday to Friday, of the chosen week. Choosing any date selects the week containing it. A week that has already ended cannot be chosen.

### A12 — Round lifecycle details (§3.1, §5)

- Creating a round puts it in **Draft** with its week and deadline. A draft can be deleted. Nobody can vote on a draft.
- **Opening** a draft takes the eligible-participant snapshot (all users enabled at that moment) and starts voting. The deadline must still be in the future.
- A round is **active** from Draft until it is Published. Only one active round may exist at a time.
- **Reopening** a closed round requires a new deadline in the future. The snapshot is not retaken.
- Refinement of A1: automatic closure happens when a participant's **first** submission completes the snapshot. Updates made after a reopen do not close the round again.
- While voting is open, the administrator can see participation (who has and hasn't voted) but not the answers.
