import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, AlertCircle, RefreshCw, UserCheck, UserX,
  CheckCircle2, XCircle, MessageSquare, ArrowRight,
  Clock, FileText, Inbox as InboxIcon,
} from 'lucide-react'
import {
  getMyInbox, claimTask, unclaimTask,
  approveTask, rejectTask, requestInfo, passToSpecialist, provideInfo,
} from '../../api/workflowApi'
import toast from 'react-hot-toast'

// -- Helpers ------------------------------------------------------------------

function formatDate(iso) {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '--' }
}

function statusBadge(status) {
  switch (status) {
    case 'CLAIMED':  return 'bg-blue-50 text-blue-700'
    case 'PENDING':  return 'bg-amber-50 text-amber-700'
    default:         return 'bg-gray-100 text-gray-500'
  }
}

// -- Task Action Modal --------------------------------------------------------

function TaskActionModal({ task, action, onClose, onSubmit, isPending }) {
  const [comment, setComment] = useState('')

  const needsComment = action === 'reject' || action === 'request-info'
  const labels = {
    approve:        { title: 'Approve Document',  btn: 'Approve',       color: 'bg-emerald-600 hover:bg-emerald-700' },
    reject:         { title: 'Reject Document',    btn: 'Reject',        color: 'bg-red-600 hover:bg-red-700' },
    'request-info': { title: 'Request More Info',  btn: 'Send Request',  color: 'bg-amber-600 hover:bg-amber-700' },
    pass:           { title: 'Pass to Specialist', btn: 'Pass',          color: 'bg-primary-600 hover:bg-primary-700' },
  }
  const label = labels[action] || labels.approve

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{label.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {task.documentName || task.taskName || 'Document'}
          </p>
        </div>

        <div className="px-6 py-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Comment {needsComment ? '(required)' : '(optional)'}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={needsComment ? 'Please provide a reason...' : 'Optional comment...'}
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm
                       text-gray-800 placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-200
                       focus:border-blue-400 transition-shadow resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg
                       hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(comment)}
            disabled={isPending || (needsComment && !comment.trim())}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg
                       shadow-sm transition-colors disabled:opacity-50
                       ${label.color}`}
          >
            {isPending
              ? <Loader2 size={14} className="animate-spin inline mr-1.5" />
              : null}
            {label.btn}
          </button>
        </div>
      </div>
    </div>
  )
}


// -- Provide Info Form (for submitter's INFO_REQUESTED tasks) -----------------
// Rendered instead of reviewer actions when taskName === "Provide Additional Information"

function ProvideInfoForm({ taskId, onSuccess }) {
  const [comment, setComment] = useState('')
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async () => {
    if (!comment.trim()) return
    setIsPending(true)
    try {
      await provideInfo(taskId, { comment })
      toast.success('Information submitted — document returned to reviewer queue')
      onSuccess()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit information')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-amber-100 bg-amber-50/40 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare size={13} className="text-amber-600" />
        <span className="text-xs font-semibold text-amber-700">Additional Information Requested</span>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Provide the requested information..."
        rows={3}
        className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm
                   text-gray-800 placeholder:text-gray-400 bg-white
                   focus:outline-none focus:ring-2 focus:ring-amber-200
                   focus:border-amber-400 transition-shadow resize-none"
      />
      <div className="flex justify-end mt-2">
        <button
          onClick={handleSubmit}
          disabled={isPending || !comment.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                     text-xs font-medium text-white bg-amber-600
                     hover:bg-amber-700 shadow-sm transition-colors
                     disabled:opacity-50"
        >
          {isPending && <Loader2 size={12} className="animate-spin" />}
          Submit Information
        </button>
      </div>
    </div>
  )
}

// -- Main Component -----------------------------------------------------------

export default function TaskInbox() {
  const qc = useQueryClient()
  const [actionState, setActionState] = useState(null) // { task, action }

  const { data: tasks, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['workflow', 'inbox'],
    queryFn:  getMyInbox,
    throwOnError: false,
    refetchInterval: 30_000,  // poll every 30s for new tasks
  })

  const taskList = Array.isArray(tasks) ? tasks : []

  // -- Mutations ---------------------------------------------------------------

  const claimMut = useMutation({
    mutationFn: (taskId) => claimTask(taskId),
    onSuccess: () => { toast.success('Task claimed'); qc.invalidateQueries({ queryKey: ['workflow'] }) },
    onError: (err) => toast.error(`Claim failed: ${err.message}`),
  })

  const unclaimMut = useMutation({
    mutationFn: (taskId) => unclaimTask(taskId),
    onSuccess: () => { toast.success('Task returned to pool'); qc.invalidateQueries({ queryKey: ['workflow'] }) },
    onError: (err) => toast.error(`Unclaim failed: ${err.message}`),
  })

  const actionMut = useMutation({
    mutationFn: ({ taskId, action, comment }) => {
      switch (action) {
        case 'approve':        return approveTask(taskId, comment)
        case 'reject':         return rejectTask(taskId, comment)
        case 'request-info':   return requestInfo(taskId, comment)
        case 'pass':           return passToSpecialist(taskId, comment)
        default: throw new Error('Unknown action: ' + action)
      }
    },
    onSuccess: (_, { action }) => {
      const labels = { approve: 'approved', reject: 'rejected', 'request-info': 'info requested', pass: 'passed to specialist' }
      toast.success(`Document ${labels[action] || 'processed'}`)
      setActionState(null)
      qc.invalidateQueries({ queryKey: ['workflow'] })
    },
    onError: (err) => toast.error(`Action failed: ${err.message}`),
  })

  // -- Render -----------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-flex flex-col items-center gap-3 text-gray-400">
          <Loader2 size={28} className="animate-spin" />
          <span className="text-sm">Loading inbox...</span>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle size={28} className="text-red-400 mb-2" />
        <p className="text-sm font-medium text-gray-700">Failed to load inbox</p>
        <p className="text-xs text-gray-400 max-w-sm text-center mt-1">
          {error?.message || 'Could not reach ecm-workflow service on port 8083'}
        </p>
        <button onClick={() => refetch()}
                className="mt-3 text-xs text-blue-500 hover:underline">
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 tabular-nums">
          {taskList.length} task{taskList.length !== 1 ? 's' : ''} in inbox
        </span>
        <div className="flex items-center gap-2">
          {isFetching && !isLoading && (
            <Loader2 size={14} className="text-blue-400 animate-spin" />
          )}
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

      {/* Empty state */}
      {taskList.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm
                        flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center
                          justify-center mb-3">
            <InboxIcon size={24} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-600">Inbox is empty</p>
          <p className="text-xs text-gray-400 mt-1">
            No pending tasks assigned to you or your groups
          </p>
        </div>
      )}

      {/* Task cards */}
      {taskList.length > 0 && (
        <div className="flex flex-col gap-3">
          {taskList.map((task) => (
            <div key={task.taskId}
                 className="bg-white rounded-xl border border-gray-100 shadow-sm
                            hover:shadow-md transition-shadow duration-200 overflow-hidden">
              <div className="px-5 py-4">
                {/* Detect submitter "Provide Additional Information" task */}
                {(() => {
                  const isInfoTask = task.taskName === 'Provide Additional Information'
                  return (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: task info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[10px]
                                             font-semibold ${statusBadge(task.status)}`}>
                              {task.status}
                            </span>
                            <span className={`text-[10px] font-medium ${isInfoTask ? 'text-amber-600' : 'text-gray-400'}`}>
                              {task.taskName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mb-1">
                            <FileText size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-800 truncate">
                              {task.documentName || 'Untitled Document'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {formatDate(task.createTime)}
                            </span>
                            {task.assignee && (
                              <span className="flex items-center gap-1">
                                <UserCheck size={11} />
                                Claimed by you
                              </span>
                            )}
                            {!task.assignee && task.candidateGroups?.length > 0 && (
                              <span className="text-amber-600">
                                Pool: {task.candidateGroups.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right: actions — suppressed for info tasks (inline form below) */}
                        {!isInfoTask && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Unclaimed: show Claim button */}
                            {!task.assignee && (
                              <button
                                onClick={() => claimMut.mutate(task.taskId)}
                                disabled={claimMut.isPending}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5
                                           rounded-lg text-xs font-medium text-white
                                           bg-primary-600 hover:bg-primary-700
                                           shadow-sm transition-colors disabled:opacity-50"
                              >
                                <UserCheck size={13} /> Claim
                              </button>
                            )}

                            {/* Claimed: show reviewer action buttons */}
                            {task.assignee && (
                              <>
                                <button
                                  onClick={() => setActionState({ task, action: 'approve' })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5
                                             rounded-lg text-xs font-medium
                                             text-emerald-700 bg-emerald-50
                                             hover:bg-emerald-100 transition-colors"
                                  title="Approve"
                                >
                                  <CheckCircle2 size={13} /> Approve
                                </button>
                                <button
                                  onClick={() => setActionState({ task, action: 'reject' })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5
                                             rounded-lg text-xs font-medium
                                             text-red-700 bg-red-50
                                             hover:bg-red-100 transition-colors"
                                  title="Reject"
                                >
                                  <XCircle size={13} /> Reject
                                </button>
                                <button
                                  onClick={() => setActionState({ task, action: 'request-info' })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5
                                             rounded-lg text-xs font-medium
                                             text-amber-700 bg-amber-50
                                             hover:bg-amber-100 transition-colors"
                                  title="Request Info"
                                >
                                  <MessageSquare size={13} />
                                </button>
                                {task.taskName?.includes('Triage') && (
                                  <button
                                    onClick={() => setActionState({ task, action: 'pass' })}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5
                                               rounded-lg text-xs font-medium
                                               text-primary-700 bg-primary-50
                                               hover:bg-primary-100 transition-colors"
                                    title="Pass to Specialist"
                                  >
                                    <ArrowRight size={13} /> Pass
                                  </button>
                                )}
                                <button
                                  onClick={() => unclaimMut.mutate(task.taskId)}
                                  disabled={unclaimMut.isPending}
                                  className="inline-flex items-center gap-1 px-2 py-1.5
                                             rounded-lg text-xs font-medium
                                             text-gray-500 hover:bg-gray-100
                                             transition-colors disabled:opacity-50"
                                  title="Return to pool"
                                >
                                  <UserX size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Inline provide-info form for submitter tasks */}
                      {isInfoTask && (
                        <ProvideInfoForm
                          taskId={task.taskId}
                          onSuccess={() => refetch()}
                        />
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action modal */}
      {actionState && (
        <TaskActionModal
          task={actionState.task}
          action={actionState.action}
          onClose={() => setActionState(null)}
          onSubmit={(comment) =>
            actionMut.mutate({
              taskId: actionState.task.taskId,
              action: actionState.action,
              comment,
            })
          }
          isPending={actionMut.isPending}
        />
      )}
    </div>
  )
}