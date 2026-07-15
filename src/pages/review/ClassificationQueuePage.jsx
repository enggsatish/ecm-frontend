/**
 * ClassificationQueuePage.jsx
 * Dedicated review page for documents needing classification.
 * Shows ALL unclassified documents (regardless of upload source: single, batch, case).
 * Uses the shared ClassifyModal for the full hierarchy (Customer → Segment → Product Line → Category).
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardCheck, Search, Loader2, AlertCircle, FileText,
  Tag, Eye, RefreshCw, Clock, Lock, Unlock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { listNeedsClassification, classifyDocument, checkoutDocument, releaseDocument } from '../../api/documentsApi'
import ClassifyModal from '../../components/documents/ClassifyModal'
import DocumentViewerModal from '../../components/documents/DocumentViewerModal'

const PAGE_SIZE = 20

function formatDate(iso) {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '--' }
}

function getTypeLabel(mimeType) {
  const mime = mimeType ?? ''
  if (mime.includes('pdf'))        return { label: 'PDF', color: 'text-red-600 bg-red-50' }
  if (mime.includes('word'))       return { label: 'DOCX', color: 'text-blue-600 bg-blue-50' }
  if (mime.includes('sheet'))      return { label: 'XLSX', color: 'text-emerald-600 bg-emerald-50' }
  if (mime.startsWith('image/'))   return { label: 'IMG', color: 'text-purple-600 bg-purple-50' }
  return { label: 'FILE', color: 'text-gray-500 bg-gray-100' }
}

export default function ClassificationQueuePage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [classifyingDocId, setClassifyingDocId] = useState(null)
  const [viewingDocId, setViewingDocId] = useState(null)

  const queryParams = { page, size: PAGE_SIZE, ...(search ? { search } : {}) }

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['documents-needs-classification', queryParams],
    queryFn: () => listNeedsClassification(queryParams),
    staleTime: 15_000,
  })

  const classifyMutation = useMutation({
    mutationFn: ({ id, data: classifyData }) => classifyDocument(id, classifyData),
    onSuccess: () => {
      toast.success('Document classified and moved to Active')
      qc.invalidateQueries({ queryKey: ['documents-needs-classification'] })
      qc.invalidateQueries({ queryKey: ['documents-auto-classified'] })
      qc.invalidateQueries({ queryKey: ['documents'] })
      setClassifyingDocId(null)
    },
    onError: (err) => toast.error(`Classify failed: ${err.message}`),
  })

  const claimMutation = useMutation({
    mutationFn: (id) => checkoutDocument(id),
    onSuccess: () => {
      toast.success('Document claimed')
      qc.invalidateQueries({ queryKey: ['documents-needs-classification'] })
    },
    onError: (err) => toast.error(`Claim failed: ${err.message}`),
  })

  const releaseMutation = useMutation({
    mutationFn: (id) => releaseDocument(id),
    onSuccess: () => {
      toast.success('Document released')
      qc.invalidateQueries({ queryKey: ['documents-needs-classification'] })
    },
    onError: (err) => toast.error(`Release failed: ${err.message}`),
  })

  const documents = Array.isArray(data?.content) ? data.content : []
  const totalPages = data?.totalPages ?? 1
  const totalElements = data?.totalElements ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-amber-600" />
          Classification Queue
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Documents needing category and customer assignment
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search documents..."
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm
                       text-gray-800 placeholder:text-gray-400 focus:outline-none
                       focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-shadow"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {isFetching && !isLoading && (
            <Loader2 size={14} className="text-blue-400 animate-spin" />
          )}
          <span className="text-xs text-gray-400 tabular-nums">
            {totalElements} document{totalElements !== 1 ? 's' : ''} pending
          </span>
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-gray-200 p-2 text-gray-400
                       hover:text-gray-700 hover:border-gray-300 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="py-20 text-center">
          <div className="inline-flex flex-col items-center gap-3 text-gray-400">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      ) : isError ? (
        <div className="py-16 text-center">
          <div className="inline-flex flex-col items-center gap-2">
            <AlertCircle size={28} className="text-red-400" />
            <p className="text-sm font-medium text-gray-700">Failed to load</p>
            <p className="text-xs text-gray-400">{error?.message}</p>
            <button onClick={() => refetch()} className="mt-2 text-xs text-blue-500 hover:underline">Try again</button>
          </div>
        </div>
      ) : documents.length === 0 ? (
        <div className="py-20 text-center">
          <div className="inline-flex flex-col items-center gap-2 text-gray-300">
            <ClipboardCheck size={36} />
            <p className="text-sm text-gray-500 font-medium">All documents are classified</p>
            <p className="text-xs text-gray-400">Nothing needs attention right now</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const { label, color } = getTypeLabel(doc.mimeType)
            const name = doc.name ?? doc.originalFilename ?? 'Unknown'
            const hasText = doc.extractedText && doc.extractedText.length > 0
            const ocrDone = doc.ocrCompleted

            return (
              <div
                key={doc.id}
                className="rounded-xl border border-gray-100 bg-white shadow-sm p-4
                           hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Type badge + name */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className={`shrink-0 rounded px-1.5 py-0.5
                                     text-[10px] font-bold tracking-wider ${color}`}>
                      {label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate" title={name}>
                        {name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                        <span>{formatDate(doc.createdAt)}</span>
                        {doc.uploadedByEmail && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>{doc.uploadedByEmail}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status indicators */}
                  <div className="flex items-center gap-2 shrink-0">
                    {ocrDone && hasText && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-teal-50 text-teal-700">
                        OCR: {doc.extractedText.length} chars
                      </span>
                    )}

                    {doc.status === 'NEEDS_ASSIGNMENT' ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-orange-50 text-orange-700">
                        <AlertCircle size={10} /> Needs Assignment
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700">
                        <AlertCircle size={10} /> Needs Classification
                      </span>
                    )}

                    {doc.categoryName && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700">
                        <Tag size={10} /> {doc.categoryName}
                        {doc.classificationConfidence ? ` (${Math.round(doc.classificationConfidence)}%)` : ''}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setViewingDocId(doc.id)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                      title="View document"
                    >
                      <Eye size={16} />
                    </button>
                    {doc.lockedBy ? (
                      <button
                        onClick={() => releaseMutation.mutate(doc.id)}
                        className="p-2 rounded-lg hover:bg-amber-50 text-amber-500 hover:text-amber-700 transition-colors"
                        title={`Claimed by ${doc.lockedBy} — click to release`}
                      >
                        <Unlock size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => claimMutation.mutate(doc.id)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                        title="Claim document"
                      >
                        <Lock size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => setClassifyingDocId(doc.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2
                                 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                    >
                      <Tag size={13} />
                      Classify
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400 text-xs">Page {page + 1} of {totalPages}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600
                         hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600
                         hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Classify modal */}
      {classifyingDocId && (() => {
        const doc = documents.find(d => d.id === classifyingDocId)
        return (
          <ClassifyModal
            documentName={doc?.name ?? doc?.originalFilename}
            initialCategoryId={doc?.categoryId}
            initialCustomerRef={doc?.partyExternalId}
            onSubmit={(data) => classifyMutation.mutate({ id: classifyingDocId, data })}
            onCancel={() => setClassifyingDocId(null)}
            isPending={classifyMutation.isPending}
          />
        )
      })()}

      {/* Document viewer modal */}
      {viewingDocId && (
        <DocumentViewerModal
          documentId={viewingDocId}
          onClose={() => setViewingDocId(null)}
        />
      )}
    </div>
  )
}
