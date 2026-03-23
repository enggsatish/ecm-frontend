/**
 * WorkflowStatusBadge — compact inline pill showing workflow state on a checklist item.
 * Shows: "In Review > Backoffice Review (John)"
 */
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'

const WF_STATUS_CONFIG = {
  ACTIVE:    { color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Loader2, spin: true },
  COMPLETED: { color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
  TERMINATED:{ color: 'bg-red-50 text-red-600 border-red-200', icon: XCircle },
  SUSPENDED: { color: 'bg-gray-100 text-gray-500 border-gray-200', icon: Clock },
}

export default function WorkflowStatusBadge({ workflowStatus, currentTaskName, currentTaskAssignee }) {
  const cfg = WF_STATUS_CONFIG[workflowStatus] ?? WF_STATUS_CONFIG.ACTIVE
  const Icon = cfg.icon

  const assigneeName = currentTaskAssignee
    ? currentTaskAssignee.split('@')[0]
    : null

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-medium ${cfg.color}`}>
      <Icon size={10} className={cfg.spin ? 'animate-spin' : ''} />
      <span>{workflowStatus === 'ACTIVE' ? 'In Review' : workflowStatus}</span>
      {currentTaskName && (
        <>
          <span className="text-current/50">&rsaquo;</span>
          <span className="truncate max-w-[120px]">{currentTaskName}</span>
        </>
      )}
      {assigneeName && (
        <span className="text-current/60">({assigneeName})</span>
      )}
    </div>
  )
}
