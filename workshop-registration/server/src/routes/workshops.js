import { Router } from 'express';
import { db, now } from '../db.js';
import { authenticate, can } from '../middleware/auth.js';
import { HttpError, notFound } from '../lib/errors.js';
import { text, integer, dateTime, oneOf, has, invalid, isoParam } from '../lib/validate.js';
import { audit } from '../lib/audit.js';
import { countActive, promoteFromWaitlist } from '../lib/registrations.js';

const router = Router();
router.use(authenticate);

export const STATUSES = ['scheduled', 'completed', 'cancelled'];

const WITH_COUNTS = `
  SELECT w.*,
    (SELECT COUNT(*) FROM registrations r WHERE r.workshop_id = w.id AND r.status = 'active')     AS active_count,
    (SELECT COUNT(*) FROM registrations r WHERE r.workshop_id = w.id AND r.status = 'waitlisted') AS waitlist_count
  FROM workshops w`;

const shape = (w) => ({ ...w, seats_available: Math.max(0, w.capacity - w.active_count) });
const getOne = (id) => db.prepare(`${WITH_COUNTS} WHERE w.id = ?`).get(id);

// ---- field validators (shared by create + update) ----
const FIELDS = {
  code: (b) => {
    const v = text(b, 'code', { label: 'Code', min: 2, max: 20 }).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(v)) throw invalid('code', 'Code may only contain letters, numbers, - and _');
    return v;
  },
  title: (b) => text(b, 'title', { label: 'Title', max: 150 }),
  instructor: (b) => text(b, 'instructor', { label: 'Instructor', max: 100 }),
  location: (b) => text(b, 'location', { label: 'Location', max: 100 }),
  description: (b) => text(b, 'description', { label: 'Description', max: 2000, optional: true }) ?? '',
  starts_at: (b) => dateTime(b, 'starts_at', 'Start time'),
  ends_at: (b) => (b.ends_at === null || b.ends_at === '' ? null : dateTime(b, 'ends_at', 'End time')),
  capacity: (b) => integer(b, 'capacity', { label: 'Capacity', min: 1, max: 1000 }),
  status: (b) => oneOf(b, 'status', STATUSES, 'Status'),
};
const REQUIRED = ['code', 'title', 'instructor', 'location', 'starts_at', 'capacity'];

const checkTimes = (w) => {
  if (w.ends_at && w.ends_at <= w.starts_at) throw invalid('ends_at', 'End time must be after the start time');
};

// ---- read ----
router.get('/locations', can('workshops:read'), (req, res) => {
  res.json(db.prepare('SELECT DISTINCT location FROM workshops ORDER BY location').all().map((r) => r.location));
});

// Search: ?from=&to=&status=&minSeats=&location=&q=
router.get('/', can('workshops:read'), (req, res) => {
  const q = req.query;
  const where = [];
  const p = {};
  if (q.from) { where.push('w.starts_at >= @from'); p.from = isoParam(q.from, 'from'); }
  if (q.to) { where.push('w.starts_at <= @to'); p.to = isoParam(q.to, 'to'); }
  if (q.status) {
    if (!STATUSES.includes(q.status)) throw invalid('status', `status must be one of: ${STATUSES.join(', ')}`);
    where.push('w.status = @status'); p.status = q.status;
  }
  if (q.location) { where.push('w.location = @location'); p.location = String(q.location); }
  if (q.q) {
    where.push('(w.code LIKE @q OR w.title LIKE @q OR w.instructor LIKE @q)');
    p.q = `%${String(q.q).trim()}%`;
  }

  let sql = `${WITH_COUNTS} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;
  if (q.minSeats !== undefined && q.minSeats !== '') {
    const n = parseInt(q.minSeats, 10);
    if (!Number.isInteger(n) || n < 1) throw invalid('minSeats', 'minSeats must be a positive whole number');
    // "Seats still available" only makes sense for workshops that are open.
    sql = `SELECT * FROM (${sql}) WHERE status = 'scheduled' AND capacity - active_count >= @minSeats`;
    p.minSeats = n;
  }
  res.json(db.prepare(`${sql} ORDER BY starts_at ASC, id ASC`).all(p).map(shape));
});

router.get('/:id', can('workshops:read'), (req, res) => {
  const w = getOne(Number(req.params.id));
  if (!w) throw notFound('Workshop');
  res.json(shape(w));
});

// ---- write (managers only) ----
router.post('/', can('workshops:write'), (req, res) => {
  const b = req.body || {};
  const w = {};
  for (const f of REQUIRED) w[f] = FIELDS[f](b);
  w.description = FIELDS.description(b);
  w.ends_at = has(b, 'ends_at') ? FIELDS.ends_at(b) : null;
  w.status = has(b, 'status') ? FIELDS.status(b) : 'scheduled';
  checkTimes(w);

  const create = db.transaction(() => {
    if (db.prepare('SELECT 1 FROM workshops WHERE code = ?').get(w.code)) {
      throw new HttpError(409, 'CODE_TAKEN', `Workshop code ${w.code} is already in use`, { field: 'code' });
    }
    const t = now();
    const info = db
      .prepare(`INSERT INTO workshops (code, title, instructor, location, description, starts_at, ends_at, capacity, status, created_by, created_at, updated_at)
                VALUES (@code,@title,@instructor,@location,@description,@starts_at,@ends_at,@capacity,@status,@by,@t,@t)`)
      .run({ ...w, by: req.user.id, t });
    audit(req.user, 'workshop.created', 'workshop', info.lastInsertRowid, `Created workshop ${w.code} "${w.title}" (${w.capacity} seats)`, w);
    return info.lastInsertRowid;
  });
  res.status(201).json(shape(getOne(create.immediate())));
});

router.patch('/:id', can('workshops:write'), (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};

  const update = db.transaction(() => {
    const cur = db.prepare('SELECT * FROM workshops WHERE id = ?').get(id);
    if (!cur) throw notFound('Workshop');

    const next = { ...cur };
    for (const f of Object.keys(FIELDS)) if (has(b, f)) next[f] = FIELDS[f](b);
    checkTimes(next);

    if (next.code !== cur.code && db.prepare('SELECT 1 FROM workshops WHERE code = ? AND id <> ?').get(next.code, id)) {
      throw new HttpError(409, 'CODE_TAKEN', `Workshop code ${next.code} is already in use`, { field: 'code' });
    }
    const active = countActive(id);
    if (next.capacity < active) {
      throw new HttpError(409, 'CAPACITY_BELOW_ACTIVE',
        `${active} seats are already taken, so capacity can't be lower than ${active}`, { field: 'capacity' });
    }

    const changed = Object.keys(FIELDS).filter((f) => next[f] !== cur[f]);
    if (changed.length) {
      db.prepare(`UPDATE workshops SET code=@code, title=@title, instructor=@instructor, location=@location,
                  description=@description, starts_at=@starts_at, ends_at=@ends_at, capacity=@capacity,
                  status=@status, updated_at=@t WHERE id=@id`).run({ ...next, t: now(), id });
      const diff = Object.fromEntries(changed.map((f) => [f, { from: cur[f], to: next[f] }]));
      audit(req.user, 'workshop.updated', 'workshop', id,
        `Edited workshop ${next.code}: ${changed.map((f) => `${f} ${JSON.stringify(cur[f])} → ${JSON.stringify(next[f])}`).join(', ').slice(0, 300)}`, diff);
      // New seats (capacity raised / workshop re-opened) go to the waitlist first.
      promoteFromWaitlist(id);
    }
    return id;
  });
  res.json(shape(getOne(update.immediate())));
});

export default router;
