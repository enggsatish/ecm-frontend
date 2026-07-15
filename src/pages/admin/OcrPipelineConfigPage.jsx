import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useFieldMappings, useCreateFieldMapping, useDeleteFieldMapping,
  useExtractionTemplates, useCreateExtractionTemplate, useUpdateExtractionTemplate, useDeleteExtractionTemplate,
  useConfidenceConfigs, useUpdateConfidenceConfig,
  useTrainingExamples, useUpdateTrainingExampleStatus, useDeleteTrainingExample,
} from '../../hooks/useAdmin'
import { getCategories } from '../../api/adminApi'
import { Loader2, Plus, Trash2, Save, ArrowRight, CheckCircle, XCircle, Brain, Layers, Target, GraduationCap, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'mappings',   label: 'Field Mappings',       icon: ArrowRight,    desc: 'Map raw engine field names to canonical names' },
  { id: 'templates',  label: 'Extraction Templates',  icon: Layers,        desc: 'Define expected fields per document category' },
  { id: 'confidence', label: 'Confidence Scoring',    icon: Target,        desc: 'Configure classification thresholds and weights' },
  { id: 'training',   label: 'Training Data',         icon: GraduationCap, desc: 'Manage OCR training examples with lifecycle' },
]

const FIELD_TYPES = ['STRING', 'DATE', 'CURRENCY', 'NUMBER', 'BOOLEAN']
const TRAINING_STATUSES = ['CANDIDATE', 'VERIFIED', 'ACTIVE', 'RETIRED']
const STATUS_COLORS = { CANDIDATE: 'bg-amber-100 text-amber-700', VERIFIED: 'bg-blue-100 text-blue-700', ACTIVE: 'bg-emerald-100 text-emerald-700', RETIRED: 'bg-gray-100 text-gray-500' }

export default function OcrPipelineConfigPage() {
  const [tab, setTab] = useState('mappings')
  const [catFilter, setCatFilter] = useState('')
  const { data: categories = [] } = useQuery({ queryKey: ['admin', 'categories'], queryFn: getCategories, staleTime: 5 * 60_000 })
  const categoryCodes = categories.map(c => c.code).filter(Boolean)

  return (
    <div className="p-6">
      {/* Sticky header: description + tabs + filter */}
      <div className="sticky top-0 z-10 -mx-6 -mt-6 px-6 pt-6 pb-4 bg-gray-50 border-b border-gray-200 mb-5">
        <p className="text-sm text-gray-500 mb-4">Manage field normalization, extraction templates, confidence scoring, and training data.</p>

        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-3 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
                tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-500">Category:</label>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All Categories</option>
            {categoryCodes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Tab content — scrolls within parent Outlet container */}
      <div className="pb-6">
        {tab === 'mappings' && <FieldMappingsTab categoryCode={catFilter} categoryCodes={categoryCodes} />}
        {tab === 'templates' && <ExtractionTemplatesTab categoryCode={catFilter} categoryCodes={categoryCodes} />}
        {tab === 'confidence' && <ConfidenceTab categoryCode={catFilter} categoryCodes={categoryCodes} />}
        {tab === 'training' && <TrainingTab categoryCode={catFilter} />}
      </div>
    </div>
  )
}

// ── Field Mappings Tab ────────────────────────────────────────────────────

