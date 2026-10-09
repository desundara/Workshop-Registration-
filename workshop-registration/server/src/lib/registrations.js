import { db, now } from '../db.js';

export const REG_SELECT = `
  SELECT r.*,
         rb.name AS registered_by_name,
         cb.name AS cancelled_by_name,
         CASE WHEN r.status = 'waitlisted'
              THEN ROW_NUMBER() OVER (PARTITION BY r.workshop_id, r.status ORDER BY r.id)
         END AS waitlist_position
  FROM registrations r
  JOIN users rb ON rb.id = r.registered_by
  LEFT JOIN users cb ON cb.id = r.cancelled_by`;

export const countActive = (workshopId) =>
  db.prepare("SELECT COUNT(*) AS c FROM registrations WHERE workshop_id = ? AND status = 'active'").get(workshopId).c;

// Moves people from the waitlist into free seats, oldest first.
// MUST be called inside a write transaction (see routes) so the seat count
// it reads can't change underneath it.
export function promoteFromWaitlist(workshopId) {
  const ws = db.prepare('SELECT capacity, status FROM workshops WHERE id = ?').get(workshopId);
  if (!ws || ws.status !== 'scheduled') return [];
  const promoted = [];
  let free = ws.capacity - countActive(workshopId);
  while (free > 0) {
    const next = db
      .prepare("SELECT id FROM registrations WHERE workshop_id = ? AND status = 'waitlisted' ORDER BY id LIMIT 1")
      .get(workshopId);
    if (!next) break;
    db.prepare("UPDATE registrations SET status = 'active', promoted_at = ? WHERE id = ?").run(now(), next.id);
    promoted.push(next.id);
    free--;
  }
  return promoted;
}

export const getRegistration = (id) => db.prepare(`${REG_SELECT} WHERE r.id = ?`).get(id);
