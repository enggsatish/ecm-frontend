import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, AlertCircle, RefreshCw, ListChecks, XCircle,
  ChevronUp, ChevronDown, ChevronsUpDown, Clock, User,
} from 'lucide-react'
import { listWorkflowInstances, cancelWorkflow } from '../../api/workflowApi'
import useUserStore from '../../store/userStore'
import toast from 'react-hot-toast'

function formatDate(iso) {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch { return '--' }
}

// STATUS_CONFIG: single source of truth for all workflow instance statuses.
// INFO_REQUESTED added in backend workflow refactor (March 2026):
//   reviewer request-info → instance moves to INFO_REQUESTED
//   submitter provide-info → instance moves back to ACTIVE
const STATUS_CONFIG = {
  ACTIVE:             { label: 'Active',         style: 'bg-blue-50 text-blue-700'        },
  INFO_REQUESTED:     { label: 'Info Requested', style: 'bg-amber-50 text-amber-700'      },
  COMPLETED_APPROVED: { label: 'Approved',       style: 'bg-emerald-50 text-emerald-700'  },
  COMPLETED_REJECTED: { label: 'Rejected',       style: 'bg-red-50 text-red-700'          },
  CANCELLED:          { label: 'Cancelled',      style: 'bg-gray-100 text-gray-500'       },
}
export const ALL_INSTANCE_STATUSES = Object.keys(STATUS_CONFIG)

function statusStyle(status) {
  return STATUS_CONFIG[status]?.style ?? 'bg-gray-100 text-gray-500'
}

function statusLabel(status) {
  return STATUS_CONFIG[status]?.label ?? (status || '--')
}

function triggerBadge(type) {
  return type === 'AUTO'
    ? 'bg-purple-50 text-purple-600'
    : 'bg-gray-100 text-gray-500'
}

function SortButton({ field, label, sort, onSort }) {
  const active = sort.field === field
  return (
    <button onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 font-semibold text-xs
                 uppercase tracking-wide text-gray-500
                 hover:text-gray-800 transition-colors">
      {label}
      {active
        ? sort.dir === 'asc' ? <ChevronUp size={13}/> : <ChevronDown size={13}/>
        : <ChevronsUpDown size={13} className="opacity-30"/>}
    </button>
  )
}

function CancelButton({ instance, onCancel }) {
  const [confirm, setConfirm] = useState(false)
  if (instance.status !== 'ACTIVE') return null
  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="text-red-600 font-medium">Cancel?</span>
        <button onClick={() => { onCancel(instance.id); setConfirm(false) }}
          className="rounded px-1.5 py-0.5 bg-red-600 text-white hover:bg-red-700 transition-colors">Yes</button>
        <button onClick={() => setConfirm(false)}
          className="rounded px-1.5 py-0.5 bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">No</button>
      </span>
    )
  }
  return (
    <button onClick={() => setConfirm(true)}
      className="text-gray-300 hover:text-red-500 transition-colors" aria-label="Cancel workflow">
      <XCircle size={15}/>
    </button>
  )
}

const PAGE_SIZE = 20

