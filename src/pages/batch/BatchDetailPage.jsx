/**
 * BatchDetailPage.jsx
 * Detail view for a single batch job — stacked progress bar, filterable items
 * table with action buttons (retry, manual classify) for failed/review items.
 */
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DocumentViewerModal from '../../components/documents/DocumentViewerModal'
import ClassifyModal from '../../components/documents/ClassifyModal'
import {
  ArrowLeft, Layers, CheckCircle, Eye, AlertCircle, XCircle,
  Loader2, FileText, Clock, RefreshCw, Edit3,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useBatchJob, useBatchItems, useRetryReviewItem,
  useApproveReviewItem,
} from '../../hooks/useBatch'

const PAGE_SIZE = 20

const TABS = [
  { key: '',              label: 'All' },
  { key: 'AUTO_FILED',    label: 'Auto-Filed' },
  { key: 'REVIEW_COMPLETE', label: 'Reviewed' },
  { key: 'IN_REVIEW',     label: 'In Review' },
  { key: 'FAILED',        label: 'Failed' },
]

const ITEM_STATUS_BADGE = {
  QUEUED:           { style: 'bg-gray-100 text-gray-500',      label: 'Queued' },
  PROCESSING:       { style: 'bg-blue-50 text-blue-700',       label: 'Processing' },
  AUTO_FILED:       { style: 'bg-emerald-50 text-emerald-700', label: 'Auto-Filed' },
  IN_REVIEW:        { style: 'bg-amber-50 text-amber-700',     label: 'In Review' },
  REVIEW_COMPLETE:  { style: 'bg-emerald-50 text-emerald-700', label: 'Reviewed' },
  FAILED:           { style: 'bg-red-50 text-red-600',         label: 'Failed' },
}

const JOB_STATUS_BADGE = {
  CREATED:               { style: 'bg-gray-50 text-gray-600',       icon: Clock },
  QUEUED:                { style: 'bg-gray-50 text-gray-600',       icon: Clock },
  PROCESSING:            { style: 'bg-blue-50 text-blue-700',       icon: Clock },
  COMPLETED:             { style: 'bg-emerald-50 text-emerald-700', icon: CheckCircle },
  COMPLETED_WITH_ERRORS: { style: 'bg-amber-50 text-amber-700',     icon: AlertCircle },
  FAILED:                { style: 'bg-red-50 text-red-600',         icon: XCircle },
}

function getItemBadge(status) {
  return ITEM_STATUS_BADGE[status] || { style: 'bg-gray-100 text-gray-500', label: status || '--' }
}

function formatDate(iso) {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '--' }
}

function confidenceColor(pct) {
  if (pct == null) return 'text-gray-400'
  if (pct >= 90) return 'text-emerald-600'
  if (pct >= 50) return 'text-amber-600'
  return 'text-red-600'
}

