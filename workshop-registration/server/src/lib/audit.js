import { db, now } from '../db.js';

// Records "who did what, when" for everything that is not a registration
// (registrations carry their own who/when columns). Call inside the same
// transaction as the change so the log can never drift from reality.
export function audit(actor, action, entityType, entityId, summary, details = null) {
  db.prepare(
    `INSERT INTO audit_log (actor_id, actor_name, action, entity_type, entity_id, summary, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(actor.id, actor.name, action, entityType, entityId, summary, details ? JSON.stringify(details) : null, now());
}
