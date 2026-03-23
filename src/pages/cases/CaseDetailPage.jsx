/**
 * CaseDetailPage.jsx
 * Route: /cases/:id
 *
 * Full-page case detail with:
 * - Verification checkboxes + bulk save
 * - Assignment (person or group) + claim from queue
 * - Request additional docs (reviewer action)
 * - State machine transitions
 * - Tabbed content: Checklist | Timeline | Notes | Overrides
 */
import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FolderOpen, ArrowLeft, CheckCircle, XCircle, Clock, Loader2, X,
  AlertCircle, Trash2, History, MessageSquare, ShieldAlert, FileText,
  User, UserPlus, Users, ChevronRight, Save, Plus, Send, Upload, Download, Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getCase, updateCaseStatus, waiveCaseItem,
  addCaseNote, cancelCase, deleteCase, getCategories,
} from '../../api/adminApi'
import useUserStore from '../../store/userStore'
import { getAvailableTransitions, getChecklistProgress, TRANSITION_COLORS, STATUS_ACTIONS } from '../../utils/caseStateMachine'
import CaseTimeline from '../../components/cases/CaseTimeline'
import OverrideReviewPanel from '../../components/cases/OverrideReviewPanel'
import CaseParticipants from '../../components/cases/CaseParticipants'
import DocumentViewerModal from '../../components/documents/DocumentViewerModal'
import { ChecklistItemRow } from './CasesPage'
import {
  useVerifyItems, useAssignCase, useClaimCase, useRequestAdditionalDocs,
} from '../../hooks/useAdmin'

// ── Status badge ─────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  NEW:                'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS:        'bg-cyan-50 text-cyan-700 border-cyan-200',
  REVIEW_PENDING:     'bg-amber-50 text-amber-700 border-amber-200',
  UNDER_REVIEW:       'bg-indigo-50 text-indigo-700 border-indigo-200',
  PENDING_APPROVAL:   'bg-orange-50 text-orange-700 border-orange-200',
  APPROVED:           'bg-green-50 text-green-700 border-green-200',
  COMPLETED:          'bg-green-50 text-green-700 border-green-200',
  REJECTED:           'bg-red-50 text-red-700 border-red-200',
  CANCELLED:          'bg-gray-100 text-gray-500 border-gray-200',
  ON_HOLD:            'bg-gray-100 text-gray-600 border-gray-200',
  // Legacy — support old data
  OPEN:               'bg-blue-50 text-blue-700 border-blue-200',
  DOCUMENTS_PENDING:  'bg-amber-50 text-amber-700 border-amber-200',
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  )
}

