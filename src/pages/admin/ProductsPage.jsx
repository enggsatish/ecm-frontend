import { useState } from 'react';
import { Plus, Pencil, Trash2, Link, Unlink, Loader2, Package, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useProducts,
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useDeactivateProduct,
  useLinkCategory,
  useUnlinkCategory,
  useWorkflowDefinitions,
  useCategories,
} from '../../hooks/useAdmin';

// ── Simple JSON editor (textarea-based) ───────────────────────────────────
function JsonEditor({ value, onChange }) {
  const [error, setError] = useState('');

  const handle = (raw) => {
    onChange(raw);
    try { JSON.parse(raw); setError(''); }
    catch (e) { setError(e.message); }
  };

  return (
    <div>
      <textarea
        value={value}
        onChange={e => handle(e.target.value)}
        rows={10}
        spellCheck={false}
        className={`w-full font-mono text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 resize-y bg-gray-950 text-green-300 ${
          error ? 'border-red-400 focus:ring-red-400' : 'border-gray-700 focus:ring-blue-500'
        }`}
        placeholder='{"fields": []}'
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── Category Links sub-table ───────────────────────────────────────────────
function CategoryLinks({ product }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newLink, setNewLink] = useState({ categoryId: '', workflowDefinitionId: '' });

  const { data: categories } = useCategories(true);
  const { data: wfDefs } = useWorkflowDefinitions();
  const linkCat = useLinkCategory();
  const unlinkCat = useUnlinkCategory();

  const linkedCategoryIds = new Set((product.categoryLinks ?? []).map(l => l.categoryId));
  const available = (categories ?? []).filter(c => c.isActive && !linkedCategoryIds.has(c.id));

  const handleLink = () => {
    if (!newLink.categoryId) { toast.error('Select a category'); return; }
    linkCat.mutate({ productId: product.id, payload: newLink }, {
      onSuccess: () => { toast.success('Category linked'); setShowAdd(false); setNewLink({ categoryId: '', workflowDefinitionId: '' }); },
      onError: () => toast.error('Failed to link'),
    });
  };

  const handleUnlink = (categoryId) => {
    if (!confirm('Unlink this category?')) return;
    unlinkCat.mutate({ productId: product.id, categoryId }, {
      onSuccess: () => toast.success('Unlinked'),
      onError: () => toast.error('Failed'),
    });
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-800">Category Links</h4>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          <Link size={12} /> Link Category
        </button>
      </div>

      {showAdd && (
        <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
          <select
            value={newLink.categoryId}
            onChange={e => setNewLink(n => ({ ...n, categoryId: e.target.value }))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="">Select category…</option>
            {available.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </select>
          <select
            value={newLink.workflowDefinitionId}
            onChange={e => setNewLink(n => ({ ...n, workflowDefinitionId: e.target.value }))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="">No workflow (optional)</option>
            {(wfDefs ?? []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={handleLink} disabled={linkCat.isPending} className="flex-1 bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 disabled:opacity-50">
              {linkCat.isPending ? 'Linking…' : 'Confirm Link'}
            </button>
            <button onClick={() => setShowAdd(false)} className="text-xs text-gray-500 px-2">Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        {(product.categoryLinks ?? []).length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">No categories linked.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-gray-600">Category</th>
                <th className="px-3 py-2 text-left text-gray-600">Workflow</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {(product.categoryLinks ?? []).map(l => (
                <tr key={l.categoryId} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 font-medium text-gray-800">{l.categoryName ?? l.categoryId}</td>
                  <td className="px-3 py-2 text-gray-500">{l.workflowDefinitionName ?? '—'}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => handleUnlink(l.categoryId)} className="text-red-400 hover:text-red-600">
                      <Unlink size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Detail Side Panel ──────────────────────────────────────────────────────
function ProductPanel({ productId, onClose }) {
  const { data: product, isLoading } = useProduct(productId);
  const update = useUpdateProduct();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);

  const startEdit = () => {
    setForm({
      displayName: product.displayName,
      description: product.description ?? '',
      productSchema: JSON.stringify(product.productSchema ?? {}, null, 2),
    });
    setEditing(true);
  };

  const handleSave = () => {
    let schema;
    try { schema = JSON.parse(form.productSchema); }
    catch { toast.error('Invalid JSON schema'); return; }
    update.mutate({ id: productId, payload: { displayName: form.displayName, description: form.description, productSchema: schema } }, {
      onSuccess: () => { toast.success('Product updated'); setEditing(false); },
      onError: () => toast.error('Save failed'),
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[520px] bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-blue-500" />
            <h2 className="text-base font-semibold text-gray-900">
              {isLoading ? '…' : product?.displayName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!editing && <button onClick={startEdit} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"><Pencil size={13} /> Edit</button>}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-5">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
                <input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Product Schema (JSON)</label>
                <JsonEditor value={form.productSchema} onChange={v => setForm(f => ({ ...f, productSchema: v }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={update.isPending}
                  className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {update.isPending ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => setEditing(false)} className="px-4 text-sm text-gray-600">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3 text-sm">
                <div className="flex gap-2"><span className="text-gray-500 w-28">Product Code</span><span className="font-mono font-medium text-gray-800">{product.productCode}</span></div>
                <div className="flex gap-2"><span className="text-gray-500 w-28">Display Name</span><span className="text-gray-800">{product.displayName}</span></div>
                <div className="flex gap-2"><span className="text-gray-500 w-28">Status</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${product.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {product.description && <div className="flex gap-2"><span className="text-gray-500 w-28">Description</span><span className="text-gray-700">{product.description}</span></div>}
              </div>

              <div className="mt-5">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Product Schema</h4>
                <pre className="bg-gray-950 text-green-300 text-xs rounded-lg p-3 overflow-auto max-h-48 font-mono">
                  {JSON.stringify(product.productSchema ?? {}, null, 2)}
                </pre>
              </div>

              <CategoryLinks product={product} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
const EMPTY = { productCode: '', displayName: '', description: '', productSchema: '{}' };

export default function ProductsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [activeOnly, setActiveOnly] = useState(true);
  const [page, setPage] = useState(0);
  const [form, setForm] = useState(EMPTY);

  const { data, isLoading } = useProducts({ isActive: activeOnly || undefined, page, size: 20 });
  const create = useCreateProduct();
  const deactivate = useDeactivateProduct();

  const products = Array.isArray(data) ? data : (data?.content ?? []);
  const totalPages = data?.totalPages ?? 1;

  const handleCreate = () => {
    let schema;
    try { schema = JSON.parse(form.productSchema); }
    catch { toast.error('Invalid JSON schema'); return; }
    if (!form.productCode.trim() || !form.displayName.trim()) { toast.error('Code and Name required'); return; }
    create.mutate({ ...form, productSchema: schema }, {
      onSuccess: () => { toast.success('Product created'); setShowCreate(false); setForm(EMPTY); },
      onError: () => toast.error('Create failed'),
    });
  };

  const handleDeactivate = (e, id) => {
    e.stopPropagation();
    if (!confirm('Deactivate this product?')) return;
    deactivate.mutate(id, {
      onSuccess: () => toast.success('Product deactivated'),
      onError: () => toast.error('Failed'),
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Products</h2>
          <p className="text-xs text-gray-500 mt-0.5">Financial product catalogue with schema and category bindings</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} className="rounded" />
            Active only
          </label>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <Plus size={14} /> New Product
          </button>
        </div>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={4} className="py-12 text-center text-gray-400 text-sm">No products found.</td></tr>
              ) : products.map(p => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors ${!p.isActive ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Package size={14} className="text-blue-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{p.displayName}</div>
                        {p.description && <div className="text-xs text-gray-500 truncate max-w-xs">{p.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.productCode}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setSelectedId(p.id)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                        <ChevronRight size={13} /> Details
                      </button>
                      {p.isActive && (
                        <button onClick={e => handleDeactivate(e, p.id)} className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-4">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
          <span className="text-sm text-gray-600">Page {page + 1} of {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
        </div>
      )}

      {/* Create Product Panel */}
      {showCreate && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowCreate(false)} />
          <div className="w-[480px] bg-white shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">New Product</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Product Code *</label>
                <input value={form.productCode} onChange={e => setForm(f => ({ ...f, productCode: e.target.value.toUpperCase() }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="MORTGAGE_PRODUCT" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Display Name *</label>
                <input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Residential Mortgage" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Product Schema (JSON)</label>
                <JsonEditor value={form.productSchema} onChange={v => setForm(f => ({ ...f, productSchema: v }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleCreate} disabled={create.isPending}
                  className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {create.isPending ? 'Creating…' : 'Create Product'}
                </button>
                <button onClick={() => setShowCreate(false)} className="px-4 text-sm text-gray-600">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedId && <ProductPanel productId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}