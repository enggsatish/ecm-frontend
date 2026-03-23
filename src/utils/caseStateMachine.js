/**
 * Case State Machine
 *
 * Lobby-based flow: cases move through lobbies (queues) where someone
 * picks them up. Assignment determines who works on it, not the status.
 *
 * NEW → IN_PROGRESS → REVIEW_PENDING → UNDER_REVIEW → PENDING_APPROVAL → APPROVED → COMPLETED
 *                ↑                           │
 *                └─── (returned flag) ───────┘
 */

// ── Case statuses ────────────────────────────────────────────────────────────
export const CASE_STATUS = {
  NEW:                'NEW',
  IN_PROGRESS:        'IN_PROGRESS',
  REVIEW_PENDING:     'REVIEW_PENDING',
  UNDER_REVIEW:       'UNDER_REVIEW',
  PENDING_APPROVAL:   'PENDING_APPROVAL',
  APPROVED:           'APPROVED',
  COMPLETED:          'COMPLETED',
  REJECTED:           'REJECTED',
  CANCELLED:          'CANCELLED',
  ON_HOLD:            'ON_HOLD',
}

// ── Transition definitions ───────────────────────────────────────────────────
// No role checks here — permission is checked by backend (CASE:UPDATE).
// Anyone assigned to the case or with case permissions can trigger transitions.
const TRANSITIONS = {
  [CASE_STATUS.NEW]: [
    { target: CASE_STATUS.IN_PROGRESS,  label: 'Start Working' },
    { target: CASE_STATUS.CANCELLED,    requiresReason: true, label: 'Cancel' },
  ],

  [CASE_STATUS.IN_PROGRESS]: [
    { target: CASE_STATUS.REVIEW_PENDING, label: 'Submit for Review' },
    { target: CASE_STATUS.ON_HOLD,        requiresReason: true, label: 'Put on Hold' },
    { target: CASE_STATUS.CANCELLED,      requiresReason: true, label: 'Cancel' },
  ],

  [CASE_STATUS.REVIEW_PENDING]: [
    { target: CASE_STATUS.UNDER_REVIEW,   label: 'Pick Up for Review' },
    { target: CASE_STATUS.IN_PROGRESS,    requiresReason: true, label: 'Return', isReturn: true },
    { target: CASE_STATUS.ON_HOLD,        requiresReason: true, label: 'Put on Hold' },
    { target: CASE_STATUS.CANCELLED,      requiresReason: true, label: 'Cancel' },
  ],

  [CASE_STATUS.UNDER_REVIEW]: [
    { target: CASE_STATUS.PENDING_APPROVAL, label: 'Send for Approval' },
    { target: CASE_STATUS.APPROVED,         label: 'Approve' },
    { target: CASE_STATUS.REJECTED,         requiresReason: true, label: 'Reject' },
    { target: CASE_STATUS.IN_PROGRESS,      requiresReason: true, label: 'Return', isReturn: true },
    { target: CASE_STATUS.ON_HOLD,          requiresReason: true, label: 'Put on Hold' },
    { target: CASE_STATUS.CANCELLED,        requiresReason: true, label: 'Cancel' },
  ],

  [CASE_STATUS.PENDING_APPROVAL]: [
    { target: CASE_STATUS.APPROVED,       label: 'Approve' },
    { target: CASE_STATUS.REJECTED,       requiresReason: true, label: 'Reject' },
    { target: CASE_STATUS.UNDER_REVIEW,   requiresReason: true, label: 'Return to Review', isReturn: true },
    { target: CASE_STATUS.ON_HOLD,        requiresReason: true, label: 'Put on Hold' },
    { target: CASE_STATUS.CANCELLED,      requiresReason: true, label: 'Cancel' },
  ],

  [CASE_STATUS.APPROVED]: [
    { target: CASE_STATUS.COMPLETED, label: 'Complete' },
    { target: CASE_STATUS.CANCELLED, requiresReason: true, label: 'Cancel' },
  ],

  [CASE_STATUS.REJECTED]: [
    { target: CASE_STATUS.UNDER_REVIEW, label: 'Re-open Review' },
  ],

  [CASE_STATUS.ON_HOLD]: [
    { target: CASE_STATUS.IN_PROGRESS,    label: 'Resume' },
    { target: CASE_STATUS.REVIEW_PENDING, label: 'Resume to Review Queue' },
    { target: CASE_STATUS.CANCELLED,      requiresReason: true, label: 'Cancel' },
  ],

  [CASE_STATUS.COMPLETED]: [],
  [CASE_STATUS.CANCELLED]: [],
}

