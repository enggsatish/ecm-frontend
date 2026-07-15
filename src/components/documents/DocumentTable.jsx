/**
 * DocumentTable.jsx
 *
 * Sprint-C: Added "Location" column (Segment › Product Line › Category breadcrumb).
 * Sprint-D: Added OCR status badge column + View button → DocumentViewerModal.
 *
 * Sprint-D fixes applied over the Sprint-C base:
 *  1. viewingId state moved INSIDE the component (was incorrectly at module level).
 *  2. OCR <td> added to every row (header existed but cell was missing).
 *  3. View (Eye) button added to actions — opens DocumentViewerModal.
 *  4. DocumentViewerModal imported and conditionally rendered below the table.
 *  5. Column count reconciled: 8 columns. colSpan updated from 7 → 8 everywhere.
 *  6. Stray empty <th /> removed from header (was the 9th orphan header).
 *  7. Eye added to lucide-react imports.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText, Download, Trash2, Search, RefreshCw, Eye, Archive, RotateCcw, Lock, Unlock,
  ChevronUp, ChevronDown, ChevronsUpDown, AlertCircle, Loader2,
  MoreVertical, FileSignature, Tag, X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { listDocuments, downloadDocument, deleteDocument, archiveDocument, restoreDocument, checkoutDocument, releaseDocument, classifyDocument } from '../../api/documentsApi'
import { listCustomers } from '../../api/adminApi'
import ClassifyModal from './ClassifyModal'
import useUserStore from '../../store/userStore'
import DocumentViewerModal from './DocumentViewerModal'
import toast from 'react-hot-toast'

// ── Field helpers ─────────────────────────────────────────────
// DocumentResponse from Spring uses these exact field names.
// These helpers normalise the doc object so the table is resilient
// to minor API changes or field renames.

function docName(doc)      { return doc.name ?? doc.originalFilename ?? doc.filename ?? '—' }
function docMime(doc)      { return doc.mimeType ?? doc.contentType ?? '' }
function docDate(doc)      { return doc.createdAt ?? doc.uploadedAt }

// Sprint-C: builds the hierarchy breadcrumb from the three optional name fields.
// All three are null in Sprint-C; Sprint-D resolves them.
function docLocation(doc) {
  const parts = [doc.segmentName, doc.productLineName, doc.categoryName].filter(Boolean)
  return parts.length > 0 ? parts.join(' › ') : null
}

function useDebounce(value, delayMs) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return '—'
  }
}

function getTypeLabel(mimeType) {
  const mime = mimeType ?? ''
  if (mime.includes('pdf'))             return { label: 'PDF',  color: 'text-red-600 bg-red-50' }
  if (mime.includes('word') || mime.includes('document'))
                                        return { label: 'DOCX', color: 'text-blue-600 bg-blue-50' }
  if (mime.includes('sheet') || mime.includes('excel'))
                                        return { label: 'XLSX', color: 'text-emerald-600 bg-emerald-50' }
  if (mime.includes('presentation') || mime.includes('powerpoint'))
                                        return { label: 'PPTX', color: 'text-orange-600 bg-orange-50' }
  if (mime.includes('csv') || mime.includes('text'))
                                        return { label: 'TXT',  color: 'text-gray-600 bg-gray-100' }
  if (mime.startsWith('image/'))        return { label: 'IMG',  color: 'text-purple-600 bg-purple-50' }
  return { label: 'FILE', color: 'text-gray-500 bg-gray-100' }
}

// Unified document status — single column showing full lifecycle state
const STATUS_CONFIG = {
  PENDING_OCR:           { label: 'Processing',           style: 'bg-blue-50 text-blue-700',       icon: '⏳' },
  ACTIVE:                { label: 'Active',               style: 'bg-emerald-50 text-emerald-700', icon: '✓' },
  PENDING_CLASSIFICATION:{ label: 'Needs Classification', style: 'bg-amber-50 text-amber-700',     icon: '!', clickable: true },
  NEEDS_ASSIGNMENT:      { label: 'Needs Assignment',     style: 'bg-orange-50 text-orange-700',   icon: '!' },
  NEEDS_CLASSIFICATION:  { label: 'Needs Classification', style: 'bg-amber-50 text-amber-700',     icon: '!', clickable: true },
  OCR_FAILED:            { label: 'OCR Failed',           style: 'bg-red-50 text-red-600',         icon: '!' },
  PENDING_SIGNATURE:     { label: 'Awaiting Signature',   style: 'bg-amber-50 text-amber-700',     icon: '✍' },
  SIGNED:                { label: 'Signed',               style: 'bg-purple-50 text-purple-700',   icon: '✓' },
  SIGN_DECLINED:         { label: 'Declined',             style: 'bg-red-50 text-red-600',         icon: '✗' },
  ARCHIVED:              { label: 'Archived',             style: 'bg-gray-100 text-gray-500',      icon: '▪' },
  DELETED:               { label: 'Deleted',              style: 'bg-red-50 text-red-500',         icon: '✗' },
  PURGED:                { label: 'Purged',               style: 'bg-gray-200 text-gray-400',      icon: '—' },
}

/** Derives visual status from DB status + classification state */
function getStatusConfig(doc) {
  const status = typeof doc === 'string' ? doc : doc?.status
  const categoryId = typeof doc === 'string' ? undefined : doc?.categoryId
  // ACTIVE + no category = needs classification
  if (status === 'ACTIVE' && !categoryId) return STATUS_CONFIG.NEEDS_CLASSIFICATION
  return STATUS_CONFIG[status] || { label: status || '—', style: 'bg-gray-100 text-gray-500', icon: '' }
}

