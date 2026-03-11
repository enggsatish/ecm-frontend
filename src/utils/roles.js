/**
 * ECM Role constants — single source of truth for all role strings.
 * Use these everywhere instead of raw 'ECM_ADMIN' string literals.
 *
 * Roles are assigned in ecm-identity and enriched at the gateway.
 * The backend emits ROLE_ECM_* Spring authorities; the frontend
 * receives the short form (ECM_ADMIN, ECM_BACKOFFICE, etc.) from
 * the /api/auth/me response.
 */
export const ROLES = {
  ADMIN:      'ECM_ADMIN',
  BACKOFFICE: 'ECM_BACKOFFICE',
  REVIEWER:   'ECM_REVIEWER',
  DESIGNER:   'ECM_DESIGNER',
  READONLY:   'ECM_READONLY',
}

/**
 * Convenience role groupings used in RoleGuard and Sidebar.
 */
export const ROLE_GROUPS = {
  // Can see and act on documents, tasks, review queues
  OPERATIONS: [ROLES.ADMIN, ROLES.BACKOFFICE, ROLES.REVIEWER],

  // Can build forms and workflows
  DESIGN:     [ROLES.ADMIN, ROLES.DESIGNER],

  // Everyone including read-only
  ALL:        [ROLES.ADMIN, ROLES.BACKOFFICE, ROLES.REVIEWER, ROLES.DESIGNER, ROLES.READONLY],
}

/**
 * Granular permission codes — matches ecm_core.permissions.code column.
 * Grouped by module to mirror the backend module taxonomy.
 */
export const PERMISSIONS = {
  // Documents
  DOCUMENT_VIEW:     'DOCUMENT:VIEW',
  DOCUMENT_UPLOAD:   'DOCUMENT:UPLOAD',
  DOCUMENT_APPROVE:  'DOCUMENT:APPROVE',
  DOCUMENT_DELETE:   'DOCUMENT:DELETE',
  DOCUMENT_ARCHIVE:  'DOCUMENT:ARCHIVE',

  // Workflow
  WORKFLOW_VIEW:     'WORKFLOW:VIEW',
  WORKFLOW_EXECUTE:  'WORKFLOW:EXECUTE',
  WORKFLOW_DESIGN:   'WORKFLOW:DESIGN',

  // eForms
  EFORMS_VIEW:       'EFORMS:VIEW',
  EFORMS_SUBMIT:     'EFORMS:SUBMIT',
  EFORMS_REVIEW:     'EFORMS:REVIEW',
  EFORMS_DESIGN:     'EFORMS:DESIGN',

  // Admin
  ADMIN_USERS:       'ADMIN:USERS',
  ADMIN_ROLES:       'ADMIN:ROLES',
  ADMIN_SETTINGS:    'ADMIN:SETTINGS',
  ADMIN_AUDIT:       'ADMIN:AUDIT',

  // OCR
  OCR_VIEW:          'OCR:VIEW',
  OCR_TRIGGER:       'OCR:TRIGGER',

  // Archive
  ARCHIVE_VIEW:      'ARCHIVE:VIEW',
  ARCHIVE_RESTORE:   'ARCHIVE:RESTORE',
}