/**
 * Get available transitions for the current status.
 * No role filtering — anyone with CASE:UPDATE permission can transition.
 */
export function getAvailableTransitions(status) {
  return TRANSITIONS[status] ?? []
}

/**
 * Which actions are allowed in each status.
 * Controls button visibility on the case detail page.
 */
export const STATUS_ACTIONS = {
  [CASE_STATUS.NEW]:              { assign: true, claim: true,  requestDocs: false, addParticipant: false, verify: false, upload: false },
  [CASE_STATUS.IN_PROGRESS]:      { assign: true, claim: false, requestDocs: true,  addParticipant: true,  verify: true,  upload: true  },
  [CASE_STATUS.REVIEW_PENDING]:   { assign: true, claim: true,  requestDocs: false, addParticipant: false, verify: false, upload: false },
  [CASE_STATUS.UNDER_REVIEW]:     { assign: true, claim: false, requestDocs: true,  addParticipant: true,  verify: true,  upload: false },
  [CASE_STATUS.PENDING_APPROVAL]: { assign: true, claim: true,  requestDocs: false, addParticipant: false, verify: false, upload: false },
  [CASE_STATUS.APPROVED]:         { assign: false, claim: false, requestDocs: false, addParticipant: false, verify: false, upload: false },
  [CASE_STATUS.COMPLETED]:        { assign: false, claim: false, requestDocs: false, addParticipant: false, verify: false, upload: false },
  [CASE_STATUS.REJECTED]:         { assign: false, claim: false, requestDocs: false, addParticipant: false, verify: false, upload: false },
  [CASE_STATUS.CANCELLED]:        { assign: false, claim: false, requestDocs: false, addParticipant: false, verify: false, upload: false },
  [CASE_STATUS.ON_HOLD]:          { assign: true,  claim: false, requestDocs: false, addParticipant: false, verify: false, upload: false },
}

/**
 * Calculate checklist progress.
 * An item is "satisfied" if its status is APPROVED, WAIVED, or UPLOADED.
 */
export function getChecklistProgress(checklist = []) {
  const total = checklist.length
  const required = checklist.filter(i => i.isRequired)
  const satisfiedStatuses = ['APPROVED', 'WAIVED', 'UPLOADED']

  const satisfiedAll = checklist.filter(i => satisfiedStatuses.includes(i.status)).length
  const satisfiedRequired = required.filter(i => satisfiedStatuses.includes(i.status)).length
  const requiredCount = required.length

  return {
    total,
    requiredCount,
    satisfiedAll,
    satisfiedRequired,
    allRequiredSatisfied: requiredCount > 0 && satisfiedRequired >= requiredCount,
    percentage: total > 0 ? Math.round((satisfiedAll / total) * 100) : 0,
    requiredPercentage: requiredCount > 0 ? Math.round((satisfiedRequired / requiredCount) * 100) : 100,
  }
}

/**
 * Status display metadata — colors, labels
 */
export const STATUS_META = {
  NEW:                { color: 'blue',   label: 'New' },
  IN_PROGRESS:        { color: 'cyan',   label: 'In Progress' },
  REVIEW_PENDING:     { color: 'amber',  label: 'Review Pending' },
  UNDER_REVIEW:       { color: 'indigo', label: 'Under Review' },
  PENDING_APPROVAL:   { color: 'orange', label: 'Pending Approval' },
  APPROVED:           { color: 'green',  label: 'Approved' },
  COMPLETED:          { color: 'green',  label: 'Completed' },
  REJECTED:           { color: 'red',    label: 'Rejected' },
  CANCELLED:          { color: 'gray',   label: 'Cancelled' },
  ON_HOLD:            { color: 'gray',   label: 'On Hold' },
}

/**
 * Transition button colors by target status
 */
export const TRANSITION_COLORS = {
  IN_PROGRESS:        'text-cyan-700 bg-cyan-50 border-cyan-200 hover:bg-cyan-100',
  REVIEW_PENDING:     'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100',
  UNDER_REVIEW:       'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
  PENDING_APPROVAL:   'text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100',
  APPROVED:           'text-green-700 bg-green-50 border-green-200 hover:bg-green-100',
  COMPLETED:          'text-green-700 bg-green-50 border-green-200 hover:bg-green-100',
  REJECTED:           'text-red-700 bg-red-50 border-red-200 hover:bg-red-100',
  CANCELLED:          'text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100',
  ON_HOLD:            'text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100',
}