/* ── Stacked progress bar ────────────────────────────────────────────────── */
function StackedProgress({ job }) {
  const total = job.totalItems || 1
  const autoFiled = job.autoFiled ?? 0
  const reviewed = (job.processedItems ?? 0) - autoFiled - (job.sentToReview ?? 0) - (job.failedItems ?? 0)
  const inReview = job.sentToReview ?? 0
  const failed = job.failedItems ?? 0
  const processed = job.processedItems ?? 0

  const pctAuto   = (autoFiled / total) * 100
  const pctReview = (inReview / total) * 100
  const pctFailed = (failed / total) * 100

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
        <span className="font-medium">{processed}/{total} processed</span>
        <span className="tabular-nums">{Math.round((processed / total) * 100)}%</span>
      </div>
      <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
        {pctAuto > 0 && (
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${pctAuto}%` }}
            title={`${autoFiled} auto-filed`}
          />
        )}
        {reviewed > 0 && (
          <div
            className="bg-blue-500 transition-all duration-500"
            style={{ width: `${(reviewed / total) * 100}%` }}
            title={`${reviewed} reviewed`}
          />
        )}
        {pctReview > 0 && (
          <div
            className="bg-amber-400 transition-all duration-500"
            style={{ width: `${pctReview}%` }}
            title={`${inReview} in review`}
          />
        )}
        {pctFailed > 0 && (
          <div
            className="bg-red-400 transition-all duration-500"
            style={{ width: `${pctFailed}%` }}
            title={`${failed} failed`}
          />
        )}
      </div>
      <div className="flex gap-4 mt-2 text-xs">
        {autoFiled > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> {autoFiled} Auto-Filed
          </span>
        )}
        {inReview > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> {inReview} In Review
          </span>
        )}
        {failed > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" /> {failed} Failed
          </span>
        )}
      </div>
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function BatchDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [tab, setTab]   = useState('')
  const [page, setPage] = useState(0)
  const [classifyingId, setClassifyingId] = useState(null)
  const [viewingDocId, setViewingDocId] = useState(null)

  const { data: job, isLoading: jobLoading } = useBatchJob(id)

  const itemParams = {
    page,
    size: PAGE_SIZE,
    ...(tab ? { status: tab } : {}),
  }
  const { data: itemsData, isLoading: itemsLoading, isError, error, refetch } = useBatchItems(id, itemParams)

  const items       = Array.isArray(itemsData?.content) ? itemsData.content : []
  const totalPages  = itemsData?.totalPages ?? 1

  const retryMutation = useRetryReviewItem()
  const approveMutation = useApproveReviewItem()

  const jobBadge = JOB_STATUS_BADGE[job?.status] || { style: 'bg-gray-100 text-gray-500', icon: FileText }
  const JobIcon = jobBadge.icon

  const COL_SPAN = 7

  function handleRetry(itemId) {
    retryMutation.mutate({ itemId }, {
      onSuccess: (res) => {
        const newStatus = res?.status ?? 'updated'
        if (newStatus === 'AUTO_FILED') {
          toast.success('Document already classified — reconciled')
        } else {
          toast.success('Item re-queued for processing')
        }
      },
      onError: (err) => toast.error(`Retry failed: ${err.message}`),
    })
  }

  function handleApprove(itemId, data) {
    approveMutation.mutate({ itemId, data }, {
      onSuccess: () => {
        toast.success('Item classified and approved')
        setClassifyingId(null)
      },
      onError: (err) => toast.error(`Approval failed: ${err.message}`),
    })
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/batch/jobs')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Batches
        </button>

        {jobLoading ? (
          <div className="flex items-center gap-3 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading batch details...</span>
          </div>
        ) : job ? (
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600" />
                  Batch {(job.id ?? '').toString().substring(0, 8)}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {job.source === 'AUTO_CLASSIFY' ? 'Auto-classify' : 'Uploaded'} by {job.createdBy ?? 'Unknown'} on {formatDate(job.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => refetch()}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-400
                             hover:text-gray-700 hover:border-gray-300 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={14} />
                </button>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5
                                 text-xs font-medium whitespace-nowrap ${jobBadge.style}`}>
                  <JobIcon size={12} />
                  {(job.status ?? '').replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            <StackedProgress job={job} />
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400">
            <AlertCircle size={28} className="mx-auto mb-2" />
            <p className="text-sm">Batch not found</p>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(0) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
                       ${tab === t.key
                         ? 'border-blue-500 text-blue-600'
                         : 'border-transparent text-gray-500 hover:text-gray-700'
                       }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Items table */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Filename</th>
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Category</th>
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Customer</th>
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Confidence</th>
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Status</th>
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Error / Notes</th>
                <th className="py-3 px-4 text-right text-xs uppercase tracking-wide font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {itemsLoading ? (
                <tr>
                  <td colSpan={COL_SPAN} className="py-20 text-center">
                    <div className="inline-flex flex-col items-center gap-3 text-gray-400">
                      <Loader2 size={28} className="animate-spin" />
                      <span className="text-sm">Loading items...</span>
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={COL_SPAN} className="py-16 text-center">
                    <div className="inline-flex flex-col items-center gap-2">
                      <AlertCircle size={28} className="text-red-400" />
                      <p className="text-sm font-medium text-gray-700">Failed to load items</p>
                      <p className="text-xs text-gray-400">{error?.message}</p>
                      <button onClick={() => refetch()} className="mt-2 text-xs text-blue-500 hover:underline">Try again</button>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={COL_SPAN} className="py-20 text-center">
                    <div className="inline-flex flex-col items-center gap-2 text-gray-300">
                      <FileText size={36} />
                      <p className="text-sm text-gray-500 font-medium">No items in this filter</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const badge = getItemBadge(item.status)
                  const catConf  = item.categoryConfidence
                  const custConf = item.customerConfidence
                  const isActionable = item.status === 'FAILED' || item.status === 'IN_REVIEW'
                  const isRetrying = retryMutation.isPending && retryMutation.variables?.itemId === item.id

                  return (
                    <tr key={item.id} className="group border-t border-gray-50 hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-800 font-medium truncate max-w-[200px]" title={item.originalFilename}>
                            {item.originalFilename ?? '--'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {item.finalCategoryId ? `#${item.finalCategoryId}` : item.detectedCategoryId ? `#${item.detectedCategoryId}` : <span className="text-gray-300">--</span>}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {item.extractedName
                          ?? (item.finalCustomerId
                            ? <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded" title={item.finalCustomerId}>Assigned</span>
                            : item.detectedCustomerId
                              ? item.detectedCustomerId.toString().substring(0, 8)
                              : <span className="text-gray-300">--</span>
                          )
                        }
                      </td>
                      <td className="py-3 px-4">
                        {item.status === 'REVIEW_COMPLETE' ? (
                          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            Manual
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 text-xs tabular-nums">
                            <span className={confidenceColor(catConf)}>
                              Cat: {catConf != null ? `${catConf}%` : '--'}
                            </span>
                            <span className="text-gray-300">|</span>
                            <span className={confidenceColor(custConf)}>
                              Cust: {custConf != null ? `${custConf}%` : '--'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5
                                         text-xs font-medium whitespace-nowrap ${badge.style}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {item.errorMessage && (
                          <span className="text-xs text-red-500 truncate max-w-[180px] block" title={item.errorMessage}>
                            {item.errorMessage}
                          </span>
                        )}
                        {item.reviewNotes && !item.errorMessage && (
                          <span className="text-xs text-gray-500 truncate max-w-[180px] block" title={item.reviewNotes}>
                            {item.reviewNotes}
                          </span>
                        )}
                        {!item.errorMessage && !item.reviewNotes && (
                          <span className="text-gray-300 text-xs">--</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {item.documentId && (
                            <button
                              onClick={() => setViewingDocId(item.documentId)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                              title="View document"
                            >
                              <Eye size={15} />
                            </button>
                          )}
                          {item.status === 'FAILED' && (
                            <button
                              onClick={() => handleRetry(item.id)}
                              disabled={isRetrying}
                              className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600
                                         disabled:opacity-40 transition-colors"
                              title="Auto Retry (reconcile + re-queue)"
                            >
                              {isRetrying ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                            </button>
                          )}
                          {isActionable && (
                            <button
                              onClick={() => setClassifyingId(classifyingId === item.id ? null : item.id)}
                              className={`p-1.5 rounded transition-colors ${
                                classifyingId === item.id
                                  ? 'bg-blue-100 text-blue-600'
                                  : 'hover:bg-amber-50 text-gray-400 hover:text-amber-600'
                              }`}
                              title="Manual Classify"
                            >
                              <Edit3 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Classify modal — shared component */}
      {classifyingId && (() => {
        const item = items.find(i => i.id === classifyingId)
        if (!item) return null
        return (
          <ClassifyModal
            key={classifyingId}
            documentName={item.originalFilename}
            initialCategoryId={item.detectedCategoryId ?? item.finalCategoryId}
            isPending={approveMutation.isPending}
            onSubmit={(data) => handleApprove(item.id, data)}
            onCancel={() => setClassifyingId(null)}
          />
        )
      })()}

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
