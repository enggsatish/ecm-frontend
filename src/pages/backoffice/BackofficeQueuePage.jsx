/**
 * BackofficeQueuePage.jsx
 * Route: /backoffice/queue
 * Roles: ECM_BACKOFFICE, ECM_REVIEWER, ECM_ADMIN
 *
 * Promoted backoffice task inbox with three tabs:
 *   Unassigned | My Tasks | Completed (30 days)
 *
 * Includes party context, SLA badges, and full action modals.
 */
import { useState } from 'react'
import {
  Inbox, UserCheck, CheckCircle2, Clock, RefreshCw,
  Building2, FileText, AlertCircle, ChevronDown,
  CheckCircle, XCircle, MessageSquare, UserMinus, Loader2,
  Forward,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { formatDistanceToNow, format } from 'date-fns'
import apiClient from '../../api/apiClient'
import useUserStore from '../../store/userStore'

// ── API wrappers ──────────────────────────────────────────────────────────────
const unwrap = r => r.data?.data ?? r.data

const getQueue       = (assignedToMe) =>
  apiClient.get('/api/workflow/tasks/queue', { params: { assignedToMe } }).then(unwrap)
const claimTask      = (taskId) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/claim`).then(unwrap)
const releaseTask    = (taskId, comment) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/release`, { comment }).then(unwrap)
const adminRelease   = (taskId) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/admin-release`).then(unwrap)
const approveTask    = (taskId, comment) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/approve`, { decision: 'APPROVED', comment }).then(unwrap)
const rejectTask     = (taskId, comment) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/reject`, { decision: 'REJECTED', comment }).then(unwrap)
const requestInfo    = (taskId, comment) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/request-info`, { decision: 'REQUEST_INFO', comment }).then(unwrap)
const passTask       = (taskId, comment) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/pass`, { decision: 'PASS', comment }).then(unwrap)
const getHistory     = (taskId) =>
  apiClient.get(`/api/workflow/tasks/${taskId}/history`).then(unwrap)

// ── SLA badge config ──────────────────────────────────────────────────────────
const SLA_CONFIG = {
  ON_TRACK:  { label: 'On Track',  color: 'bg-green-100 text-green-700 border-green-200' },
  WARNING:   { label: 'Warning',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
  ESCALATED: { label: 'Escalated', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  BREACHED:  { label: 'Breached',  color: 'bg-red-100 text-red-700 border-red-200' },
}

function SlaBadge({ status }) {
  const cfg = SLA_CONFIG[status] ?? SLA_CONFIG.ON_TRACK
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      <Clock size={10} />
      {cfg.label}
    </span>
  )
}

function PartyTag({ externalId, displayName, partyType }) {
  if (!externalId) return null
  const colors = {
    COMMERCIAL: 'bg-blue-50 text-blue-700 border-blue-200',
    SMB:        'bg-purple-50 text-purple-700 border-purple-200',
    RETAIL:     'bg-gray-50 text-gray-600 border-gray-200',
  }
  const color = colors[partyType] ?? colors.RETAIL
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${color}`}>
      <Building2 size={10} />
      {displayName || externalId}
    </span>
  )
}

