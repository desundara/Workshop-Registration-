import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { initials } from '../lib/format.js';

export const cn = (...a) => a.filter(Boolean).join(' ');

/* ---------- Buttons ---------- */
const VARIANTS = {
  primary: 'bg-brand-600 text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700 active:bg-brand-800',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 shadow-sm hover:bg-slate-50',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  danger: 'bg-rose-600 text-white shadow-sm shadow-rose-600/25 hover:bg-rose-700',
  dangerSoft: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
  ghost: 'text-slate-600 hover:bg-slate-100',
};
const SIZES = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-sm' };

export function Button({ variant = 'primary', size = 'md', loading = false, icon: Icon, className, children, disabled, ...rest }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant], SIZES[size], className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

/* ---------- Form fields ---------- */
const inputCls =
  'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-4 disabled:bg-slate-50 disabled:text-slate-500';
const okCls = 'border-slate-200 focus:border-brand-500 focus:ring-brand-500/10';
const errCls = 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10';

export function Field({ label, error, hint, children, className }) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>}
      {children}
      {error ? <span className="mt-1.5 block text-xs font-medium text-rose-600">{error}</span>
        : hint ? <span className="mt-1.5 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
export function Input({ label, error, hint, className, ...p }) {
  return <Field label={label} error={error} hint={hint} className={className}><input className={cn(inputCls, error ? errCls : okCls)} {...p} /></Field>;
}
export function Select({ label, error, hint, className, children, ...p }) {
  return <Field label={label} error={error} hint={hint} className={className}><select className={cn(inputCls, 'pr-9', error ? errCls : okCls)} {...p}>{children}</select></Field>;
}
export function Textarea({ label, error, hint, className, ...p }) {
  return <Field label={label} error={error} hint={hint} className={className}><textarea rows={3} className={cn(inputCls, error ? errCls : okCls)} {...p} /></Field>;
}

/* ---------- Badges ---------- */
const TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
};
const DOTS = { slate: 'bg-slate-400', brand: 'bg-brand-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500', violet: 'bg-violet-500' };
export function Badge({ tone = 'slate', dot = false, className, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', TONES[tone], className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  );
}
export const WORKSHOP_STATUS = {
  scheduled: { tone: 'brand', label: 'Scheduled' },
  completed: { tone: 'slate', label: 'Completed' },
  cancelled: { tone: 'rose', label: 'Cancelled' },
};
export const REG_STATUS = {
  active: { tone: 'emerald', label: 'Registered' },
  waitlisted: { tone: 'amber', label: 'Waitlisted' },
  cancelled: { tone: 'rose', label: 'Cancelled' },
};
export const ROLE_TONE = { admin: 'violet', manager: 'brand', staff: 'emerald' };

/* ---------- Seat meter ---------- */
export function SeatMeter({ taken, capacity, waitlist = 0, className }) {
  const left = Math.max(0, capacity - taken);
  const pct = Math.min(100, Math.round((taken / capacity) * 100));
  const level = left === 0 ? 'full' : left / capacity <= 0.25 ? 'low' : 'ok';
  const bar = { ok: 'bg-emerald-500', low: 'bg-amber-500', full: 'bg-rose-500' }[level];
  const text = { ok: 'text-emerald-700', low: 'text-amber-700', full: 'text-rose-700' }[level];
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className={cn('font-semibold', text)}>{left === 0 ? 'Full' : `${left} seat${left === 1 ? '' : 's'} left`}</span>
        <span className="text-slate-500">
          {taken}/{capacity}{waitlist > 0 && <span className="ml-1.5 text-amber-700">+{waitlist} waiting</span>}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full transition-all duration-500', bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------- Layout bits ---------- */
export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {back}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
export const Card = ({ className, children }) => (
  <div className={cn('rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70', className)}>{children}</div>
);
export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
      {Icon && <div className="mb-4 rounded-2xl bg-brand-50 p-3 text-brand-600"><Icon className="h-6 w-6" /></div>}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-slate-500">{children}</p>}
    </div>
  );
}
export const Spinner = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>
);
export function Avatar({ name, className }) {
  return (
    <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-xs font-semibold text-white', className)}>
      {initials(name)}
    </span>
  );
}
export const ErrorBanner = ({ children }) =>
  children ? (
    <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{children}</span>
    </div>
  ) : null;

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-2xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" className={cn('animate-pop relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl', width)}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Toasts ---------- */
const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((kind, message) => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s, { id, kind, message }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4500);
  }, []);
  const api = { success: (m) => push('success', m), error: (m) => push('error', m) };
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {items.map((t) => (
          <div key={t.id} className="animate-pop pointer-events-auto flex max-w-sm items-start gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
            {t.kind === 'success'
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
