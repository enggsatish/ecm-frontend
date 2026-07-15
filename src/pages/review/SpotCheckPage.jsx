/**
 * SpotCheckPage.jsx
 * Spot check — audit auto-classified documents and flag any mistakes.
 * Queries documents with status=ACTIVE and classificationSource=AUTO_CLASSIFIED.
 */
import { useState } from 'react'
import {
  Shield, Eye, Flag, Loader2, AlertCircle, FileText, RefreshCw,
  Search, ChevronDown, CheckCircle, User,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listAutoClassified, approveClassification, flagClassification } from '../../api/documentsApi'
import { listCustomers } from '../../api/adminApi'
import DocumentViewerModal from '../../components/documents/DocumentViewerModal'

const PAGE_SIZE = 20

function formatDate(iso) {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch { return '--' }
}

function confidenceColor(pct) {
  if (pct == null) return 'text-gray-400'
  if (pct >= 90) return 'text-emerald-600'
  if (pct >= 50) return 'text-amber-600'
  return 'text-red-600'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function CustomerName({ externalId }) {
  const isUuid = UUID_RE.test(externalId)

  // Search by customerRef (normal path)
  const { data: searchData } = useQuery({
    queryKey: ['customer-by-ref', externalId],
    queryFn: () => listCustomers({ q: externalId, size: 1 }),
    staleTime: 10 * 60_000,
    enabled: !!externalId && !isUuid,
  })

  // Lookup by UUID (when partyExternalId is a party UUID)
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

  return <span>{customer?.displayName ?? externalId}</span>
}

export default function SpotCheckPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [viewingDocId, setViewingDocId] = useState(null)

  const queryParams = { page, size: PAGE_SIZE, ...(search ? { search } : {}) }

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['documents-auto-classified', queryParams],
    queryFn: () => listAutoClassified(queryParams),
    staleTime: 15_000,
  })

  const approveMutation = useMutation({
    mutationFn: ({ id }) => approveClassification(id),
    onSuccess: () => {
      toast.success('Classification verified')
      qc.invalidateQueries({ queryKey: ['documents-auto-classified'] })
      qc.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (err) => toast.error(`Approve failed: ${err.message}`),
  })

  const flagMutation = useMutation({
    mutationFn: ({ id, reason }) => flagClassification(id, reason),
    onSuccess: () => {
      toast.success('Document sent to classification queue')
      qc.invalidateQueries({ queryKey: ['documents-auto-classified'] })
      qc.invalidateQueries({ queryKey: ['documents-needs-classification'] })
      qc.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (err) => toast.error(`Flag failed: ${err.message}`),
  })

  const documents = Array.isArray(data?.content) ? data.content : []
  const totalPages = data?.totalPages ?? 1
  const totalElements = data?.totalElements ?? 0

  const handleApprove = (doc) => {
    approveMutation.mutate({ id: doc.id })
  }

  const handleFlag = (doc) => {
    const reason = window.prompt('Reason for flagging (optional):')
    if (reason === null) return
    flagMutation.mutate({ id: doc.id, reason: reason?.trim() || null })
  }

  const COL_SPAN = 6

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-600" />
          Spot Check
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Audit auto-classified documents — verify classification accuracy and flag mistakes
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search auto-classified documents..."
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
            {totalElements} document{totalElements !== 1 ? 's' : ''}
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

      {/* Table */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Document</th>
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Category</th>
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Customer</th>
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Confidence</th>
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Date</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={COL_SPAN} className="py-20 text-center">
                    <div className="inline-flex flex-col items-center gap-3 text-gray-400">
                      <Loader2 size={28} className="animate-spin" />
                      <span className="text-sm">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={COL_SPAN} className="py-16 text-center">
                    <div className="inline-flex flex-col items-center gap-2">
                      <AlertCircle size={28} className="text-red-400" />
                      <p className="text-sm font-medium text-gray-700">Failed to load</p>
                      <p className="text-xs text-gray-400">{error?.message}</p>
                      <button onClick={() => refetch()} className="mt-2 text-xs text-blue-500 hover:underline">Try again</button>
                    </div>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={COL_SPAN} className="py-20 text-center">
                    <div className="inline-flex flex-col items-center gap-2 text-gray-300">
                      <Shield size={36} />
                      <p className="text-sm text-gray-500 font-medium">No auto-classified documents to review</p>
                      <p className="text-xs text-gray-400">Documents auto-classified with high confidence will appear here</p>
                    </div>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="group border-t border-gray-50 hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-800 font-medium truncate max-w-xs"
                              title={doc.name ?? doc.originalFilename}>
                          {doc.name ?? doc.originalFilename ?? '--'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700">
                        <CheckCircle size={10} />
                        {doc.categoryName ?? `Category #${doc.categoryId}`}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {doc.partyExternalId ? (
                        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                          <User size={12} className="text-gray-400" />
                          <CustomerName externalId={doc.partyExternalId} />
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">--</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs tabular-nums font-medium ${confidenceColor(doc.classificationConfidence)}`}>
                        {doc.classificationConfidence != null
                          ? `${Math.round(doc.classificationConfidence)}%`
                          : '--'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap tabular-nums">
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingDocId(doc.id)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400
                                     hover:text-blue-600 transition-colors"
                          title="View document"
                        >
                          <Eye size={15} />
                        </button>
                        {!doc.classificationSource?.includes('VERIFIED') && (
                          <button
                            onClick={() => handleApprove(doc)}
                            disabled={approveMutation.isPending}
                            className="p-1.5 rounded hover:bg-emerald-50 text-gray-400
                                       hover:text-emerald-600 transition-colors disabled:opacity-40"
                            title="Approve classification"
                          >
                            <CheckCircle size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => handleFlag(doc)}
                          disabled={flagMutation.isPending}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400
                                     hover:text-red-600 transition-colors disabled:opacity-40"
                          title="Flag for reclassification"
                        >
                          <Flag size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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

      {/* Document viewer */}
      {viewingDocId && (
        <DocumentViewerModal
          documentId={viewingDocId}
          onClose={() => setViewingDocId(null)}
        />
      )}
    </div>
  )
}
