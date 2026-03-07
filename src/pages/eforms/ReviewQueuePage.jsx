/**
 * ReviewQueuePage.jsx
 * Route: /eforms/submissions/queue
 * Roles: ECM_BACKOFFICE, ECM_REVIEWER
 * Review queue with approve/reject/assign actions.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, CheckCircle, XCircle, UserCheck, RefreshCw, MessageSquare } from 'lucide-react';
import { useReviewQueue, useUpdateSubmissionStatus } from '../../hooks/useEForms';
import StatusBadge from '../../components/eforms/StatusBadge';
import { format } from 'date-fns';

function safeFormat(d) {
  try { return d ? format(new Date(d), 'MMM d, yyyy HH:mm') : '—'; } catch { return '—'; }
}

export default function ReviewQueuePage() {
  const navigate = useNavigate();
  const { data: rawQueue, isLoading, refetch, isFetching } = useReviewQueue();
  const updateStatus = useUpdateSubmissionStatus();

  // Guard: hooks return T[] but add Array.isArray safety for any edge case
  const queue = Array.isArray(rawQueue) ? rawQueue : [];

  const [reviewModal, setReviewModal] = useState(null); // { id, action: 'APPROVE'|'REJECT' }
  const [notes, setNotes]             = useState('');

  const handleReviewAction = () => {
    if (!reviewModal) return;
    const payload = {
      id:     reviewModal.id,
      status: reviewModal.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      notes:  notes.trim() || undefined,
    };
    updateStatus.mutate(payload, {
      onSuccess: () => {
        setReviewModal(null);
        setNotes('');
      },
    });
  };

  const handleAssignToMe = (submissionId) => {
    updateStatus.mutate({ id: submissionId, status: 'IN_REVIEW' });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {queue.length} submission{queue.length !== 1 ? 's' : ''} pending review
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-300
                     rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Queue table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading queue...</div>
        ) : queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-4xl mb-3">✅</span>
            <p className="text-sm font-medium text-gray-600">Queue is empty</p>
            <p className="text-xs text-gray-400 mt-1">All submissions have been reviewed</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Submission</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden md:table-cell">Submitter</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden lg:table-cell">Submitted At</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden xl:table-cell">Assigned To</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {queue.map((sub) => {
                const canReview  = ['SUBMITTED', 'IN_REVIEW', 'SIGNED'].includes(sub.status);
                const needsAssign = sub.status === 'SUBMITTED' && !sub.assignedTo;

                return (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{sub.formKey}</p>
                        <p className="text-xs font-mono text-gray-400">{sub.id?.slice(0, 10)}...</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div>
                        <p className="text-sm text-gray-700">{sub.submitterName || sub.submittedBy || '—'}</p>
                        <p className="text-xs text-gray-400">{sub.submitterEmail || ''}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-gray-500">{safeFormat(sub.submittedAt)}</span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-xs text-gray-500">{sub.assignedTo || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* View */}
                        <button
                          onClick={() => navigate(`/eforms/submissions/${sub.id}`)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Assign to me */}
                        {needsAssign && (
                          <button
                            onClick={() => handleAssignToMe(sub.id)}
                            disabled={updateStatus.isPending}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-600
                                       border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Assign to me
                          </button>
                        )}

                        {/* Approve */}
                        {canReview && (
                          <button
                            onClick={() => { setReviewModal({ id: sub.id, action: 'APPROVE' }); setNotes(''); }}
                            className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}

                        {/* Reject */}
                        {canReview && (
                          <button
                            onClick={() => { setReviewModal({ id: sub.id, action: 'REJECT' }); setNotes(''); }}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Review Action Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              {reviewModal.action === 'APPROVE' ? (
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
              )}
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {reviewModal.action === 'APPROVE' ? 'Approve Submission' : 'Reject Submission'}
                </h3>
                <p className="text-xs text-gray-400 font-mono">{reviewModal.id?.slice(0, 16)}...</p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
                Notes {reviewModal.action === 'REJECT' && <span className="text-red-400">*</span>}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none
                           focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                placeholder={
                  reviewModal.action === 'APPROVE'
                    ? 'Optional notes...'
                    : 'Please provide a reason for rejection...'
                }
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setReviewModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewAction}
                disabled={
                  updateStatus.isPending ||
                  (reviewModal.action === 'REJECT' && !notes.trim())
                }
                className={`px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${
                  reviewModal.action === 'APPROVE'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {updateStatus.isPending
                  ? 'Processing...'
                  : reviewModal.action === 'APPROVE' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}