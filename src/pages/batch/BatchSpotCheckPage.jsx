/**
 * BatchSpotCheckPage.jsx
 * Auto-processed spot check — review auto-filed items and flag any mistakes.
 */
import { useState } from 'react'
import {
  Shield, Eye, Flag, Loader2, AlertCircle, FileText, RefreshCw,
  Search, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAutoProcessed, useFlagReviewItem } from '../../hooks/useBatch'

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

export default function BatchSpotCheckPage() {
  const [page, setPage]     = useState(0)
  const [search, setSearch] = useState('')
  const [minConf, setMinConf] = useState('')
  const [dateFrom, setDateFrom] = useState('')

  const queryParams = {
    page,
    size: PAGE_SIZE,
    ...(search ? { search } : {}),
    ...(minConf ? { minConfidence: minConf } : {}),
    ...(dateFrom ? { dateFrom } : {}),
  }

  const { data, isLoading, isError, error, isFetching, refetch } = useAutoProcessed(queryParams)
  const flagMutation = useFlagReviewItem()

  const items       = Array.isArray(data?.content) ? data.content : []
  const totalPages  = data?.totalPages ?? 1
  const totalElements = data?.totalElements ?? 0

  const handleFlag = (item) => {
    const reason = window.prompt('Reason for flagging (optional):')
    flagMutation.mutate(
      { itemId: item.id, data: { reason: reason?.trim() || null } },
      {
        onSuccess: () => toast.success('Item flagged and sent to review queue'),
        onError: (err) => toast.error(`Flag failed: ${err.message}`),
      }
    )
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
          Review auto-processed items and flag any that were incorrectly classified
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
            placeholder="Search auto-processed..."
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm
                       text-gray-800 placeholder:text-gray-400 focus:outline-none
                       focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-shadow"
          />
        </div>

        <div className="relative">
          <select
            value={minConf}
            onChange={(e) => { setMinConf(e.target.value); setPage(0) }}
            className="appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 py-2
                       text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200
                       focus:border-blue-400 transition-shadow"
          >
            <option value="">Any Confidence</option>
            <option value="50">Min 50%</option>
            <option value="70">Min 70%</option>
            <option value="90">Min 90%</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(0) }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700
                     focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-shadow"
        />

        <div className="flex items-center gap-2 ml-auto">
          {isFetching && !isLoading && (
            <Loader2 size={14} className="text-blue-400 animate-spin" />
          )}
          <span className="text-xs text-gray-400 tabular-nums">
            {totalElements} item{totalElements !== 1 ? 's' : ''}
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
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wide font-semibold text-gray-500">Filename</th>
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
                      <span className="text-sm">Loading auto-processed items...</span>
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
                      <Shield size={36} />
                      <p className="text-sm text-gray-500 font-medium">No auto-processed items to review</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const catConf  = item.categoryConfidence ?? item.confidence
                  const custConf = item.customerConfidence

                  return (
                    <tr key={item.id} className="group border-t border-gray-50 hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-800 font-medium truncate max-w-xs" title={item.filename}>
                            {item.filename ?? '--'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {item.category ?? item.detectedCategory ?? '--'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {item.customer ?? item.detectedCustomer ?? '--'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-xs tabular-nums">
                          <span className={confidenceColor(catConf)}>
                            {catConf != null ? `${catConf}%` : '--'}
                          </span>
                          {custConf != null && (
                            <>
                              <span className="text-gray-300">/</span>
                              <span className={confidenceColor(custConf)}>
                                {custConf}%
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap tabular-nums">
                        {formatDate(item.processedAt ?? item.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.documentId && (
                            <button
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400
                                         hover:text-blue-600 transition-colors"
                              title="View document"
                            >
                              <Eye size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => handleFlag(item)}
                            disabled={flagMutation.isPending}
                            className="p-1.5 rounded hover:bg-red-50 text-gray-400
                                       hover:text-red-600 transition-colors disabled:opacity-40"
                            title="Flag for review"
                          >
                            <Flag size={15} />
                          </button>
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
    </div>
  )
}