function FieldMappingsTab({ categoryCode, categoryCodes }) {
  const { data: mappings = [], isLoading } = useFieldMappings(categoryCode || undefined)
  const createMut = useCreateFieldMapping()
  const deleteMut = useDeleteFieldMapping()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ categoryCode: '', rawName: '', canonicalName: '', fieldType: 'STRING' })

  const handleAdd = async () => {
    if (!form.categoryCode || !form.rawName || !form.canonicalName) return toast.error('Fill all fields')
    try { await createMut.mutateAsync(form); setAdding(false); setForm({ categoryCode: '', rawName: '', canonicalName: '', fieldType: 'STRING' }); toast.success('Mapping added') }
    catch { toast.error('Failed to add') }
  }

  if (isLoading) return <Loading />

  // Group by category
  const grouped = {}
  mappings.forEach(m => {
    const cat = m.category_code || m.categoryCode
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(m)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Map raw OCR engine field names to canonical names. e.g., Azure's "FirstName" → "first_name"</p>
        <button onClick={() => setAdding(!adding)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer">
          <Plus size={14} /> Add Mapping
        </button>
      </div>

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 grid grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Category</label>
            <select value={form.categoryCode} onChange={e => setForm(f => ({ ...f, categoryCode: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
              <option value="">Select...</option>
              {categoryCodes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Raw Name (from engine)</label>
            <input value={form.rawName} onChange={e => setForm(f => ({ ...f, rawName: e.target.value }))}
              placeholder="FirstName" className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Canonical Name</label>
            <input value={form.canonicalName} onChange={e => setForm(f => ({ ...f, canonicalName: e.target.value }))}
              placeholder="first_name" className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
            <select value={form.fieldType} onChange={e => setForm(f => ({ ...f, fieldType: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
              {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer">Save</button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-gray-500 text-sm cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500">{cat}</span>
            <span className="text-xs text-gray-400 ml-2">({items.length} mappings)</span>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-2 font-medium">Raw Name</th>
              <th className="px-4 py-2 font-medium">→</th>
              <th className="px-4 py-2 font-medium">Canonical Name</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium w-10"></th>
            </tr></thead>
            <tbody>
              {items.map(m => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-1.5 font-mono text-gray-600">{m.raw_name || m.rawName}</td>
                  <td className="px-4 py-1.5 text-gray-300"><ArrowRight size={12} /></td>
                  <td className="px-4 py-1.5 font-mono text-blue-600">{m.canonical_name || m.canonicalName}</td>
                  <td className="px-4 py-1.5 text-gray-400 text-xs">{m.field_type || m.fieldType}</td>
                  <td className="px-4 py-1.5">
                    <button onClick={() => deleteMut.mutate(m.id)} className="text-gray-300 hover:text-red-500 cursor-pointer"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {Object.keys(grouped).length === 0 && <EmptyState message="No field mappings configured" />}
    </div>
  )
}

// ── Extraction Templates Tab ──────────────────────────────────────────────

function ExtractionTemplatesTab({ categoryCode, categoryCodes }) {
  const { data: templates = [], isLoading } = useExtractionTemplates(categoryCode || undefined)
  const createMut = useCreateExtractionTemplate()
  const updateMut = useUpdateExtractionTemplate()
  const deleteMut = useDeleteExtractionTemplate()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ categoryCode: '', fieldName: '', fieldType: 'STRING', required: false, displayOrder: 0, description: '' })

  const handleAdd = async () => {
    if (!form.categoryCode || !form.fieldName) return toast.error('Category and field name required')
    try { await createMut.mutateAsync(form); setAdding(false); setForm({ categoryCode: '', fieldName: '', fieldType: 'STRING', required: false, displayOrder: 0, description: '' }); toast.success('Template added') }
    catch { toast.error('Failed') }
  }

  const toggleRequired = async (t) => {
    try { await updateMut.mutateAsync({ id: t.id, required: !(t.required) }) }
    catch { toast.error('Failed') }
  }

  if (isLoading) return <Loading />

  const grouped = {}
  templates.forEach(t => {
    const cat = t.category_code || t.categoryCode
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(t)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Define expected fields per category. Drives prompt generation, confidence scoring, and field validation.</p>
        <button onClick={() => setAdding(!adding)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer">
          <Plus size={14} /> Add Field
        </button>
      </div>

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 grid grid-cols-6 gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Category</label>
            <select value={form.categoryCode} onChange={e => setForm(f => ({ ...f, categoryCode: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
              <option value="">Select...</option>
              {categoryCodes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Field Name</label>
            <input value={form.fieldName} onChange={e => setForm(f => ({ ...f, fieldName: e.target.value }))}
              placeholder="first_name" className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
            <select value={form.fieldType} onChange={e => setForm(f => ({ ...f, fieldType: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
              {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Order</label>
            <input type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: +e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional" className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-1 text-xs text-gray-600">
              <input type="checkbox" checked={form.required} onChange={e => setForm(f => ({ ...f, required: e.target.checked }))} /> Required
            </label>
            <button onClick={handleAdd} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer">Save</button>
            <button onClick={() => setAdding(false)} className="text-gray-500 text-sm cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {Object.entries(grouped).sort().map(([cat, items]) => (
        <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-gray-500">{cat}</span>
              <span className="text-xs text-gray-400 ml-2">({items.filter(t => t.required).length} required, {items.filter(t => !t.required).length} optional)</span>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-2 font-medium w-8">#</th>
              <th className="px-4 py-2 font-medium">Field Name</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Required</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium w-10"></th>
            </tr></thead>
            <tbody>
              {items.sort((a, b) => (a.display_order || a.displayOrder || 0) - (b.display_order || b.displayOrder || 0)).map(t => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-1.5 text-gray-400 text-xs">{t.display_order ?? t.displayOrder}</td>
                  <td className="px-4 py-1.5 font-mono text-blue-600">{t.field_name || t.fieldName}</td>
                  <td className="px-4 py-1.5 text-gray-400 text-xs">{t.field_type || t.fieldType}</td>
                  <td className="px-4 py-1.5">
                    <button onClick={() => toggleRequired(t)} className="cursor-pointer">
                      {t.required ? <CheckCircle size={14} className="text-emerald-500" /> : <XCircle size={14} className="text-gray-300" />}
                    </button>
                  </td>
                  <td className="px-4 py-1.5 text-gray-500 text-xs">{t.description}</td>
                  <td className="px-4 py-1.5">
                    <button onClick={() => deleteMut.mutate(t.id)} className="text-gray-300 hover:text-red-500 cursor-pointer"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {Object.keys(grouped).length === 0 && <EmptyState message="No extraction templates configured" />}
    </div>
  )
}

// ── Confidence Config Tab ─────────────────────────────────────────────────

function ConfidenceTab({ categoryCode, categoryCodes }) {
  const { data: allConfigs = [], isLoading } = useConfidenceConfigs()
  const updateMut = useUpdateConfidenceConfig()
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})

  // Filter by selected category if any
  const configs = categoryCode
    ? allConfigs.filter(c => (c.category_code || c.categoryCode) === categoryCode)
    : allConfigs

  // Categories that DON'T yet have a confidence config — offer to create defaults
  const configuredCodes = new Set(allConfigs.map(c => c.category_code || c.categoryCode))
  const unconfiguredCategories = categoryCodes.filter(c => !configuredCodes.has(c))
  const showUnconfiguredForThis = categoryCode && !configuredCodes.has(categoryCode)

  const startEdit = (c) => {
    setEditing(c.category_code || c.categoryCode)
    setForm({
      autoAcceptThreshold: c.auto_accept_threshold ?? c.autoAcceptThreshold ?? 85,
      reviewThreshold: c.review_threshold ?? c.reviewThreshold ?? 50,
      rejectThreshold: c.reject_threshold ?? c.rejectThreshold ?? 20,
      weightLlmConfidence: c.weight_llm_confidence ?? c.weightLlmConfidence ?? 0.30,
      weightFieldMatch: c.weight_field_match ?? c.weightFieldMatch ?? 0.35,
      weightKeywordScore: c.weight_keyword_score ?? c.weightKeywordScore ?? 0.20,
      weightTrainingSim: c.weight_training_sim ?? c.weightTrainingSim ?? 0.15,
    })
  }

  const startCreate = (code) => {
    setEditing(code)
    setForm({
      autoAcceptThreshold: 85,
      reviewThreshold: 50,
      rejectThreshold: 20,
      weightLlmConfidence: 0.30,
      weightFieldMatch: 0.35,
      weightKeywordScore: 0.20,
      weightTrainingSim: 0.15,
    })
  }

  const handleSave = async () => {
    try { await updateMut.mutateAsync({ categoryCode: editing, ...form }); setEditing(null); toast.success('Saved') }
    catch { toast.error('Failed') }
  }

  if (isLoading) return <Loading />

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Configure per-category confidence thresholds and scoring weights. Composite score = weighted average of LLM confidence, field match, keywords, and training similarity.</p>

      {/* Prompt to create config for filtered category if it doesn't exist */}
      {showUnconfiguredForThis && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-900">No confidence config for <span className="font-mono">{categoryCode}</span></p>
            <p className="text-xs text-amber-700 mt-0.5">This category uses default thresholds until you create one.</p>
          </div>
          <button onClick={() => startCreate(categoryCode)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 cursor-pointer">
            <Plus size={14} /> Create Config
          </button>
        </div>
      )}

      {/* When no category filter, list unconfigured ones at top */}
      {!categoryCode && unconfiguredCategories.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-900 mb-2">Categories without confidence config ({unconfiguredCategories.length})</p>
          <div className="flex flex-wrap gap-2">
            {unconfiguredCategories.map(code => (
              <button key={code} onClick={() => startCreate(code)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-amber-300 text-amber-700 text-xs rounded-lg hover:bg-amber-100 cursor-pointer">
                <Plus size={11} /> {code}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editing card for a new (create) or existing (edit) config */}
      {editing && !configs.some(c => (c.category_code || c.categoryCode) === editing) && (
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">
              New config for <span className="font-mono text-blue-600">{editing}</span>
            </span>
          </div>
          <EditorFields form={form} setForm={setForm} onSave={handleSave} onCancel={() => setEditing(null)} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {configs.map(c => {
          const code = c.category_code || c.categoryCode
          const isEditing = editing === code
          return (
            <div key={code} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">{code}</span>
                {!isEditing && <button onClick={() => startEdit(c)} className="text-xs text-blue-600 hover:underline cursor-pointer">Edit</button>}
              </div>

              {isEditing ? (
                <EditorFields form={form} setForm={setForm} onSave={handleSave} onCancel={() => setEditing(null)} />
              ) : (
                <div className="grid grid-cols-7 gap-2 text-xs">
                  <Stat label="Auto-Accept" value={`>=${c.auto_accept_threshold ?? c.autoAcceptThreshold ?? 85}%`} color="emerald" />
                  <Stat label="Review" value={`>=${c.review_threshold ?? c.reviewThreshold ?? 50}%`} color="amber" />
                  <Stat label="Reject" value={`<${c.reject_threshold ?? c.rejectThreshold ?? 20}%`} color="red" />
                  <Stat label="W: LLM" value={c.weight_llm_confidence ?? c.weightLlmConfidence ?? 0.30} color="gray" />
                  <Stat label="W: Fields" value={c.weight_field_match ?? c.weightFieldMatch ?? 0.35} color="gray" />
                  <Stat label="W: Keywords" value={c.weight_keyword_score ?? c.weightKeywordScore ?? 0.20} color="gray" />
                  <Stat label="W: Training" value={c.weight_training_sim ?? c.weightTrainingSim ?? 0.15} color="gray" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {configs.length === 0 && !showUnconfiguredForThis && !editing && (
        <EmptyState message={categoryCode
          ? `No confidence config for ${categoryCode}`
          : 'No confidence configurations yet'} />
      )}
    </div>
  )
}

// Reusable editor form for create + edit confidence config
function EditorFields({ form, setForm, onSave, onCancel }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">{"Auto-Accept (\u2265)"}</label>
          <input type="number" step="1" value={form.autoAcceptThreshold} onChange={e => setForm(f => ({ ...f, autoAcceptThreshold: +e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">{"Review (\u2265)"}</label>
          <input type="number" step="1" value={form.reviewThreshold} onChange={e => setForm(f => ({ ...f, reviewThreshold: +e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">{"Reject (<)"}</label>
          <input type="number" step="1" value={form.rejectThreshold} onChange={e => setForm(f => ({ ...f, rejectThreshold: +e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
      </div>
      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Scoring Weights (must sum to 1.0)</p>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-gray-600 block mb-1">LLM Confidence</label>
          <input type="number" step="0.05" value={form.weightLlmConfidence} onChange={e => setForm(f => ({ ...f, weightLlmConfidence: +e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Field Match</label>
          <input type="number" step="0.05" value={form.weightFieldMatch} onChange={e => setForm(f => ({ ...f, weightFieldMatch: +e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Keywords</label>
          <input type="number" step="0.05" value={form.weightKeywordScore} onChange={e => setForm(f => ({ ...f, weightKeywordScore: +e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Training Sim</label>
          <input type="number" step="0.05" value={form.weightTrainingSim} onChange={e => setForm(f => ({ ...f, weightTrainingSim: +e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-1"><Save size={13} /> Save</button>
        <button onClick={onCancel} className="text-gray-500 text-sm cursor-pointer">Cancel</button>
      </div>
    </div>
  )
}

// ── Training Data Tab ─────────────────────────────────────────────────────

function TrainingTab({ categoryCode }) {
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const params = {}
  if (categoryCode) params.categoryCode = categoryCode
  if (statusFilter) params.status = statusFilter
  const { data: examples = [], isLoading } = useTrainingExamples(params)
  const updateStatusMut = useUpdateTrainingExampleStatus()
  const deleteMut = useDeleteTrainingExample()

  const handleStatus = async (id, status) => {
    try { await updateStatusMut.mutateAsync({ id, status }); toast.success(`Status → ${status}`) }
    catch { toast.error('Failed') }
  }

  const parseFields = (ex) => {
    try {
      const raw = typeof ex.expected_fields === 'string' ? JSON.parse(ex.expected_fields) : (ex.expected_fields || ex.expectedFields || {})
      // Training examples store as { category, confidence, fields: {...} } OR just { field: value }
      return raw.fields && typeof raw.fields === 'object' ? raw.fields : raw
    } catch { return {} }
  }

  if (isLoading) return <Loading />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Training examples used as few-shot prompts for OCR extraction. Lifecycle: Candidate → Verified → Active → Retired.</p>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All Statuses</option>
            {TRAINING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {examples.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState message="No training examples found" />
        </div>
      ) : (
        <div className="space-y-3">
          {examples.map(ex => {
            const fields = parseFields(ex)
            const fieldKeys = Object.keys(fields).filter(k => k !== 'category' && k !== 'confidence')
            const fieldCount = fieldKeys.length
            const status = ex.status || 'CANDIDATE'
            const accuracy = ex.accuracy_score ?? ex.accuracyScore
            const timesUsed = ex.times_used ?? ex.timesUsed ?? 0
            const timesCorrect = ex.times_correct ?? ex.timesCorrect ?? 0
            const expanded = expandedId === ex.id

            return (
              <div key={ex.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedId(expanded ? null : ex.id)}>
                  <ChevronRight size={14} className={`text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                  <div className="flex items-center gap-2 w-32">
                    <span className="text-xs font-mono font-semibold text-gray-700">{ex.category_code || ex.categoryCode}</span>
                  </div>
                  <div className="w-20">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">{ex.source}</span>
                  </div>
                  <div className="w-24">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-500'}`}>{status}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2 overflow-hidden">
                    <span className="text-xs text-gray-400 whitespace-nowrap">{fieldCount} field{fieldCount !== 1 ? 's' : ''}:</span>
                    <div className="flex items-center gap-1 overflow-hidden">
                      {fieldKeys.slice(0, 4).map(k => (
                        <span key={k} className="text-[10px] font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded whitespace-nowrap">{k}</span>
                      ))}
                      {fieldCount > 4 && <span className="text-[10px] text-gray-400">+{fieldCount - 4} more</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
                    <div className="text-right w-16">
                      <p className="text-[9px] text-gray-400 uppercase">Accuracy</p>
                      {accuracy != null
                        ? <span className={accuracy >= 70 ? 'text-emerald-600 font-semibold' : accuracy >= 40 ? 'text-amber-600 font-semibold' : 'text-red-500 font-semibold'}>{accuracy}%</span>
                        : <span className="text-gray-300">—</span>}
                    </div>
                    <div className="text-right w-16">
                      <p className="text-[9px] text-gray-400 uppercase">Used</p>
                      <span>{timesCorrect}/{timesUsed}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {status === 'CANDIDATE' && <StatusBtn label="Verify" onClick={() => handleStatus(ex.id, 'VERIFIED')} color="blue" />}
                    {status === 'VERIFIED' && <StatusBtn label="Activate" onClick={() => handleStatus(ex.id, 'ACTIVE')} color="emerald" />}
                    {(status === 'ACTIVE' || status === 'VERIFIED') && <StatusBtn label="Retire" onClick={() => handleStatus(ex.id, 'RETIRED')} color="gray" />}
                    <button onClick={() => { if (confirm('Delete this training example?')) deleteMut.mutate(ex.id) }}
                      className="text-gray-300 hover:text-red-500 cursor-pointer ml-1"><Trash2 size={13} /></button>
                  </div>
                </div>

                {/* Expanded field detail */}
                {expanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Extracted Fields</p>
                    {fieldKeys.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No fields</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        {fieldKeys.map(k => {
                          const value = fields[k]
                          const display = typeof value === 'object' ? JSON.stringify(value) : String(value)
                          return (
                            <div key={k} className="flex items-start gap-3 text-xs">
                              <span className="font-mono text-blue-600 font-medium min-w-[140px] flex-shrink-0">{k}</span>
                              <span className="text-gray-300">:</span>
                              <span className="text-gray-700 font-mono break-all">{display}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {ex.created_at && (
                      <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-200">
                        Created {new Date(ex.created_at).toLocaleString()}
                        {ex.created_by && <span> by {ex.created_by}</span>}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Shared Components ─────────────────────────────────────────────────────

function StatusBtn({ label, onClick, color }) {
  const colors = { blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100', emerald: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100', gray: 'bg-gray-50 text-gray-500 hover:bg-gray-100' }
  return <button onClick={onClick} className={`text-[10px] font-medium px-2 py-0.5 rounded ${colors[color]} cursor-pointer`}>{label}</button>
}

function Stat({ label, value, color }) {
  const colors = { emerald: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-500', gray: 'text-gray-600' }
  return (
    <div>
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className={`font-semibold ${colors[color]}`}>{value}</p>
    </div>
  )
}

function Loading() {
  return <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 size={18} className="animate-spin mr-2" /> Loading...</div>
}

function EmptyState({ message }) {
  return <div className="text-center py-12 text-gray-400"><Brain size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">{message}</p></div>
}
