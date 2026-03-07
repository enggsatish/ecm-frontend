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
import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText, Download, Trash2, Search, RefreshCw, Eye,
  ChevronUp, ChevronDown, ChevronsUpDown, AlertCircle, Loader2,
} from 'lucide-react'
import { listDocuments, downloadDocument, deleteDocument } from '../../api/documentsApi'
import DocumentViewerModal from './DocumentViewerModal'
import toast from 'react-hot-toast'

// ── Field helpers ─────────────────────────────────────────────
// DocumentResponse from Spring uses these exact field names.
// These helpers normalise the doc object so the table is resilient
// to minor API changes or field renames.

function docName(doc)      { return doc.name ?? doc.originalFilename ?? doc.filename ?? '—' }
function docMime(doc)      { return doc.mimeType ?? doc.contentType ?? '' }
function docSize(doc)      { return doc.fileSizeBytes ?? doc.fileSize ?? doc.size }
function docUploader(doc)  { return doc.uploadedBy ?? doc.createdBy }
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

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—'
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
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

function statusStyle(status) {
  switch (status) {
    case 'ACTIVE':       return 'bg-emerald-50 text-emerald-700'
    case 'PENDING_OCR':  return 'bg-amber-50 text-amber-700'
    case 'PROCESSING':   return 'bg-blue-50 text-blue-700'
    case 'DELETED':      return 'bg-red-50 text-red-700'
    default:             return 'bg-gray-100 text-gray-500'
  }
}

// Sprint-D: OCR completion status derived from document.status
const OCR_STATUS = {
  PENDING_OCR: { label: 'Pending',  style: 'bg-amber-50 text-amber-600' },
  ACTIVE:      { label: 'Done',     style: 'bg-emerald-50 text-emerald-600' },
  OCR_FAILED:  { label: 'Failed',   style: 'bg-red-50 text-red-500' },
  ARCHIVED:    { label: 'Archived', style: 'bg-gray-100 text-gray-500' },
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

function DeleteButton({ doc, onDelete }) {
  const [confirm, setConfirm] = useState(false)
  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="text-red-600 font-medium">Delete?</span>
        <button
          onClick={() => { onDelete(doc.id); setConfirm(false) }}
          className="rounded px-1.5 py-0.5 bg-red-600 text-white
                     hover:bg-red-700 transition-colors"
        >Yes</button>
        <button
          onClick={() => setConfirm(false)}
          className="rounded px-1.5 py-0.5 bg-gray-100 text-gray-600
                     hover:bg-gray-200 transition-colors"
        >No</button>
      </span>
    )
  }
  return (
    <button
      onClick={() => setConfirm(true)}
      className="text-gray-300 hover:text-red-500 transition-colors"
      aria-label="Delete"
    >
      <Trash2 size={15} />
    </button>
  )
}

// ── Main component ────────────────────────────────────────────

// Column count: Name | Size | Uploaded By | Date | Status | Location | OCR | Actions = 8
const COL_SPAN = 8
const PAGE_SIZE = 20

