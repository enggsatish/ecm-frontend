/**
 * RetentionPage.jsx
 * Route: /admin/retention
 *
 * Full-page table with modal create/edit.
 * Matches the workflow designer table pattern.
 */
import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Archive, X, Search, Clock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useRetentionPolicies,
  useCreateRetentionPolicy,
  useUpdateRetentionPolicy,
  useDeactivateRetentionPolicy,
  useCategories,
} from '../../hooks/useAdmin';

const EMPTY = { name: '', categoryId: '', productCode: '', archiveAfterDays: '', purgeAfterDays: '' };

// ── Policy Form Modal ────────────────────────────────────────────────────────
function PolicyModal({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState(initial ?? EMPTY);
  const { data: categories } = useCategories(true);
  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  const isEdit = !!initial?.name;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{isEdit ? 'Edit Policy' : 'New Retention Policy'}</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Policy Name *</label>
            <input value={form.name} onChange={set('name')} autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="e.g. Mortgage 7yr Retention" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Document Category</label>
            <select value={form.categoryId} onChange={set('categoryId')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">All categories (default)</option>
              {(categories ?? []).filter(c => c.isActive).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Product Code</label>
            <input value={form.productCode} onChange={e => set('productCode')({ target: { value: e.target.value.toUpperCase() } })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="e.g. MORTGAGE (optional)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Archive After (days) *</label>
              <input type="number" min={1} value={form.archiveAfterDays} onChange={set('archiveAfterDays')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="365" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Purge After (days) *</label>
              <input type="number" min={1} value={form.purgeAfterDays} onChange={set('purgeAfterDays')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="2555" />
            </div>
          </div>
          {form.archiveAfterDays && form.purgeAfterDays && parseInt(form.purgeAfterDays) <= parseInt(form.archiveAfterDays) && (
            <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={11} /> Purge days must exceed archive days</p>
          )}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            <strong>Archive</strong> = move to cold storage (still downloadable).
            <strong> Purge</strong> = permanent binary deletion (metadata kept for audit).
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? 'Update' : 'Create'} Policy
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function RetentionPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('active'); // 'active' | 'all'
  const [search, setSearch] = useState('');

  const { data, isLoading } = useRetentionPolicies();
  const create = useCreateRetentionPolicy();
  const update = useUpdateRetentionPolicy();
  const deactivate = useDeactivateRetentionPolicy();

  const allPolicies = Array.isArray(data) ? data : (data?.content ?? []);

  const filtered = allPolicies
    .filter(p => filter === 'all' || p.isActive)
    .filter(p => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return p.name?.toLowerCase().includes(q)
        || p.productCode?.toLowerCase().includes(q)
        || p.categoryName?.toLowerCase().includes(q);
    });

  const openCreate = () => { setEditing(null); setShowModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setShowModal(true);
  };

  const handleSave = (payload) => {
    setSaving(true);
    const opts = {
      onSuccess: () => { toast.success(editing ? 'Policy updated' : 'Policy created'); setShowModal(false); },
      onError: () => toast.error('Save failed'),
      onSettled: () => setSaving(false),
    };
    if (editing) update.mutate({ id: editing.id, payload }, opts);
    else create.mutate(payload, opts);
  };

  const handleDeactivate = (id) => {
    if (!window.confirm('Deactivate this retention policy?')) return;
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

  const activeCount = allPolicies.filter(p => p.isActive).length;

  return (
    <div className="max-w-6xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Retention Policies</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Define document archive and purge schedules
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm">
          <Plus size={15} /> New Policy
        </button>
      </div>

      {/* Filter + Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-0 rounded-lg border border-gray-200 overflow-hidden">
          {[
            { key: 'active', label: 'Active', count: activeCount },
            { key: 'all', label: 'All', count: allPolicies.length },
          ].map(({ key, label, count }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors
                ${filter === key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {label}
              <span className={`ml-1 text-[10px] ${filter === key ? 'text-blue-200' : 'text-gray-400'}`}>{count}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search policies..."
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        <Clock size={14} className="flex-shrink-0 mt-0.5" />
        <div>
          <strong>How it works:</strong> The retention scheduler runs daily at 2:00 AM.
          Documents matching a policy's <strong>archive days</strong> are moved to cold storage.
          Documents past <strong>purge days</strong> have their binary permanently deleted (metadata kept for audit).
          Orphaned MinIO objects (no DB record) are detected and reported to admins.
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading...
        </div>
      )}

      {/* Empty state */}
      {!isLoading && allPolicies.length === 0 && (
        <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-xl">
          <Archive size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-semibold">No retention policies yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first policy to manage document lifecycle</p>
          <button onClick={openCreate}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus size={15} /> Create Policy
          </button>
        </div>
      )}

      {/* Table */}
      {!isLoading && filtered.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Policy</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Product</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Archive</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Purge</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${!p.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Archive size={14} className="text-amber-400 flex-shrink-0" />
                      <span className="font-medium text-gray-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-gray-600">{p.categoryName ?? p.categoryId ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="font-mono text-xs text-gray-500">{p.productCode ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-gray-800">{fmt(p.archiveAfterDays)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-gray-800">{fmt(p.purgeAfterDays)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(p)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={13} /></button>
                      {p.isActive && (
                        <button onClick={() => handleDeactivate(p.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* No results */}
      {!isLoading && allPolicies.length > 0 && filtered.length === 0 && (
        <div className="py-12 text-center text-gray-400 text-sm">No policies match your filter.</div>
      )}

      {/* Footer */}
      {!isLoading && allPolicies.length > 0 && (
        <div className="text-xs text-gray-400 text-right">
          Showing {filtered.length} of {allPolicies.length} policies
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <PolicyModal
          initial={editing ? {
            name: editing.name,
            categoryId: editing.categoryId ?? '',
            productCode: editing.productCode ?? '',
            archiveAfterDays: editing.archiveAfterDays,
            purgeAfterDays: editing.purgeAfterDays,
          } : null}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
        />
      )}
    </div>
  );
}
