/**
 * MySubmissionsPage.jsx
 * Route: /eforms/submissions/mine
 * Shows the current user's form submissions with status and actions.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Undo2, ExternalLink, FileText } from 'lucide-react';
import { useMySubmissions, useWithdrawSubmission } from '../../hooks/useEForms';
import StatusBadge from '../../components/eforms/StatusBadge';
import { formatDistanceToNow, format } from 'date-fns';

const TERMINAL_STATUSES = new Set(['APPROVED', 'REJECTED', 'WITHDRAWN', 'COMPLETED', 'SIGN_DECLINED']);

function safeFormat(d) {
  try { return d ? format(new Date(d), 'MMM d, yyyy') : '—'; } catch { return '—'; }
}
function safeRelative(d) {
  try { return d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '—'; } catch { return '—'; }
}

export default function MySubmissionsPage() {
  const navigate = useNavigate();
  const { data: rawSubmissions, isLoading } = useMySubmissions();
  const withdrawMutation = useWithdrawSubmission();
  const [confirmWithdraw, setConfirmWithdraw] = useState(null);

  // Guard: hooks return T[] but add Array.isArray safety for any edge case
  const submissions = Array.isArray(rawSubmissions) ? rawSubmissions : [];

  const handleWithdraw = (id) => {
    withdrawMutation.mutate(id, { onSuccess: () => setConfirmWithdraw(null) });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Submissions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your submitted and drafted forms</p>
        </div>
        <button
          onClick={() => navigate('/eforms/fill')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium
                     rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <FileText className="w-4 h-4" /> Fill a Form
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading...</div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-4xl mb-3">📭</span>
            <p className="text-sm font-medium text-gray-600">No submissions yet</p>
            <p className="text-xs text-gray-400 mt-1">Forms you submit will appear here</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Form</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden sm:table-cell">Submitted</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden lg:table-cell">Last Updated</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map((sub) => {
                const isTerminal = TERMINAL_STATUSES.has(sub.status);
                const isDraft    = sub.status === 'DRAFT';
                return (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{sub.formKey}</p>
                        <p className="text-xs font-mono text-gray-400">{sub.id?.slice(0, 8)}...</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-gray-500" title={safeFormat(sub.submittedAt)}>
                        {sub.submittedAt ? safeRelative(sub.submittedAt) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-gray-500">{safeRelative(sub.updatedAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Continue draft */}
                        {isDraft && (
                          <button
                            onClick={() => navigate(`/eforms/fill/${sub.formKey}?submission=${sub.id}`)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-600
                                       border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Continue
                          </button>
                        )}

                        {/* View */}
                        <button
                          onClick={() => navigate(`/eforms/submissions/${sub.id}`)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View submission"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Withdraw */}
                        {!isTerminal && !isDraft && (
                          <button
                            onClick={() => setConfirmWithdraw(sub.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Withdraw submission"
                          >
                            <Undo2 className="w-4 h-4" />
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

      {/* Withdraw confirmation modal */}
      {confirmWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Withdraw submission?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This action cannot be undone. The submission will be marked as withdrawn.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmWithdraw(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleWithdraw(confirmWithdraw)}
                disabled={withdrawMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}