/**
 * CustomerSchemaPage.jsx
 * Route: /admin/customer-schema
 *
 * Superadmin config for CRM-aware form fill (design note "CRM-Aware Form Fill
 * & Customer 360", 2026-07-17):
 *   - Profile attributes (Tier A, flat) — the canonical vocabulary forms bind
 *     to. MANUAL ones are typed in per-customer; CRM_MAPPED ones are pulled
 *     live from Salesforce via the field mapping set here.
 *   - Relationship types (Tier B, one-to-many) — Membership, Account, etc.,
 *     each with its own attribute schema, also CRM-mapped.
 *
 * Nothing here stores customer data — only the schema/mapping metadata.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, X, Loader2, Tag, Link2, ChevronDown, ChevronRight, Trash2, Edit2, Layers,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  listProfileAttributes, createProfileAttribute, updateProfileAttribute, deactivateProfileAttribute,
  listRelationshipTypes, createRelationshipType, updateRelationshipType, deactivateRelationshipType,
  addRelationshipAttribute, removeRelationshipAttribute,
} from '../../api/adminApi'

const VALUE_TYPES = ['STRING', 'DATE', 'EMAIL', 'PHONE', 'NUMBER']
const SEGMENTS = [
  { code: 'RETAIL', label: 'Retail' },
  { code: 'SMB', label: 'Small Business' },
  { code: 'COMMERCIAL', label: 'Commercial' },
]

// segments: comma-separated string ('' or all 3 checked = applies to all segments)
function SegmentCheckboxes({ value, onChange }) {
  const checked = value ? value.split(',').map(s => s.trim()) : SEGMENTS.map(s => s.code)
  const toggle = (code) => {
    const next = checked.includes(code) ? checked.filter(c => c !== code) : [...checked, code]
    onChange(next.length === SEGMENTS.length ? '' : next.join(','))
  }
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Applies To</label>
      <div className="flex gap-3">
        {SEGMENTS.map(s => (
          <label key={s.code} className="flex items-center gap-1.5 text-xs text-gray-700">
            <input type="checkbox" checked={checked.includes(s.code)} onChange={() => toggle(s.code)}
              className="rounded border-gray-300" />
            {s.label}
          </label>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-1">
        {checked.length === SEGMENTS.length ? 'Shown for every customer segment' : 'Only shown for the checked segment(s)'}
      </p>
    </div>
  )
}

function SegmentBadges({ segments }) {
  if (!segments) return <span className="text-[10px] text-gray-400">All segments</span>
  return (
    <div className="flex gap-1">
      {segments.split(',').map(s => (
        <span key={s} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{s.trim()}</span>
      ))}
    </div>
  )
}

// ── Profile Attribute Modal ──────────────────────────────────────────────────
function AttributeModal({ initial, onClose, onSave, saving }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    key: initial?.key ?? '',
    label: initial?.label ?? '',
    valueType: initial?.valueType ?? 'STRING',
    source: initial?.source ?? 'MANUAL',
    sortOrder: initial?.sortOrder ?? 0,
    segments: initial?.segments ?? '',
    salesforceObject: initial?.salesforceObject ?? '',
    salesforceField: initial?.salesforceField ?? '',
  })
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    if (!form.key.trim() || !form.label.trim()) return toast.error('Key and label are required')
    if (form.source === 'CRM_MAPPED' && (!form.salesforceObject.trim() || !form.salesforceField.trim()))
      return toast.error('Salesforce object and field are required for CRM-mapped attributes')
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{isEdit ? 'Edit Attribute' : 'New Profile Attribute'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Key</label>
            <input value={form.key} onChange={e => update('key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              disabled={isEdit} placeholder="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400" />
            <p className="text-[10px] text-gray-400 mt-1">lower_snake_case — this is what forms bind to, cannot change after creation</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
            <input value={form.label} onChange={e => update('label', e.target.value)} placeholder="Email Address"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Value Type</label>
              <select value={form.valueType} onChange={e => update('valueType', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                {VALUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
              <select value={form.source} onChange={e => update('source', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value="MANUAL">Manual (typed in per customer)</option>
                <option value="CRM_MAPPED">CRM-mapped (from Salesforce)</option>
              </select>
            </div>
          </div>
          <SegmentCheckboxes value={form.segments} onChange={v => update('segments', v)} />

          {form.source === 'CRM_MAPPED' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Salesforce Object</label>
                <input value={form.salesforceObject} onChange={e => update('salesforceObject', e.target.value)}
                  placeholder="Contact" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Salesforce Field</label>
                <input value={form.salesforceField} onChange={e => update('salesforceField', e.target.value)}
                  placeholder="Email" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />} {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Profile Attributes Section ───────────────────────────────────────────────
function ProfileAttributesSection() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // null | 'create' | attribute object

  const { data: attributes = [], isLoading } = useQuery({
    queryKey: ['admin', 'customer-profile-schema', 'attributes'],
    queryFn: listProfileAttributes,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'customer-profile-schema', 'attributes'] })

  const createMut = useMutation({
    mutationFn: createProfileAttribute,
    onSuccess: () => { toast.success('Attribute created'); invalidate(); setModal(null) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Create failed'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }) => updateProfileAttribute(id, payload),
    onSuccess: () => { toast.success('Attribute updated'); invalidate(); setModal(null) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Update failed'),
  })
  const deactivateMut = useMutation({
    mutationFn: deactivateProfileAttribute,
    onSuccess: () => { toast.success('Attribute removed'); invalidate() },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Remove failed'),
  })

  const handleSave = (form) => {
    if (modal && modal !== 'create') updateMut.mutate({ id: modal.id, ...form })
    else createMut.mutate(form)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Tag size={15} /> Profile Attributes</h2>
          <p className="text-xs text-gray-400 mt-0.5">Flat customer fields (name, email, DOB, ...) forms can bind to</p>
        </div>
        <button onClick={() => setModal('create')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus size={14} /> New Attribute
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10 text-gray-400"><Loader2 size={18} className="animate-spin" /></div>
      ) : attributes.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">No profile attributes yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="px-5 py-2 font-medium">Key</th>
              <th className="px-5 py-2 font-medium">Label</th>
              <th className="px-5 py-2 font-medium">Type</th>
              <th className="px-5 py-2 font-medium">Source</th>
              <th className="px-5 py-2 font-medium">Segments</th>
              <th className="px-5 py-2 font-medium">Salesforce</th>
              <th className="px-5 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {attributes.map(a => (
              <tr key={a.id} className="hover:bg-gray-50/50">
                <td className="px-5 py-2.5 font-mono text-xs text-gray-700">{a.key}</td>
                <td className="px-5 py-2.5 text-gray-800">{a.label}</td>
                <td className="px-5 py-2.5 text-gray-500 text-xs">{a.valueType}</td>
                <td className="px-5 py-2.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.source === 'CRM_MAPPED' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                    {a.source === 'CRM_MAPPED' ? 'CRM-mapped' : 'Manual'}
                  </span>
                </td>
                <td className="px-5 py-2.5"><SegmentBadges segments={a.segments} /></td>
                <td className="px-5 py-2.5 font-mono text-[11px] text-gray-500">
                  {a.salesforceObject ? `${a.salesforceObject}.${a.salesforceField}` : '—'}
                </td>
                <td className="px-5 py-2.5 text-right whitespace-nowrap">
                  <button onClick={() => setModal(a)} className="text-gray-400 hover:text-blue-600 p-1"><Edit2 size={14} /></button>
                  <button onClick={() => deactivateMut.mutate(a.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal && (
        <AttributeModal
          initial={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}
    </div>
  )
}

// ── Relationship Type Modal ──────────────────────────────────────────────────
function RelationshipTypeModal({ initial, onClose, onSave, saving }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    parentObject: initial?.parentObject ?? 'Contact',
    salesforceObject: initial?.salesforceObject ?? '',
    salesforceParentField: initial?.salesforceParentField ?? '',
    segments: initial?.segments ?? '',
    sortOrder: initial?.sortOrder ?? 0,
  })
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    if (!form.name.trim() || !form.parentObject.trim() || !form.salesforceObject.trim() || !form.salesforceParentField.trim())
      return toast.error('Name, parent object, Salesforce object, and parent field are required')
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{isEdit ? 'Edit Relationship Type' : 'New Relationship Type'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Bank Accounts"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>

          <SegmentCheckboxes value={form.segments} onChange={v => update('segments', v)} />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Customer's Own Object</label>
            <select value={form.parentObject} onChange={e => update('parentObject', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="Contact">Contact (Retail)</option>
              <option value="Account">Account (Small Business / Commercial)</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              Which object holds the customer's own record — used to resolve their Salesforce Id first
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Salesforce Object</label>
            <input value={form.salesforceObject} onChange={e => update('salesforceObject', e.target.value)}
              placeholder="Banking_Account__c" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
            <p className="text-[10px] text-gray-400 mt-1">The Salesforce object that has one record per item (e.g. one per bank account)</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Parent Lookup Field</label>
            <input value={form.salesforceParentField} onChange={e => update('salesforceParentField', e.target.value)}
              placeholder="Contact__c" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
            <p className="text-[10px] text-gray-400 mt-1">
              The lookup field on that object pointing back to the "Customer's Own Object" record above
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />} {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── One Relationship Type row (expandable, with its own attributes) ─────────
function RelationshipTypeRow({ type, onEdit, onDeactivate }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [addingAttr, setAddingAttr] = useState(false)
  const [attrForm, setAttrForm] = useState({ key: '', label: '', valueType: 'STRING', salesforceField: '' })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'customer-profile-schema', 'relationship-types'] })

  const addAttrMut = useMutation({
    mutationFn: (payload) => addRelationshipAttribute(type.id, payload),
    onSuccess: () => { toast.success('Attribute added'); invalidate(); setAddingAttr(false); setAttrForm({ key: '', label: '', valueType: 'STRING', salesforceField: '' }) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Add failed'),
  })
  const removeAttrMut = useMutation({
    mutationFn: (attributeId) => removeRelationshipAttribute(type.id, attributeId),
    onSuccess: () => { toast.success('Attribute removed'); invalidate() },
  })

  const handleAddAttr = () => {
    if (!attrForm.key.trim() || !attrForm.label.trim() || !attrForm.salesforceField.trim())
      return toast.error('Key, label, and Salesforce field are required')
    addAttrMut.mutate(attrForm)
  }

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50">
        <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-2 text-left flex-1">
          {expanded ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
          <span className="text-sm font-medium text-gray-900">{type.name}</span>
          <span className="text-[11px] font-mono text-gray-400">{type.parentObject} → {type.salesforceObject}</span>
          <SegmentBadges segments={type.segments} />
          <span className="text-[10px] text-gray-400">({type.attributes?.length ?? 0} attributes)</span>
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(type)} className="text-gray-400 hover:text-blue-600 p-1"><Edit2 size={14} /></button>
          <button onClick={() => onDeactivate(type.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-3 space-y-2">
          {(type.attributes ?? []).map(a => (
            <div key={a.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0">
              <span className="font-mono text-gray-700 w-32 truncate">{a.key}</span>
              <span className="text-gray-600 flex-1">{a.label}</span>
              <span className="text-gray-400 w-16">{a.valueType}</span>
              <span className="font-mono text-gray-400 w-32 truncate">{a.salesforceField}</span>
              <button onClick={() => removeAttrMut.mutate(a.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
            </div>
          ))}

          {addingAttr ? (
            <div className="flex items-center gap-2 pt-2">
              <input value={attrForm.key} onChange={e => setAttrForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                placeholder="key" className="w-28 border border-gray-200 rounded px-2 py-1 text-xs font-mono" />
              <input value={attrForm.label} onChange={e => setAttrForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Label" className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
              <select value={attrForm.valueType} onChange={e => setAttrForm(f => ({ ...f, valueType: e.target.value }))}
                className="w-24 border border-gray-200 rounded px-2 py-1 text-xs">
                {VALUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={attrForm.salesforceField} onChange={e => setAttrForm(f => ({ ...f, salesforceField: e.target.value }))}
                placeholder="SF field" className="w-32 border border-gray-200 rounded px-2 py-1 text-xs font-mono" />
              <button onClick={handleAddAttr} disabled={addAttrMut.isPending}
                className="text-xs font-medium text-white bg-blue-600 rounded px-2 py-1 hover:bg-blue-700 disabled:opacity-50">Add</button>
              <button onClick={() => setAddingAttr(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>
          ) : (
            <button onClick={() => setAddingAttr(true)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 pt-1">
              <Plus size={12} /> Add attribute
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Relationship Types Section ───────────────────────────────────────────────
function RelationshipTypesSection() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['admin', 'customer-profile-schema', 'relationship-types'],
    queryFn: listRelationshipTypes,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'customer-profile-schema', 'relationship-types'] })

  const createMut = useMutation({
    mutationFn: createRelationshipType,
    onSuccess: () => { toast.success('Relationship type created'); invalidate(); setModal(null) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Create failed'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }) => updateRelationshipType(id, payload),
    onSuccess: () => { toast.success('Relationship type updated'); invalidate(); setModal(null) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Update failed'),
  })
  const deactivateMut = useMutation({
    mutationFn: deactivateRelationshipType,
    onSuccess: () => { toast.success('Relationship type removed'); invalidate() },
  })

  const handleSave = (form) => {
    if (modal && modal !== 'create') updateMut.mutate({ id: modal.id, ...form })
    else createMut.mutate(form)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Layers size={15} /> Relationship Types</h2>
          <p className="text-xs text-gray-400 mt-0.5">One-to-many CRM data (memberships, accounts) a customer can have several of</p>
        </div>
        <button onClick={() => setModal('create')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus size={14} /> New Type
        </button>
      </div>

      <div className="p-4 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-6 text-gray-400"><Loader2 size={18} className="animate-spin" /></div>
        ) : types.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No relationship types yet.</p>
        ) : (
          types.map(t => (
            <RelationshipTypeRow key={t.id} type={t} onEdit={setModal} onDeactivate={deactivateMut.mutate} />
          ))
        )}
      </div>

      {modal && (
        <RelationshipTypeModal
          initial={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomerSchemaPage() {
  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Link2 size={18} /> Customer Schema</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Define the canonical customer profile forms can bind to, and how it maps to Salesforce.
          Configure the connection itself under Integrations → Salesforce.
        </p>
      </div>
      <ProfileAttributesSection />
      <RelationshipTypesSection />
    </div>
  )
}
