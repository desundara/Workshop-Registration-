import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, can } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, can('audit:read'));

router.get('/', (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const entity = ['user', 'workshop'].includes(req.query.entity) ? req.query.entity : null;
  const where = entity ? 'WHERE entity_type = @entity' : '';
  const items = db
    .prepare(`SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT @limit OFFSET @offset`)
    .all({ entity, limit, offset })
    .map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null }));
  const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_log ${where}`).get(entity ? { entity } : {}).c;
  res.json({ items, total });
});

export default router;