// ── Sub-components ────────────────────────────────────────────

function SortButton({ field, label, sort, onSort }) {
  const active = sort.field === field
  return (
    <button
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 font-semibold text-xs
                 uppercase tracking-wide text-gray-500
                 hover:text-gray-800 transition-colors"
    >
      {label}
      {active
        ? sort.dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
        : <ChevronsUpDown size={13} className="opacity-30" />}
    </button>
  )
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function CustomerLink({ externalId }) {
  const navigate = useNavigate()
  const isUuid = UUID_RE.test(externalId)

  // Search by customerRef (normal path)
  const { data: searchData } = useQuery({
    queryKey: ['customer-by-ref', externalId],
    queryFn: () => listCustomers({ q: externalId, size: 1 }),
    staleTime: 10 * 60_000,
    enabled: !!externalId && !isUuid,
  })

  // Lookup by UUID (fallback for legacy data where partyExternalId was set to party UUID)
  const { data: uuidData } = useQuery({
    queryKey: ['customer-by-id', externalId],
    queryFn: () => import('../../api/adminApi').then(m => m.getCustomer(externalId)),
    staleTime: 10 * 60_000,
    enabled: !!externalId && isUuid,
  })

  const searchCustomers = Array.isArray(searchData) ? searchData : (searchData?.content ?? [])
  const customer = isUuid
    ? uuidData ?? null
    : searchCustomers.find(c => c.customerRef === externalId || c.externalId === externalId)

  if (customer) {
    return (
      <button onClick={() => navigate(`/customers/${customer.id}/portfolio`, { state: { from: '/documents', fromLabel: 'Documents' } })}
        className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full hover:bg-indigo-100 transition-colors cursor-pointer"
        title={`View portfolio: ${customer.displayName}`}>
        {customer.displayName ?? externalId}
      </button>
    )
  }

  return (
    <span className="text-[10px] font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
      {externalId}
    </span>
  )
}

function DocActionMenu({ doc, onArchive, onRestore, onDelete, onCheckout, onRelease, isAdmin, currentUserEmail }) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const status = doc.status
  const isLocked = doc.lockedBy && doc.lockExpiresAt && new Date(doc.lockExpiresAt) > new Date()
  const isLockedByMe = isLocked && doc.lockedBy === currentUserEmail
  const isLockedByOther = isLocked && !isLockedByMe

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)
          && btnRef.current && !btnRef.current.contains(e.target)) setOpen(false)
    }
    const scrollHandler = () => setOpen(false)
    document.addEventListener('mousedown', handler)
    document.addEventListener('scroll', scrollHandler, true)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('scroll', scrollHandler, true)
    }
  }, [open])

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 192 }) // 192 = w-48
    }
    setOpen(v => !v)
  }

  // No menu for deleted/purged
  if (status === 'DELETED' || status === 'PURGED') return null

  return (
    <>
      <button ref={btnRef} onClick={handleToggle}
        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="More actions">
        <MoreVertical size={16} />
      </button>

      {open && (
        <div ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {/* Lock / Unlock */}
          {status !== 'ARCHIVED' && (
            <>
              {!isLocked && (
                <button onClick={() => { setOpen(false); onCheckout(doc.id) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-gray-700 hover:bg-blue-50 hover:text-blue-700">
                  <Lock size={13} /> Lock Document
                </button>
              )}
              {isLockedByMe && (
                <button onClick={() => { setOpen(false); onRelease(doc.id) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-blue-600 hover:bg-blue-50">
                  <Unlock size={13} /> Unlock Document
                </button>
              )}
              {isLockedByOther && (
                <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
                  <Lock size={13} /> Locked by {doc.lockedBy?.split('@')[0]}
                </div>
              )}
            </>
          )}

          {/* Archive / Restore */}
          {isAdmin && status === 'ARCHIVED' && (
            <button onClick={() => { setOpen(false); onRestore(doc.id) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-green-700 hover:bg-green-50">
              <RotateCcw size={13} /> Restore from Archive
            </button>
          )}
          {isAdmin && status !== 'ARCHIVED' && !isLockedByOther && (
            <button onClick={() => {
              setOpen(false)
              if (window.confirm('Archive this document? It will be moved to cold storage.')) onArchive(doc.id)
            }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-amber-700 hover:bg-amber-50">
              <Archive size={13} /> Archive
            </button>
          )}

          {/* Divider before destructive action */}
          {isAdmin && status !== 'ARCHIVED' && !isLockedByOther && (
            <div className="border-t border-gray-100 my-1" />
          )}

          {/* Delete */}
          {isAdmin && status !== 'ARCHIVED' && !isLockedByOther && (
            <button onClick={() => {
              setOpen(false)
              const reason = window.prompt('Reason for deletion (required):')
              if (reason && reason.trim()) onDelete({ id: doc.id, reason: reason.trim() })
            }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-red-600 hover:bg-red-50">
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      )}
    </>
  )
}

// ── Main component ────────────────────────────────────────────

// Column count: Name | Size | Uploaded By | Date | Status | Customer | Location | Actions = 8
const COL_SPAN = 4
const PAGE_SIZE = 20

export default function DocumentTable({ customerFilter = '' }) {
  const qc = useQueryClient()
  const { user } = useUserStore()
  const isAdmin = user?.roles?.some(r =>
    r === 'ECM_ADMIN' || r === 'ECM_SUPER_ADMIN' || r === 'ROLE_ECM_ADMIN' || r === 'ROLE_ECM_SUPER_ADMIN'
  ) ?? false
  const [search, setSearch]     = useState('')
  const debouncedSearch         = useDebounce(search, 350)
  const [page,   setPage]       = useState(0)
  const [sort,   setSort]       = useState({ field: 'createdAt', dir: 'desc' })

  // Sprint-D: controls which document is open in the viewer modal.
  const [viewingId, setViewingId] = useState(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0)
  }, [debouncedSearch, customerFilter])

  const queryParams = {
    page,
    size: PAGE_SIZE,
    sort: `${sort.field},${sort.dir}`,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(customerFilter  ? { partyExternalId: customerFilter } : {}),
  }

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey:        ['documents', { ...queryParams, search: debouncedSearch, customer: customerFilter }],
    queryFn:         () => listDocuments(queryParams),
    placeholderData: (prev) => prev,
    throwOnError:    false,
  })

  const documents     = Array.isArray(data?.content) ? data.content
                      : Array.isArray(data)           ? data
                      : []
  const totalPages    = data?.totalPages    ?? 1
  const totalElements = data?.totalElements ?? documents.length

  const handleSort = useCallback((field) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'desc' }
    )
  }, [])

  const handleSearch = (e) => {
    setSearch(e.target.value)
    setPage(0)
  }

  const downloadMutation = useMutation({
    mutationFn: ({ id, name }) => downloadDocument(id, name),
    onError: (err) => toast.error(`Download failed: ${err.message}`),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, reason }) => deleteDocument(id, reason),
    onSuccess: () => {
      toast.success('Document deleted')
      qc.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  })

  const archiveMutation = useMutation({
    mutationFn: (id) => archiveDocument(id),
    onSuccess: () => {
      toast.success('Document archived')
      qc.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (err) => toast.error(`Archive failed: ${err.message}`),
  })

  const restoreMutation = useMutation({
    mutationFn: (id) => restoreDocument(id),
    onSuccess: () => {
      toast.success('Document restored')
      qc.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (err) => toast.error(`Restore failed: ${err.message}`),
  })

  const checkoutMutation = useMutation({
    mutationFn: (id) => checkoutDocument(id),
    onSuccess: () => {
      toast.success('Document checked out')
      qc.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (err) => toast.error(err.message),
  })

  const releaseMutation = useMutation({
    mutationFn: (id) => releaseDocument(id),
    onSuccess: () => {
      toast.success('Document released')
      qc.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (err) => toast.error(err.message),
  })

  const classifyMutation = useMutation({
    mutationFn: ({ id, data }) => classifyDocument(id, data),
    onSuccess: () => {
      toast.success('Document classified')
      qc.invalidateQueries({ queryKey: ['documents'] })
      setClassifyingDocId(null)
    },
    onError: (err) => toast.error(`Classify failed: ${err.message}`),
  })

  const [classifyingDocId, setClassifyingDocId] = useState(null)

  // ── Table body ────────────────────────────────────────────────

  const renderBody = () => {
    if (isLoading) {
      return (
        <tr>
          <td colSpan={COL_SPAN} className="py-20 text-center">
            <div className="inline-flex flex-col items-center gap-3 text-gray-400">
              <Loader2 size={28} className="animate-spin" />
              <span className="text-sm">Loading documents…</span>
            </div>
          </td>
        </tr>
      )
    }

    if (isError) {
      return (
        <tr>
          <td colSpan={COL_SPAN} className="py-16 text-center">
            <div className="inline-flex flex-col items-center gap-2">
              <AlertCircle size={28} className="text-red-400" />
              <p className="text-sm font-medium text-gray-700">Failed to load documents</p>
              <p className="text-xs text-gray-400 max-w-sm">
                {error?.message ?? 'Could not reach ecm-document service on port 8082'}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-2 text-xs text-blue-500 hover:underline"
              >
                Try again
              </button>
            </div>
          </td>
        </tr>
      )
    }

    if (documents.length === 0) {
      return (
        <tr>
          <td colSpan={COL_SPAN} className="py-20 text-center">
            <div className="inline-flex flex-col items-center gap-2 text-gray-300">
              <FileText size={36} />
              <p className="text-sm text-gray-500 font-medium">
                {search ? 'No documents match your search' : 'No documents yet'}
              </p>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs text-blue-500 hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          </td>
        </tr>
      )
    }

    return documents.map((doc) => {
      if (!doc?.id) return null
      const { label, color } = getTypeLabel(docMime(doc))
      const name     = docName(doc)
      const location = docLocation(doc)

      const sc = getStatusConfig(doc)

      return (
        <tr
          key={doc.id}
          className="group border-t border-gray-50
                     hover:bg-gray-50/70 transition-colors"
        >
          {/* Name + date + location subtitle */}
          <td className="py-2.5 px-4">
            <div className="flex items-start gap-2.5">
              <span className={`shrink-0 rounded px-1.5 py-0.5 mt-0.5
                               text-[10px] font-bold tracking-wider ${color}`}>
                {label}
              </span>
              <div className="min-w-0">
                <span
                  className="text-sm text-gray-800 font-medium truncate block max-w-sm"
                  title={name}
                >
                  {name}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-400">
                  <span className="tabular-nums">{formatDate(docDate(doc))}</span>
                  {location && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="truncate max-w-[200px]" title={location}>{location}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </td>

          {/* Status — unified lifecycle column */}
          <td className="py-3 px-4">
            {sc.clickable ? (
              <button
                onClick={() => setClassifyingDocId(classifyingDocId === doc.id ? null : doc.id)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5
                           text-xs font-medium whitespace-nowrap cursor-pointer
                           hover:ring-2 hover:ring-amber-300 transition-all ${sc.style}`}
                title="Click to classify this document"
              >
                <Tag size={10} />
                {sc.label}
              </button>
            ) : (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5
                               text-xs font-medium whitespace-nowrap ${sc.style}`}>
                {sc.label}
              </span>
            )}
          </td>

          {/* Customer (clickable → portfolio) */}
          <td className="py-3 px-4">
            {doc.partyExternalId ? (
              <CustomerLink externalId={doc.partyExternalId} />
            ) : (
              <span className="text-xs text-gray-300">—</span>
            )}
          </td>

          {/* Actions — always visible */}
          <td className="py-3 px-4">
            <div className="flex items-center justify-end gap-1.5">
              {/* Lock state badge — always visible when locked */}
              {doc.lockedBy && doc.lockExpiresAt && new Date(doc.lockExpiresAt) > new Date() && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                  ${doc.lockedBy === user?.email
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'bg-amber-50 text-amber-600 border border-amber-200'}`}
                  title={`Locked by ${doc.lockedBy} until ${new Date(doc.lockExpiresAt).toLocaleTimeString()}`}>
                  <Lock size={9} />
                  {doc.lockedBy === user?.email ? 'You' : doc.lockedBy?.split('@')[0]}
                </span>
              )}

              {/* Case linkage badge — shows who is working on it */}
              {doc.linkedCaseId && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border
                  ${doc.linkedCaseAssignee
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-cyan-50 text-cyan-600 border-cyan-200'}`}
                  title={`Linked to active case${doc.linkedCaseAssignee ? ' — ' + doc.linkedCaseAssignee : ''}`}>
                  {doc.linkedCaseAssignee
                    ? `Case: ${doc.linkedCaseAssignee.split('@')[0]}`
                    : 'In Case'}
                </span>
              )}

              {/* View — always visible */}
              <button
                onClick={() => setViewingId(doc.id)}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                title="View document"
              >
                <Eye size={15} />
              </button>

              {/* Download — always visible */}
              <button
                onClick={() => downloadMutation.mutate({ id: doc.id, name })}
                disabled={downloadMutation.isPending}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600
                           transition-colors disabled:opacity-40"
                title="Download"
              >
                <Download size={15} />
              </button>

              {/* Three-dot menu — all other actions */}
              <DocActionMenu
                doc={doc}
                isAdmin={isAdmin}
                currentUserEmail={user?.email}
                onArchive={(id) => archiveMutation.mutate(id)}
                onRestore={(id) => restoreMutation.mutate(id)}
                onDelete={({ id, reason }) => deleteMutation.mutate({ id, reason })}
                onCheckout={(id) => checkoutMutation.mutate(id)}
                onRelease={(id) => releaseMutation.mutate(id)}
              />
            </div>
          </td>
        </tr>
      )
    })
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2
                                      -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Search documents…"
            className="w-full rounded-lg border border-gray-200 bg-white
                       pl-9 pr-4 py-2 text-sm text-gray-800
                       placeholder:text-gray-400 focus:outline-none
                       focus:ring-2 focus:ring-blue-200 focus:border-blue-400
                       transition-shadow"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {isFetching && !isLoading && (
            <Loader2 size={14} className="text-blue-400 animate-spin" />
          )}
          <span className="text-xs text-gray-400 tabular-nums">
            {totalElements} document{totalElements !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-gray-200 p-2 text-gray-400
                       hover:text-gray-700 hover:border-gray-300
                       transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="py-3 px-4 text-left">
                  <SortButton field="name" label="Document"
                              sort={sort} onSort={handleSort} />
                </th>
                <th className="py-3 px-4 text-left">
                  <span className="text-xs uppercase tracking-wide
                                   font-semibold text-gray-500">
                    Status
                  </span>
                </th>
                <th className="py-3 px-4 text-left">
                  <span className="text-xs uppercase tracking-wide
                                   font-semibold text-gray-500">
                    Customer
                  </span>
                </th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {renderBody()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400 text-xs">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-gray-200 px-3 py-1.5
                         text-xs text-gray-600 hover:bg-gray-50
                         disabled:opacity-30 disabled:cursor-not-allowed
                         transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5
                         text-xs text-gray-600 hover:bg-gray-50
                         disabled:opacity-30 disabled:cursor-not-allowed
                         transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Classify modal */}
      {classifyingDocId && (
        <ClassifyModal
          documentName={docName(documents.find(d => d.id === classifyingDocId) ?? {})}
          onSubmit={(data) => classifyMutation.mutate({ id: classifyingDocId, data })}
          onCancel={() => setClassifyingDocId(null)}
          isPending={classifyMutation.isPending}
        />
      )}

      {/* Sprint-D: Document viewer modal — rendered outside the table so it
          overlays the full viewport, not clipped by the table's overflow-hidden. */}
      {viewingId && (
        <DocumentViewerModal
          documentId={viewingId}
          onClose={() => setViewingId(null)}
        />
      )}
    </div>
  )
}