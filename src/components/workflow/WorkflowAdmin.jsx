import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, AlertCircle, RefreshCw, Plus, Trash2, Users, Link2, Shield,
} from 'lucide-react'
import {
  listWorkflowDefinitions, createWorkflowDefinition,
  listWorkflowGroups, createWorkflowGroup,
  listCategoryMappings, createCategoryMapping, deleteCategoryMapping,
} from '../../api/workflowApi'
import toast from 'react-hot-toast'

// -- Definitions Section ------------------------------------------------------

// WorkflowDefinitionRequest fields:
//   { name, description, processKey, assignedRole, assignedGroupId, slaHours, active }
const EMPTY_DEF = { name: '', description: '', processKey: 'document-single-review', assignedRole: 'ECM_REVIEWER', assignedGroupId: '', slaHours: 48, active: true }

function DefinitionsSection() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_DEF)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['workflow', 'definitions'],
    queryFn:  listWorkflowDefinitions,
    throwOnError: false,
  })
  const definitions = Array.isArray(data) ? data : []

  const createMut = useMutation({
    mutationFn: () => createWorkflowDefinition(form),
    onSuccess: () => {
      toast.success('Definition created')
      setShowCreate(false)
      setForm(EMPTY_DEF)
      qc.invalidateQueries({ queryKey: ['workflow', 'definitions'] })
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to create definition'),
  })

  const field = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  if (isLoading) return <LoadingCard label="Loading definitions..." />
  if (isError) return <ErrorCard label="Failed to load definitions" onRetry={refetch} />

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 rounded-full bg-primary-600" />
          <h3 className="font-bold text-gray-900 text-sm">Workflow Definitions</h3>
        </div>
        <button onClick={() => setShowCreate(v => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-medium
                     text-primary-600 hover:text-primary-700 transition-colors">
          <Plus size={13} /> New Definition
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-5 py-4 bg-gray-50/60 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input value={form.name} onChange={field('name')} placeholder="Name *"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 col-span-2" />
            <input value={form.description} onChange={field('description')} placeholder="Description"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 col-span-2" />
            <div>
              <label className="block text-[10px] text-gray-500 mb-1 font-medium uppercase tracking-wide">Process Key</label>
              <select value={form.processKey} onChange={field('processKey')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200">
                <option value="document-single-review">Single Review</option>
                <option value="document-dual-review">Dual Review</option>
                <option value="document-auto-approve">Auto Approve</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1 font-medium uppercase tracking-wide">Assigned Role</label>
              <select value={form.assignedRole} onChange={field('assignedRole')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200">
                <option value="ECM_REVIEWER">ECM_REVIEWER</option>
                <option value="ECM_BACKOFFICE">ECM_BACKOFFICE</option>
                <option value="ECM_ADMIN">ECM_ADMIN</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1 font-medium uppercase tracking-wide">SLA Hours</label>
              <input type="number" value={form.slaHours} onChange={field('slaHours')} min={1}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="def-active" checked={form.active}
                onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
                className="rounded" />
              <label htmlFor="def-active" className="text-sm text-gray-700">Active</label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowCreate(false); setForm(EMPTY_DEF) }}
              className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
            <button onClick={() => createMut.mutate()}
              disabled={!form.name.trim() || createMut.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors disabled:opacity-50">
              {createMut.isPending && <Loader2 size={12} className="animate-spin" />}
              Create
            </button>
          </div>
        </div>
      )}

      {definitions.length === 0 && !showCreate ? (
        <div className="py-12 text-center text-sm text-gray-400">No definitions configured</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {definitions.map((def) => (
            <div key={def.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-800">{def.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{def.description || 'No description'}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="bg-gray-100 rounded-full px-2 py-0.5 font-medium">{def.processKey}</span>
                <span className="flex items-center gap-1">
                  <Shield size={11} /> {def.assignedGroupName || def.assignedRole}
                </span>
                {def.slaHours && <span className="text-amber-600">{def.slaHours}h SLA</span>}
                <span className={`rounded-full px-2 py-0.5 font-semibold text-[10px]
                  ${def.active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                  {def.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// -- Groups Section -----------------------------------------------------------

function GroupsSection() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['workflow', 'groups'],
    queryFn:  listWorkflowGroups,
    throwOnError: false,
  })
  const groups = Array.isArray(data) ? data : []

  const createMut = useMutation({
    mutationFn: () => createWorkflowGroup({ name: newName, description: newDesc }),
    onSuccess: () => {
      toast.success('Group created')
      setShowCreate(false); setNewName(''); setNewDesc('')
      qc.invalidateQueries({ queryKey: ['workflow', 'groups'] })
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  })

  if (isLoading) return <LoadingCard label="Loading groups..." />
  if (isError) return <ErrorCard label="Failed to load groups" onRetry={refetch} />

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 rounded-full bg-accent-500" />
          <h3 className="font-bold text-gray-900 text-sm">Workflow Groups</h3>
        </div>
        <button onClick={() => setShowCreate(v => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-medium
                     text-accent-600 hover:text-accent-700 transition-colors">
          <Plus size={13} /> Add Group
        </button>
      </div>

      {showCreate && (
        <div className="px-5 py-4 bg-gray-50/50 border-b border-gray-100">
          <div className="flex gap-3">
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Group name..." className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description..." className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            <button onClick={() => createMut.mutate()} disabled={!newName.trim() || createMut.isPending}
              className="px-4 py-2 rounded-lg bg-accent-500 text-white text-sm font-medium hover:bg-accent-600 disabled:opacity-50 transition-colors">
              {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">No groups configured</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {groups.map((g) => (
            <div key={g.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-800">{g.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{g.description || 'No description'}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="bg-gray-100 rounded-full px-2 py-0.5 font-mono text-[10px]">{g.groupKey}</span>
                <span className="flex items-center gap-1"><Users size={11} /> {g.memberCount} members</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// -- Category Mappings Section ------------------------------------------------

function MappingsSection() {
  const qc = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['workflow', 'mappings'],
    queryFn:  listCategoryMappings,
    throwOnError: false,
  })
  const mappings = Array.isArray(data) ? data : []

  const deleteMut = useMutation({
    mutationFn: (id) => deleteCategoryMapping(id),
    onSuccess: () => { toast.success('Mapping removed'); qc.invalidateQueries({ queryKey: ['workflow', 'mappings'] }) },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  })

  if (isLoading) return <LoadingCard label="Loading mappings..." />
  if (isError) return <ErrorCard label="Failed to load mappings" onRetry={refetch} />

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 rounded-full bg-purple-500" />
          <h3 className="font-bold text-gray-900 text-sm">Category Auto-Trigger Mappings</h3>
        </div>
        <span className="text-xs text-gray-400">{mappings.length} mappings</span>
      </div>
      {mappings.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          No category mappings. Documents will need manual workflow start.
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {mappings.map((m) => (
            <div key={m.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors group">
              <div className="flex items-center gap-3">
                <Link2 size={14} className="text-purple-400" />
                <span className="text-sm text-gray-700">
                  Category <span className="font-mono font-medium">#{m.categoryId}</span>
                </span>
                <span className="text-gray-300">-&gt;</span>
                <span className="text-sm text-gray-700 font-medium">{m.workflowDefinitionName}</span>
              </div>
              <button onClick={() => deleteMut.mutate(m.id)}
                className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// -- Shared helper components -------------------------------------------------

function LoadingCard({ label }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
      <Loader2 size={24} className="animate-spin text-gray-300 mx-auto mb-2" />
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  )
}

function ErrorCard({ label, onRetry }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-12 text-center">
      <AlertCircle size={24} className="text-red-400 mx-auto mb-2" />
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <button onClick={onRetry} className="mt-2 text-xs text-blue-500 hover:underline">Try again</button>
    </div>
  )
}

// -- Main Component -----------------------------------------------------------

export default function WorkflowAdmin() {
  return (
    <div className="flex flex-col gap-5">
      <DefinitionsSection />
      <GroupsSection />
      <MappingsSection />
    </div>
  )
}