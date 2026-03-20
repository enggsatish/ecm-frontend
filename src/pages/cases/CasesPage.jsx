/**
 * CasesPage.jsx
 * Route: /cases
 *
 * Case (loan application / account opening) management.
 * - List cases with status filter
 * - Create case: select customer + product → auto-populates checklist
 * - Case detail: view checklist, link documents, waive items, update status
 */
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, FolderOpen, User, Package, CheckCircle, XCircle, Clock,
  FileText, ChevronRight, Loader2, X, AlertCircle, Check, Ban, Trash2,
  Upload, Eye, Link2, PenLine,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  listCases, getCase, createCase, updateCaseStatus, linkCaseDocument, waiveCaseItem,
  addCaseNote, cancelCase, deleteCase, getProducts, listCustomers,
} from '../../api/adminApi'
import { uploadDocuments, listDocuments } from '../../api/documentsApi'

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  OPEN:               'bg-blue-50 text-blue-700 border-blue-200',
  DOCUMENTS_PENDING:  'bg-amber-50 text-amber-700 border-amber-200',
  UNDER_REVIEW:       'bg-indigo-50 text-indigo-700 border-indigo-200',
  WITH_EXTERNAL:      'bg-purple-50 text-purple-700 border-purple-200',
  PENDING_APPROVAL:   'bg-orange-50 text-orange-700 border-orange-200',
  APPROVED:           'bg-green-50 text-green-700 border-green-200',
  COMPLETED:          'bg-green-50 text-green-700 border-green-200',
  REJECTED:           'bg-red-50 text-red-700 border-red-200',
  CANCELLED:          'bg-gray-100 text-gray-500 border-gray-200',
  ON_HOLD:            'bg-gray-100 text-gray-600 border-gray-200',
}

const CHECKLIST_STATUS_COLORS = {
  PENDING:      'bg-gray-100 text-gray-500',
  UPLOADED:     'bg-blue-50 text-blue-600',
  UNDER_REVIEW: 'bg-amber-50 text-amber-600',
  APPROVED:     'bg-green-50 text-green-600',
  REJECTED:     'bg-red-50 text-red-500',
  WAIVED:       'bg-gray-100 text-gray-400',
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {status}
    </span>
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
function ChecklistItemRow({ item, caseId, caseStatus, partyExternalId, onWaive }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [showLinkPicker, setShowLinkPicker] = useState(false)

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
      }
      const result = await uploadDocuments([file], metadata)
      // result may be ApiResponse envelope
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

  const isPending = item.status === 'PENDING'
  const hasDoc = !!item.documentId
  const isEform = item.sourceType === 'EFORM'
  const isCaseClosed = ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(caseStatus)
  const canAct = isPending && !isCaseClosed

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-2">
        {/* Left: item info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-800">{item.documentTypeName}</p>
            {item.isRequired && (
              <span className="text-[10px] text-red-500 font-medium bg-red-50 px-1.5 py-0.5 rounded">Required</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              isEform ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'
            }`}>{item.sourceType}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              CHECKLIST_STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-500'
            }`}>{item.status}</span>
          </div>
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
              <button onClick={() => window.open(`/documents?search=${item.documentId}`, '_blank')}
                className="text-blue-500 hover:text-blue-700" title="View document">
                <Eye size={13} />
              </button>
            </div>
          )}

          {/* PENDING UPLOAD type — Upload button + Link Existing */}
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

          {/* PENDING EFORM type — Fill Form link with case context */}
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

          {/* Waive button */}
          {canAct && (
            <button onClick={() => { if (confirm('Waive this requirement?')) onWaive() }}
              className="p-1 text-gray-400 hover:text-orange-500" title="Waive requirement">
              <Ban size={12} />
            </button>
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
    </div>
  )
}

// ── Case Detail Panel ────────────────────────────────────────────────────────
function CaseDetailPanel({ caseId, onClose }) {
  const qc = useQueryClient()
  const { data: caseData, isLoading } = useQuery({
    queryKey: ['admin', 'case', caseId],
    queryFn: () => getCase(caseId),
    enabled: !!caseId,
  })

  const statusMut = useMutation({
    mutationFn: (payload) => updateCaseStatus(caseId, payload),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['admin', 'case', caseId] }); qc.invalidateQueries({ queryKey: ['admin', 'cases'] }) },
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
  const completedCount = checklist.filter(i => ['UPLOADED', 'APPROVED', 'WAIVED'].includes(i.status)).length

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

          {/* Status actions */}
          <div className="flex flex-wrap gap-2">
            {['DOCUMENTS_PENDING', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'].map(s => (
              <button key={s} onClick={() => statusMut.mutate({ status: s })}
                disabled={c?.status === s}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors
                  ${c?.status === s ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50'}
                  ${STATUS_COLORS[s] ?? 'border-gray-200 text-gray-500'}`}>
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {/* Document Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-800">
                Document Checklist ({completedCount}/{checklist.length})
              </h4>
            </div>

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
                    onWaive={() => waiveMut.mutate({ itemId: item.id })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Notes / Activity Log */}
          <CaseNotes caseId={caseId} metadata={c?.metadata} isCaseClosed={['COMPLETED', 'CANCELLED', 'REJECTED'].includes(c?.status)} />
        </div>

        {/* Footer actions — Delete / Cancel */}
        {c?.status && !['COMPLETED', 'CANCELLED'].includes(c.status) && (
          <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              Case ID: <span className="font-mono">{caseId?.toString().substring(0, 8)}</span>
            </div>
            <div className="flex items-center gap-2">
              {c.status === 'OPEN' && (
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

// ── Main Page ────────────────────────────────────────────────────────────────
export default function CasesPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['admin', 'cases', { status: statusFilter || undefined }],
    queryFn: () => listCases({ status: statusFilter || undefined }),
    staleTime: 30_000,
  })

  const caseList = Array.isArray(cases) ? cases : []

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

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'OPEN', 'DOCUMENTS_PENDING', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED', 'REJECTED'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading...
          </div>
        ) : caseList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FolderOpen size={36} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">No cases found</p>
            <p className="text-xs text-gray-400 mt-1">Create a new case to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Opened</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {caseList.map(c => (
                <tr key={c.id} onClick={() => setSelectedId(c.id)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800">{c.partyDisplayName ?? '—'}</p>
                    <p className="text-xs text-gray-400 font-mono">{c.partyExternalId}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{c.productName ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.caseType}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.sourceSystem}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {c.openedAt ? new Date(c.openedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setSelectedId(c.id)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                      <ChevronRight size={13} /> Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateCaseModal onClose={() => setShowCreate(false)} />}
      {selectedId && <CaseDetailPanel caseId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
