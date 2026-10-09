import { Link } from 'react-router-dom';
import { Clock, MapPin, UserRound } from 'lucide-react';
import { Badge, SeatMeter, WORKSHOP_STATUS } from './ui.jsx';
import { dayNum, fmtTime, monthShort, weekday } from '../lib/format.js';

export default function WorkshopCard({ w }) {
  const st = WORKSHOP_STATUS[w.status];
  const dim = w.status !== 'scheduled';
  return (
    <Link
      to={`/workshops/${w.id}`}
      className="group flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-900/5 hover:ring-brand-200"
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${dim ? 'bg-slate-100 text-slate-500' : 'bg-brand-50 text-brand-700'}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wide">{monthShort(w.starts_at)}</span>
          <span className="text-xl font-bold leading-none">{dayNum(w.starts_at)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600">{w.code}</span>
            <Badge tone={st.tone} dot>{st.label}</Badge>
          </div>
          <h3 className="line-clamp-2 font-semibold leading-snug text-slate-900 group-hover:text-brand-700">{w.title}</h3>
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 text-sm text-slate-500">
        <div className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0 text-slate-400" />{weekday(w.starts_at)}, {fmtTime(w.starts_at)}{w.ends_at ? ` – ${fmtTime(w.ends_at)}` : ''}</div>
        <div className="flex items-center gap-2"><UserRound className="h-4 w-4 shrink-0 text-slate-400" />{w.instructor}</div>
        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-slate-400" />{w.location}</div>
      </dl>

      <div className="mt-5 border-t border-slate-100 pt-4">
        {w.status === 'scheduled'
          ? <SeatMeter taken={w.active_count} capacity={w.capacity} waitlist={w.waitlist_count} />
          : <div className="text-xs text-slate-500">{w.active_count} of {w.capacity} seats were booked</div>}
      </div>
    </Link>
  );
}
