# Workshop Desk: Workshop Registration Service

A small full-stack app for a community training centre: staff register attendees for workshops, seats can **never** be over-booked, and every registration (including cancellations) is kept forever.

**Stack:** Node.js + Express · SQLite (`better-sqlite3`) · React 18 + Vite + Tailwind CSS v4

---

## Run it locally (about 2 minutes)

Requires **Node 18+**.

```bash
npm run setup     # installs root, server and client dependencies
npm start         # starts API on :4000 and web app on :3000
```

Open **http://localhost:3000**

The database is created and seeded automatically on first start (`server/data/workshops.db`), with sample workshops that include a full workshop with a waitlist, a nearly-full one, a cancelled one and a completed one.
Want a clean slate? `npm run seed:reset`.

> Prefer two terminals? `cd server && npm install && npm start` and `cd client && npm install && npm start`.

### Dev-only logins (also one-click buttons on the login page)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@center.test` | `Admin@123` |
| Manager | `manager@center.test` | `Manager@123` |
| Front desk (Staff) | `staff@center.test` | `Staff@123` |

There is no public signup. The Admin creates every other account from **Staff accounts**.

### Who can do what (enforced by the API, hidden in the UI as a courtesy)

| | Admin | Manager | Staff |
|---|:--:|:--:|:--:|
| Create accounts & set roles | ✅ | ❌ | ❌ |
| Add & edit workshops | ❌ | ✅ | ❌ |
| Register & cancel attendees | ❌ | ✅ | ✅ |
| View workshops, registrations & history | ❌ | ✅ | ✅ |
| *(bonus)* Read the audit trail | ✅ | ❌ | ❌ |

The matrix lives in one place: `server/src/permissions.js`. Anything not allowed returns `403`.

---

## Prove the capacity rule

With the server running (seeded), in another terminal:

```bash
npm run test:concurrency
```

It logs in as each role and checks the permission matrix, then fires **80 simultaneous registrations at a 20-seat workshop** and asserts exactly 20 succeed. It also registers the same person 10× at once, and cancels 3 seats at the same moment while 20 people queue on the waitlist.

To show it isn't just Node's single thread, run **two API processes on the same database**:

```bash
# terminal A
cd server && npm start
# terminal B
cd server && PORT=4001 AUTO_SEED=false npm start
# terminal C
API_URLS=http://localhost:4000,http://localhost:4001 npm run test:concurrency --prefix server
```

---

## Features

- **Roles & auth:** JWT login; the user is reloaded from the DB on every request, so role changes and deactivation apply immediately.
- **Workshop catalogue:** code, title, instructor, date/time, end time, capacity, status, plus **location** (the centre has three sites) and a description.
- **Registrations:** name + email, who/when registered, who/when/why cancelled. Never deleted.
- **Finding workshops:** quick date presets (Today, Next 7 days, …) or a custom range, status, location, text search, and **"Only with seats available"**. API: `GET /api/workshops?from=&to=&status=&minSeats=&location=&q=`.
- **Bonus: waitlist.** When a workshop is full, staff can add people to a queue. A freed seat (cancellation, or capacity raised) goes to the next in line automatically, in the same transaction.
- **Bonus: audit trail.** Account creation, role/active/password changes and workshop create/edit, with actor and timestamp (Admin → *Audit trail*).

## API overview

| Method & path | Permission |
|---|---|
| `POST /api/auth/login`, `GET /api/auth/me` | public / any signed-in user |
| `GET/POST /api/users`, `PATCH /api/users/:id` | admin |
| `GET /api/audit` | admin |
| `GET /api/workshops`, `GET /api/workshops/:id`, `GET /api/workshops/locations` | manager, staff |
| `POST /api/workshops`, `PATCH /api/workshops/:id` | manager |
| `GET /api/workshops/:id/registrations` (full history) | manager, staff |
| `POST /api/workshops/:id/registrations` `{name, email, joinWaitlist?}` | manager, staff |
| `POST /api/registrations/:id/cancel` `{reason?}` | manager, staff |

Errors are always `{ "error": { "code", "message", "details" } }`, e.g. `WORKSHOP_FULL` (409), `FORBIDDEN` (403).

## Project layout

```
server/src
  permissions.js     role → permission table (single source of truth)
  db.js              schema + DB-level safety triggers
  routes/            auth, users, workshops, registrations, audit
  middleware/auth.js authenticate + can('permission')
  seedData.js        demo users & workshops
server/scripts/concurrency-test.js
client/src
  pages/             Login, Workshops, WorkshopDetail, Users, Audit
  components/        ui kit, layout, forms, cards
```

See **DESIGN.md** for design decisions, trade-offs and what was skipped.
