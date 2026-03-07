import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Archive } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useRetentionPolicies,
  useCreateRetentionPolicy,
  useUpdateRetentionPolicy,
  useDeactivateRetentionPolicy,
} from '../../hooks/useAdmin';
import { useCategories } from '../../hooks/useAdmin';

const EMPTY = {
  name: '',
  categoryId: '',
  productCode: '',
  archiveAfterDays: '',
  purgeAfterDays: '',
};

function PolicyForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial ?? EMPTY);
  const { data: categories } = useCategories(true);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    const archive = parseInt(form.archiveAfterDays);
    const purge = parseInt(form.purgeAfterDays);
    if (isNaN(archive) || archive < 1) { toast.error('Archive days must be a positive number'); return; }
    if (isNaN(purge) || purge < 1) { toast.error('Purge days must be a positive number'); return; }
    if (purge <= archive) { toast.error('Purge days must be greater than archive days'); return; }
    onSave({
      name: form.name.trim(),
      categoryId: form.categoryId || null,
      productCode: form.productCode.trim() || null,
      archiveAfterDays: archive,
      purgeAfterDays: purge,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Policy Name *</label>
        <input value={form.name} onChange={set('name')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. Mortgage 7yr Retention" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Document Category</label>
        <select value={form.categoryId} onChange={set('categoryId')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All categories</option>
          {(categories ?? []).filter(c => c.isActive).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Product Code</label>
        <input value={form.productCode} onChange={e => set('productCode')({ target: { value: e.target.value.toUpperCase() } })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. MORTGAGE (optional)" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Archive After (days) *</label>
          <input type="number" min={1} value={form.archiveAfterDays} onChange={set('archiveAfterDays')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 2555" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Purge After (days) *</label>
          <input type="number" min={1} value={form.purgeAfterDays} onChange={set('purgeAfterDays')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 3650" />
          {form.archiveAfterDays && form.purgeAfterDays && parseInt(form.purgeAfterDays) <= parseInt(form.archiveAfterDays) && (
            <p className="text-xs text-red-500 mt-1">Must be &gt; archive days</p>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400">Archive days: move to cold storage. Purge days: permanent deletion. Purge must exceed archive.</p>
      <div className="pt-2 flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving && <Loader2 size={13} className="animate-spin" />}
          Save Policy
        </button>
        <button onClick={onCancel} className="px-4 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
      </div>
    </div>
  );
}

function SlidePanel({ title, open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-96 bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        <div className="flex-1 p-5 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export default function RetentionPage() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useRetentionPolicies();
  const create = useCreateRetentionPolicy();
  const update = useUpdateRetentionPolicy();
  const deactivate = useDeactivateRetentionPolicy();

  const policies = Array.isArray(data) ? data : (data?.content ?? []);

  const openCreate = () => { setEditing(null); setPanelOpen(true); };
  const openEdit = (p) => { setEditing(p); setPanelOpen(true); };

  const handleSave = (payload) => {
    setSaving(true);
    const opts = {
      onSuccess: () => { toast.success(editing ? 'Policy updated' : 'Policy created'); setPanelOpen(false); },
      onError: () => toast.error('Save failed'),
      onSettled: () => setSaving(false),
    };
    if (editing) update.mutate({ id: editing.id, payload }, opts);
    else create.mutate(payload, opts);
  };

  const handleDeactivate = (id) => {
    if (!confirm('Deactivate this retention policy?')) return;
    deactivate.mutate(id, {
      onSuccess: () => toast.success('Policy deactivated'),
      onError: () => toast.error('Failed'),
    });
  };

  const fmt = (days) => {
    if (!days) return '—';
    const yrs = Math.floor(days / 365);
    const rem = days % 365;
    return yrs > 0 ? `${yrs}y ${rem > 0 ? rem + 'd' : ''}`.trim() : `${days}d`;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Retention Policies</h2>
          <p className="text-xs text-gray-500 mt-0.5">Define document archive and purge schedules</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <Plus size={14} /> New Policy
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Policy</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Archive</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Purge</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400 text-sm">No retention policies defined.</td></tr>
              ) : policies.map(p => (
                <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 ${!p.isActive ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Archive size={14} className="text-amber-400" />
                      <span className="text-sm font-medium text-gray-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.categoryName ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.productCode ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-800 font-medium">{fmt(p.archiveAfterDays)}</span>
                    <span className="text-xs text-gray-400 ml-1">({p.archiveAfterDays}d)</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-800 font-medium">{fmt(p.purgeAfterDays)}</span>
                    <span className="text-xs text-gray-400 ml-1">({p.purgeAfterDays}d)</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(p)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={13} /></button>
                      {p.isActive && (
                        <button onClick={() => handleDeactivate(p.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SlidePanel title={editing ? 'Edit Policy' : 'New Retention Policy'} open={panelOpen} onClose={() => setPanelOpen(false)}>
        <PolicyForm
          initial={editing ? {
            name: editing.name,
            categoryId: editing.categoryId ?? '',
            productCode: editing.productCode ?? '',
            archiveAfterDays: editing.archiveAfterDays,
            purgeAfterDays: editing.purgeAfterDays,
          } : null}
          onSave={handleSave}
          onCancel={() => setPanelOpen(false)}
          saving={saving}
        />
      </SlidePanel>
    </div>
  );
}