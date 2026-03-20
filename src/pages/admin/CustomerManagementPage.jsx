/**
 * CustomerManagementPage.jsx
 * Route: /admin/customers
 *
 * Features:
 *   - CRUD for customers (parties)
 *   - Segment dropdown populated from /api/admin/segments
 *   - Product enrollments panel on detail view
 *   - Primary product dropdown from /api/admin/products
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, User, Building2, Briefcase,
  Edit2, Trash2, RefreshCw, X, Check, ChevronRight, Loader2, Package,
} from 'lucide-react'
import {
  listCustomers, getCustomer,
  createCustomer, updateCustomer, deactivateCustomer,
  getProducts, getSegments, getProductLines,
  addEnrollment, removeEnrollment,
} from '../../api/adminApi'
import toast from 'react-hot-toast'

// ── Segment badge ────────────────────────────────────────────────────────────
const SEGMENT_ICONS = { RETAIL: User, SMB: Briefcase, COMMERCIAL: Building2 }
const SEGMENT_COLORS = {
  RETAIL:     'text-blue-600 bg-blue-50 border-blue-200',
  SMB:        'text-purple-600 bg-purple-50 border-purple-200',
  COMMERCIAL: 'text-amber-600 bg-amber-50 border-amber-200',
}

function SegmentBadge({ segment }) {
  const Icon = SEGMENT_ICONS[segment] ?? User
  const color = SEGMENT_COLORS[segment] ?? SEGMENT_COLORS.RETAIL
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      <Icon size={11} /> {segment}
    </span>
  )
}

// ── Create / Edit modal ──────────────────────────────────────────────────────

function CustomerModal({ customer, segments, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    customerRef:    customer?.customerRef    ?? '',
    displayName:    customer?.displayName    ?? '',
    segment:        customer?.segment        ?? 'RETAIL',
    segmentId:      customer?.segmentId      ?? '',
    shortName:      customer?.shortName      ?? '',
    registrationNo: customer?.registrationNo ?? '',
    notes:          customer?.notes          ?? '',
  }))
  const [saving, setSaving] = useState(false)
  const field = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  const isEdit = !!customer

  const handleSegmentChange = (e) => {
    const segCode = e.target.value
    const seg = (segments ?? []).find(s => s.code === segCode)
    setForm(f => ({ ...f, segment: segCode, segmentId: seg?.id ?? '' }))
  }

  const handleSubmit = async () => {
    if (!form.customerRef.trim() || !form.displayName.trim()) {
      toast.error('Customer ref and display name are required'); return
    }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (e) {
      toast.error(e?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{isEdit ? 'Edit Customer' : 'New Customer'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Customer Ref *</label>
              <input value={form.customerRef} onChange={field('customerRef')} disabled={isEdit}
                placeholder="e.g. CUST-001"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Segment *</label>
              <select value={form.segment} onChange={handleSegmentChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                {(segments ?? []).map(s => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
                {!(segments ?? []).length && <>
                  <option value="RETAIL">Retail</option>
                  <option value="SMB">Small Business</option>
                  <option value="COMMERCIAL">Commercial</option>
                </>}
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Short Name</label>
              <input value={form.shortName} onChange={field('shortName')} placeholder="Abbreviated name"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reg / Tax No</label>
              <input value={form.registrationNo} onChange={field('registrationNo')} placeholder="Business reg number"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={field('notes')} rows={2} placeholder="Internal notes..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            {isEdit ? 'Save Changes' : 'Create Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Product Enrollments Panel ────────────────────────────────────────────────

function EnrollmentsPanel({ customer }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [newEnroll, setNewEnroll] = useState({ productLineId: '', productId: '' })

  const { data: detail, isLoading } = useQuery({
    queryKey: ['admin', 'customer', customer.id],
    queryFn: () => getCustomer(customer.id),
    enabled: !!customer.id,
  })

  const { data: productLines = [] } = useQuery({
    queryKey: ['admin', 'product-lines'],
    queryFn: () => getProductLines(),
    staleTime: 5 * 60_000,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['admin', 'products', 'all'],
    queryFn: () => getProducts().then(d => Array.isArray(d) ? d : (d?.content ?? [])),
    staleTime: 5 * 60_000,
  })

  const addMut = useMutation({
    mutationFn: (payload) => addEnrollment(customer.id, payload),
    onSuccess: () => {
      toast.success('Enrollment added')
      qc.invalidateQueries({ queryKey: ['admin', 'customer', customer.id] })
      setShowAdd(false)
      setNewEnroll({ productLineId: '', productId: '' })
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to add enrollment'),
  })

  const removeMut = useMutation({
    mutationFn: (enrollmentId) => removeEnrollment(customer.id, enrollmentId),
    onSuccess: () => {
      toast.success('Enrollment removed')
      qc.invalidateQueries({ queryKey: ['admin', 'customer', customer.id] })
    },
  })

  const enrollments = detail?.enrollments ?? []
  const filteredProducts = newEnroll.productLineId
    ? products.filter(p => String(p.productLineId) === String(newEnroll.productLineId))
    : products

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-800">Product Enrollments</h4>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
          <Plus size={12} /> Add Enrollment
        </button>
      </div>

      {showAdd && (
        <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
          <select value={newEnroll.productLineId}
            onChange={e => setNewEnroll(n => ({ ...n, productLineId: e.target.value, productId: '' }))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none">
            <option value="">Select product line...</option>
            {(Array.isArray(productLines) ? productLines : []).map(pl =>
              <option key={pl.id} value={pl.id}>{pl.name} ({pl.code})</option>
            )}
          </select>
          <select value={newEnroll.productId}
            onChange={e => setNewEnroll(n => ({ ...n, productId: e.target.value }))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none">
            <option value="">Select product (optional)...</option>
            {filteredProducts.map(p =>
              <option key={p.id} value={p.id}>{p.displayName} ({p.productCode})</option>
            )}
          </select>
          <div className="flex gap-2">
            <button onClick={() => {
              if (!newEnroll.productLineId) { toast.error('Select a product line'); return }
              addMut.mutate({
                productLineId: Number(newEnroll.productLineId),
                productId: newEnroll.productId ? Number(newEnroll.productId) : null,
              })
            }} disabled={addMut.isPending}
              className="flex-1 bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 disabled:opacity-50">
              {addMut.isPending ? 'Adding...' : 'Add Enrollment'}
            </button>
            <button onClick={() => setShowAdd(false)} className="text-xs text-gray-500 px-2">Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
        ) : enrollments.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">No product enrollments.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-gray-600">Product Line</th>
                <th className="px-3 py-2 text-left text-gray-600">Product</th>
                <th className="px-3 py-2 text-left text-gray-600">Enrolled</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {enrollments.map(e => (
                <tr key={e.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 font-medium text-gray-800">{e.productLineName ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{e.productName ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-400">
                    {e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => { if (confirm('Remove enrollment?')) removeMut.mutate(e.id) }}
                      className="text-red-400 hover:text-red-600"><X size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Customer Detail Panel ────────────────────────────────────────────────────

function CustomerDetailPanel({ customer, onClose, onEdit }) {
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[520px] bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={16} className="text-blue-500" />
            <h2 className="text-base font-semibold text-gray-900">{customer.displayName}</h2>
            <SegmentBadge segment={customer.segment} />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-end">
          <button onClick={() => onEdit(customer)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
            <Edit2 size={12} /> Edit Customer
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">
          <div className="space-y-3 text-sm">
            <div className="flex gap-2"><span className="text-gray-500 w-28">Customer Ref</span><span className="font-mono font-medium text-gray-800">{customer.customerRef}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Display Name</span><span className="text-gray-800">{customer.displayName}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Segment</span><SegmentBadge segment={customer.segment} /></div>
            {customer.shortName && <div className="flex gap-2"><span className="text-gray-500 w-28">Short Name</span><span className="text-gray-700">{customer.shortName}</span></div>}
            {customer.registrationNo && <div className="flex gap-2"><span className="text-gray-500 w-28">Reg No</span><span className="text-gray-700">{customer.registrationNo}</span></div>}
            {customer.notes && <div className="flex gap-2"><span className="text-gray-500 w-28">Notes</span><span className="text-gray-700">{customer.notes}</span></div>}
            <div className="flex gap-2"><span className="text-gray-500 w-28">Status</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${customer.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                {customer.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <EnrollmentsPanel customer={customer} />
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerManagementPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [page, setPage] = useState(0)

  const { data: pageData, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'customers', search, page],
    queryFn: () => listCustomers({ q: search || undefined, page, size: 20 }),
    placeholderData: (prev) => prev,
  })

  const { data: segments = [] } = useQuery({
    queryKey: ['admin', 'segments'],
    queryFn: getSegments,
    staleTime: 10 * 60_000,
  })

  const customers = Array.isArray(pageData) ? pageData : (pageData?.content ?? [])
  const totalPages = pageData?.totalPages ?? 1

  const createMut = useMutation({
    mutationFn: (payload) => createCustomer(payload),
    onSuccess: () => { toast.success('Customer created'); qc.invalidateQueries({ queryKey: ['admin', 'customers'] }) },
    onError: (err) => toast.error(err?.message ?? 'Create failed'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }) => updateCustomer(id, payload),
    onSuccess: () => { toast.success('Customer updated'); qc.invalidateQueries({ queryKey: ['admin', 'customers'] }) },
    onError: (err) => toast.error(err?.message ?? 'Update failed'),
  })

  const deactivateMut = useMutation({
    mutationFn: (id) => deactivateCustomer(id),
    onSuccess: () => { toast.success('Customer deactivated'); qc.invalidateQueries({ queryKey: ['admin', 'customers'] }) },
  })

  const handleSave = (form) => {
    if (modal && modal !== 'create') return updateMut.mutateAsync({ id: modal.id, ...form })
    return createMut.mutateAsync(form)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage retail, SMB, and commercial customer entities</p>
        </div>
        <button onClick={() => setModal('create')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700">
          <Plus size={16} /> New Customer
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
          placeholder="Search by name or ref..."
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
      </div>

      {/* Segment summary */}
      <div className="grid grid-cols-3 gap-4">
        {(segments.length ? segments : [{ code: 'RETAIL', name: 'Retail' }, { code: 'SMB', name: 'Small Business' }, { code: 'COMMERCIAL', name: 'Commercial' }]).map(seg => {
          const Icon = SEGMENT_ICONS[seg.code] ?? User
          const count = customers.filter(c => c.segment === seg.code).length
          return (
            <div key={seg.code} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${(SEGMENT_COLORS[seg.code] ?? '').split(' ').slice(1).join(' ')}`}>
                <Icon size={18} className={(SEGMENT_COLORS[seg.code] ?? '').split(' ')[0]} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500">{seg.name}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Customer table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" /> Loading...
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-16 gap-3 text-red-500">
            Failed to load. <button onClick={() => refetch()} className="underline text-sm">Retry</button>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <User size={40} className="mb-3 opacity-30" />
            <p className="font-medium">No customers yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left">
                {['Customer', 'Ref', 'Segment', 'Reg No', 'Actions'].map(h =>
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} onClick={() => setSelectedCustomer(c)}
                  className="border-b border-gray-50 hover:bg-blue-50/50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 text-sm">
                    {c.displayName}
                    {c.shortName && <span className="ml-1.5 text-xs text-gray-400">({c.shortName})</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{c.customerRef}</td>
                  <td className="px-4 py-3"><SegmentBadge segment={c.segment} /></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.registrationNo || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setSelectedCustomer(c)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                        <ChevronRight size={13} /> Details
                      </button>
                      <button onClick={() => setModal(c)} className="text-gray-400 hover:text-blue-600"><Edit2 size={15} /></button>
                      <button onClick={() => { if (confirm(`Deactivate ${c.displayName}?`)) deactivateMut.mutate(c.id) }}
                        className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

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

      {/* Create / Edit modal */}
      {modal && (
        <CustomerModal
          customer={modal === 'create' ? null : modal}
          segments={segments}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Detail panel with enrollments */}
      {selectedCustomer && (
        <CustomerDetailPanel
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onEdit={(c) => { setSelectedCustomer(null); setModal(c) }}
        />
      )}
    </div>
  )
}
