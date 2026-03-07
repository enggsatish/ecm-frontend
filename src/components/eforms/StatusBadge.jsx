/**
 * StatusBadge.jsx
 * Pill badge for FormDefinition and FormSubmission statuses.
 *
 * FormDefinition  : DRAFT | PUBLISHED | ARCHIVED | DEPRECATED
 * FormSubmission  : DRAFT | SUBMITTED | PENDING_SIGNATURE | SIGNED |
 *                   IN_REVIEW | APPROVED | REJECTED | WITHDRAWN |
 *                   COMPLETED | SIGN_DECLINED
 */

const CONFIG = {
  // FormDefinition
  DRAFT:             { label: 'Draft',          classes: 'bg-gray-100    text-gray-600    border-gray-200'    },
  PUBLISHED:         { label: 'Published',      classes: 'bg-green-100   text-green-700   border-green-200'   },
  ARCHIVED:          { label: 'Archived',       classes: 'bg-orange-100  text-orange-700  border-orange-200'  },
  DEPRECATED:        { label: 'Deprecated',     classes: 'bg-red-100     text-red-600     border-red-200'     },

  // FormSubmission
  SUBMITTED:         { label: 'Submitted',      classes: 'bg-blue-100    text-blue-700    border-blue-200'    },
  PENDING_SIGNATURE: { label: 'Pending Sig.',   classes: 'bg-yellow-100  text-yellow-700  border-yellow-200'  },
  SIGNED:            { label: 'Signed',         classes: 'bg-teal-100    text-teal-700    border-teal-200'    },
  IN_REVIEW:         { label: 'In Review',      classes: 'bg-purple-100  text-purple-700  border-purple-200'  },
  APPROVED:          { label: 'Approved',       classes: 'bg-green-100   text-green-700   border-green-200'   },
  REJECTED:          { label: 'Rejected',       classes: 'bg-red-100     text-red-600     border-red-200'     },
  WITHDRAWN:         { label: 'Withdrawn',      classes: 'bg-gray-100    text-gray-500    border-gray-200'    },
  COMPLETED:         { label: 'Completed',      classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  SIGN_DECLINED:     { label: 'Sign Declined',  classes: 'bg-red-100     text-red-600     border-red-200'     },
}

export default function StatusBadge({ status, size = 'sm' }) {
  const cfg = CONFIG[status] ?? {
    label: status ?? '—',
    classes: 'bg-gray-100 text-gray-500 border-gray-200',
  }
  const sizeClass = size === 'md'
    ? 'text-xs px-2.5 py-1 font-semibold'
    : 'text-[11px] px-2 py-0.5 font-semibold'

  return (
    <span className={`inline-flex items-center rounded-full border ${sizeClass} ${cfg.classes} whitespace-nowrap`}>
      {cfg.label}
    </span>
  )
}