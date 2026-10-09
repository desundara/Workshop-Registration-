// End-to-end checks against a RUNNING server:
//   1. access control is enforced by the backend for every role
//   2. the capacity rule holds when many registrations arrive at the same moment
//   3. waitlist promotion is atomic and fair under parallel cancellations
//
//   npm run test:concurrency
//   API_URLS=http://localhost:4000,http://localhost:4001 npm run test:concurrency
//     (two server processes sharing one database file - proves it isn't just
//      Node's single thread that makes the rule hold)

const URLS = (process.env.API_URLS || process.env.API_URL || 'http://localhost:4000').split(',');
let rr = 0;
const nextUrl = () => URLS[rr++ % URLS.length];

async function call(method, path, { token, body, fixed } = {}) {
  const res = await fetch((fixed ? URLS[0] : nextUrl()) + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

let failures = 0;
const check = (label, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};
const tally = (rs) => rs.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});

async function login(email, password) {
  const r = await call('POST', '/auth/login', { body: { email, password }, fixed: true });
  if (r.status !== 200) throw new Error(`Login failed for ${email} (${r.status}). Is the server running with seed data?`);
  return r.data.token;
}

const startsAt = new Date(Date.now() + 7 * 864e5).toISOString();
const makeWorkshop = async (token, capacity) => {
  const code = `T${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
  const r = await call('POST', '/workshops', {
    token, fixed: true,
    body: { code, title: `Test ${code}`, instructor: 'Test', location: 'Test Lab', starts_at: startsAt, capacity },
  });
  if (r.status !== 201) throw new Error('Could not create test workshop: ' + JSON.stringify(r.data));
  return r.data;
};

const admin = await login('admin@center.test', 'Admin@123');
const manager = await login('manager@center.test', 'Manager@123');
const staff = await login('staff@center.test', 'Staff@123');

console.log('\n1. Access control (enforced by the API, not the UI)');
const ws0 = await makeWorkshop(manager, 3);
const expect = async (label, method, path, token, status, body) => {
  const r = await call(method, path, { token, body, fixed: true });
  check(label, r.status === status, `(expected ${status}, got ${r.status})`);
};
await expect('no token -> 401 on workshops', 'GET', '/workshops', undefined, 401);
await expect('admin cannot list workshops', 'GET', '/workshops', admin, 403);
await expect('admin cannot register attendees', 'POST', `/workshops/${ws0.id}/registrations`, admin, 403, { name: 'A B', email: 'ab@example.com' });
await expect('admin cannot view registrations', 'GET', `/workshops/${ws0.id}/registrations`, admin, 403);
await expect('staff cannot create workshops', 'POST', '/workshops', staff, 403, { code: 'X1' });
await expect('staff cannot edit workshops', 'PATCH', `/workshops/${ws0.id}`, staff, 403, { title: 'Hacked' });
await expect('staff cannot list users', 'GET', '/users', staff, 403);
await expect('manager cannot create users', 'POST', '/users', manager, 403, { name: 'X', email: 'x@y.com', password: 'password1', role: 'admin' });
await expect('manager cannot read audit log', 'GET', '/audit', manager, 403);
await expect('staff can list workshops', 'GET', '/workshops', staff, 200);
await expect('manager can list workshops', 'GET', '/workshops', manager, 200);
await expect('admin can list users', 'GET', '/users', admin, 200);

console.log('\n2. Capacity rule: 80 simultaneous registrations for a 20-seat workshop');
const ws1 = await makeWorkshop(manager, 20);
const burst = await Promise.all(
  Array.from({ length: 80 }, (_, i) =>
    call('POST', `/workshops/${ws1.id}/registrations`, {
      token: i % 2 ? staff : manager,
      body: { name: `Person ${i}`, email: `person${i}@example.com` },
    })
  )
);
let counts = tally(burst);
check('exactly 20 succeeded (201)', counts[201] === 20, JSON.stringify(counts));
check('the other 60 were refused with 409 WORKSHOP_FULL', burst.filter((r) => r.status === 409 && r.data?.error?.code === 'WORKSHOP_FULL').length === 60);
let regs = (await call('GET', `/workshops/${ws1.id}/registrations`, { token: manager, fixed: true })).data;
check('database holds exactly 20 active registrations', regs.filter((r) => r.status === 'active').length === 20);

console.log('\n3. Same person registered 10x at the same moment');
const ws2 = await makeWorkshop(manager, 10);
const dupes = await Promise.all(
  Array.from({ length: 10 }, () => call('POST', `/workshops/${ws2.id}/registrations`, { token: staff, body: { name: 'Same Person', email: 'Same.Person@example.com' } }))
);
counts = tally(dupes);
check('only 1 registration created', counts[201] === 1, JSON.stringify(counts));

console.log('\n4. Waitlist: 5 seats, 20 queue up, 3 cancel at the same moment');
const ws3 = await makeWorkshop(manager, 5);
const fill = await Promise.all(
  Array.from({ length: 25 }, (_, i) =>
    call('POST', `/workshops/${ws3.id}/registrations`, { token: staff, body: { name: `Queue ${i}`, email: `queue${i}@example.com`, joinWaitlist: true } })
  )
);
check('all 25 accepted (5 active + 20 waitlisted)', fill.every((r) => r.status === 201));
regs = (await call('GET', `/workshops/${ws3.id}/registrations`, { token: manager, fixed: true })).data;
check('5 active / 20 waitlisted', regs.filter((r) => r.status === 'active').length === 5 && regs.filter((r) => r.status === 'waitlisted').length === 20);
const toCancel = regs.filter((r) => r.status === 'active').slice(0, 3);
const waitlistBefore = regs.filter((r) => r.status === 'waitlisted').map((r) => r.id).sort((a, b) => a - b);
await Promise.all(toCancel.map((r) => call('POST', `/registrations/${r.id}/cancel`, { token: staff, body: { reason: 'test' } })));
regs = (await call('GET', `/workshops/${ws3.id}/registrations`, { token: manager, fixed: true })).data;
check('still exactly 5 active (seats refilled, never exceeded)', regs.filter((r) => r.status === 'active').length === 5);
check('3 cancelled records kept in history', regs.filter((r) => r.status === 'cancelled').length === 3 && regs.every((r) => r.registered_by_name));
check('cancelled records say who/when', regs.filter((r) => r.status === 'cancelled').every((r) => r.cancelled_by_name && r.cancelled_at));
const promoted = regs.filter((r) => r.promoted_at).map((r) => r.id).sort((a, b) => a - b);
check('the 3 earliest waitlisted people were promoted, in order', JSON.stringify(promoted) === JSON.stringify(waitlistBefore.slice(0, 3)));

console.log('\n5. Capacity cannot be lowered below taken seats');
const r = await call('PATCH', `/workshops/${ws3.id}`, { token: manager, body: { capacity: 4 }, fixed: true });
check('PATCH capacity 4 (5 taken) -> 409', r.status === 409 && r.data?.error?.code === 'CAPACITY_BELOW_ACTIVE');

console.log(failures ? `\n${failures} check(s) FAILED\n` : '\nAll checks passed\n');
process.exit(failures ? 1 : 0);
