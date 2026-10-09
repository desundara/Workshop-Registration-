// Single source of truth for "who may do what". Mirrors the table in the brief.
// Every route is guarded with can('<permission>') on the backend; the UI only
// reads this list (via /auth/me) to decide what to show.
export const ROLES = ['admin', 'manager', 'staff'];

export const PERMISSIONS = {
  'users:manage': ['admin'],
  'audit:read': ['admin'],
  'workshops:read': ['manager', 'staff'],
  'workshops:write': ['manager'],
  'registrations:read': ['manager', 'staff'],
  'registrations:write': ['manager', 'staff'],
};

export const permissionsFor = (role) =>
  Object.keys(PERMISSIONS).filter((p) => PERMISSIONS[p].includes(role));
