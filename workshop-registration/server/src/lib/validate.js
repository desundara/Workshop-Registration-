import { HttpError } from './errors.js';

export const invalid = (field, message) => new HttpError(400, 'VALIDATION_ERROR', message, { field });
export const has = (b, f) => b != null && Object.prototype.hasOwnProperty.call(b, f) && b[f] !== undefined;

export function text(b, f, { label = f, min = 1, max = 200, optional = false, trim = true } = {}) {
  let v = b?.[f];
  if (v === undefined || v === null || v === '') {
    if (optional) return undefined;
    throw invalid(f, `${label} is required`);
  }
  if (typeof v !== 'string') throw invalid(f, `${label} must be text`);
  if (trim) v = v.trim();
  if (v.length < min) throw invalid(f, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`);
  if (v.length > max) throw invalid(f, `${label} must be at most ${max} characters`);
  return v;
}

export function email(b, f = 'email') {
  const v = text(b, f, { label: 'Email', max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw invalid(f, 'Enter a valid email address');
  return v;
}

export function integer(b, f, { label = f, min = -Infinity, max = Infinity } = {}) {
  const v = b?.[f];
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (!Number.isInteger(n)) throw invalid(f, `${label} must be a whole number`);
  if (n < min || n > max) throw invalid(f, `${label} must be between ${min} and ${max}`);
  return n;
}

export function dateTime(b, f, label = f) {
  const v = b?.[f];
  if (v === undefined || v === null || v === '') throw invalid(f, `${label} is required`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw invalid(f, `${label} is not a valid date`);
  return d.toISOString();
}

export function oneOf(b, f, list, label = f) {
  const v = b?.[f];
  if (!list.includes(v)) throw invalid(f, `${label} must be one of: ${list.join(', ')}`);
  return v;
}

export function isoParam(v, name) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw invalid(name, `${name} is not a valid date`);
  return d.toISOString();
}
