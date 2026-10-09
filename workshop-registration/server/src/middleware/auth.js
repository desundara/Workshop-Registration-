import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { JWT_SECRET } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { PERMISSIONS } from '../permissions.js';

// Verifies the token AND re-loads the user on every request, so a role change
// or a deactivated account takes effect immediately (no stale-token privileges).
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in to continue');

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw new HttpError(401, 'INVALID_TOKEN', 'Your session has expired, please sign in again');
  }

  const user = db.prepare('SELECT id, name, email, role, active FROM users WHERE id = ?').get(payload.sub);
  if (!user || !user.active) throw new HttpError(401, 'ACCOUNT_DISABLED', 'This account is no longer active');
  req.user = user;
  next();
}

// Route guard: can('workshops:write')
export const can = (permission) => (req, res, next) => {
  if (!PERMISSIONS[permission]?.includes(req.user.role)) {
    throw new HttpError(403, 'FORBIDDEN', "Your role doesn't have access to this action");
  }
  next();
};
