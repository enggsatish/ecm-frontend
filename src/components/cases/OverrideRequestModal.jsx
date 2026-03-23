/**
 * OverrideRequestModal — shared modal for:
 * - Non-admin: "Request Override" (sends request to admin)
 * - Admin: "Bypass" (directly bypasses checklist item)
 */
import { useState } from 'react'
import { X, ShieldAlert, Loader2 } from 'lucide-react'

export default function OverrideRequestModal({ itemName, isAdminBypass, isPending, onSubmit, onClose }) {
  const [reason, setReason] = useState('')

  const title = isAdminBypass ? 'Bypass Requirement' : 'Request Override'
  const description = isAdminBypass
    ? 'This will mark the item as approved, skipping any workflow. An audit record will be created.'
    : 'Submit a request to an admin to bypass this requirement. Include a reason for the override.'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isAdminBypass ? 'bg-orange-50' : 'bg-blue-50'
            }`}>
              <ShieldAlert className={`w-4 h-4 ${isAdminBypass ? 'text-orange-600' : 'text-blue-600'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-xs text-gray-400">{itemName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">{description}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Explain why this override is needed..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {isAdminBypass && (
            <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2.5">
              <p className="text-xs text-orange-700">
                This action cannot be undone. The item will be marked as approved and the workflow (if any) will be skipped.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(reason)}
            disabled={!reason.trim() || isPending}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
                        transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white
                        ${isAdminBypass
                          ? 'bg-orange-600 hover:bg-orange-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                        }`}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isAdminBypass ? 'Bypass Item' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
