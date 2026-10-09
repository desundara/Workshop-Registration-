import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PORT = Number(process.env.PORT) || 4000;
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
export const TOKEN_TTL = '12h';
export const DB_PATH = process.env.DB_PATH || path.join(root, 'data', 'workshops.db');

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'dev-only-secret-change-me') {
  console.warn('[warn] JWT_SECRET is not set - using the insecure dev default.');
}
