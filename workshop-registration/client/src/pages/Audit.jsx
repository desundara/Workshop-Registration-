import { useCallback, useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { api } from '../api.js';
import { Avatar, Badge, Button, Card, EmptyState, ErrorBanner, PageHeader, Select, Spinner } from '../components/ui.jsx';
import { fmtFull } from '../lib/format.js';

const PAGE = 50;
const ACTION_TONE = {
  'user.created': 'emerald', 'user.role_changed': 'violet', 'user.deactivated': 'rose', 'user.reactivated': 'emerald',
  'user.password_reset': 'amber', 'user.updated': 'slate', 'workshop.created': 'brand', 'workshop.updated': 'slate',
};
const label = (a) => a.split('.')[1].replace(/_/g, ' ');

export default function Audit() {
  const [entity, setEntity] = useState('');
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (offset = 0) => {
    setBusy(true);
    try {
      const r = await api.get('/audit', { limit: PAGE, offset, entity });
      setItems((prev) => (offset ? [...prev, ...r.items] : r.items));
      setTotal(r.total); setError('');
    } catch (ex) { setError(ex.message); } finally { setBusy(false); }
  }, [entity]);
  useEffect(() => { setItems(null); load(0); }, [load]);

  return (
    <>
      <PageHeader title="Audit trail" subtitle="Who changed what, and when: accounts, roles and workshops."
        actions={<Select value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Filter"><option value="">Everything</option><option value="user">Accounts &amp; roles</option><option value="workshop">Workshops</option></Select>} />
      <ErrorBanner>{error}</ErrorBanner>
      {!items ? <Spinner /> : items.length === 0 ? <EmptyState icon={ScrollText} title="No activity yet" /> : (
        <Card className="divide-y divide-slate-100">
          {items.map((e) => (
            <div key={e.id} className="flex items-start gap-4 px-5 py-4">
              <Avatar name={e.actor_name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{e.actor_name}</span>
                  <Badge tone={ACTION_TONE[e.action] || 'slate'}>{e.entity_type} · {label(e.action)}</Badge>
                </div>
                <p className="mt-1 break-words text-sm text-slate-600">{e.summary}</p>
              </div>
              <time className="shrink-0 text-xs text-slate-400">{fmtFull(e.created_at)}</time>
            </div>
          ))}
        </Card>
      )}
      {items && items.length < total && (
        <div className="mt-4 text-center"><Button variant="secondary" loading={busy} onClick={() => load(items.length)}>Load more ({total - items.length} older)</Button></div>
      )}
    </>
  );
}
