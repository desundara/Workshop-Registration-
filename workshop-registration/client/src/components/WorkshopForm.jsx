import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Button, ErrorBanner, Input, Modal, Select, Textarea, useToast } from './ui.jsx';
import { fromLocalInput, toLocalInput } from '../lib/format.js';

const BLANK = { code: '', title: '', instructor: '', location: '', description: '', starts_at: '', ends_at: '', capacity: 20, status: 'scheduled' };

export default function WorkshopForm({ open, onClose, workshop, onSaved, locations = [] }) {
  const editing = !!workshop;
  const toast = useToast();
  const [f, setF] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({}); setFormError('');
    setF(workshop ? {
      code: workshop.code, title: workshop.title, instructor: workshop.instructor, location: workshop.location,
      description: workshop.description || '', starts_at: toLocalInput(workshop.starts_at), ends_at: toLocalInput(workshop.ends_at),
      capacity: workshop.capacity, status: workshop.status,
    } : BLANK);
  }, [open, workshop]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setErrors({}); setFormError('');
    if (!f.starts_at) return setErrors({ starts_at: 'Start time is required' });
    setBusy(true);
    const body = { ...f, capacity: Number(f.capacity), starts_at: fromLocalInput(f.starts_at), ends_at: fromLocalInput(f.ends_at) };
    try {
      const saved = editing ? await api.patch(`/workshops/${workshop.id}`, body) : await api.post('/workshops', body);
      toast.success(editing ? `${saved.code} updated` : `${saved.code} created`);
      onSaved(saved);
      onClose();
    } catch (ex) {
      if (ex.details?.field) setErrors({ [ex.details.field]: ex.message });
      else setFormError(ex.message);
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open={open} onClose={onClose} size="lg"
      title={editing ? `Edit ${workshop.code}` : 'New workshop'}
      subtitle={editing ? 'Changes are recorded in the audit trail.' : 'Add a workshop to the catalogue.'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="workshop-form" loading={busy}>{editing ? 'Save changes' : 'Create workshop'}</Button>
      </>}
    >
      <form id="workshop-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {formError && <div className="sm:col-span-2"><ErrorBanner>{formError}</ErrorBanner></div>}
        <Input label="Workshop code" placeholder="POT-101" value={f.code} onChange={set('code')} error={errors.code} required />
        <Input label="Capacity (seats)" type="number" min="1" max="1000" value={f.capacity} onChange={set('capacity')} error={errors.capacity} required />
        <Input className="sm:col-span-2" label="Title" placeholder="Pottery: Wheel Throwing Basics" value={f.title} onChange={set('title')} error={errors.title} required />
        <Input label="Instructor" value={f.instructor} onChange={set('instructor')} error={errors.instructor} required />
        <div>
          <Input label="Location" list="locations" placeholder="Downtown Centre" value={f.location} onChange={set('location')} error={errors.location} required />
          <datalist id="locations">{locations.map((l) => <option key={l} value={l} />)}</datalist>
        </div>
        <Input label="Starts" type="datetime-local" value={f.starts_at} onChange={set('starts_at')} error={errors.starts_at} required />
        <Input label="Ends (optional)" type="datetime-local" value={f.ends_at} onChange={set('ends_at')} error={errors.ends_at} />
        {editing && (
          <Select className="sm:col-span-2" label="Status" value={f.status} onChange={set('status')} error={errors.status}
            hint="Cancelled and completed workshops no longer accept registrations.">
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        )}
        <Textarea className="sm:col-span-2" label="Description (optional)" value={f.description} onChange={set('description')} error={errors.description} />
      </form>
    </Modal>
  );
}