export default function InstanceList() {
  const qc = useQueryClient()
  const { hasRole } = useUserStore()
  const isAdmin = hasRole('ECM_ADMIN')
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState({ field: 'createdAt', dir: 'desc' })

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['workflow', 'instances', { page, size: PAGE_SIZE }],
    queryFn:  () => listWorkflowInstances({ page, size: PAGE_SIZE }),
    placeholderData: (prev) => prev,
    throwOnError: false,
  })

  const instances     = Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : []
  const totalPages    = data?.totalPages ?? 1
  const totalElements = data?.totalElements ?? instances.length

  const handleSort = useCallback((field) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'desc' })
  }, [])

  const cancelMut = useMutation({
    mutationFn: (id) => cancelWorkflow(id),
    onSuccess: () => { toast.success('Workflow cancelled'); qc.invalidateQueries({ queryKey: ['workflow'] }) },
    onError: (err) => toast.error(`Cancel failed: ${err.message}`),
  })

  const renderBody = () => {
    if (isLoading) {
      return (<tr><td colSpan={7} className="py-20 text-center">
        <div className="inline-flex flex-col items-center gap-3 text-gray-400">
          <Loader2 size={28} className="animate-spin"/>
          <span className="text-sm">Loading workflows...</span>
        </div>
      </td></tr>)
    }
    if (isError) {
      return (<tr><td colSpan={7} className="py-16 text-center">
        <div className="inline-flex flex-col items-center gap-2">
          <AlertCircle size={28} className="text-red-400"/>
          <p className="text-sm font-medium text-gray-700">Failed to load workflows</p>
          <p className="text-xs text-gray-400 max-w-sm">{error?.message || 'Service unavailable'}</p>
          <button onClick={() => refetch()} className="mt-2 text-xs text-blue-500 hover:underline">Try again</button>
        </div>
      </td></tr>)
    }
    if (instances.length === 0) {
      return (<tr><td colSpan={7} className="py-20 text-center">
        <div className="inline-flex flex-col items-center gap-2 text-gray-300">
          <ListChecks size={36}/> <p className="text-sm text-gray-500 font-medium">No workflow instances</p>
        </div>
      </td></tr>)
    }
    return instances.map((inst) => (
      <tr key={inst.id} className="group border-t border-gray-50 hover:bg-gray-50/70 transition-colors">
        <td className="py-3 px-4">
          <span className="text-sm text-gray-800 font-medium truncate block max-w-xs" title={inst.documentName}>
            {inst.documentName || '--'}
          </span>
        </td>
        <td className="py-3 px-4 text-sm text-gray-500">{inst.workflowDefinitionName || '--'}</td>
        <td className="py-3 px-4">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${triggerBadge(inst.triggerType)}`}>
            {inst.triggerType}
          </span>
        </td>
        <td className="py-3 px-4">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle(inst.status)}`}>
            {statusLabel(inst.status)}
          </span>
        </td>
        <td className="py-3 px-4 text-sm text-gray-500">
          <span className="flex items-center gap-1"><User size={12} className="text-gray-400"/>{inst.startedByEmail || '--'}</span>
        </td>
        <td className="py-3 px-4 text-sm text-gray-500 tabular-nums whitespace-nowrap">
          <span className="flex items-center gap-1"><Clock size={12} className="text-gray-400"/>{formatDate(inst.createdAt)}</span>
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            {isAdmin && <CancelButton instance={inst} onCancel={(id) => cancelMut.mutate(id)}/>}
          </div>
        </td>
      </tr>
    ))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 tabular-nums">
          {totalElements} workflow{totalElements !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          {isFetching && !isLoading && <Loader2 size={14} className="text-blue-400 animate-spin"/>}
          <button onClick={() => refetch()} className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors" aria-label="Refresh">
            <RefreshCw size={14}/>
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="py-3 px-4 text-left"><SortButton field="documentName" label="Document" sort={sort} onSort={handleSort}/></th>
                <th className="py-3 px-4 text-left"><span className="text-xs uppercase tracking-wide font-semibold text-gray-500">Workflow</span></th>
                <th className="py-3 px-4 text-left"><span className="text-xs uppercase tracking-wide font-semibold text-gray-500">Trigger</span></th>
                <th className="py-3 px-4 text-left"><span className="text-xs uppercase tracking-wide font-semibold text-gray-500">Status</span></th>
                <th className="py-3 px-4 text-left"><span className="text-xs uppercase tracking-wide font-semibold text-gray-500">Started by</span></th>
                <th className="py-3 px-4 text-left"><SortButton field="createdAt" label="Date" sort={sort} onSort={handleSort}/></th>
                <th className="py-3 px-4"/>
              </tr>
            </thead>
            <tbody>{renderBody()}</tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400 text-xs">Page {page + 1} of {totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Previous</button>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}