// ── Action Modal ──────────────────────────────────────────────────────────────
function ActionModal({ task, action, onClose, onConfirm, isPending }) {
  const [comment, setComment] = useState('')

  const config = {
    approve:      { title: 'Approve Task',           icon: CheckCircle,    iconColor: 'text-green-500',  bg: 'bg-green-50',   requireNote: false, btnClass: 'bg-green-600 hover:bg-green-700' },
    reject:       { title: 'Reject Task',            icon: XCircle,        iconColor: 'text-red-500',    bg: 'bg-red-50',     requireNote: true,  btnClass: 'bg-red-600 hover:bg-red-700' },
    'req-info':   { title: 'Request Information',    icon: MessageSquare,  iconColor: 'text-blue-500',   bg: 'bg-blue-50',    requireNote: true,  btnClass: 'bg-blue-600 hover:bg-blue-700' },
    pass:         { title: 'Pass to Backoffice',     icon: Forward,        iconColor: 'text-purple-500', bg: 'bg-purple-50',  requireNote: false, btnClass: 'bg-purple-600 hover:bg-purple-700' },
    release:      { title: 'Release Task',           icon: UserMinus,      iconColor: 'text-gray-500',   bg: 'bg-gray-50',    requireNote: false, btnClass: 'bg-gray-600 hover:bg-gray-700' },
  }

  const cfg = config[action]
  if (!cfg) return null
  const Icon = cfg.icon
  const canConfirm = !cfg.requireNote || comment.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className={`w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center`}>
            <Icon size={20} className={cfg.iconColor} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">{cfg.title}</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{task?.taskName}</p>
          </div>
        </div>

        {task?.partyDisplayName && (
          <div className="px-5 pt-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <Building2 size={13} className="text-gray-400" />
              <span className="text-sm text-gray-700 font-medium">{task.partyDisplayName}</span>
              {task.partyExternalId && (
                <span className="text-xs text-gray-400 font-mono">({task.partyExternalId})</span>
              )}
            </div>
          </div>
        )}

        <div className="px-5 py-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {action === 'approve' ? 'Notes (optional)' : 'Reason *'}
          </label>
          <textarea
            autoFocus
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            placeholder={
              action === 'approve'   ? 'Add optional reviewer notes...'
              : action === 'reject'  ? 'Reason for rejection (required)...'
              : action === 'req-info' ? 'Describe what additional information is needed...'
              : 'Optional note...'
            }
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none
                       focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
          />
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(comment)}
            disabled={isPending || !canConfirm}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg
                        disabled:opacity-50 transition-colors ${cfg.btnClass}`}
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : null}
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Task Row ──────────────────────────────────────────────────────────────────
function TaskRow({ task, currentUserSubject, isAdmin, onAction }) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const { data: history } = useQuery({
    queryKey: ['task-history', task.taskId],
    queryFn:  () => getHistory(task.taskId),
    enabled:  historyOpen,
  })

  const isMyTask = task.assignee === currentUserSubject
  const isUnassigned = !task.assignee
  const isOthersClaimed = task.assignee && !isMyTask
  // Triage tasks show Pass/Approve (route decision), regular tasks show Approve/Reject
  const isTriage = (task.taskName || '').toLowerCase().includes('triage')

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        {/* Task info */}
        <td className="px-4 py-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-800 leading-snug">{task.taskName || 'Review Task'}</p>
            {task.documentName && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <FileText size={10} /> {task.documentName}
              </p>
            )}
            {task.formName && (
              <p className="text-xs text-blue-500">{task.formName}</p>
            )}
          </div>
        </td>

        {/* Party */}
        <td className="px-4 py-3 hidden md:table-cell">
          <PartyTag
            externalId={task.partyExternalId}
            displayName={task.partyDisplayName}
            partyType={task.partyType}
          />
        </td>

        {/* SLA */}
        <td className="px-4 py-3 hidden lg:table-cell">
          <div className="space-y-1">
            <SlaBadge status={task.slaStatus} />
            {task.slaDeadline && (
              <p className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(task.slaDeadline), { addSuffix: true })}
              </p>
            )}
          </div>
        </td>

        {/* Assignee */}
        <td className="px-4 py-3 hidden xl:table-cell">
          {task.assignee ? (
            <span className="text-xs text-gray-600 flex items-center gap-1">
              <UserCheck size={11} className="text-blue-500" />
              {isMyTask ? 'Me' : task.assignee.split('@')[0]}
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic">Unassigned</span>
          )}
        </td>

        {/* Created */}
        <td className="px-4 py-3 hidden xl:table-cell">
          <span className="text-xs text-gray-400">
            {task.createdAt
              ? format(new Date(task.createdAt), 'MMM d, HH:mm')
              : '—'}
          </span>
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1 flex-wrap">
            {isUnassigned && (
              <button
                onClick={() => onAction('claim', task)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium
                           text-blue-700 bg-blue-50 border border-blue-200 rounded-lg
                           hover:bg-blue-100 transition-colors"
              >
                <UserCheck size={12} /> Claim
              </button>
            )}

            {isMyTask && isTriage && (
              <>
                <button
                  onClick={() => onAction('pass', task)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium
                             text-purple-700 bg-purple-50 border border-purple-200 rounded-lg
                             hover:bg-purple-100 transition-colors"
                >
                  <Forward size={12} /> Send to Backoffice
                </button>
                <button
                  onClick={() => onAction('approve', task)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium
                             text-green-700 bg-green-50 border border-green-200 rounded-lg
                             hover:bg-green-100 transition-colors"
                >
                  <CheckCircle size={12} /> Send to Reviewer
                </button>
                <button
                  onClick={() => onAction('release', task)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Release task"
                >
                  <UserMinus size={14} />
                </button>
              </>
            )}

            {isMyTask && !isTriage && (
              <>
                <button
                  onClick={() => onAction('approve', task)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium
                             text-green-700 bg-green-50 border border-green-200 rounded-lg
                             hover:bg-green-100 transition-colors"
                >
                  <CheckCircle size={12} /> Approve
                </button>
                <button
                  onClick={() => onAction('reject', task)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium
                             text-red-600 bg-red-50 border border-red-200 rounded-lg
                             hover:bg-red-100 transition-colors"
                >
                  <XCircle size={12} /> Reject
                </button>
                <button
                  onClick={() => onAction('req-info', task)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium
                             text-blue-600 bg-blue-50 border border-blue-200 rounded-lg
                             hover:bg-blue-100 transition-colors"
                >
                  <MessageSquare size={12} /> Info
                </button>
                <button
                  onClick={() => onAction('release', task)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Release task"
                >
                  <UserMinus size={14} />
                </button>
              </>
            )}

            {/* Admin can release tasks claimed by other users */}
            {isOthersClaimed && isAdmin && (
              <button
                onClick={() => onAction('admin-release', task)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium
                           text-orange-700 bg-orange-50 border border-orange-200 rounded-lg
                           hover:bg-orange-100 transition-colors"
                title={`Release from ${task.assignee}`}
              >
                <UserMinus size={12} /> Release
              </button>
            )}

            {/* History toggle */}
            <button
              onClick={() => setHistoryOpen(v => !v)}
              className={`p-1.5 rounded-lg transition-colors
                          ${historyOpen ? 'bg-gray-200 text-gray-700' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
              title="View history"
            >
              <ChevronDown size={14} className={`transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </td>
      </tr>

      {/* History drawer */}
      {historyOpen && (
        <tr>
          <td colSpan={6} className="px-6 py-3 bg-gray-50 border-b border-gray-100">
            {!history ? (
              <p className="text-xs text-gray-400">Loading history…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No history yet</p>
            ) : (
              <div className="space-y-1.5">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-3 text-xs text-gray-600">
                    <span className="font-mono text-gray-400 w-28 flex-shrink-0">
                      {format(new Date(h.createdAt), 'MMM d HH:mm')}
                    </span>
                    <span className={`font-semibold px-1.5 py-0.5 rounded text-xs
                      ${h.action === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        h.action === 'REJECTED' ? 'bg-red-100 text-red-600' :
                        h.action === 'CLAIMED'  ? 'bg-blue-100 text-blue-600' :
                        'bg-gray-100 text-gray-600'}`}>
                      {h.action}
                    </span>
                    <span className="text-gray-500">{h.actorEmail || h.actorSubject}</span>
                    {h.comment && <span className="text-gray-400 italic truncate">"{h.comment}"</span>}
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function BackofficeQueuePage() {
  const qc = useQueryClient()
  const { user } = useUserStore()
  const [tab, setTab] = useState('unassigned') // unassigned | mine | all
  const [modal, setModal] = useState(null) // { action, task }

  const isAdmin = user?.roles?.some(r => r === 'ECM_ADMIN' || r === 'ECM_SUPER_ADMIN')
  const currentUserSubject = user?.entraObjectId || user?.email || ''

  // For 'mine' tab, fetch assigned-to-me; for others, fetch the full queue
  const { data: rawItems = [], isLoading, isFetching, refetch } = useQuery({
    queryKey:        ['backoffice-queue', tab],
    queryFn:         () => getQueue(tab === 'mine'),
    refetchInterval: 30_000,
  })

  // Filter client-side based on tab
  const items = tab === 'unassigned'
    ? rawItems.filter(t => !t.assignee)
    : tab === 'mine'
    ? rawItems.filter(t => t.assignee === currentUserSubject)
    : rawItems // 'all' tab — admin sees everything

  // Mutations
  const claimMut = useMutation({
    mutationFn: ({ taskId }) => claimTask(taskId),
    onSuccess: () => { toast.success('Task claimed'); qc.invalidateQueries({ queryKey: ['backoffice-queue'] }) },
    onError: e => toast.error(e?.response?.data?.message ?? 'Claim failed'),
  })

  const actionMut = useMutation({
    mutationFn: ({ action, taskId, comment }) => {
      if (action === 'approve')        return approveTask(taskId, comment)
      if (action === 'reject')         return rejectTask(taskId, comment)
      if (action === 'req-info')       return requestInfo(taskId, comment)
      if (action === 'pass')           return passTask(taskId, comment)
      if (action === 'release')        return releaseTask(taskId, comment)
      if (action === 'admin-release')  return adminRelease(taskId)
      throw new Error('Unknown action')
    },
    onSuccess: (_, { action }) => {
      const msgs = {
        approve:         'Task approved',
        reject:          'Task rejected',
        'req-info':      'Information requested from submitter',
        pass:            'Task passed to backoffice team',
        release:         'Task returned to queue',
        'admin-release': 'Task released by admin',
      }
      toast.success(msgs[action] || 'Action completed')
      setModal(null)
      qc.invalidateQueries({ queryKey: ['backoffice-queue'] })
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Action failed'),
  })

  const handleAction = (action, task) => {
    if (action === 'claim') {
      claimMut.mutate({ taskId: task.taskId })
    } else if (action === 'admin-release') {
      // Admin release doesn't need a modal — just confirm
      if (confirm(`Release this task from ${task.assignee?.split('@')[0] ?? 'user'}?`)) {
        actionMut.mutate({ action, taskId: task.taskId })
      }
    } else {
      setModal({ action, task })
    }
  }

  const handleConfirm = (comment) => {
    if (!modal) return
    actionMut.mutate({ action: modal.action, taskId: modal.task.taskId, comment })
  }

  const tabs = [
    { id: 'unassigned', label: 'Unassigned', icon: Inbox },
    { id: 'mine',       label: 'My Tasks',   icon: UserCheck },
    ...(isAdmin ? [{ id: 'all', label: 'All Tasks', icon: FileText }] : []),
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tasks assigned to you and your group
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600
                     border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(t => {
          const Icon = t.icon
          const count = t.id === 'unassigned'
            ? rawItems.filter(i => !i.assignee).length
            : t.id === 'mine'
            ? rawItems.filter(i => i.assignee === currentUserSubject).length
            : t.id === 'all'
            ? rawItems.length
            : null

          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2
                          transition-colors -mb-px
                          ${tab === t.id
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <Icon size={15} />
              {t.label}
              {count !== null && count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold
                                  ${tab === t.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading queue…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 size={36} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">
              {tab === 'unassigned' ? 'No unassigned tasks'
                : tab === 'all' ? 'No tasks in the system'
                : 'No tasks assigned to you'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {tab === 'unassigned' ? 'All tasks have been claimed'
                : tab === 'all' ? 'Submit a form to create a review task'
                : 'Claim tasks from the Unassigned tab'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Task</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden md:table-cell">Party</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden lg:table-cell">SLA</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden xl:table-cell">Assignee</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden xl:table-cell">Created</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(task => (
                <TaskRow
                  key={task.taskId}
                  task={task}
                  currentUserSubject={currentUserSubject}
                  isAdmin={isAdmin}
                  onAction={handleAction}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Action Modal */}
      {modal && (
        <ActionModal
          task={modal.task}
          action={modal.action}
          onClose={() => setModal(null)}
          onConfirm={handleConfirm}
          isPending={actionMut.isPending}
        />
      )}
    </div>
  )
}
