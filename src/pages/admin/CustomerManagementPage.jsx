/**
 * CustomerManagementPage.jsx
 * Route: /admin/customers
 * Roles: ECM_ADMIN, ECM_BACKOFFICE
 *
 * Lists customers with create/edit/deactivate. Customer entity captures:
 *   - Segment: RETAIL | SMB | COMMERCIAL
 *   - Customer ref (CIF/account number)
 *   - Primary product enrollment
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, User, Building2, Briefcase, Edit2, Trash2, RefreshCw, X, Check } from 'lucide-react'
import apiClient from '../../api/apiClient'
import toast from 'react-hot-toast'

const unwrap = r => r.data?.data ?? r.data

const SEGMENTS = [
  { value: 'RETAIL',     label: 'Retail',         icon: User,      color: 'text-blue-600   bg-blue-50   border-blue-200' },
  { value: 'SMB',        label: 'Small Business',  icon: Briefcase, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { value: 'COMMERCIAL', label: 'Commercial',      icon: Building2, color: 'text-amber-600  bg-amber-50  border-amber-200' },
]

function SegmentBadge({ segment }) {
  const cfg = SEGMENTS.find(s => s.value === segment) ?? SEGMENTS[0]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon size={11} /> {cfg.label}
    </span>
  )
}

const EMPTY = { customerRef: '', displayName: '', email: '', phone: '', segment: 'RETAIL', primaryProductId: '', primaryProductName: '', notes: '' }

function CustomerModal({ customer, products, onClose, onSave }) {
  const [form, setForm] = useState(customer ? {
    customerRef: customer.customerRef,
    displayName: customer.displayName,
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    segment: customer.segment ?? 'RETAIL',
    primaryProductId: customer.primaryProductId ? String(customer.primaryProductId) : '',
    primaryProductName: customer.primaryProductName ?? '',
    notes: customer.notes ?? '',
  } : EMPTY)
  const [saving, setSaving] = useState(false)

  const field = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleProductChange = id => {
    const p = products.find(p => String(p.id) === String(id))
    setForm(f => ({ ...f, primaryProductId: id, primaryProductName: p?.name || '' }))
  }

  const handleSubmit = async () => {
    if (!form.customerRef.trim() || !form.displayName.trim()) {
      toast.error('Customer ref and display name are required')
      return
    }
    setSaving(true)
    try {
      await onSave({ ...form, primaryProductId: form.primaryProductId || undefined })
      onClose()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{customer ? 'Edit Customer' : 'New Customer'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Customer Ref *</label>
              <input value={form.customerRef} onChange={field('customerRef')} disabled={!!customer}
                placeholder="e.g. CUST-001"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Segment *</label>
              <select value={form.segment} onChange={field('segment')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Display Name *</label>
            <input value={form.displayName} onChange={field('displayName')} placeholder="Full name or company name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={field('email')} placeholder="contact@example.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input value={form.phone} onChange={field('phone')} placeholder="+1 555-0000"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Primary Product / Service</label>
            <select value={form.primaryProductId} onChange={e => handleProductChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">— None —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={field('notes')} rows={2} placeholder="Internal notes…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            {customer ? 'Save Changes' : 'Create Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CustomerManagementPage() {
  const qc = useQueryClient()
  const [search, setSearch]   = useState('')
  const [modal,  setModal]    = useState(null)  // null | 'create' | customer object
  const [page,   setPage]     = useState(0)

  const { data: pageData, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'customers', search, page],
    queryFn: () => apiClient.get('/api/admin/customers', { params: { q: search || undefined, page, size: 20 } }).then(unwrap),
  })

  const { data: products = [] } = useQuery({
    queryKey: ['admin', 'products', 'all'],
    queryFn: () => apiClient.get('/api/admin/products').then(r => {
      const d = r.data?.data ?? r.data ?? []
      return Array.isArray(d) ? d : (d.content ?? [])
    }),
  })

  const customers = Array.isArray(pageData) ? pageData : (pageData?.content ?? [])
  const totalPages = pageData?.totalPages ?? 1

  const createMut = useMutation({
    mutationFn: payload => apiClient.post('/api/admin/customers', payload).then(unwrap),
    onSuccess: () => { toast.success('Customer created'); qc.invalidateQueries({ queryKey: ['admin', 'customers'] }) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }) => apiClient.put(`/api/admin/customers/${id}`, payload).then(unwrap),
    onSuccess: () => { toast.success('Customer updated'); qc.invalidateQueries({ queryKey: ['admin', 'customers'] }) },
  })

  const deactivateMut = useMutation({
    mutationFn: id => apiClient.delete(`/api/admin/customers/${id}`),
    onSuccess: () => { toast.success('Customer deactivated'); qc.invalidateQueries({ queryKey: ['admin', 'customers'] }) },
  })

  const handleSave = (form) => {
    if (modal && modal !== 'create') {
      return updateMut.mutateAsync({ id: modal.id, ...form })
    }
    return createMut.mutateAsync(form)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage retail, SMB, and commercial entities</p>
        </div>
        <button onClick={() => setModal('create')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700">
          <Plus size={16} /> New Customer
        </button>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          placeholder="Search by name, ref, or email…"
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {/* Segment summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {SEGMENTS.map(seg => {
          const Icon = seg.icon
          const count = customers.filter(c => c.segment === seg.value).length
          return (
            <div key={seg.value} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${seg.color.split(' ').slice(1).join(' ')}`}>
                <Icon size={18} className={seg.color.split(' ')[0]} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500">{seg.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Customer table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" /> Loading customers…
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-16 gap-3 text-red-500">
            Failed to load customers.
            <button onClick={refetch} className="underline text-sm">Retry</button>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <User size={40} className="mb-3 opacity-30" />
            <p className="font-medium">No customers yet</p>
            <p className="text-sm">Click "New Customer" to add the first one</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ref</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Segment</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 text-sm">{c.displayName}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{c.customerRef}</td>
                  <td className="px-4 py-3"><SegmentBadge segment={c.segment} /></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.primaryProductName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.email || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setModal(c)} className="text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={15} /></button>
                      <button onClick={() => { if (confirm(`Deactivate ${c.displayName}?`)) deactivateMut.mutate(c.id) }}
                        className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40">Prev</button>
            <span className="text-sm text-gray-500">Page {page + 1} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40">Next</button>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <CustomerModal
          customer={modal === 'create' ? null : modal}
          products={products}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}