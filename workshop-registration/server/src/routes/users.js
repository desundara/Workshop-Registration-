import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, now } from '../db.js';
import { authenticate, can } from '../middleware/auth.js';
import { HttpError, notFound } from '../lib/errors.js';
import { text, email, oneOf, has } from '../lib/validate.js';
import { audit } from '../lib/audit.js';
import { ROLES } from '../permissions.js';

const router = Router();
router.use(authenticate, can('users:manage'));

const COLS = 'id, name, email, role, active, created_at';
const shape = (u) => ({ ...u, active: !!u.active });

router.get('/', (req, res) => {
  res.json(db.prepare(`SELECT ${COLS} FROM users ORDER BY active DESC, role, name`).all().map(shape));
});

router.post('/', (req, res) => {
  const b = req.body || {};
  const name = text(b, 'name', { label: 'Name', max: 100 });
  const mail = email(b);
  const password = text(b, 'password', { label: 'Password', min: 8, max: 100, trim: false });
  const role = oneOf(b, 'role', ROLES, 'Role');

  const create = db.transaction(() => {
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(mail)) {
      throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists', { field: 'email' });
    }
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash, role, active, created_at, created_by) VALUES (?,?,?,?,1,?,?)')
      .run(name, mail, bcrypt.hashSync(password, 10), role, now(), req.user.id);
    audit(req.user, 'user.created', 'user', info.lastInsertRowid, `Created ${role} account for ${name} (${mail})`, { name, email: mail, role });
    return db.prepare(`SELECT ${COLS} FROM users WHERE id = ?`).get(info.lastInsertRowid);
  });
  res.status(201).json(shape(create.immediate()));
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};

  const update = db.transaction(() => {
    const cur = db.prepare(`SELECT ${COLS}, password_hash FROM users WHERE id = ?`).get(id);
    if (!cur) throw notFound('User');

    const next = { name: cur.name, role: cur.role, active: !!cur.active };
    if (has(b, 'name')) next.name = text(b, 'name', { label: 'Name', max: 100 });
    if (has(b, 'role')) next.role = oneOf(b, 'role', ROLES, 'Role');
    if (has(b, 'active')) next.active = !!b.active;
    const newPassword = has(b, 'password') && b.password !== '' ? text(b, 'password', { label: 'Password', min: 8, max: 100, trim: false }) : null;

    // Admins can't lock themselves out (this also guarantees at least one active admin remains).
    if (cur.id === req.user.id && (next.role !== cur.role || next.active !== !!cur.active)) {
      throw new HttpError(409, 'CANNOT_MODIFY_SELF', "You can't change your own role or deactivate your own account");
    }

    const changes = [];
    if (next.name !== cur.name) changes.push(`name "${cur.name}" → "${next.name}"`);
    if (next.role !== cur.role) changes.push(`role ${cur.role} → ${next.role}`);
    if (next.active !== !!cur.active) changes.push(next.active ? 'reactivated' : 'deactivated');
    if (newPassword) changes.push('password reset');
    if (!changes.length) return db.prepare(`SELECT ${COLS} FROM users WHERE id = ?`).get(id);

    db.prepare('UPDATE users SET name = ?, role = ?, active = ?, password_hash = ? WHERE id = ?').run(
      next.name, next.role, next.active ? 1 : 0, newPassword ? bcrypt.hashSync(newPassword, 10) : cur.password_hash, id
    );

    const action = next.role !== cur.role ? 'user.role_changed'
      : next.active !== !!cur.active ? (next.active ? 'user.reactivated' : 'user.deactivated')
      : newPassword && !changes.some((c) => c.startsWith('name')) ? 'user.password_reset'
      : 'user.updated';
    audit(req.user, action, 'user', id, `${cur.name} (${cur.email}): ${changes.join(', ')}`, {
      before: { name: cur.name, role: cur.role, active: !!cur.active },
      after: next,
      passwordReset: !!newPassword,
    });
    return db.prepare(`SELECT ${COLS} FROM users WHERE id = ?`).get(id);
  });
  res.json(shape(update.immediate()));
});

export default router;
