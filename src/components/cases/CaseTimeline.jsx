/**
 * CaseTimeline — displays case lifecycle events in a vertical timeline.
 * Reuses the visual pattern from DocumentViewerModal's TimelinePanel.
 */
import {
  Clock, FolderOpen, FileText, CheckCircle, XCircle, ShieldAlert,
  MessageSquare, Play, Flag, Upload, Ban, User, RefreshCw,
} from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { useCaseTimeline } from '../../hooks/useAdmin'

const EVENT_CONFIG = {
  CASE_CREATED:             { icon: FolderOpen,    color: 'text-blue-500',   bg: 'bg-blue-50' },
  CASE_STATUS_CHANGED:      { icon: RefreshCw,     color: 'text-indigo-500', bg: 'bg-indigo-50' },
  CHECKLIST_ITEM_UPLOADED:  { icon: Upload,        color: 'text-blue-600',   bg: 'bg-blue-50' },
  CHECKLIST_ITEM_APPROVED:  { icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-50' },
  CHECKLIST_ITEM_REJECTED:  { icon: XCircle,       color: 'text-red-500',    bg: 'bg-red-50' },
  CHECKLIST_ITEM_WAIVED:    { icon: Ban,           color: 'text-gray-500',   bg: 'bg-gray-50' },
  WORKFLOW_STARTED:         { icon: Play,          color: 'text-indigo-500', bg: 'bg-indigo-50' },
  WORKFLOW_COMPLETED:       { icon: Flag,          color: 'text-green-600',  bg: 'bg-green-50' },
  OVERRIDE_REQUESTED:       { icon: ShieldAlert,   color: 'text-amber-600',  bg: 'bg-amber-50' },
  OVERRIDE_APPROVED:        { icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-50' },
  OVERRIDE_DENIED:          { icon: XCircle,       color: 'text-red-500',    bg: 'bg-red-50' },
  ADMIN_BYPASS:             { icon: ShieldAlert,   color: 'text-orange-600', bg: 'bg-orange-50' },
  CASE_NOTE_ADDED:          { icon: MessageSquare, color: 'text-yellow-600', bg: 'bg-yellow-50' },
}

const DEFAULT_EVENT = { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-50' }

export default function CaseTimeline({ caseId }) {
  const { data: timeline, isLoading } = useCaseTimeline(caseId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 size={16} className="animate-spin mr-2" /> Loading timeline...
      </div>
    )
  }

  const events = Array.isArray(timeline) ? timeline : []

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock size={28} className="text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No events recorded yet</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-3 bottom-3 w-px bg-gray-200" />

      <div className="space-y-0">
        {events.map((evt, i) => {
          const cfg = EVENT_CONFIG[evt.eventType] ?? DEFAULT_EVENT
          const Icon = cfg.icon
          const ts = evt.timestamp
            ? new Date(evt.timestamp).toLocaleString('en-CA', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })
            : '—'

          return (
            <div key={i} className="flex items-start gap-3 py-2.5 relative">
              {/* Icon dot */}
              <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center
                               flex-shrink-0 z-10 border-2 border-white`}>
                <Icon size={14} className={cfg.color} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm text-gray-800 font-medium">
                  {evt.description ?? evt.eventType.replace(/_/g, ' ')}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                  <span>{ts}</span>
                  {evt.actor && (
                    <>
                      <span>&middot;</span>
                      <span className="flex items-center gap-1">
                        <User size={9} /> {evt.actor}
                      </span>
                    </>
                  )}
                </div>
                {evt.detail && (
                  <p className="text-xs text-gray-500 mt-1 bg-gray-50 px-2 py-1 rounded">
                    {evt.detail}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
