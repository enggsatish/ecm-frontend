/**
 * BatchJobsPage.jsx
 * Main batch processing dashboard — stats cards, jobs table, new batch upload.
 */
import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers, Upload, RefreshCw, Search, FileText, AlertCircle,
  Loader2, CheckCircle, Eye, Clock, XCircle, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useBatchJobs, useBatchStats, useCreateBatchJob } from '../../hooks/useBatch'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: '',                    label: 'All Statuses' },
  { value: 'QUEUED',              label: 'Queued' },
  { value: 'PROCESSING',          label: 'Processing' },
  { value: 'COMPLETED',           label: 'Completed' },
  { value: 'COMPLETED_WITH_ERRORS', label: 'Completed with Errors' },
  { value: 'FAILED',              label: 'Failed' },
]

const STATUS_BADGE = {
  CREATED:               { style: 'bg-gray-100 text-gray-500',   icon: Clock },
  QUEUED:                { style: 'bg-gray-100 text-gray-500',   icon: Clock },
  PROCESSING:            { style: 'bg-blue-50 text-blue-700',    icon: Clock },
  COMPLETED:             { style: 'bg-emerald-50 text-emerald-700', icon: CheckCircle },
  COMPLETED_WITH_ERRORS: { style: 'bg-amber-50 text-amber-700',  icon: AlertCircle },
  FAILED:                { style: 'bg-red-50 text-red-600',      icon: XCircle },
}

function getStatusBadge(status) {
  return STATUS_BADGE[status] || { style: 'bg-gray-100 text-gray-500', icon: FileText }
}

function formatDate(iso) {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '--' }
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-800">{value ?? '--'}</p>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
    </div>
  )
}

export default function BatchJobsPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [page, setPage]             = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]         = useState('')
  const [uploadProgress, setUploadProgress] = useState(null)

  const queryParams = {
    page,
    size: PAGE_SIZE,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
  }

  const { data: stats } = useBatchStats()
  const { data, isLoading, isError, error, isFetching, refetch } = useBatchJobs(queryParams)
  const createMutation = useCreateBatchJob()

  const jobs        = Array.isArray(data?.content) ? data.content : []
  const totalPages  = data?.totalPages ?? 1
  const totalElements = data?.totalElements ?? 0

  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploadProgress(0)
    createMutation.mutate(
      { files, metadata: {}, onProgress: setUploadProgress },
      {
        onSuccess: () => {
          toast.success(`Batch uploaded: ${files.length} file(s)`)
          setUploadProgress(null)
          if (fileInputRef.current) fileInputRef.current.value = ''
        },
        onError: (err) => {
          toast.error(`Upload failed: ${err.message}`)
          setUploadProgress(null)
        },
      }
    )
  }, [createMutation])

  const COL_SPAN = 6

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-600" />
            Batch Processing
          </h1>
          <p className="text-sm text-gray-500 mt-1">Upload, track, and review batch document imports</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.tiff"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5
                       text-sm font-medium text-white shadow-sm
                       hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            New Batch
          </button>
        </div>
      </div>

      {/* Upload progress */}
      {uploadProgress !== null && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">Uploading batch...</p>
              <div className="mt-2 h-2 rounded-full bg-blue-200 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-medium text-blue-700">{uploadProgress}%</span>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Processed Today" value={stats?.processedToday} icon={CheckCircle}
                  color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Auto-Filed" value={stats?.autoFiledToday} icon={FileText}
                  color="bg-blue-50 text-blue-600" />
        <StatCard label="In Review" value={stats?.inReviewToday} icon={Eye}
                  color="bg-amber-50 text-amber-600" />
        <StatCard label="Failed" value={stats?.failedToday} icon={XCircle}
                  color="bg-red-50 text-red-600" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search batches..."
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm
                       text-gray-800 placeholder:text-gray-400 focus:outline-none
                       focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-shadow"
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
            className="appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 py-2
                       text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200
                       focus:border-blue-400 transition-shadow"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {isFetching && !isLoading && (
            <Loader2 size={14} className="text-blue-400 animate-spin" />
          )}
          <span className="text-xs text-gray-400 tabular-nums">
            {totalElements} batch{totalElements !== 1 ? 'es' : ''}
          </span>
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-gray-200 p-2 text-gray-400
                       hover:text-gray-700 hover:border-gray-300 transition-colors"
            aria-label="Refresh"
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
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Batch ID</th>
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Uploaded By</th>
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Date</th>
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Items</th>
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Progress</th>
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={COL_SPAN} className="py-20 text-center">
                    <div className="inline-flex flex-col items-center gap-3 text-gray-400">
                      <Loader2 size={28} className="animate-spin" />
                      <span className="text-sm">Loading batches...</span>
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={COL_SPAN} className="py-16 text-center">
                    <div className="inline-flex flex-col items-center gap-2">
                      <AlertCircle size={28} className="text-red-400" />
                      <p className="text-sm font-medium text-gray-700">Failed to load batches</p>
                      <p className="text-xs text-gray-400 max-w-sm">{error?.message ?? 'Unknown error'}</p>
                      <button onClick={() => refetch()} className="mt-2 text-xs text-blue-500 hover:underline">Try again</button>
                    </div>
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={COL_SPAN} className="py-20 text-center">
                    <div className="inline-flex flex-col items-center gap-2 text-gray-300">
                      <Layers size={36} />
                      <p className="text-sm text-gray-500 font-medium">
                        {search || statusFilter ? 'No batches match your filters' : 'No batch jobs yet'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const badge = getStatusBadge(job.status)
                  const BadgeIcon = badge.icon

                  return (
                    <tr
                      key={job.id}
                      onClick={() => navigate(`/batch/jobs/${job.id}`)}
                      className="group border-t border-gray-50 hover:bg-gray-50/70
                                 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 text-sm font-mono text-blue-600">
                        {(job.id ?? '').toString().substring(0, 8)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {job.createdBy ?? '--'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap tabular-nums">
                        {formatDate(job.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 font-medium tabular-nums">
                        {job.totalItems ?? 0}
                      </td>
                      <td className="py-3 px-4">
                        {(() => {
                          const total = job.totalItems || 1
                          const autoFiled = job.autoFiled ?? 0
                          const inReview = job.sentToReview ?? 0
                          const failed = job.failedItems ?? 0
                          const processed = job.processedItems ?? 0
                          return (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden max-w-[120px] flex">
                                {autoFiled > 0 && (
                                  <div className="bg-emerald-500 h-full" style={{ width: `${(autoFiled / total) * 100}%` }} />
                                )}
                                {inReview > 0 && (
                                  <div className="bg-amber-400 h-full" style={{ width: `${(inReview / total) * 100}%` }} />
                                )}
                                {failed > 0 && (
                                  <div className="bg-red-400 h-full" style={{ width: `${(failed / total) * 100}%` }} />
                                )}
                              </div>
                              <span className="text-xs text-gray-400 tabular-nums w-12">
                                {processed}/{total}
                              </span>
                            </div>
                          )
                        })()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5
                                         text-xs font-medium whitespace-nowrap ${badge.style}`}>
                          <BadgeIcon size={12} />
                          {(job.status ?? '').replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
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
    </div>
  )
}
