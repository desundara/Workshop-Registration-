# Design notes: Workshop Registration Service

## Stack and why
- **Node + Express + SQLite (better-sqlite3).** SQLite means reviewers run the app with zero setup, and for ~15 staff on one site it is more than enough. Its single-writer model also makes the capacity rule simple to reason about. It is a deliberately boring choice; the data layer is plain SQL, so moving to Postgres is mechanical.
- **React + Vite + Tailwind.** Fast to build, easy to run. The API proxy in Vite removes any CORS setup. No state library: the app is small and server state is re-fetched after every action, so the screen always shows what the database says.

## How over-registration is prevented
Two independent layers:
1. **Transaction.** Registering is one `BEGIN IMMEDIATE` transaction: read the workshop, check for duplicates, count active registrations, insert. SQLite lets only one writer in at a time (even across processes), so two staff grabbing the last seat are serialised: the second one sees the first one's row and gets a clean `409 WORKSHOP_FULL`.
2. **Database triggers.** `trg_capacity_insert` / `trg_capacity_promote` abort any insert or promotion that would push active registrations above capacity, regardless of which code path runs. A trigger also stops capacity being lowered below taken seats, and another blocks `DELETE` on registrations, so history is permanent.

`npm run test:concurrency` shows it: 80 parallel requests for 20 seats gives exactly 20 successes, also with two server processes sharing the file.

## Other design decisions
- **Access control is a table** (`permissions.js`) used by a `can('…')` middleware on every route. The UI reads the same list from `/auth/me` only to hide things. The user is re-read from the DB per request, so deactivation or a role change takes effect immediately.
- **Cancel, never delete.** A registration is one row whose status moves `active/waitlisted → cancelled`, with who/when/why recorded. A partial unique index stops the same email holding two open places in one workshop.
- **Waitlist** is first-come-first-served. Freed seats are auto-assigned inside the cancelling transaction.
- **Extra tracked fields:** location (three sites), end time, description, plus audit trail for account/role/workshop changes.
- **Finding workshops** is done in SQL, with seat counts computed live, never stored, so they can't drift.

## Assumptions
- The permission table is taken literally: **Admins cannot see workshops or registrations**; the audit trail is Admin-only.
- Only open (`scheduled`, not yet started) workshops accept registrations. Cancelling a workshop keeps its registrations as history.
- Attendees are identified by email (case-insensitive). Times are stored in UTC and shown in the browser's timezone.
- Users are deactivated, not deleted, so history keeps pointing at real people. Admins can't demote or deactivate themselves.

## Trade-offs and what I skipped
- SQLite is single-node; at higher scale I'd move to Postgres and lock the workshop row (`SELECT … FOR UPDATE`) inside the same transaction.
- JWT sits in `localStorage` (simple, but exposed to XSS); an httpOnly cookie would be stronger. No login rate-limiting, password-reset email, or refresh tokens.
- Waitlisted people aren't emailed. Staff see the promotion in the UI and would phone them.
- No pagination on the workshop list or registrations table (fine at this size).
- Tests are one integration script (permissions + concurrency); no unit or frontend tests.
- Not deployed; run locally via the README.
