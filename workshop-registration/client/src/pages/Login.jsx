import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CalendarCheck, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Button, ErrorBanner, Input } from '../components/ui.jsx';

// Dev-only shortcuts so reviewers can try each role in one click.
const DEMO = [
  { label: 'Admin', email: 'admin@center.test', password: 'Admin@123' },
  { label: 'Manager', email: 'manager@center.test', password: 'Manager@123' },
  { label: 'Front desk', email: 'staff@center.test', password: 'Staff@123' },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(email, password); navigate('/', { replace: true }); }
    catch (ex) { setError(ex.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-slate-900 via-brand-900 to-brand-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20"><Sparkles className="h-5 w-5" /></div>
          <span className="text-lg font-semibold">Workshop Desk</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">Every seat counted.<br />No more double-booking.</h1>
          <p className="mt-4 text-brand-100/90">Register attendees, keep a clear history, and see which workshops still have room, all in one place.</p>
          <ul className="mt-8 space-y-4 text-sm text-brand-50">
            {[[CalendarCheck, 'Live seat counts that can never go over capacity'], [Users, 'Waitlists that fill freed seats automatically'], [ShieldCheck, 'Role-based access, enforced on the server']].map(([Icon, t]) => (
              <li key={t} className="flex items-center gap-3"><span className="rounded-lg bg-white/10 p-2 ring-1 ring-white/15"><Icon className="h-4 w-4" /></span>{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-200/70">Community training centre · Internal staff tool</p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden"><Sparkles className="h-5 w-5 text-brand-600" /><span className="font-semibold">Workshop Desk</span></div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in with the account your administrator created for you.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <ErrorBanner>{error}</ErrorBanner>
            <Input label="Email" type="email" autoComplete="username" placeholder="you@center.org" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            <Input label="Password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" size="lg" loading={busy} className="w-full">Sign in</Button>
          </form>

          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Demo accounts (dev only)</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button key={d.label} type="button" onClick={() => { setEmail(d.email); setPassword(d.password); setError(''); }}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200">
                  {d.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">Click a role to fill in its credentials, then sign in.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
