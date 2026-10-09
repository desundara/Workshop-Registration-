import express from 'express';
import cors from 'cors';
import { PORT } from './config.js';
import './db.js';
import { HttpError } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import workshopRoutes from './routes/workshops.js';
import registrationRoutes from './routes/registrations.js';
import auditRoutes from './routes/audit.js';
import { seedIfEmpty, DEMO_LOGINS } from './seedData.js';

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '50kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workshops', workshopRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api', registrationRoutes);
app.use('/api', (req, res, next) => next(new HttpError(404, 'NOT_FOUND', 'Route not found')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }
  // The database-level safety net (triggers) fired - report it like the app-level check would.
  if (typeof err.message === 'string' && err.message.includes('CAPACITY_EXCEEDED')) {
    return res.status(409).json({ error: { code: 'WORKSHOP_FULL', message: 'This workshop is full' } });
  }
  if (typeof err.message === 'string' && err.message.includes('CAPACITY_BELOW_ACTIVE')) {
    return res.status(409).json({ error: { code: 'CAPACITY_BELOW_ACTIVE', message: "Capacity can't be lower than the seats already taken" } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side' } });
});

if (process.env.AUTO_SEED !== 'false' && seedIfEmpty()) {
  console.log('\nFirst run - database seeded with demo data. Dev-only logins:');
  for (const l of DEMO_LOGINS) console.log(`  ${l.role.padEnd(8)} ${l.email}  /  ${l.password}`);
}

app.listen(PORT, () => console.log(`\nAPI ready on http://localhost:${PORT}`));
