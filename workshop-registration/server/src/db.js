import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { DB_PATH } from './config.js';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // readers don't block the writer
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000'); // wait (not fail) if another process holds the write lock

export const now = () => new Date().toISOString();

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','manager','staff')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  created_by    INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS workshops (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title       TEXT NOT NULL,
  instructor  TEXT NOT NULL,
  location    TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  starts_at   TEXT NOT NULL,
  ends_at     TEXT,
  capacity    INTEGER NOT NULL CHECK (capacity > 0),
  status      TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workshops_starts ON workshops(starts_at);

-- One row per registration, forever. Cancelling flips status; nothing is deleted.
CREATE TABLE IF NOT EXISTS registrations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  workshop_id    INTEGER NOT NULL REFERENCES workshops(id),
  attendee_name  TEXT NOT NULL,
  attendee_email TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('active','waitlisted','cancelled')),
  registered_by  INTEGER NOT NULL REFERENCES users(id),
  registered_at  TEXT NOT NULL,
  promoted_at    TEXT,
  cancelled_by   INTEGER REFERENCES users(id),
  cancelled_at   TEXT,
  cancel_reason  TEXT
);
CREATE INDEX IF NOT EXISTS idx_reg_workshop_status ON registrations(workshop_id, status);

-- The same person can't hold two open places (active or waitlisted) in one workshop.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reg_open
  ON registrations(workshop_id, lower(attendee_email))
  WHERE status IN ('active','waitlisted');

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    INTEGER REFERENCES users(id),
  actor_name  TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   INTEGER,
  summary     TEXT NOT NULL,
  details     TEXT,
  created_at  TEXT NOT NULL
);

-- ---- Last line of defence: the database itself refuses to break the rules ----

-- A workshop can never hold more active registrations than its capacity,
-- no matter which code path (or future bug) tries to insert one.
CREATE TRIGGER IF NOT EXISTS trg_capacity_insert
BEFORE INSERT ON registrations
WHEN NEW.status = 'active'
BEGIN
  SELECT RAISE(ABORT, 'CAPACITY_EXCEEDED')
  WHERE (SELECT COUNT(*) FROM registrations WHERE workshop_id = NEW.workshop_id AND status = 'active')
      >= (SELECT capacity FROM workshops WHERE id = NEW.workshop_id);
END;

-- Same rule when a waitlisted row is promoted to active.
CREATE TRIGGER IF NOT EXISTS trg_capacity_promote
BEFORE UPDATE OF status ON registrations
WHEN NEW.status = 'active' AND OLD.status <> 'active'
BEGIN
  SELECT RAISE(ABORT, 'CAPACITY_EXCEEDED')
  WHERE (SELECT COUNT(*) FROM registrations WHERE workshop_id = NEW.workshop_id AND status = 'active')
      >= (SELECT capacity FROM workshops WHERE id = NEW.workshop_id);
END;

-- Capacity can't be lowered under the number of people already holding seats.
CREATE TRIGGER IF NOT EXISTS trg_capacity_shrink
BEFORE UPDATE OF capacity ON workshops
WHEN NEW.capacity < (SELECT COUNT(*) FROM registrations WHERE workshop_id = NEW.id AND status = 'active')
BEGIN
  SELECT RAISE(ABORT, 'CAPACITY_BELOW_ACTIVE');
END;

-- Registration history is permanent.
CREATE TRIGGER IF NOT EXISTS trg_registrations_permanent
BEFORE DELETE ON registrations
BEGIN
  SELECT RAISE(ABORT, 'REGISTRATIONS_ARE_PERMANENT');
END;
`);
