import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, History, ListPlus, MapPin, Pencil, UserMinus, UserPlus, UserRound } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  Badge, Button, Card, EmptyState, ErrorBanner, Input, Modal, REG_STATUS, SeatMeter, Spinner, Textarea,
  WORKSHOP_STATUS, cn, useToast,
} from '../components/ui.jsx';
import WorkshopForm from '../components/WorkshopForm.jsx';
import { fmtDateTime, fmtFull } from '../lib/format.js';

const TABS = [
  { id: 'active', label: 'Registered' },
  { id: 'waitlisted', label: 'Waitlist' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'Full history' },
];

export default function WorkshopDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const [ws, setWs] = useState(null);
  const [regs, setRegs] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('active');
  const [editing, setEditing] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  const load = useCallback(async () => {
    try {
      const [w, r] = await Promise.all([api.get(`/workshops/${id}`), api.get(`/workshops/${id}/registrations`)]);
      setWs(w); setRegs(r); setError('');
    } catch (ex) { setError(ex.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (error && !ws) return <><BackLink /><ErrorBanner>{error}</ErrorBanner></>;
  if (!ws) return <Spinner />;

  const counts = { active: 0, waitlisted: 0, cancelled: 0, all: regs.length };
  regs.forEach((r) => counts[r.status]++);
  const visible = tab === 'all' ? regs : regs.filter((r) => r.status === tab);
  const st = WORKSHOP_STATUS[ws.status];
  const started = new Date(ws.starts_at) <= new Date();
  const closedReason = ws.status !== 'scheduled' ? `This workshop is ${ws.status}, so registration is closed.` : started ? 'This workshop has already started.' : '';

  return (
    <>
      <BackLink />

      <Card className="mb-6 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-brand-500 via-violet-500 to-brand-400" />
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">{ws.code}</span>
              <Badge tone={st.tone} dot>{st.label}</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{ws.title}</h1>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" />{fmtDateTime(ws.starts_at)}{ws.ends_at && ` → ${fmtDateTime(ws.ends_at)}`}</span>
              <span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-slate-400" />{ws.instructor}</span>
              <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{ws.location}</span>
            </div>
            {ws.description && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">{ws.description}</p>}
          </div>
          {can('workshops:write') && <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 lg:order-2 space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Seats</h2>
            <SeatMeter taken={ws.active_count} capacity={ws.capacity} waitlist={ws.waitlist_count} />
          </Card>
          {can('registrations:write') && (
            <RegisterCard ws={ws} closedReason={closedReason} onDone={load} />
          )}
        </div>

        <div className="lg:col-span-2 lg:order-1">
          <Card>
            <div className="flex flex-wrap gap-1 border-b border-slate-100 px-3 pt-3">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={cn('-mb-px flex items-center gap-2 rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-medium transition',
                    tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>
                  {t.label}
                  <span className={cn('rounded-full px-2 py-0.5 text-xs', tab === t.id ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500')}>{counts[t.id]}</span>
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <div className="p-6"><EmptyState icon={History} title="Nothing here yet">{tab === 'active' ? 'Registered attendees will appear here.' : 'No records in this view.'}</EmptyState></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Attendee</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Registered</th>
                      <th className="px-3 py-3 font-medium">Cancelled</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visible.map((r) => {
                      const s = REG_STATUS[r.status];
                      return (
                        <tr key={r.id} className="align-top hover:bg-slate-50/60">
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-slate-900">{r.attendee_name}</div>
                            <div className="text-xs text-slate-500">{r.attendee_email}</div>
                          </td>
                          <td className="px-3 py-3.5">
                            <Badge tone={s.tone} dot>{s.label}{r.status === 'waitlisted' && ` #${r.waitlist_position}`}</Badge>
                            {r.promoted_at && <div className="mt-1 text-[11px] text-amber-700">Promoted from waitlist {fmtFull(r.promoted_at)}</div>}
                          </td>
                          <td className="px-3 py-3.5 text-slate-600">
                            <div>{fmtFull(r.registered_at)}</div>
                            <div className="text-xs text-slate-400">by {r.registered_by_name}</div>
                          </td>
                          <td className="px-3 py-3.5 text-slate-600">
                            {r.status === 'cancelled' ? (
                              <>
                                <div>{fmtFull(r.cancelled_at)}</div>
                                <div className="text-xs text-slate-400">by {r.cancelled_by_name}</div>
                                {r.cancel_reason && <div className="mt-0.5 text-xs italic text-slate-500">“{r.cancel_reason}”</div>}
                              </>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {r.status !== 'cancelled' && can('registrations:write') && (
                              <Button size="sm" variant="dangerSoft" icon={UserMinus} onClick={() => setCancelTarget(r)}>Cancel</Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      <WorkshopForm open={editing} onClose={() => setEditing(false)} workshop={ws} onSaved={load} />
      <CancelModal reg={cancelTarget} waitlistCount={ws.waitlist_count} onClose={() => setCancelTarget(null)}
        onDone={(res) => {
          const p = res.promoted?.[0];
          toast.success(p ? `Cancelled. ${p.attendee_name} moved up from the waitlist.` : 'Registration cancelled and the seat is free again.');
          load();
        }} />
    </>
  );
}

function BackLink() {
  return (
    <Link to="/workshops" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700">
      <ArrowLeft className="h-4 w-4" /> All workshops
    </Link>
  );
}

function RegisterCard({ ws, closedReason, onDone }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [fullPrompt, setFullPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const full = ws.status === 'scheduled' && ws.seats_available === 0;

  async function submit(joinWaitlist = false) {
    setBusy(true); setErrors({}); setFormError('');
    try {
      const r = await api.post(`/workshops/${ws.id}/registrations`, { name, email, joinWaitlist });
      toast.success(r.status === 'waitlisted' ? `${r.attendee_name} added to the waitlist (#${r.waitlist_position})` : `${r.attendee_name} registered`);
      setName(''); setEmail(''); setFullPrompt(false);
    } catch (ex) {
      if (ex.code === 'WORKSHOP_FULL') setFullPrompt(true);
      else if (ex.details?.field) setErrors({ [ex.details.field]: ex.message });
      else setFormError(ex.message);
    } finally { setBusy(false); onDone(); }   // always refresh: someone else may have taken the seat
  }

  return (
    <Card className="p-5">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Register an attendee</h2>
      <p className="mb-4 text-xs text-slate-500">Name and email are all we need.</p>
      {closedReason ? (
        <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">{closedReason}</div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); setFullPrompt(false); submit(false); }} className="space-y-3">
          <ErrorBanner>{formError}</ErrorBanner>
          <Input label="Full name" value={name} onChange={(e) => { setName(e.target.value); setFullPrompt(false); }} error={errors.name} required />
          <Input label="Email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setFullPrompt(false); }} error={errors.email} required />

          {(fullPrompt || full) && (
            <div className="rounded-xl bg-amber-50 p-3.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
              <strong>This workshop is full.</strong> You can add {name || 'them'} to the waitlist, and they'll get the next free seat automatically.
            </div>
          )}

          {fullPrompt || full ? (
            <Button type="button" variant="primary" icon={ListPlus} loading={busy} className="w-full" disabled={!name || !email} onClick={() => submit(true)}>Add to waitlist</Button>
          ) : (
            <Button type="submit" icon={UserPlus} loading={busy} className="w-full">Register</Button>
          )}
        </form>
      )}
    </Card>
  );
}

function CancelModal({ reg, waitlistCount, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setReason(''); setError(''); }, [reg]);

  async function confirm() {
    setBusy(true); setError('');
    try { const res = await api.post(`/registrations/${reg.id}/cancel`, { reason: reason.trim() || undefined }); onDone(res); onClose(); }
    catch (ex) { setError(ex.message); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={!!reg} onClose={onClose} size="sm" title="Cancel this registration?"
      subtitle={reg ? `${reg.attendee_name} · ${reg.attendee_email}` : ''}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Keep it</Button>
        <Button variant="danger" loading={busy} onClick={confirm}>Cancel registration</Button>
      </>}>
      <div className="space-y-4">
        <ErrorBanner>{error}</ErrorBanner>
        <p className="text-sm text-slate-600">
          The record stays in the history with your name and the time.
          {reg?.status === 'active' && waitlistCount > 0 && ' The next person on the waitlist will get this seat automatically.'}
        </p>
        <Textarea label="Reason (optional)" placeholder="e.g. Called to say they can't make it" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}