export default function DocumentTable() {
  const qc = useQueryClient()
  const [search, setSearch]     = useState('')
  const debouncedSearch         = useDebounce(search, 350)
  const [page,   setPage]       = useState(0)
  const [sort,   setSort]       = useState({ field: 'createdAt', dir: 'desc' })

  // Sprint-D: controls which document is open in the viewer modal.
  // Must be inside the component — hooks cannot be called at module level.
  const [viewingId, setViewingId] = useState(null)

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch])

  const queryParams = {
    page,
    size: PAGE_SIZE,
    sort: `${sort.field},${sort.dir}`,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  }

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey:        ['documents', { ...queryParams, search: debouncedSearch }],
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
    mutationFn: (id) => deleteDocument(id),
    onSuccess: () => {
      toast.success('Document deleted')
      qc.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  })

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

      // Sprint-D: resolve OCR badge from status; fall back to a neutral style
      const ocrEntry = OCR_STATUS[doc.status]

      return (
        <tr
          key={doc.id}
          className="group border-t border-gray-50
                     hover:bg-gray-50/70 transition-colors"
        >
          {/* Name + type badge */}
          <td className="py-3 px-4">
            <div className="flex items-center gap-2.5">
              <span className={`shrink-0 rounded px-1.5 py-0.5
                               text-[10px] font-bold tracking-wider ${color}`}>
                {label}
              </span>
              <span
                className="text-sm text-gray-800 font-medium truncate max-w-xs"
                title={name}
              >
                {name}
              </span>
            </div>
          </td>

          {/* Size */}
          <td className="py-3 px-4 text-sm text-gray-500 tabular-nums">
            {formatBytes(docSize(doc))}
          </td>

          {/* Uploaded by */}
          <td className="py-3 px-4 text-sm text-gray-500">
            {docUploader(doc) ?? '—'}
          </td>

          {/* Date */}
          <td className="py-3 px-4 text-sm text-gray-500
                         tabular-nums whitespace-nowrap">
            {formatDate(docDate(doc))}
          </td>

          {/* Status */}
          <td className="py-3 px-4">
            {doc.status && (
              <span className={`rounded-full px-2 py-0.5 text-xs
                               font-medium ${statusStyle(doc.status)}`}>
                {doc.status}
              </span>
            )}
          </td>

          {/* Location breadcrumb (Sprint-C) */}
          <td className="py-3 px-4">
            {location ? (
              <span
                className="text-xs text-gray-400 whitespace-nowrap"
                title={location}
              >
                {location}
              </span>
            ) : (
              <span className="text-xs text-gray-300">—</span>
            )}
          </td>

          {/* OCR status badge (Sprint-D) */}
          <td className="py-3 px-4">
            {ocrEntry ? (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ocrEntry.style}`}>
                {ocrEntry.label}
              </span>
            ) : (
              <span className="text-xs text-gray-300">—</span>
            )}
          </td>

          {/* Actions */}
          <td className="py-3 px-4">
            <div className="flex items-center justify-end gap-2
                            opacity-0 group-hover:opacity-100
                            transition-opacity">
              {/* Sprint-D: View button — opens DocumentViewerModal */}
              <button
                onClick={() => setViewingId(doc.id)}
                className="text-gray-300 hover:text-blue-500
                           transition-colors"
                aria-label="View"
              >
                <Eye size={15} />
              </button>
              <button
                onClick={() => downloadMutation.mutate({ id: doc.id, name })}
                disabled={downloadMutation.isPending}
                className="text-gray-300 hover:text-blue-500
                           transition-colors disabled:opacity-40"
                aria-label="Download"
              >
                <Download size={15} />
              </button>
              <DeleteButton
                doc={doc}
                onDelete={(id) => deleteMutation.mutate(id)}
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
      <div className="rounded-xl border border-gray-100 bg-white
                      shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="py-3 px-4 text-left">
                  <SortButton field="name" label="Name"
                              sort={sort} onSort={handleSort} />
                </th>
                <th className="py-3 px-4 text-left">
                  <SortButton field="fileSizeBytes" label="Size"
                              sort={sort} onSort={handleSort} />
                </th>
                <th className="py-3 px-4 text-left">
                  <span className="text-xs uppercase tracking-wide
                                   font-semibold text-gray-500">
                    Uploaded by
                  </span>
                </th>
                <th className="py-3 px-4 text-left">
                  <SortButton field="createdAt" label="Date"
                              sort={sort} onSort={handleSort} />
                </th>
                <th className="py-3 px-4 text-left">
                  <span className="text-xs uppercase tracking-wide
                                   font-semibold text-gray-500">
                    Status
                  </span>
                </th>
                {/* Sprint-C: hierarchy breadcrumb column */}
                <th className="py-3 px-4 text-left">
                  <span className="text-xs uppercase tracking-wide
                                   font-semibold text-gray-500">
                    Location
                  </span>
                </th>
                {/* Sprint-D: OCR completion status */}
                <th className="py-3 px-4 text-left">
                  <span className="text-xs uppercase tracking-wide
                                   font-semibold text-gray-500">
                    OCR
                  </span>
                </th>
                {/* Actions — no header label, right-aligned */}
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