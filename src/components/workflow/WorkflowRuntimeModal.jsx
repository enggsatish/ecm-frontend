/**
 * WorkflowRuntimeModal.jsx
 *
 * Modal showing a live BPMN diagram with activity overlays + details panel.
 * Used from CaseDetailPage checklist items that have an active workflow.
 *
 * Props:
 *   workflowInstanceId — UUID of the ECM workflow instance record
 *   onClose            — () => void
 */
import { useState } from 'react'
import { X, Loader2, CheckCircle, Clock, User, Users } from 'lucide-react'
import { useWorkflowRuntimeState } from '../../hooks/useWorkflow'
import BpmnRuntimeViewer from './BpmnRuntimeViewer'
import { formatDistanceToNow, format } from 'date-fns'

function safeFormat(d) {
  try { return d ? format(new Date(d), 'MMM d, yyyy HH:mm') : '—' } catch { return '—' }
}
function safeRelative(d) {
  try { return d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '' } catch { return '' }
}

const STATUS_BADGE = {
  ACTIVE:             'bg-blue-50 text-blue-700 border-blue-200',
  INFO_REQUESTED:     'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED_APPROVED: 'bg-green-50 text-green-700 border-green-200',
  COMPLETED_REJECTED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED:          'bg-gray-100 text-gray-500 border-gray-200',
}

export default function WorkflowRuntimeModal({ workflowInstanceId, onClose }) {
  const { data, isLoading } = useWorkflowRuntimeState(workflowInstanceId)
  const [selectedActivity, setSelectedActivity] = useState(null)

  const selectedDetail = selectedActivity
    ? data?.completedActivities?.find(a => a.activityId === selectedActivity)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">Workflow Runtime</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {data?.status && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_BADGE[data.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {data.status.replace(/_/g, ' ')}
                </span>
              )}
              {data?.processVariables?.documentName && (
                <span className="text-xs text-gray-400">{data.processVariables.documentName}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : !data?.bpmnXml ? (
            <div className="flex items-center justify-center py-24 text-sm text-gray-400">
              No BPMN diagram available for this workflow instance
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row">
              {/* BPMN Diagram */}
              <div className="flex-1 p-4">
                <BpmnRuntimeViewer
                  bpmnXml={data.bpmnXml}
                  activeActivityIds={data.activeActivityIds ?? []}
                  completedActivities={data.completedActivities ?? []}
                  onActivityClick={setSelectedActivity}
                />
              </div>

              {/* Details Panel */}
              <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-gray-200 p-4 space-y-4 bg-gray-50/50">
                {/* Current Task */}
                {data.currentTask && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Step</h4>
                    <div className="bg-white rounded-lg border border-blue-200 p-3">
                      <p className="text-sm font-medium text-blue-700">{data.currentTask.taskName ?? 'Task'}</p>
                      {data.currentTask.assignee ? (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
                          <User size={11} />
                          <span>{data.currentTask.assignee.split('@')[0]}</span>
                        </div>
                      ) : data.currentTask.candidateGroups?.length > 0 ? (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
                          <Users size={11} />
                          <span>{data.currentTask.candidateGroups.join(', ').replace(/ECM_/g, '')}</span>
                        </div>
                      ) : null}
                      {data.currentTask.createdAt && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          Started {safeRelative(data.currentTask.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* DocuSign status */}
                {data.processVariables?.docuSignEnvelopeId && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">DocuSign</h4>
                    <div className="bg-white rounded-lg border border-purple-200 p-3 text-xs">
                      <p className="text-purple-700 font-medium">
                        {data.processVariables.docuSignStatus === 'completed' ? 'Signed' :
                         data.processVariables.docuSignStatus === 'declined' ? 'Declined' :
                         data.processVariables.docuSignStatus === 'sent' ? 'Awaiting Signature' :
                         data.processVariables.docuSignStatus ?? 'Unknown'}
                      </p>
                      <p className="text-gray-400 font-mono mt-1">
                        {data.processVariables.docuSignEnvelopeId.slice(0, 12)}...
                      </p>
                    </div>
                  </div>
                )}

                {/* Clicked activity detail */}
                {selectedDetail && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Selected Step</h4>
                    <div className="bg-white rounded-lg border border-green-200 p-3 text-xs">
                      <p className="text-green-700 font-medium">{selectedDetail.activityName ?? selectedDetail.activityId}</p>
                      <p className="text-gray-400 mt-1">{selectedDetail.activityType?.replace(/([A-Z])/g, ' $1').trim()}</p>
                      {selectedDetail.assignee && (
                        <p className="text-gray-500 mt-1">By: {selectedDetail.assignee.split('@')[0]}</p>
                      )}
                      {selectedDetail.endTime && (
                        <p className="text-gray-400 mt-1">{safeFormat(selectedDetail.endTime)}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Completed History */}
                {data.completedActivities?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      History ({data.completedActivities.length})
                    </h4>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {[...data.completedActivities].reverse().map((a, i) => (
                        <button key={a.activityId + i}
                          onClick={() => setSelectedActivity(a.activityId)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                            selectedActivity === a.activityId ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-100 hover:bg-gray-50'
                          }`}>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle size={10} className="text-green-500 shrink-0" />
                            <span className="font-medium text-gray-700 truncate">{a.activityName ?? a.activityId}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400 ml-4">
                            {a.assignee && <span>{a.assignee.split('@')[0]}</span>}
                            {a.endTime && <span>{safeRelative(a.endTime)}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Process variables */}
                {data.processVariables?.decision && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Decision</h4>
                    <div className="bg-white rounded-lg border border-gray-200 p-3 text-xs">
                      <span className={`font-semibold ${
                        data.processVariables.decision === 'APPROVED' ? 'text-green-600' :
                        data.processVariables.decision === 'REJECTED' ? 'text-red-600' : 'text-gray-700'
                      }`}>{data.processVariables.decision}</span>
                      {data.processVariables.comment && (
                        <p className="text-gray-500 mt-1">{data.processVariables.comment}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
