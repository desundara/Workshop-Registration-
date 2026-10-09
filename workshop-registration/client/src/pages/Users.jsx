import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, UserPlus } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar, Badge, Button, Card, ErrorBanner, Input, Modal, PageHeader, ROLE_TONE, Select, Spinner, useToast } from '../components/ui.jsx';
import { ROLE_LABEL, fmtFull } from '../lib/format.js';

const ROLE_HELP = {
  admin: 'Manages staff accounts and roles. Does not touch workshops or registrations.',
  manager: 'Adds and edits workshops, registers and cancels attendees.',
  staff: 'Registers and cancels attendees; can view workshops and history.',
};

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { mode: 'create' } | { mode: 'edit', user }

  const load = useCallback(() => api.get('/users').then((u) => { setUsers(u); setError(''); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader title="Staff accounts" subtitle="There's no public signup. Accounts are created here."
        actions={<Button icon={Plus} onClick={() => setModal({ mode: 'create' })}>Add account</Button>} />
      <ErrorBanner>{error}</ErrorBanner>
      {!users ? <Spinner /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-3 font-medium">Person</th><th className="px-3 py-3 font-medium">Role</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 font-medium">Created</th><th className="px-5 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className={u.active ? 'hover:bg-slate-50/60' : 'bg-slate-50/50 text-slate-400'}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} className={u.active ? '' : 'opacity-50'} />
                        <div>
                          <div className="font-medium text-slate-900">{u.name}{u.id === me.id && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5"><Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge></td>
                    <td className="px-3 py-3.5"><Badge tone={u.active ? 'emerald' : 'slate'} dot>{u.active ? 'Active' : 'Deactivated'}</Badge></td>
                    <td className="px-3 py-3.5 text-slate-500">{fmtFull(u.created_at)}</td>
                    <td className="px-5 py-3.5 text-right"><Button size="sm" variant="secondary" icon={Pencil} onClick={() => setModal({ mode: 'edit', user: u })}>Edit</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <UserModal state={modal} me={me} onClose={() => setModal(null)} onSaved={load} />
    </>
  );
}

function UserModal({ state, me, onClose, onSaved }) {
  const toast = useToast();
  const open = !!state;
  const editing = state?.mode === 'edit';
  const target = state?.user;
  const isSelf = editing && target.id === me.id;
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'staff', active: true });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({}); setFormError('');
    setF(editing ? { name: target.name, email: target.email, password: '', role: target.role, active: target.active } : { name: '', email: '', password: '', role: 'staff', active: true });
  }, [open, editing, target]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErrors({}); setFormError('');
    try {
      if (editing) {
        const body = { name: f.name, role: f.role, active: f.active };
        if (f.password) body.password = f.password;
        await api.patch(`/users/${target.id}`, body);
        toast.success('Account updated');
      } else {
        await api.post('/users', { name: f.name, email: f.email, password: f.password, role: f.role });
        toast.success(`Account created for ${f.name}`);
      }
      onSaved(); onClose();
    } catch (ex) {
      if (ex.details?.field) setErrors({ [ex.details.field]: ex.message }); else setFormError(ex.message);
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit account' : 'Add account'} subtitle={editing ? target.email : 'They can sign in right away with this password.'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="user-form" loading={busy} icon={editing ? undefined : UserPlus}>{editing ? 'Save changes' : 'Create account'}</Button>
      </>}>
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <ErrorBanner>{formError}</ErrorBanner>
        <Input label="Full name" value={f.name} onChange={set('name')} error={errors.name} required />
        {!editing && <Input label="Email" type="email" value={f.email} onChange={set('email')} error={errors.email} required />}
        <Select label="Role" value={f.role} onChange={set('role')} error={errors.role} disabled={isSelf} hint={isSelf ? "You can't change your own role." : ROLE_HELP[f.role]}>
          {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Input label={editing ? 'New password (leave blank to keep)' : 'Temporary password'} type="password" autoComplete="new-password"
          value={f.password} onChange={set('password')} error={errors.password} hint="At least 8 characters." required={!editing} />
        {editing && (
          <label className={`flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-inset ring-slate-200 ${isSelf ? 'opacity-60' : ''}`}>
            <span>
              <span className="block text-sm font-medium text-slate-800">Account active</span>
              <span className="block text-xs text-slate-500">{isSelf ? "You can't deactivate yourself." : 'Deactivated people are signed out and cannot log in.'}</span>
            </span>
            <input type="checkbox" className="h-5 w-5 rounded accent-brand-600" checked={f.active} disabled={isSelf} onChange={(e) => setF((p) => ({ ...p, active: e.target.checked }))} />
          </label>
        )}
      </form>
    </Modal>
  );
}
