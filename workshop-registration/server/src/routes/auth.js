import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { JWT_SECRET, TOKEN_TTL } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { permissionsFor } from '../permissions.js';

const router = Router();
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10); // keeps timing similar for unknown emails

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

router.post('/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = email ? db.prepare('SELECT * FROM users WHERE email = ?').get(email) : null;
  const ok = bcrypt.compareSync(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok || !user.active) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  }
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL, algorithm: 'HS256' });
  res.json({ token, user: publicUser(user), permissions: permissionsFor(user.role) });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user), permissions: permissionsFor(req.user.role) });
});

export default router;
