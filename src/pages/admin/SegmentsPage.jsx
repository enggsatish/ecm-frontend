/**
 * SegmentsPage.jsx
 * Route: /admin/segments
 *
 * Admin table for managing business segments (Retail, Commercial, SMB).
 * Follows the same patterns as DepartmentsPage.jsx:
 *  - List with active/inactive badge
 *  - Inline Add/Edit form
 *  - Toggle active/inactive
 */
import { useState } from 'react'
import { Layers, Plus, Pencil, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useSegments, useCreateSegment, useUpdateSegment,
} from '../../hooks/useAdmin'

const inputCls  = 'w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200'
const labelCls  = 'block text-xs font-medium text-gray-600 mb-1'

function SegmentForm({ initial = {}, onSave, onCancel, saving }) {
  const [name,        setName]        = useState(initial.name        ?? '')
  const [code,        setCode]        = useState(initial.code        ?? '')
  const [description, setDescription] = useState(initial.description ?? '')

  const handleSubmit = () => {
    if (!name.trim() || !code.trim()) { toast.error('Name and code are required'); return }
    onSave({ name: name.trim(), code: code.trim().toUpperCase(), description: description.trim() || undefined })
  }

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-blue-800">
        {initial.id ? 'Edit Segment' : 'New Segment'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Name *</label>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Retail" />
        </div>
        <div>
          <label className={labelCls}>Code * {initial.id && <span className="text-gray-400">(read-only)</span>}</label>
          <input
            className={inputCls}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. RETAIL"
            disabled={!!initial.id}   // code is immutable after creation
            maxLength={20}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <textarea
          className={`${inputCls} resize-none`} rows={2}
          value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">
          {saving && <Loader2 size={13} className="animate-spin" />}
          {initial.id ? 'Save changes' : 'Create segment'}
        </button>
      </div>
    </div>
  )
}

export default function SegmentsPage() {
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState(null)  // segment object being edited

  const { data: segments = [], isLoading } = useSegments()
  const createMutation = useCreateSegment()
  const updateMutation = useUpdateSegment()

  const handleCreate = async (payload) => {
    try {
      await createMutation.mutateAsync(payload)
      toast.success('Segment created')
      setShowForm(false)
    } catch (err) {
      toast.error(err?.message || 'Failed to create segment')
    }
  }

  const handleUpdate = async (payload) => {
    try {
      await updateMutation.mutateAsync({ id: editing.id, payload })
      toast.success('Segment updated')
      setEditing(null)
    } catch (err) {
      toast.error(err?.message || 'Failed to update segment')
    }
  }

  const handleToggleActive = async (seg) => {
    try {
      await updateMutation.mutateAsync({
        id: seg.id,
        payload: { name: seg.name, code: seg.code, description: seg.description, active: !seg.isActive },
      })
      toast.success(`Segment ${seg.isActive ? 'deactivated' : 'activated'}`)
    } catch (err) {
      toast.error(err?.message || 'Failed to update segment')
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Layers size={18} className="text-blue-500" /> Segments
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Top-level financial hierarchy: Retail, Commercial, Small Business
          </p>
        </div>
        {!showForm && !editing && (
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={14} /> Add segment
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <SegmentForm
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          saving={createMutation.isPending}
        />
      )}

      {/* Edit form */}
      {editing && (
        <SegmentForm
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
                {['Code', 'Name', 'Description', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {segments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                    No segments yet — create one above
                  </td>
                </tr>
              )}
              {segments.map(seg => (
                <tr key={seg.id} className={`hover:bg-gray-50 transition-colors ${!seg.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{seg.code}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{seg.name}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{seg.description || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      seg.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {seg.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => { setEditing(seg); setShowForm(false) }}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(seg)}
                        disabled={updateMutation.isPending}
                        className={`p-1 rounded transition-colors disabled:opacity-40 ${
                          seg.isActive
                            ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                            : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={seg.isActive ? 'Deactivate' : 'Activate'}>
                        {seg.isActive ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
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