import { Router } from 'express';
import { db, now } from '../db.js';
import { authenticate, can } from '../middleware/auth.js';
import { HttpError, notFound } from '../lib/errors.js';
import { text, email, has } from '../lib/validate.js';
import { REG_SELECT, countActive, promoteFromWaitlist, getRegistration } from '../lib/registrations.js';

const router = Router();

// Full history for one workshop - every registration ever made, including cancelled ones.
router.get('/workshops/:id/registrations', authenticate, can('registrations:read'), (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM workshops WHERE id = ?').get(id)) throw notFound('Workshop');
  res.json(db.prepare(`${REG_SELECT} WHERE r.workshop_id = ? ORDER BY r.id DESC`).all(id));
});

/**
 * Register an attendee.
 *
 * Why the capacity rule holds under concurrency:
 *   1. The whole check-then-insert runs inside ONE `BEGIN IMMEDIATE` transaction.
 *      SQLite allows a single writer at a time, so a second request (even from
 *      another process) waits until the first has committed and then sees its seat.
 *   2. A database trigger (trg_capacity_insert) re-checks the rule on every insert,
 *      so even a bug in this code could not over-book a workshop.
 */
const register = db.transaction((workshopId, name, mail, joinWaitlist, actor) => {
  const ws = db.prepare('SELECT * FROM workshops WHERE id = ?').get(workshopId);
  if (!ws) throw notFound('Workshop');
  if (ws.status !== 'scheduled') {
    throw new HttpError(409, 'WORKSHOP_NOT_OPEN', `This workshop is ${ws.status}, so registration is closed`);
  }
  if (ws.starts_at <= now()) throw new HttpError(409, 'WORKSHOP_STARTED', 'This workshop has already started');

  const dupe = db
    .prepare("SELECT status FROM registrations WHERE workshop_id = ? AND lower(attendee_email) = ? AND status IN ('active','waitlisted')")
    .get(workshopId, mail);
  if (dupe) {
    throw new HttpError(409, 'ALREADY_REGISTERED',
      dupe.status === 'active' ? 'This person is already registered for this workshop' : 'This person is already on the waitlist', { field: 'email' });
  }

  let status;
  if (countActive(workshopId) < ws.capacity) status = 'active';
  else if (joinWaitlist) status = 'waitlisted';
  else throw new HttpError(409, 'WORKSHOP_FULL', 'This workshop is full', { waitlistAvailable: true, capacity: ws.capacity });

  const info = db
    .prepare('INSERT INTO registrations (workshop_id, attendee_name, attendee_email, status, registered_by, registered_at) VALUES (?,?,?,?,?,?)')
    .run(workshopId, name, mail, status, actor.id, now());
  return info.lastInsertRowid;
});

router.post('/workshops/:id/registrations', authenticate, can('registrations:write'), (req, res) => {
  const b = req.body || {};
  const name = text(b, 'name', { label: 'Name', max: 120 });
  const mail = email(b);
  const joinWaitlist = has(b, 'joinWaitlist') && b.joinWaitlist === true;
  const id = register.immediate(Number(req.params.id), name, mail, joinWaitlist, req.user);
  res.status(201).json(getRegistration(id));
});

// Cancel (never deletes). If a seat is freed, the next person on the waitlist gets it - atomically.
const cancel = db.transaction((regId, reason, actor) => {
  const r = db.prepare('SELECT * FROM registrations WHERE id = ?').get(regId);
  if (!r) throw notFound('Registration');
  if (r.status === 'cancelled') throw new HttpError(409, 'ALREADY_CANCELLED', 'This registration is already cancelled');
  db.prepare("UPDATE registrations SET status = 'cancelled', cancelled_by = ?, cancelled_at = ?, cancel_reason = ? WHERE id = ?")
    .run(actor.id, now(), reason ?? null, regId);
  const promotedIds = r.status === 'active' ? promoteFromWaitlist(r.workshop_id) : [];
  return { regId, promotedIds };
});

router.post('/registrations/:id/cancel', authenticate, can('registrations:write'), (req, res) => {
  const reason = text(req.body || {}, 'reason', { label: 'Reason', max: 300, optional: true });
  const { regId, promotedIds } = cancel.immediate(Number(req.params.id), reason, req.user);
  res.json({ registration: getRegistration(regId), promoted: promotedIds.map(getRegistration) });
});

export default router;
