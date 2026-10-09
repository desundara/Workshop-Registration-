const short = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const full = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const timeOnly = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export const fmtDateTime = (iso) => (iso ? short.format(new Date(iso)) : '—');
export const fmtFull = (iso) => (iso ? full.format(new Date(iso)) : '—');
export const fmtTime = (iso) => (iso ? timeOnly.format(new Date(iso)) : '');
export const monthShort = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short' });
export const dayNum = (iso) => new Date(iso).getDate();
export const weekday = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'short' });

const pad = (n) => String(n).padStart(2, '0');
export const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
export const ROLE_LABEL = { admin: 'Administrator', manager: 'Programme manager', staff: 'Front desk' };
