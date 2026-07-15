/**
 * CasesPage.jsx
 * Route: /cases
 *
 * Case (loan application / account opening) management.
 * - List cases with status filter
 * - Create case: select customer + product → auto-populates checklist
 * - Case detail: view checklist, link documents, waive items, update status
 * - State machine transitions (role-aware)
 * - Checklist → workflow bridge with inline status badges
 * - Override request / admin bypass flow
 * - Tabbed detail panel: Checklist | Timeline | Notes
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, FolderOpen, User, Package, CheckCircle, XCircle, Clock, Search,
  FileText, ChevronRight, Loader2, X, AlertCircle, Check, Ban, Trash2,
  Upload, Eye, Link2, PenLine, ShieldAlert, History, MessageSquare, FileSignature,
  Play, Lock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  listCases, getCase, createCase, updateCaseStatus, linkCaseDocument, waiveCaseItem,
  addCaseNote, cancelCase, deleteCase, getProducts, listCustomers, sendForSignature,
  addChecklistItem, startChecklistWorkflow, completeChecklistItem, reopenChecklistItem,
} from '../../api/adminApi'
import { uploadDocuments, listDocuments } from '../../api/documentsApi'
import useUserStore from '../../store/userStore'
import { getAvailableTransitions, getChecklistProgress, TRANSITION_COLORS } from '../../utils/caseStateMachine'
import WorkflowStatusBadge from '../../components/cases/WorkflowStatusBadge'
import CaseTimeline from '../../components/cases/CaseTimeline'
import OverrideRequestModal from '../../components/cases/OverrideRequestModal'
import OverrideReviewPanel from '../../components/cases/OverrideReviewPanel'
import DocumentViewerModal from '../../components/documents/DocumentViewerModal'
import {
  useRequestOverride, useAdminBypassItem,
} from '../../hooks/useAdmin'

// ── Status config ────────────────────────────────────────────────────────────
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
  // Legacy
  OPEN:               'bg-blue-50 text-blue-700 border-blue-200',
  DOCUMENTS_PENDING:  'bg-amber-50 text-amber-700 border-amber-200',
}

const CHECKLIST_STATUS_COLORS = {
  PENDING:            'bg-gray-100 text-gray-500',
  UPLOADED:           'bg-blue-50 text-blue-600',
  UNDER_REVIEW:       'bg-amber-50 text-amber-600',
  PENDING_SIGNATURE:  'bg-purple-50 text-purple-600',
  SIGNED:             'bg-teal-50 text-teal-600',
  APPROVED:           'bg-green-50 text-green-600',
  REJECTED:           'bg-red-50 text-red-500',
  WAIVED:             'bg-gray-100 text-gray-400',
}

const OVERRIDE_STATUS_COLORS = {
  PENDING:  'bg-amber-50 text-amber-600 border-amber-200',
  APPROVED: 'bg-green-50 text-green-600 border-green-200',
  DENIED:   'bg-red-50 text-red-500 border-red-200',
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {status}
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
          <h3 className="font-semibold text-gray-900">
            {transition.label ?? transition.target.replace(/_/g, ' ')}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">This transition requires a reason</p>
        </div>
        <div className="px-6 py-4">
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Enter reason..."
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSubmit(reason)}
            disabled={!reason.trim() || isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Updating...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create Case Modal ────────────────────────────────────────────────────────
function CreateCaseModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    partyId: '', productId: '', caseType: 'LOAN_ORIGINATION', externalRef: '',
  })
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDrop, setShowCustomerDrop] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const { data: customers } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: () => listCustomers({ q: customerSearch, size: 8 }),
    enabled: customerSearch.length >= 2,
  })
  const { data: products } = useQuery({
    queryKey: ['admin', 'products', 'all'],
    queryFn: () => getProducts().then(d => Array.isArray(d) ? d : (d?.content ?? [])),
  })

  const createMut = useMutation({
    mutationFn: (payload) => createCase(payload),
    onSuccess: () => {
      toast.success('Case created')
      qc.invalidateQueries({ queryKey: ['admin', 'cases'] })
      onClose()
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Create failed'),
  })

  const customerList = Array.isArray(customers) ? customers : (customers?.content ?? [])

  const handleCreate = () => {
    if (!form.partyId || !form.productId) { toast.error('Customer and Product are required'); return }
    createMut.mutate(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">New Case</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Customer search */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Customer *</label>
            {selectedCustomer ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
                <User size={14} className="text-indigo-500" />
                <span className="text-sm font-medium text-indigo-900">{selectedCustomer.displayName}</span>
                <span className="text-xs text-indigo-500">{selectedCustomer.customerRef}</span>
                <button onClick={() => { setSelectedCustomer(null); setForm(f => ({ ...f, partyId: '' })); setCustomerSearch('') }}
                  className="ml-auto text-indigo-400 hover:text-indigo-600"><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <input value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true) }}
                  placeholder="Search customer..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                {showCustomerDrop && customerSearch.length >= 2 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {customerList.map(c => (
                      <button key={c.id} onClick={() => {
                        setSelectedCustomer(c); setForm(f => ({ ...f, partyId: c.id })); setShowCustomerDrop(false); setCustomerSearch(c.displayName)
                      }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm">
                        <User size={12} className="text-gray-400" />
                        <span>{c.displayName}</span>
                        <span className="text-xs text-gray-400 ml-auto">{c.customerRef}</span>
                      </button>
                    ))}
                    {customerList.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No customers found</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Product */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Product *</label>
            <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">Select product...</option>
              {(products ?? []).filter(p => p.isActive).map(p => (
                <option key={p.id} value={p.id}>{p.displayName} ({p.productCode})</option>
              ))}
            </select>
          </div>

          {/* Case type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Case Type</label>
            <select value={form.caseType} onChange={e => setForm(f => ({ ...f, caseType: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="LOAN_ORIGINATION">Loan Origination</option>
              <option value="ACCOUNT_OPENING">Account Opening</option>
              <option value="KYC_REVIEW">KYC Review</option>
              <option value="GENERAL">General</option>
            </select>
          </div>

          {/* External ref */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">External Reference (optional)</label>
            <input value={form.externalRef} onChange={e => setForm(f => ({ ...f, externalRef: e.target.value }))}
              placeholder="e.g. LOAN-2026-00142"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleCreate} disabled={createMut.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {createMut.isPending ? 'Creating...' : 'Create Case'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Checklist Item Row ────────────────────────────────────────────────────────
export function ChecklistItemRow({ item, caseId, caseStatus, partyExternalId, onWaive, isAdmin, onViewDocument, onViewWorkflow }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [showLinkPicker, setShowLinkPicker] = useState(false)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [showSignModal, setShowSignModal] = useState(false)
  const [signPending, setSignPending] = useState(false)

  const requestOverrideMut = useRequestOverride()
  const adminBypassMut = useAdminBypassItem()

  // Fetch customer's existing documents for "Link Existing"
  const { data: existingDocs } = useQuery({
    queryKey: ['documents', 'party', partyExternalId, 'for-link'],
    queryFn: () => listDocuments({ partyExternalId, size: 20 }),
    enabled: showLinkPicker && !!partyExternalId,
  })

  const linkMut = useMutation({
    mutationFn: (documentId) => linkCaseDocument(caseId, { checklistItemId: item.id, documentId }),
    onSuccess: () => {
      toast.success('Document linked')
      qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] })
      setShowLinkPicker(false)
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Link failed'),
  })

  // Upload file directly from case
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const metadata = {
        name: `${item.documentTypeName} — ${item.documentTypeCode}`,
        partyExternalId: partyExternalId || undefined,
        categoryId: item.categoryId || undefined,
        skipWorkflow: true,  // case documents are reviewed via case flow, not standalone workflow
      }
      const result = await uploadDocuments([file], metadata)
      const docData = result?.data ?? result
      const docId = docData?.id
      if (docId) {
        await linkCaseDocument(caseId, { checklistItemId: item.id, documentId: docId })
        toast.success('Document uploaded and linked')
        qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] })
      } else {
        toast.error('Upload succeeded but could not link — no document ID returned')
      }
    } catch (err) {
      toast.error(err?.message || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleOverrideSubmit = (reason) => {
    if (isAdmin) {
      adminBypassMut.mutate(
        { caseId, itemId: item.id, payload: { reason } },
        {
          onSuccess: () => { toast.success('Item bypassed'); setShowOverrideModal(false) },
          onError: (e) => toast.error(e?.response?.data?.message || 'Bypass failed'),
        }
      )
    } else {
      requestOverrideMut.mutate(
        { caseId, itemId: item.id, payload: { reason } },
        {
          onSuccess: () => { toast.success('Override requested'); setShowOverrideModal(false) },
          onError: (e) => toast.error(e?.response?.data?.message || 'Request failed'),
        }
      )
    }
  }

  const isPending = item.status === 'PENDING'
  const hasDoc = !!item.documentId
  const isEform = item.sourceType === 'EFORM'
  const isCaseClosed = ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(caseStatus)
  const isCaseStarted = !['NEW'].includes(caseStatus) && !isCaseClosed
  const canAct = isPending && isCaseStarted
  const hasActiveWorkflow = !!item.workflowInstanceId && item.workflowStatus === 'ACTIVE'
  const isLocked = item.status === 'PENDING_SIGNATURE' || hasActiveWorkflow

  const isCompleted = item.status === 'APPROVED' || item.status === 'WAIVED'

  return (
    <div className={`rounded-lg border p-3 ${isCompleted ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2">
        {/* Left: item info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isCompleted && <CheckCircle size={14} className="text-green-500 shrink-0" />}
            <p className={`text-sm font-medium ${isCompleted ? 'text-gray-500' : 'text-gray-800'}`}>{item.documentTypeName}</p>
            {item.isRequired && (
              <span className="text-[10px] text-red-500 font-medium bg-red-50 px-1.5 py-0.5 rounded">Required</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              isEform ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'
            }`}>{item.sourceType}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              CHECKLIST_STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-500'
            }`}>{item.status}</span>

            {/* Override status badge */}
            {item.overrideStatus && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                OVERRIDE_STATUS_COLORS[item.overrideStatus] ?? 'bg-gray-100 text-gray-500'
              }`}>
                Override {item.overrideStatus}
              </span>
            )}
          </div>

          {/* Workflow status badge + view flow button */}
          {item.workflowInstanceId && (
            <div className="mt-1.5 flex items-center gap-2">
              <WorkflowStatusBadge
                workflowStatus={item.workflowStatus}
                currentTaskName={item.currentTaskName}
                currentTaskAssignee={item.currentTaskAssignee}
              />
              {onViewWorkflow && (
                <button onClick={() => onViewWorkflow(item.workflowInstanceId)}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium hover:underline cursor-pointer">
                  View Flow
                </button>
              )}
            </div>
          )}

          {item.documentName && (
            <p className="text-xs text-blue-600 mt-1 truncate flex items-center gap-1">
              <FileText size={10} /> {item.documentName}
            </p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Completed — show check */}
          {hasDoc && (
            <div className="flex items-center gap-1">
              <Check size={14} className="text-green-500" />
              <button onClick={() => onViewDocument ? onViewDocument(item.documentId) : window.open(`/documents?search=${item.documentId}`, '_blank')}
                className="text-blue-500 hover:text-blue-700 cursor-pointer" title="View document">
                <Eye size={13} />
              </button>
            </div>
          )}

          {/* ── PENDING: Upload / Fill Form ── */}
          {canAct && !isEform && (
            <>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff" />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50">
                {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                Upload
              </button>
              <button onClick={() => setShowLinkPicker(v => !v)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">
                <Link2 size={11} /> Link
              </button>
            </>
          )}

          {canAct && isEform && (
            <button onClick={() => {
              const params = new URLSearchParams()
              params.set('caseId', caseId)
              params.set('checklistItemId', item.id)
              if (partyExternalId) params.set('partyRef', partyExternalId)
              navigate(item.formKey
                ? `/eforms/fill/${item.formKey}?${params.toString()}`
                : '/eforms')
            }}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100">
              <PenLine size={11} /> Fill Form
            </button>
          )}

          {/* ── UPLOADED: Decision Menu — what to do next ── */}
          {hasDoc && isCaseStarted && !isLocked && item.status !== 'APPROVED' && item.status !== 'WAIVED' && (
            <ItemActionMenu
              item={item}
              caseId={caseId}
              isAdmin={isAdmin}
              onSendForSignature={() => setShowSignModal(true)}
              onStartWorkflow={() => {
                startChecklistWorkflow(caseId, item.id)
                  .then(() => { toast.success('Workflow started'); qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] }) })
                  .catch(e => toast.error(e?.response?.data?.message || e.message || 'Failed to start workflow'))
              }}
              onMarkComplete={() => {
                completeChecklistItem(caseId, item.id)
                  .then(() => { toast.success('Marked complete'); qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] }) })
                  .catch(e => toast.error(e?.response?.data?.message || 'Failed'))
              }}
              onOverride={() => setShowOverrideModal(true)}
              onWaive={onWaive}
            />
          )}

          {/* ── Status indicators ── */}
          {item.status === 'SIGNED' && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle size={10} /> Signed
            </span>
          )}

          {item.status === 'APPROVED' && isCaseStarted && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-green-600 font-medium">Completed</span>
              {item.reviewedBy && (
                <span className="text-[9px] text-gray-400">by {item.reviewedBy?.split('@')[0]}</span>
              )}
              <button onClick={() => {
                reopenChecklistItem(caseId, item.id)
                  .then(() => { toast.success('Item reopened'); qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] }) })
                  .catch(e => toast.error(e?.response?.data?.message || 'Failed'))
              }}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Reopen for re-review">
                Reopen
              </button>
            </div>
          )}

          {/* Lock indicator — under signature or workflow */}
          {isLocked && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg">
              {item.status === 'PENDING_SIGNATURE' ? <><FileSignature size={10} /> Awaiting Signature</> :
               hasActiveWorkflow ? <><Clock size={10} /> Under Review</> : null}
            </span>
          )}

          {/* Case not started — prompt to start working */}
          {isPending && caseStatus === 'NEW' && (
            <span className="text-[10px] text-gray-400 italic">Start working to enable actions</span>
          )}

          {/* Locked indicator for closed cases */}
          {isPending && isCaseClosed && (
            <span className="text-[10px] text-gray-400 italic">Case closed</span>
          )}
        </div>
      </div>

      {/* Link Existing picker */}
      {showLinkPicker && (
        <div className="mt-2 border-t pt-2">
          <p className="text-xs font-medium text-gray-600 mb-1">Link an existing document:</p>
          {!existingDocs ? (
            <p className="text-xs text-gray-400">Loading...</p>
          ) : (existingDocs?.content ?? []).length === 0 ? (
            <p className="text-xs text-gray-400">No documents found for this customer</p>
          ) : (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {(existingDocs?.content ?? []).map(doc => (
                <button key={doc.id} onClick={() => linkMut.mutate(doc.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-blue-50 rounded text-xs">
                  <FileText size={11} className="text-gray-400 flex-shrink-0" />
                  <span className="flex-1 truncate text-gray-700">{doc.name || doc.originalFilename}</span>
                  <span className="text-gray-400 flex-shrink-0">
                    {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowLinkPicker(false)}
            className="mt-1 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      )}

      {/* Override request modal */}
      {showOverrideModal && (
        <OverrideRequestModal
          itemName={item.documentTypeName}
          isAdminBypass={isAdmin}
          isPending={isAdmin ? adminBypassMut.isPending : requestOverrideMut.isPending}
          onSubmit={handleOverrideSubmit}
          onClose={() => setShowOverrideModal(false)}
        />
      )}

      {/* Send for Signature modal */}
      {showSignModal && (
        <SendForSignatureModal
          docName={item.documentName || item.documentTypeName}
          isPending={signPending}
          onClose={() => setShowSignModal(false)}
          onSubmit={async (payload) => {
            setSignPending(true)
            try {
              await sendForSignature(caseId, item.id, payload)
              toast.success('Sent for signature')
              qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] })
              setShowSignModal(false)
            } catch (e) {
              toast.error(e?.response?.data?.message || e.message || 'Failed to send for signature')
            } finally {
              setSignPending(false)
            }
          }}
        />
      )}
    </div>
  )
}

// ── Checklist Progress Bar ───────────────────────────────────────────────────
function ChecklistProgressBar({ checklist }) {
  const progress = getChecklistProgress(checklist)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 font-medium">
          Required: {progress.satisfiedRequired}/{progress.requiredCount}
        </span>
        <span className="text-gray-400">
          Total: {progress.satisfiedAll}/{progress.total}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            progress.allRequiredSatisfied ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progress.requiredPercentage}%` }}
        />
      </div>
      {progress.allRequiredSatisfied && (
        <p className="text-[10px] text-green-600 font-medium flex items-center gap-1">
          <CheckCircle size={10} /> All required items satisfied
        </p>
      )}
    </div>
  )
}

// ── Send for Signature Modal ──────────────────────────────────────────────────
function SendForSignatureModal({ docName, onSubmit, onClose, isPending }) {
  const [signerEmail, setSignerEmail] = useState('')
  const [signerName, setSignerName] = useState('')
  const [placement, setPlacement] = useState('lastPage')
  const [sigPage, setSigPage] = useState('1')
  const [sigX, setSigX] = useState('100')
  const [sigY, setSigY] = useState('700')
  const [requireInitials, setRequireInitials] = useState(false)
  const [requireDateSigned, setRequireDateSigned] = useState(false)
  const [emailSubject, setEmailSubject] = useState(`Please sign: ${docName || 'Document'}`)

  const canSubmit = signerEmail.trim().includes('@') && signerName.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-purple-50 border-b border-purple-100">
          <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
            <FileSignature size={16} /> Send for Signature
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Signer info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Signer Email *</label>
              <input value={signerEmail} onChange={e => setSignerEmail(e.target.value)}
                placeholder="signer@company.com" type="email"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-purple-400 focus:border-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Signer Name *</label>
              <input value={signerName} onChange={e => setSignerName(e.target.value)}
                placeholder="John Smith"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-purple-400 focus:border-purple-400" />
            </div>
          </div>

          {/* Signature Placement */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Signature Placement</label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input type="radio" name="placement" value="auto" checked={placement === 'auto'}
                  onChange={e => setPlacement(e.target.value)} className="text-purple-600" />
                Auto-detect <span className="text-gray-400">(use anchor markers if present in PDF)</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input type="radio" name="placement" value="lastPage" checked={placement === 'lastPage'}
                  onChange={e => setPlacement(e.target.value)} className="text-purple-600" />
                Last page, bottom <span className="text-gray-400">(default — works for most documents)</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input type="radio" name="placement" value="specific" checked={placement === 'specific'}
                  onChange={e => setPlacement(e.target.value)} className="text-purple-600" />
                Specific position
              </label>
            </div>

            {placement === 'specific' && (
              <div className="grid grid-cols-3 gap-2 mt-2 ml-5">
                <div>
                  <label className="text-[10px] text-gray-500">Page</label>
                  <input value={sigPage} onChange={e => setSigPage(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">X Position</label>
                  <input value={sigX} onChange={e => setSigX(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Y Position</label>
                  <input value={sigY} onChange={e => setSigY(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1" />
                </div>
              </div>
            )}
          </div>

          {/* Optional tabs */}
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={requireInitials} onChange={e => setRequireInitials(e.target.checked)}
                className="rounded border-gray-300 text-purple-600" />
              Require initials
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={requireDateSigned} onChange={e => setRequireDateSigned(e.target.checked)}
                className="rounded border-gray-300 text-purple-600" />
              Require date signed
            </label>
          </div>

          {/* Email subject */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email Subject</label>
            <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-purple-400 focus:border-purple-400" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-gray-50 border-t">
          <button onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => onSubmit({
              signerEmail: signerEmail.trim(),
              signerName: signerName.trim(),
              placement,
              signaturePage: placement === 'specific' ? sigPage : null,
              signatureX: placement === 'specific' ? sigX : null,
              signatureY: placement === 'specific' ? sigY : null,
              requireInitials,
              requireDateSigned,
              emailSubject,
            })}
            disabled={!canSubmit || isPending}
            className="px-4 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5">
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <FileSignature size={12} />}
            Send for Signature
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Item Action Menu (decision dropdown) ─────────────────────────────────────
// eslint-disable-next-line no-unused-vars
function ItemActionMenu({ item, caseId, isAdmin, onSendForSignature, onStartWorkflow, onMarkComplete, onOverride, onWaive }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const hasWorkflow = !!item.workflowDefinitionId

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm">
        Actions <ChevronRight size={10} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          {hasWorkflow && (
            <button onClick={() => { setOpen(false); onStartWorkflow() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-blue-50 text-blue-700">
              <Play size={12} /> Start Workflow
              <span className="text-[9px] text-gray-400 ml-auto">Auto-review</span>
            </button>
          )}

          <button onClick={() => { setOpen(false); onSendForSignature() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-purple-50 text-purple-700">
            <FileSignature size={12} /> Send for Signature
          </button>

          <button onClick={() => { setOpen(false); onMarkComplete() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-green-50 text-green-700">
            <CheckCircle size={12} /> Mark as Complete
            <span className="text-[9px] text-gray-400 ml-auto">Self-certify</span>
          </button>

          <div className="border-t border-gray-100 my-1" />

          {!item.overrideStatus && (
            <button onClick={() => { setOpen(false); onOverride() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-orange-50 text-orange-600">
              <ShieldAlert size={12} /> {isAdmin ? 'Admin Bypass' : 'Request Override'}
            </button>
          )}

          <button onClick={() => { setOpen(false); if (confirm('Waive this requirement?')) onWaive() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50 text-gray-500">
            <Ban size={12} /> Waive Requirement
          </button>
        </div>
      )}
    </div>
  )
}

// ── Add Checklist Item Button ────────────────────────────────────────────────
function AddChecklistItemButton({ caseId }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('category') // 'category' | 'custom'
  const [categoryId, setCategoryId] = useState('')
  const [customName, setCustomName] = useState('')
  const [isRequired, setIsRequired] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Fetch available categories
  const { data: categories } = useQuery({
    queryKey: ['admin', 'categories', 'flat'],
    queryFn: () => import('../../api/adminApi').then(m => m.getCategories(true)),
    enabled: open,
    staleTime: 60_000,
  })

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await addChecklistItem(caseId, {
        categoryId: mode === 'category' ? Number(categoryId) : null,
        customName: mode === 'custom' ? customName : null,
        isRequired,
      })
      toast.success('Document request added')
      qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] })
      setOpen(false)
      setCategoryId('')
      setCustomName('')
      setIsRequired(false)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to add item')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 py-2 mt-1 text-xs font-medium
                   text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-lg
                   hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors">
        <Plus size={12} /> Add Document Request
      </button>
    )
  }

  return (
    <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Add Document Request</p>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button onClick={() => setMode('category')}
          className={`px-2 py-1 text-[10px] font-medium rounded ${mode === 'category' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
          From Category
        </button>
        <button onClick={() => setMode('custom')}
          className={`px-2 py-1 text-[10px] font-medium rounded ${mode === 'custom' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
          Custom Name
        </button>
      </div>

      {mode === 'category' ? (
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
          className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5">
          <option value="">Select document category...</option>
          {(Array.isArray(categories) ? categories : []).map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      ) : (
        <input value={customName} onChange={e => setCustomName(e.target.value)}
          placeholder="e.g. Power of Attorney, Bank Statement"
          className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5" />
      )}

      <label className="flex items-center gap-1.5 text-xs text-gray-600">
        <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)}
          className="rounded border-gray-300" />
        Required document
      </label>

      <button onClick={handleSubmit}
        disabled={submitting || (mode === 'category' ? !categoryId : !customName.trim())}
        className="w-full flex items-center justify-center gap-1 py-1.5 text-xs font-medium
                   text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
        {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
        Add to Checklist
      </button>
    </div>
  )
}

// ── Case Detail Panel ────────────────────────────────────────────────────────
function CaseDetailPanel({ caseId, onClose }) {
  const qc = useQueryClient()
  const { user } = useUserStore()
  const userRoles = user?.roles ?? []
  const isAdmin = userRoles.some(r => r === 'ECM_ADMIN' || r === 'ECM_SUPER_ADMIN')
  const [activeTab, setActiveTab] = useState('checklist')
  const [reasonModal, setReasonModal] = useState(null) // { transition }
  const [viewingDocId, setViewingDocId] = useState(null) // opens DocumentViewerModal with case context

  // Determine if any checklist item has an active workflow for polling
  const { data: caseData, isLoading } = useQuery({
    queryKey: ['admin', 'case', caseId],
    queryFn: () => getCase(caseId),
    enabled: !!caseId,
  })

  const hasActiveWorkflow = (caseData?.checklist ?? []).some(
    i => i.workflowInstanceId && i.workflowStatus === 'ACTIVE'
  )

  // Poll every 15s when workflows are active
  useEffect(() => {
    if (!hasActiveWorkflow) return
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] })
    }, 15_000)
    return () => clearInterval(interval)
  }, [hasActiveWorkflow, caseId, qc])

  const statusMut = useMutation({
    mutationFn: (payload) => updateCaseStatus(caseId, payload),
    onSuccess: () => {
      toast.success('Status updated')
      qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] })
      qc.invalidateQueries({ queryKey: ['admin', 'cases'] })
      setReasonModal(null)
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Status update failed'),
  })

  const waiveMut = useMutation({
    mutationFn: ({ itemId }) => waiveCaseItem(caseId, itemId, { reason: 'Admin waiver' }),
    onSuccess: () => { toast.success('Item waived'); qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] }) },
  })

  const cancelMut = useMutation({
    mutationFn: () => cancelCase(caseId),
    onSuccess: () => { toast.success('Case cancelled'); qc.invalidateQueries({ queryKey: ['admin', 'cases'] }); onClose() },
    onError: (e) => toast.error(e?.response?.data?.message || 'Cancel failed'),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteCase(caseId),
    onSuccess: () => { toast.success('Case deleted'); qc.invalidateQueries({ queryKey: ['admin', 'cases'] }); onClose() },
    onError: (e) => toast.error(e?.response?.data?.message || 'Delete failed'),
  })

  if (isLoading) return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[560px] bg-white shadow-2xl flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" />
      </div>
    </div>
  )

  const c = caseData
  const checklist = c?.checklist ?? []
  const transitions = getAvailableTransitions(c?.status, userRoles)

  const handleTransitionClick = (transition) => {
    if (transition.requiresReason) {
      setReasonModal({ transition })
    } else {
      statusMut.mutate({ status: transition.target })
    }
  }

  const TABS = [
    { key: 'checklist', label: 'Checklist', icon: CheckCircle },
    { key: 'timeline',  label: 'Timeline',  icon: History },
    { key: 'notes',     label: 'Notes',     icon: MessageSquare },
  ]

  // Add overrides tab for admins
  if (isAdmin) {
    TABS.push({ key: 'overrides', label: 'Overrides', icon: ShieldAlert })
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[560px] bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-blue-500" />
            <h2 className="text-base font-semibold text-gray-900">{c?.productName ?? 'Case'}</h2>
            <StatusBadge status={c?.status} />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-5">
          {/* Case info */}
          <div className="space-y-2 text-sm">
            <div className="flex gap-2"><span className="text-gray-500 w-28">Customer</span><span className="text-gray-800 font-medium">{c?.partyDisplayName}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Customer Ref</span><span className="font-mono text-gray-600">{c?.partyExternalId}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Product</span><span className="text-gray-800">{c?.productName}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Type</span><span className="text-gray-600">{c?.caseType}</span></div>
            {c?.externalRef && <div className="flex gap-2"><span className="text-gray-500 w-28">External Ref</span><span className="font-mono text-gray-600">{c.externalRef}</span></div>}
            <div className="flex gap-2"><span className="text-gray-500 w-28">Source</span><span className="text-gray-600">{c?.sourceSystem}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Opened</span><span className="text-gray-600">{c?.openedAt ? new Date(c.openedAt).toLocaleString() : '—'}</span></div>
          </div>

          {/* State machine transitions */}
          {transitions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Available Actions</p>
              <div className="flex flex-wrap gap-2">
                {transitions.map(t => (
                  <button
                    key={t.target}
                    onClick={() => handleTransitionClick(t)}
                    disabled={statusMut.isPending}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50
                      ${TRANSITION_COLORS[t.target] ?? 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Checklist progress bar */}
          {checklist.length > 0 && (
            <ChecklistProgressBar checklist={checklist} />
          )}

          {/* Tab bar */}
          <div className="flex border-b border-gray-200">
            {TABS.map(tab => {
              const TabIcon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <TabIcon size={13} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          {activeTab === 'checklist' && (
            <div>
              {checklist.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-4 bg-amber-50 rounded-lg border border-amber-100">
                  <AlertCircle size={14} className="text-amber-500" />
                  <p className="text-xs text-amber-700">No document types configured for this product. Add document types in Admin → Products.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {checklist.map(item => (
                    <ChecklistItemRow
                      key={item.id}
                      item={item}
                      caseId={caseId}
                      caseStatus={c?.status}
                      partyExternalId={c?.partyExternalId}
                      isAdmin={isAdmin}
                      onWaive={() => waiveMut.mutate({ itemId: item.id })}
                      onViewDocument={(docId) => setViewingDocId(docId)}
                    />
                  ))}

                  {/* Add Document Request — only when case is in progress */}
                  {['IN_PROGRESS', 'UNDER_REVIEW'].includes(c?.status) && (
                    <AddChecklistItemButton caseId={caseId} />
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <CaseTimeline caseId={caseId} />
          )}

          {activeTab === 'notes' && (
            <CaseNotes caseId={caseId} metadata={c?.metadata} isCaseClosed={['COMPLETED', 'CANCELLED', 'REJECTED'].includes(c?.status)} />
          )}

          {activeTab === 'overrides' && isAdmin && (
            <OverrideReviewPanel caseId={caseId} />
          )}
        </div>

        {/* Footer actions — Delete / Cancel */}
        {c?.status && !['COMPLETED', 'CANCELLED'].includes(c.status) && (
          <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              Case ID: <span className="font-mono">{caseId?.toString().substring(0, 8)}</span>
            </div>
            <div className="flex items-center gap-2">
              {(c.status === 'NEW' || c.status === 'OPEN') && (
                <button onClick={() => { if (confirm('Permanently delete this case? This cannot be undone.')) deleteMut.mutate() }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">
                  <Trash2 size={12} /> Delete Case
                </button>
              )}
              <button onClick={() => { if (confirm('Cancel this case? It will be marked as cancelled.')) cancelMut.mutate() }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100">
                <XCircle size={12} /> Cancel Case
              </button>
            </div>
          </div>
        )}

        {/* Closed case footer */}
        {c?.status && ['COMPLETED', 'CANCELLED'].includes(c.status) && (
          <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              Case ID: <span className="font-mono">{caseId?.toString().substring(0, 8)}</span>
            </div>
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${
              c.status === 'COMPLETED' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>{c.status === 'COMPLETED' ? 'Case Completed' : 'Case Cancelled'}</span>
          </div>
        )}
      </div>

      {/* Transition reason modal */}
      {reasonModal && (
        <TransitionReasonModal
          transition={reasonModal.transition}
          isPending={statusMut.isPending}
          onSubmit={(reason) => statusMut.mutate({ status: reasonModal.transition.target, reason })}
          onClose={() => setReasonModal(null)}
        />
      )}

      {/* Document viewer with annotation support (case context) */}
      {viewingDocId && (
        <DocumentViewerModal
          documentId={viewingDocId}
          caseId={caseId}
          onClose={() => setViewingDocId(null)}
        />
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
    onSuccess: () => {
      toast.success('Note added')
      setNewNote('')
      qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] })
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to add note'),
  })

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-800 mb-2">Notes & Activity</h4>

      {/* Add note input */}
      {!isCaseClosed && (
        <div className="flex gap-2 mb-3">
          <input value={newNote} onChange={e => setNewNote(e.target.value)}
            placeholder="Add a note..."
            onKeyDown={e => { if (e.key === 'Enter' && newNote.trim()) noteMut.mutate(newNote.trim()) }}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-200" />
          <button onClick={() => { if (newNote.trim()) noteMut.mutate(newNote.trim()) }}
            disabled={!newNote.trim() || noteMut.isPending}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            Add
          </button>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No notes yet</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {[...notes].reverse().map((n, i) => (
            <div key={i} className="px-3 py-2 bg-gray-50 rounded-lg text-xs">
              <p className="text-gray-700">{n.note}</p>
              <div className="flex items-center gap-2 mt-1 text-gray-400">
                <span>{n.author}</span>
                <span>&middot;</span>
                <span>{n.timestamp ? new Date(n.timestamp).toLocaleString() : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Case Table (shared between tabs) ─────────────────────────────────────────
// ── Case Owner Badge ──────────────────────────────────────────────────────────
function CaseOwnerBadge({ caseData: c }) {
  const isClosed = ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(c.status)
  if (isClosed) return <span className="text-xs text-gray-300">—</span>

  // Actively working (claimed)
  if (c.claimedByName || c.claimedBy) {
    const name = c.claimedByName || c.claimedBy?.split('@')[0]
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full" title={c.claimedBy}>
        {name}
      </span>
    )
  }

  // Assigned to person (not yet started)
  if (c.assignedToName || c.assignedTo) {
    const name = c.assignedToName || c.assignedTo?.split('@')[0]
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full" title={c.assignedTo}>
        → {name}
      </span>
    )
  }

  // Assigned to group (unclaimed)
  if (c.assignedToGroup) {
    const group = c.assignedToGroup.replace('ECM_', '').replace(/_/g, ' ')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
        → {group}
      </span>
    )
  }

  // Unassigned
  return <span className="text-xs text-gray-400 italic">Unassigned</span>
}

function CaseTable({ cases, isLoading, emptyMessage, navigate }) {
  const caseList = Array.isArray(cases) ? cases : []
  if (isLoading) return (
    <div className="flex items-center justify-center py-16 text-gray-400">
      <Loader2 size={20} className="animate-spin mr-2" /> Loading...
    </div>
  )
  if (caseList.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16">
      <FolderOpen size={36} className="text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-600">No cases found</p>
      <p className="text-xs text-gray-400 mt-1">{emptyMessage}</p>
    </div>
  )
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b bg-gray-50">
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Customer</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Product</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Type</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Ref</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Owner</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Opened</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {caseList.map(c => (
          <tr key={c.id} onClick={() => navigate(`/cases/${c.id}`)}
            className="hover:bg-blue-50 cursor-pointer transition-colors">
            <td className="px-4 py-3">
              <p className="text-sm font-medium text-gray-800">{c.partyDisplayName ?? '—'}</p>
              <p className="text-xs text-gray-400 font-mono">{c.partyExternalId}</p>
            </td>
            <td className="px-4 py-3 text-sm text-gray-700">{c.productName ?? '—'}</td>
            <td className="px-4 py-3 text-xs text-gray-500">{c.caseType?.replace(/_/g, ' ')}</td>
            <td className="px-4 py-3 text-xs font-mono text-gray-500">{c.externalRef ?? '—'}</td>
            <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
            <td className="px-4 py-3">
              <CaseOwnerBadge caseData={c} />
            </td>
            <td className="px-4 py-3 text-xs text-gray-400">
              {c.openedAt ? new Date(c.openedAt).toLocaleDateString() : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function CasesPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState('all') // all | mine | unassigned | new | review | approval
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [caseTypeFilter, setCaseTypeFilter] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 20
  const navigate = useNavigate()
  const { user } = useUserStore()
  const currentEmail = user?.email ?? ''
  const userRoles = useMemo(() => user?.roles ?? [], [user?.roles])

  // Build server-side params based on active tab
  const serverParams = useMemo(() => {
    const params = {
      page,
      size: pageSize,
      search: search || undefined,
      caseType: caseTypeFilter || undefined,
    }
    switch (tab) {
      case 'mine':
        params.assignedTo = currentEmail
        break
      case 'unassigned':
        params.unclaimed = true
        // Pass first matching role as group filter
        if (userRoles.length > 0) params.assignedToGroup = userRoles[0]
        break
      case 'new':
        params.status = 'NEW'
        break
      case 'review':
        params.status = 'REVIEW_PENDING'
        break
      case 'approval':
        params.status = 'PENDING_APPROVAL'
        break
      default:
        if (statusFilter) params.status = statusFilter
        break
    }
    return params
  }, [tab, page, search, caseTypeFilter, statusFilter, currentEmail, userRoles])

  const { data: pagedResult, isLoading } = useQuery({
    queryKey: ['admin', 'cases', serverParams],
    queryFn: () => listCases(serverParams),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  // Handle both paginated response { content, totalElements, ... } and legacy array response
  const filteredCases = useMemo(() => {
    if (!pagedResult) return []
    if (Array.isArray(pagedResult)) return pagedResult // legacy fallback
    return Array.isArray(pagedResult.content) ? pagedResult.content : []
  }, [pagedResult])

  const totalElements = pagedResult?.totalElements ?? filteredCases.length
  const totalPages = pagedResult?.totalPages ?? 1

  // Reset page when tab or filters change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(0) }, [tab, statusFilter, search, caseTypeFilter])

  // Tab counts — use totalElements from server for active tab, estimate for others
  // For non-active tabs, show "—" since we don't have the count without a separate query
  const activeTabTotal = totalElements

  const TABS = [
    { key: 'all',         label: 'All Cases' },
    { key: 'mine',        label: 'My Cases' },
    { key: 'unassigned',  label: 'Unassigned' },
    { key: 'new',         label: 'New Queue' },
    { key: 'review',      label: 'Review Queue' },
    { key: 'approval',    label: 'Approval Queue' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cases</h1>
          <p className="text-sm text-gray-500 mt-0.5">Loan applications, account openings, and document packages</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <Plus size={14} /> New Case
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
            {tab === t.key && activeTabTotal > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {activeTabTotal}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by case ref, customer name, customer ID, or product..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        <select value={caseTypeFilter} onChange={e => setCaseTypeFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Types</option>
          <option value="LOAN_ORIGINATION">Loan Origination</option>
          <option value="ACCOUNT_OPENING">Account Opening</option>
          <option value="KYC_REVIEW">KYC Review</option>
          <option value="GENERAL">General</option>
        </select>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        {['', 'NEW', 'IN_PROGRESS', 'REVIEW_PENDING', 'UNDER_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'ON_HOLD'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}>
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <CaseTable
          cases={filteredCases}
          isLoading={isLoading}
          navigate={navigate}
          emptyMessage={
            tab === 'mine' ? 'No cases assigned to you' :
            tab === 'unassigned' ? 'No unclaimed cases for your groups' :
            search ? 'Try a different search term' : 'Create a new case to get started'
          }
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-500">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalElements)} of {totalElements} cases
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Previous
            </button>
            <span className="text-xs text-gray-600">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showCreate && <CreateCaseModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