// ── Transition Reason Modal ──────────────────────────────────────────────────
function TransitionReasonModal({ transition, isPending, onSubmit, onClose }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">{transition.label}</h3>
          <p className="text-xs text-gray-400 mt-0.5">This transition requires a reason</p>
        </div>
        <div className="px-6 py-4">
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder="Enter reason..." autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSubmit(reason)} disabled={!reason.trim() || isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Updating...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Assign Case Modal ────────────────────────────────────────────────────────
function AssignModal({ onSubmit, isPending, onClose }) {
  const [mode, setMode] = useState('group') // 'person' | 'group'
  const [assignTo, setAssignTo] = useState('')
  const [assignToName, setAssignToName] = useState('')
  const [assignToGroup, setAssignToGroup] = useState('')
  const [comment, setComment] = useState('')

  const GROUPS = ['ECM_ADMIN', 'ECM_BACKOFFICE', 'ECM_REVIEWER']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Assign Case</h3>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setMode('group')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg border ${mode === 'group' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500'}`}>
              <Users size={12} className="inline mr-1" /> Group
            </button>
            <button onClick={() => setMode('person')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg border ${mode === 'person' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500'}`}>
              <User size={12} className="inline mr-1" /> Person
            </button>
          </div>
          {mode === 'group' ? (
            <select value={assignToGroup} onChange={e => setAssignToGroup(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select group...</option>
              {GROUPS.map(g => <option key={g} value={g}>{g.replace('ECM_', '')}</option>)}
            </select>
          ) : (
            <>
              <input value={assignTo} onChange={e => setAssignTo(e.target.value)}
                placeholder="Email address" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={assignToName} onChange={e => setAssignToName(e.target.value)}
                placeholder="Display name (optional)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </>
          )}
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
            placeholder="Comment (optional)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSubmit(mode === 'group'
            ? { assignToGroup, comment }
            : { assignTo, assignToName, comment }
          )} disabled={isPending || (mode === 'group' ? !assignToGroup : !assignTo)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Request Additional Docs Modal ────────────────────────────────────────────
function RequestDocsModal({ caseData, onSubmit, isPending, onClose }) {
  const [selectedCats, setSelectedCats] = useState([])
  const [comment, setComment] = useState('')
  const [reassignTo, setReassignTo] = useState(caseData?.assignedTo ?? '')
  const [reassignToName, setReassignToName] = useState(caseData?.assignedToName ?? '')

  const { data: categories } = useQuery({
    queryKey: ['admin', 'categories', true],
    queryFn: () => getCategories(true),
    staleTime: 5 * 60_000,
  })
  const catList = (categories ?? []).filter(c => c.isActive !== false)

  const toggleCat = (id) => {
    setSelectedCats(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Request Additional Documents</h3>
          <p className="text-xs text-gray-400 mt-0.5">Select document types needed and add a comment</p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Document Categories *</label>
            <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
              {catList.map(cat => (
                <label key={cat.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                  <input type="checkbox" checked={selectedCats.includes(cat.id)}
                    onChange={() => toggleCat(cat.id)} className="rounded" />
                  <span className="text-sm text-gray-700">{cat.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{cat.code}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Comment *</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
              placeholder="Explain what documents are needed and why..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reassign to (optional)</label>
            <input value={reassignTo} onChange={e => setReassignTo(e.target.value)}
              placeholder="Email of person to handle docs"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSubmit({
            categoryIds: selectedCats, comment,
            reassignTo: reassignTo || null, reassignToName: reassignToName || null,
          })} disabled={isPending || selectedCats.length === 0 || !comment.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Requesting...' : 'Request Documents'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Progress Bar ─────────────────────────────────────────────────────────────
function ChecklistProgressBar({ checklist }) {
  const progress = getChecklistProgress(checklist)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 font-medium">Required: {progress.satisfiedRequired}/{progress.requiredCount}</span>
        <span className="text-gray-400">Total: {progress.satisfiedAll}/{progress.total}</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${progress.allRequiredSatisfied ? 'bg-green-500' : 'bg-blue-500'}`}
          style={{ width: `${progress.requiredPercentage}%` }} />
      </div>
      {progress.allRequiredSatisfied && (
        <p className="text-[10px] text-green-600 font-medium flex items-center gap-1">
          <CheckCircle size={10} /> All required items satisfied
        </p>
      )}
    </div>
  )
}

// ── Case Notes ───────────────────────────────────────────────────────────────
function CaseNotes({ caseId, metadata, isCaseClosed }) {
  const qc = useQueryClient()
  const [newNote, setNewNote] = useState('')
  const notes = (() => {
    try {
      const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
      return Array.isArray(parsed?.notes) ? parsed.notes : []
    } catch { return [] }
  })()
  const noteMut = useMutation({
    mutationFn: (note) => addCaseNote(caseId, { note }),
    onSuccess: () => { toast.success('Note added'); setNewNote(''); qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] }) },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to add note'),
  })
  return (
    <div>
      {!isCaseClosed && (
        <div className="flex gap-2 mb-3">
          <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..."
            onKeyDown={e => { if (e.key === 'Enter' && newNote.trim()) noteMut.mutate(newNote.trim()) }}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-200" />
          <button onClick={() => { if (newNote.trim()) noteMut.mutate(newNote.trim()) }}
            disabled={!newNote.trim() || noteMut.isPending}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">Add</button>
        </div>
      )}
      {notes.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No notes yet</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {[...notes].reverse().map((n, i) => (
            <div key={i} className="px-3 py-2 bg-gray-50 rounded-lg text-xs">
              <p className="text-gray-700">{n.note}</p>
              <div className="flex items-center gap-2 mt-1 text-gray-400">
                <span>{n.author}</span><span>&middot;</span>
                <span>{n.timestamp ? new Date(n.timestamp).toLocaleString() : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Additional Documents (external uploads) ──────────────────────────────────
function AdditionalDocuments({ caseId, onViewDocument }) {
  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ['admin', 'external-uploads', caseId],
    queryFn: () => import('../../api/adminApi').then(m => m.listExternalUploads(caseId)),
    enabled: !!caseId,
    staleTime: 30_000,
    throwOnError: false,
  })

  const uploadList = Array.isArray(uploads) ? uploads : []

  if (isLoading || uploadList.length === 0) return null

  return (
    <div className="mt-6 pt-4 border-t border-gray-100">
      <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <Upload size={14} className="text-purple-500" />
        Additional Documents
        <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">{uploadList.length}</span>
      </h4>
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-gray-600">Document</th>
              <th className="px-3 py-2 text-left text-gray-600">Uploaded By</th>
              <th className="px-3 py-2 text-left text-gray-600">Date</th>
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {uploadList.map(u => (
              <tr key={u.id} className="border-b border-gray-50 last:border-0 bg-purple-50/30">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileText size={12} className="text-purple-400 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-800">{u.originalFilename}</p>
                      {u.description && <p className="text-gray-400 truncate max-w-[200px]">{u.description}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className="text-purple-700">{u.participantName ?? '—'}</span>
                  {u.participantRole && <span className="text-purple-400 ml-1">({u.participantRole})</span>}
                </td>
                <td className="px-3 py-2 text-gray-400">
                  {u.uploadedAt ? new Date(u.uploadedAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-2">
                  {u.documentId && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => onViewDocument?.(u.documentId)}
                        className="text-blue-500 hover:text-blue-700 cursor-pointer" title="Preview">
                        <Eye size={12} />
                      </button>
                      <a href={`/api/documents/${u.documentId}/download`} target="_blank" rel="noreferrer"
                        className="text-gray-400 hover:text-gray-600" title="Download">
                        <Download size={12} />
                      </a>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function CaseDetailPage() {
  const { id: caseId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useUserStore()
  const userRoles = user?.roles ?? []
  const currentUserEmail = user?.email ?? ''
  const isAdmin = userRoles.some(r => r === 'ECM_ADMIN' || r === 'ECM_SUPER_ADMIN')

  const [activeTab, setActiveTab] = useState('checklist')
  const [reasonModal, setReasonModal] = useState(null)
  const [showAssign, setShowAssign] = useState(false)
  const [showRequestDocs, setShowRequestDocs] = useState(false)
  const [viewingDocId, setViewingDocId] = useState(null)

  // Verification checkbox local state
  const [verifiedIds, setVerifiedIds] = useState(new Set())
  const [verifyDirty, setVerifyDirty] = useState(false)

  const { data: caseData, isLoading } = useQuery({
    queryKey: ['admin', 'case', caseId],
    queryFn: () => getCase(caseId),
    enabled: !!caseId,
  })

  // Sync verification state from server when case data loads
  useEffect(() => {
    if (caseData?.checklist) {
      const ids = new Set(caseData.checklist.filter(i => i.isVerified).map(i => i.id))
      setVerifiedIds(ids)
      setVerifyDirty(false)
    }
  }, [caseData])

  const hasActiveWorkflow = (caseData?.checklist ?? []).some(
    i => i.workflowInstanceId && i.workflowStatus === 'ACTIVE'
  )
  useEffect(() => {
    if (!hasActiveWorkflow) return
    const interval = setInterval(() => qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] }), 15_000)
    return () => clearInterval(interval)
  }, [hasActiveWorkflow, caseId, qc])

  const statusMut = useMutation({
    mutationFn: (payload) => updateCaseStatus(caseId, payload),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] }); qc.invalidateQueries({ queryKey: ['admin', 'cases'] }); setReasonModal(null) },
    onError: (e) => toast.error(e?.response?.data?.message || 'Status update failed'),
  })
  const waiveMut = useMutation({
    mutationFn: ({ itemId }) => waiveCaseItem(caseId, itemId, { reason: 'Admin waiver' }),
    onSuccess: () => { toast.success('Item waived'); qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] }) },
  })
  const cancelMut = useMutation({
    mutationFn: () => cancelCase(caseId),
    onSuccess: () => { toast.success('Case cancelled'); qc.invalidateQueries({ queryKey: ['admin', 'cases'] }); navigate('/cases') },
  })
  const deleteMut = useMutation({
    mutationFn: () => deleteCase(caseId),
    onSuccess: () => { toast.success('Case deleted'); qc.invalidateQueries({ queryKey: ['admin', 'cases'] }); navigate('/cases') },
  })

  const verifyMut = useVerifyItems()
  const assignMut = useAssignCase()
  const claimMut = useClaimCase()
  const requestDocsMut = useRequestAdditionalDocs()

  if (isLoading) return <div className="flex items-center justify-center py-32"><Loader2 className="animate-spin text-gray-400 w-8 h-8" /></div>
  if (!caseData) return (
    <div className="flex flex-col items-center justify-center py-32">
      <FolderOpen size={40} className="text-gray-300 mb-3" />
      <p className="text-sm text-gray-500">Case not found</p>
      <Link to="/cases" className="mt-3 text-sm text-blue-600 hover:text-blue-800">Back to Cases</Link>
    </div>
  )

  const c = caseData
  const checklist = c?.checklist ?? []
  const transitions = getAvailableTransitions(c?.status)
  const isCaseClosed = ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(c?.status)
  const actions = STATUS_ACTIONS[c?.status] ?? {}
  const isReturned = !!c?.returnedFromReview

  // Can current user claim this case?
  const isGroupAssigned = !!c.assignedToGroup && !c.claimedBy
  const canClaim = actions.claim && isGroupAssigned

  const toggleVerify = (itemId) => {
    setVerifiedIds(prev => {
      const next = new Set(prev)
      next.has(itemId) ? next.delete(itemId) : next.add(itemId)
      return next
    })
    setVerifyDirty(true)
  }

  const handleSaveVerification = () => {
    verifyMut.mutate({ caseId, payload: { verifiedItemIds: [...verifiedIds] } }, {
      onSuccess: (data) => {
        setVerifyDirty(false)
        if (data?.status === 'UNDER_REVIEW') {
          toast.success('All required items verified. Case moved to Under Review.')
          // Prompt to assign
          setShowAssign(true)
        } else {
          toast.success('Verification saved')
        }
      },
      onError: (e) => toast.error(e?.response?.data?.message || 'Save failed'),
    })
  }

  const handleAssign = (payload) => {
    assignMut.mutate({ caseId, payload }, {
      onSuccess: () => { toast.success('Case assigned'); setShowAssign(false) },
      onError: (e) => toast.error(e?.response?.data?.message || 'Assignment failed'),
    })
  }

  const handleClaim = () => {
    claimMut.mutate({ caseId }, {
      onSuccess: () => toast.success('Case claimed'),
      onError: (e) => toast.error(e?.response?.data?.message || 'Claim failed'),
    })
  }

  const handleRequestDocs = (payload) => {
    requestDocsMut.mutate({ caseId, payload }, {
      onSuccess: () => { toast.success('Additional documents requested'); setShowRequestDocs(false) },
      onError: (e) => toast.error(e?.response?.data?.message || 'Request failed'),
    })
  }

  const TABS = [
    { key: 'checklist',    label: 'Checklist',    icon: CheckCircle, count: checklist.length },
    { key: 'participants', label: 'Participants',  icon: Users },
    { key: 'timeline',     label: 'Timeline',      icon: History },
    { key: 'notes',        label: 'Notes',         icon: MessageSquare },
  ]
  if (isAdmin) TABS.push({ key: 'overrides', label: 'Overrides', icon: ShieldAlert })

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5">
        <Link to="/cases" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Cases
        </Link>
        <ChevronRight size={12} className="text-gray-300" />
        <span className="text-sm font-medium text-gray-800">{c?.externalRef ?? c?.productName ?? 'Case Detail'}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <FolderOpen size={22} className="text-blue-500" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-gray-900">{c?.productName ?? 'Case'}</h1>
                <StatusBadge status={c?.status} />
                {isReturned && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                    <AlertCircle size={10} /> Returned
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {c?.partyDisplayName} &middot; {c?.caseType?.replace(/_/g, ' ')}
                {c?.externalRef && <span className="ml-2 font-mono text-gray-400">{c.externalRef}</span>}
              </p>
            </div>
          </div>

          {/* Top-right actions — gated by STATUS_ACTIONS */}
          <div className="flex items-center gap-2">
            {canClaim && (
              <button onClick={handleClaim} disabled={claimMut.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 cursor-pointer">
                <UserPlus size={12} /> Claim
              </button>
            )}
            {actions.assign && (
              <button onClick={() => setShowAssign(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 cursor-pointer">
                <Send size={12} /> Assign
              </button>
            )}
            {actions.requestDocs && (
              <button onClick={() => setShowRequestDocs(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 cursor-pointer">
                <Plus size={12} /> Request Docs
              </button>
            )}
            {c?.status === 'NEW' && (
              <button onClick={() => { if (confirm('Permanently delete this case?')) deleteMut.mutate() }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">
                <Trash2 size={12} /> Delete
              </button>
            )}
            {!isCaseClosed && c?.status !== 'COMPLETED' && (
              <button onClick={() => { if (confirm('Cancel this case?')) cancelMut.mutate() }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100">
                <XCircle size={12} /> Cancel
              </button>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Customer</p>
            <p className="text-sm font-medium text-gray-800 mt-0.5">{c?.partyDisplayName}</p>
            <p className="text-xs font-mono text-gray-400">{c?.partyExternalId}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Product</p>
            <p className="text-sm text-gray-800 mt-0.5">{c?.productName}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Assigned To</p>
            <p className="text-sm text-gray-800 mt-0.5">
              {c?.claimedByName ?? c?.assignedToName ?? c?.assignedToGroup?.replace('ECM_', '') ?? '—'}
            </p>
            {c?.assignedToGroup && !c?.claimedBy && (
              <p className="text-[10px] text-amber-600 font-medium">Unclaimed (group queue)</p>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Source</p>
            <p className="text-sm text-gray-800 mt-0.5">{c?.sourceSystem}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Opened</p>
            <p className="text-sm text-gray-800 mt-0.5">{c?.openedAt ? new Date(c.openedAt).toLocaleDateString() : '—'}</p>
          </div>
        </div>

        {/* State machine transitions */}
        {transitions.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-2">Available Actions</p>
            <div className="flex flex-wrap gap-2">
              {transitions.map(t => (
                <button key={t.target} onClick={() => t.requiresReason ? setReasonModal({ transition: t }) : statusMut.mutate({ status: t.target })}
                  disabled={statusMut.isPending}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50
                    ${TRANSITION_COLORS[t.target] ?? 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {checklist.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-5">
          <ChecklistProgressBar checklist={checklist} />
        </div>
      )}

      {/* Tabbed content */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 px-2">
          {TABS.map(tab => {
            const TabIcon = tab.icon
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                <TabIcon size={14} />
                {tab.label}
                {tab.count != null && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{tab.count}</span>}
              </button>
            )
          })}
        </div>

        <div className="p-5">
          {activeTab === 'checklist' && (
            <div>
              {checklist.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-6 bg-amber-50 rounded-lg border border-amber-100">
                  <AlertCircle size={14} className="text-amber-500" />
                  <p className="text-xs text-amber-700">No document types configured for this product.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {checklist.map(item => (
                      <div key={item.id} className="flex items-start gap-3">
                        {/* Verification checkbox */}
                        <div className="pt-3.5 flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={verifiedIds.has(item.id)}
                            onChange={() => toggleVerify(item.id)}
                            disabled={isCaseClosed || item.status === 'PENDING'}
                            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-30"
                            title={item.status === 'PENDING' ? 'Upload a document first' : 'Mark as verified'}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <ChecklistItemRow
                            item={item} caseId={caseId} caseStatus={c?.status}
                            partyExternalId={c?.partyExternalId} isAdmin={isAdmin}
                            onWaive={() => waiveMut.mutate({ itemId: item.id })}
                            onViewDocument={(docId) => setViewingDocId(docId)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Save Verification button */}
                  {!isCaseClosed && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-400">
                        {verifiedIds.size} of {checklist.length} items verified
                        {verifyDirty && <span className="text-amber-500 ml-2">Unsaved changes</span>}
                      </p>
                      <button onClick={handleSaveVerification}
                        disabled={!verifyDirty || verifyMut.isPending}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        {verifyMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save Verification
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Additional Documents — external uploads */}
              <AdditionalDocuments caseId={caseId} onViewDocument={(docId) => setViewingDocId(docId)} />
            </div>
          )}

          {activeTab === 'participants' && <CaseParticipants caseId={caseId} checklist={checklist} isCaseClosed={isCaseClosed} />}
          {activeTab === 'timeline' && <CaseTimeline caseId={caseId} />}
          {activeTab === 'notes' && <CaseNotes caseId={caseId} metadata={c?.metadata} isCaseClosed={isCaseClosed} />}
          {activeTab === 'overrides' && isAdmin && <OverrideReviewPanel caseId={caseId} />}
        </div>
      </div>

      {/* Modals */}
      {reasonModal && (
        <TransitionReasonModal transition={reasonModal.transition} isPending={statusMut.isPending}
          onSubmit={(reason) => statusMut.mutate({ status: reasonModal.transition.target, reason })}
          onClose={() => setReasonModal(null)} />
      )}
      {showAssign && (
        <AssignModal onSubmit={handleAssign} isPending={assignMut.isPending} onClose={() => setShowAssign(false)} />
      )}
      {showRequestDocs && (
        <RequestDocsModal caseData={c} onSubmit={handleRequestDocs} isPending={requestDocsMut.isPending}
          onClose={() => setShowRequestDocs(false)} />
      )}
      {viewingDocId && (
        <DocumentViewerModal documentId={viewingDocId} onClose={() => setViewingDocId(null)} previewOnly />
      )}
    </div>
  )
}
