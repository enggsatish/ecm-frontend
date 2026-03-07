/**
 * ProductLinesPage.jsx
 * Route: /admin/product-lines
 *
 * Admin table for managing product lines within segments.
 * Includes a segment filter dropdown at the top of the page.
 * Follows the same patterns as SegmentsPage and DepartmentsPage.
 */
import { useState } from 'react'
import { GitBranch, Plus, Pencil, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useSegments, useAllProductLines,
  useCreateProductLine, useUpdateProductLine,
} from '../../hooks/useAdmin'

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200'
const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

function ProductLineForm({ segments, initial = {}, onSave, onCancel, saving }) {
  const [segmentId,   setSegmentId]   = useState(initial.segmentId   ?? '')
  const [name,        setName]        = useState(initial.name        ?? '')
  const [code,        setCode]        = useState(initial.code        ?? '')
  const [description, setDescription] = useState(initial.description ?? '')

  const handleSubmit = () => {
    if (!segmentId) { toast.error('Select a segment'); return }
    if (!name.trim() || !code.trim()) { toast.error('Name and code are required'); return }
    onSave({
      segmentId: parseInt(segmentId),
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
    })
  }

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-blue-800">
        {initial.id ? 'Edit Product Line' : 'New Product Line'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Segment *</label>
          <select
            className={inputCls} value={segmentId}
            onChange={e => setSegmentId(e.target.value)}
            disabled={!!initial.id}   // segment is immutable after creation
          >
            <option value="">— Select segment —</option>
            {segments.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Code * {initial.id && <span className="text-gray-400">(read-only)</span>}</label>
          <input
            className={inputCls} value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. RETAIL_LOANS"
            disabled={!!initial.id}
            maxLength={30}
          />
        </div>
        <div>
          <label className={labelCls}>Name *</label>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Loans" />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">
          {saving && <Loader2 size={13} className="animate-spin" />}
          {initial.id ? 'Save changes' : 'Create product line'}
        </button>
      </div>
    </div>
  )
}

export default function ProductLinesPage() {
  const [showForm,         setShowForm]         = useState(false)
  const [editing,          setEditing]          = useState(null)
  const [segmentFilter,    setSegmentFilter]    = useState('')

  const { data: segments     = [] } = useSegments()
  const { data: productLines = [], isLoading } = useAllProductLines()
  const createMutation = useCreateProductLine()
  const updateMutation = useUpdateProductLine()

  // Client-side filter by segment
  const displayed = segmentFilter
    ? productLines.filter(pl => String(pl.segmentId) === String(segmentFilter))
    : productLines

  const handleCreate = async (payload) => {
    try {
      await createMutation.mutateAsync(payload)
      toast.success('Product line created')
      setShowForm(false)
    } catch (err) {
      toast.error(err?.message || 'Failed to create product line')
    }
  }

  const handleUpdate = async (payload) => {
    try {
      await updateMutation.mutateAsync({ id: editing.id, payload })
      toast.success('Product line updated')
      setEditing(null)
    } catch (err) {
      toast.error(err?.message || 'Failed to update product line')
    }
  }

  const handleToggleActive = async (pl) => {
    try {
      await updateMutation.mutateAsync({
        id: pl.id,
        payload: {
          segmentId: pl.segmentId,
          name: pl.name,
          code: pl.code,
          description: pl.description,
          active: !pl.isActive,
        },
      })
      toast.success(`Product line ${pl.isActive ? 'deactivated' : 'activated'}`)
    } catch (err) {
      toast.error(err?.message || 'Failed to update product line')
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <GitBranch size={18} className="text-indigo-500" /> Product Lines
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Second-level hierarchy — product lines within each segment
          </p>
        </div>
        {!showForm && !editing && (
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={14} /> Add product line
          </button>
        )}
      </div>

      {/* Segment filter */}
      {!showForm && !editing && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600">Filter by segment:</label>
          <select
            value={segmentFilter}
            onChange={e => setSegmentFilter(e.target.value)}
            className="rounded-lg border border-gray-200 text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">All segments</option>
            {segments.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">{displayed.length} product lines</span>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <ProductLineForm
          segments={segments.filter(s => s.isActive)}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          saving={createMutation.isPending}
        />
      )}

      {/* Edit form */}
      {editing && (
        <ProductLineForm
          segments={segments}
          initial={editing}
          onSave={handleUpdate}
          onCancel={() => setEditing(null)}
          saving={updateMutation.isPending}
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Code', 'Name', 'Segment', 'Description', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                    {segmentFilter ? 'No product lines for this segment' : 'No product lines yet'}
                  </td>
                </tr>
              )}
              {displayed.map(pl => (
                <tr key={pl.id} className={`hover:bg-gray-50 transition-colors ${!pl.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{pl.code}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{pl.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                      {pl.segmentName ?? `Segment #${pl.segmentId}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{pl.description || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      pl.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {pl.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => { setEditing(pl); setShowForm(false) }}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(pl)}
                        disabled={updateMutation.isPending}
                        className={`p-1 rounded transition-colors disabled:opacity-40 ${
                          pl.isActive
                            ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                            : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={pl.isActive ? 'Deactivate' : 'Activate'}>
                        {pl.isActive ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
                      </button>
                    </div>
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