import bcrypt from 'bcryptjs';
import { db, now } from './db.js';
import { audit } from './lib/audit.js';

export const DEMO_LOGINS = [
  { name: 'Alex Admin', email: 'admin@center.test', password: 'Admin@123', role: 'admin' },
  { name: 'Maya Manager', email: 'manager@center.test', password: 'Manager@123', role: 'manager' },
  { name: 'Nuwan Front-desk', email: 'staff@center.test', password: 'Staff@123', role: 'staff' },
];

const PEOPLE = [
  'Amara Jayasinghe', 'Binura Fernando', 'Chathuri Perera', 'Dilan Silva', 'Eshani Wickramasinghe',
  'Farhan Marikar', 'Gayani Rajapaksa', 'Harsha Gunawardena', 'Imesha Kumari', 'Janith Bandara',
  'Kavindi Senanayake', 'Lakmal Herath', 'Madushi Ratnayake', 'Nadeesha Abeysekera', 'Oshada Liyanage',
  'Praveen Dias', 'Qasim Nazeer', 'Rashmi Samarasinghe', 'Sahan Weerasinghe', 'Tharushi Amarasekara',
];

const at = (days, hour, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};
const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();

const WORKSHOPS = [
  { code: 'POT-101', title: 'Pottery: Wheel Throwing Basics', instructor: 'Ishara Silva', location: 'Downtown Centre',
    description: 'Centre clay, pull walls and shape your first bowl. All materials provided.',
    starts_at: at(2, 10), ends_at: at(2, 12, 30), capacity: 12, status: 'scheduled', active: 7, waitlist: 0, cancelled: 1 },
  { code: 'COD-201', title: 'Intro to Web Coding', instructor: 'Dinesh Perera', location: 'Riverside Branch',
    description: 'Build and publish your first web page with HTML and CSS. Bring a laptop.',
    starts_at: at(3, 14), ends_at: at(3, 17), capacity: 10, status: 'scheduled', active: 9, waitlist: 0, cancelled: 0 },
  { code: 'FIT-110', title: 'Saturday Morning Yoga Flow', instructor: 'Nilmini Fernando', location: 'Hillview Campus',
    description: 'A gentle, all-levels flow to start the weekend. Mats available.',
    starts_at: at(1, 7, 30), ends_at: at(1, 8, 30), capacity: 8, status: 'scheduled', active: 8, waitlist: 2, cancelled: 1 },
  { code: 'PHO-150', title: 'Photography Basics', instructor: 'Kasun Wijesinghe', location: 'Downtown Centre',
    description: 'Exposure, composition and light, with a short photo walk.',
    starts_at: at(4, 18), ends_at: at(4, 20), capacity: 14, status: 'scheduled', active: 3, waitlist: 0, cancelled: 0 },
  { code: 'ART-130', title: 'Watercolour Painting for Beginners', instructor: 'Sanduni Rathnayake', location: 'Hillview Campus',
    description: 'Washes, layering and simple landscapes.',
    starts_at: at(9, 10), ends_at: at(9, 13), capacity: 16, status: 'scheduled', active: 5, waitlist: 0, cancelled: 0 },
  { code: 'BAK-120', title: 'Sourdough Baking', instructor: 'Ruwani De Silva', location: 'Riverside Branch',
    description: 'Starter care, shaping and baking. (Cancelled - instructor unavailable.)',
    starts_at: at(5, 9), ends_at: at(5, 12), capacity: 12, status: 'cancelled', active: 4, waitlist: 0, cancelled: 0 },
  { code: 'WLD-100', title: 'Intro to Welding', instructor: 'Chamara Gunasekara', location: 'Hillview Campus',
    description: 'Workshop safety and your first welds.',
    starts_at: at(-3, 13), ends_at: at(-3, 16), capacity: 6, status: 'completed', active: 6, waitlist: 0, cancelled: 0 },
];

export function seedIfEmpty() {
  if (db.prepare('SELECT COUNT(*) AS c FROM users').get().c > 0) return false;
  seedDemoData();
  return true;
}

export function seedDemoData() {
  const run = db.transaction(() => {
    const t = now();
    const ids = {};
    for (const u of DEMO_LOGINS) {
      const info = db
        .prepare('INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?,?,?,?,1,?)')
        .run(u.name, u.email, bcrypt.hashSync(u.password, 10), u.role, t);
      ids[u.role] = info.lastInsertRowid;
    }
    const admin = { id: ids.admin, name: DEMO_LOGINS[0].name };
    const manager = { id: ids.manager, name: DEMO_LOGINS[1].name };
    audit(admin, 'user.created', 'user', ids.manager, `Created manager account for ${DEMO_LOGINS[1].name} (${DEMO_LOGINS[1].email})`);
    audit(admin, 'user.created', 'user', ids.staff, `Created staff account for ${DEMO_LOGINS[2].name} (${DEMO_LOGINS[2].email})`);

    const insertWs = db.prepare(`INSERT INTO workshops (code,title,instructor,location,description,starts_at,ends_at,capacity,status,created_by,created_at,updated_at)
      VALUES (@code,@title,@instructor,@location,@description,@starts_at,@ends_at,@capacity,@status,@by,@t,@t)`);
    const insertReg = db.prepare(`INSERT INTO registrations (workshop_id,attendee_name,attendee_email,status,registered_by,registered_at,cancelled_by,cancelled_at,cancel_reason)
      VALUES (?,?,?,?,?,?,?,?,?)`);

    WORKSHOPS.forEach((w, i) => {
      const wsId = insertWs.run({ ...w, by: ids.manager, t }).lastInsertRowid;
      audit(manager, 'workshop.created', 'workshop', wsId, `Created workshop ${w.code} "${w.title}" (${w.capacity} seats)`);
      let k = 0;
      const person = () => {
        const name = PEOPLE[(i * 3 + k++) % PEOPLE.length];
        return [name, `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`];
      };
      const by = () => (k % 2 ? ids.staff : ids.manager);
      for (let n = 0; n < w.active; n++) { const [nm, em] = person(); insertReg.run(wsId, nm, em, 'active', by(), hoursAgo(72 - n * 3), null, null, null); }
      for (let n = 0; n < w.waitlist; n++) { const [nm, em] = person(); insertReg.run(wsId, nm, em, 'waitlisted', by(), hoursAgo(10 - n), null, null, null); }
      for (let n = 0; n < w.cancelled; n++) {
        const [nm, em] = person();
        insertReg.run(wsId, nm, em, 'cancelled', ids.staff, hoursAgo(60), ids.staff, hoursAgo(20), 'Had a schedule clash');
      }
    });
    audit(manager, 'workshop.updated', 'workshop', 1, 'Edited workshop POT-101: capacity 10 → 12', { capacity: { from: 10, to: 12 } });
  });
  run();
}
