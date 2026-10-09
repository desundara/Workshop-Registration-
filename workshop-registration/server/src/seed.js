// npm run seed          -> seeds demo data if the database is empty
// npm run seed:reset    -> wipes the database file first, then seeds
import fs from 'node:fs';
import { DB_PATH } from './config.js';

if (process.argv.includes('--reset')) {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(DB_PATH + suffix, { force: true });
  console.log('Database wiped.');
}
const { seedIfEmpty, DEMO_LOGINS } = await import('./seedData.js');
if (seedIfEmpty()) {
  console.log('Seeded demo data. Dev-only logins:');
  for (const l of DEMO_LOGINS) console.log(`  ${l.role.padEnd(8)} ${l.email}  /  ${l.password}`);
} else {
  console.log('Database already has data - nothing to do. (Use `npm run seed:reset` to start fresh.)');
}
