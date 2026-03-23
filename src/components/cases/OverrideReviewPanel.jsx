/**
 * OverrideReviewPanel — admin panel for reviewing pending override requests.
 * Can be embedded in case detail or used standalone.
 */
import { useState } from 'react'
import { ShieldAlert, Check, X, Loader2, Clock, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { useOverrideRequests, useReviewOverrideRequest } from '../../hooks/useAdmin'

const STATUS_BADGE = {
  PENDING:  'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-green-50 text-green-700 border-green-200',
  DENIED:   'bg-red-50 text-red-600 border-red-200',
}

export default function OverrideReviewPanel({ caseId }) {
  const { data, isLoading } = useOverrideRequests(caseId ? { caseId } : {})
  const reviewMut = useReviewOverrideRequest()
  const [reviewingId, setReviewingId] = useState(null)
  const [reviewReason, setReviewReason] = useState('')

  const requests = Array.isArray(data) ? data : (data?.content ?? [])

  const handleReview = (requestId, decision) => {
    reviewMut.mutate(
      { requestId, payload: { decision, reason: reviewReason } },
      {
        onSuccess: () => {
          toast.success(`Override ${decision.toLowerCase()}`)
          setReviewingId(null)
          setReviewReason('')
        },
        onError: (e) => toast.error(e?.response?.data?.message || 'Review failed'),
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 size={16} className="animate-spin mr-2" /> Loading requests...
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-6">
        <ShieldAlert size={24} className="text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No override requests</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map(req => (
        <div key={req.id} className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">{req.itemName ?? req.checklistItemId}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <User size={10} />
                <span>{req.requestedBy}</span>
                <span>&middot;</span>
                <Clock size={10} />
                <span>{req.requestedAt ? new Date(req.requestedAt).toLocaleString() : '—'}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1.5 bg-gray-50 px-2 py-1 rounded">
                {req.reason}
              </p>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
              STATUS_BADGE[req.status] ?? STATUS_BADGE.PENDING
            }`}>
              {req.status}
            </span>
          </div>

          {/* Review controls for pending requests */}
          {req.status === 'PENDING' && (
            <div className="mt-3 pt-2 border-t border-gray-100">
              {reviewingId === req.id ? (
                <div className="space-y-2">
                  <textarea
                    value={reviewReason}
                    onChange={e => setReviewReason(e.target.value)}
                    rows={2}
                    placeholder="Add review comment (optional)..."
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs
                               focus:outline-none focus:ring-1 focus:ring-blue-200 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview(req.id, 'APPROVED')}
                      disabled={reviewMut.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700
                                 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50"
                    >
                      <Check size={11} /> Approve
                    </button>
                    <button
                      onClick={() => handleReview(req.id, 'DENIED')}
                      disabled={reviewMut.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600
                                 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                    >
                      <X size={11} /> Deny
                    </button>
                    <button
                      onClick={() => { setReviewingId(null); setReviewReason('') }}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setReviewingId(req.id)}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  <ShieldAlert size={11} /> Review
                </button>
              )}
            </div>
          )}

          {/* Show reviewer info for resolved requests */}
          {req.status !== 'PENDING' && req.reviewedBy && (
            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
              <span className="font-medium">{req.status === 'APPROVED' ? 'Approved' : 'Denied'}</span>
              {' by '}{req.reviewedBy}
              {req.reviewReason && <span> — {req.reviewReason}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
