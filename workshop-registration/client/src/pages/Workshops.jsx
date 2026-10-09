import { useEffect, useRef, useState } from 'react';
import { CalendarSearch, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Button, Card, EmptyState, ErrorBanner, Input, PageHeader, Select, Spinner, cn } from '../components/ui.jsx';
import WorkshopCard from '../components/WorkshopCard.jsx';
import WorkshopForm from '../components/WorkshopForm.jsx';
import { addDays, endOfDay, startOfDay } from '../lib/format.js';

const PRESETS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Next 7 days' },
  { id: 'all', label: 'All dates' },
  { id: 'custom', label: 'Custom range' },
];

function rangeFor(preset, custom) {
  const now = new Date();
  if (preset === 'upcoming') return { from: now.toISOString() };
  if (preset === 'today') return { from: startOfDay().toISOString(), to: endOfDay().toISOString() };
  if (preset === 'week') return { from: now.toISOString(), to: endOfDay(addDays(now, 6)).toISOString() };
  if (preset === 'custom') {
    return {
      from: custom.from ? startOfDay(new Date(`${custom.from}T00:00`)).toISOString() : undefined,
      to: custom.to ? endOfDay(new Date(`${custom.to}T00:00`)).toISOString() : undefined,
    };
  }
  return {};
}

export default function Workshops() {
  const { can } = useAuth();
  const [filters, setFilters] = useState({ q: '', status: '', location: '', preset: 'upcoming', onlyAvailable: false });
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [items, setItems] = useState(null);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [reload, setReload] = useState(0);
  const reqId = useRef(0);

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  useEffect(() => { api.get('/workshops/locations').then(setLocations).catch(() => {}); }, [reload]);

  useEffect(() => {
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const data = await api.get('/workshops', {
          q: filters.q.trim(), status: filters.status, location: filters.location,
          minSeats: filters.onlyAvailable ? 1 : undefined,
          ...rangeFor(filters.preset, custom),
        });
        if (id === reqId.current) { setItems(data); setError(''); }
      } catch (ex) { if (id === reqId.current) setError(ex.message); }
    }, filters.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [filters, custom, reload]);

  const withSeats = items?.filter((w) => w.status === 'scheduled' && w.seats_available > 0).length ?? 0;
  const anyFilter = filters.q || filters.status || filters.location || filters.onlyAvailable || filters.preset !== 'upcoming';

  return (
    <>
      <PageHeader
        title="Workshops"
        subtitle={items ? `${items.length} workshop${items.length === 1 ? '' : 's'} · ${withSeats} with seats open` : 'Find a workshop and register attendees'}
        actions={can('workshops:write') && <Button icon={Plus} onClick={() => setCreating(true)}>New workshop</Button>}
      />

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => set('preset', p.id)}
              className={cn('rounded-full px-3.5 py-1.5 text-sm font-medium transition',
                filters.preset === p.id ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {p.label}
            </button>
          ))}
          <button onClick={() => set('onlyAvailable', !filters.onlyAvailable)} aria-pressed={filters.onlyAvailable}
            className={cn('ml-auto flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition',
              filters.onlyAvailable ? 'bg-emerald-50 text-emerald-700 ring-emerald-300' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50')}>
            <span className={cn('h-2 w-2 rounded-full', filters.onlyAvailable ? 'bg-emerald-500' : 'bg-slate-300')} />
            Only with seats available
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={filters.q} onChange={(e) => set('q', e.target.value)} placeholder="Search title, code, instructor"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10" />
          </div>
          <Select value={filters.status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
            <option value="">Any status</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Select value={filters.location} onChange={(e) => set('location', e.target.value)} aria-label="Location">
            <option value="">All locations</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
          {anyFilter && (
            <Button variant="ghost" icon={SlidersHorizontal} onClick={() => { setFilters({ q: '', status: '', location: '', preset: 'upcoming', onlyAvailable: false }); setCustom({ from: '', to: '' }); }}>
              Reset filters
            </Button>
          )}
        </div>

        {filters.preset === 'custom' && (
          <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
            <Input label="From" type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            <Input label="To" type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </div>
        )}
      </Card>

      <ErrorBanner>{error}</ErrorBanner>
      {!items && !error ? <Spinner /> : items && items.length === 0 ? (
        <EmptyState icon={CalendarSearch} title="No workshops match">Try a wider date range or turn off “Only with seats available”.</EmptyState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{items?.map((w) => <WorkshopCard key={w.id} w={w} />)}</div>
      )}

      <WorkshopForm open={creating} onClose={() => setCreating(false)} locations={locations} onSaved={() => setReload((n) => n + 1)} />
    </>
  );
}
