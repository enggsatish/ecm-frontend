import useUserStore from '../../store/userStore'

/**
 * RoleGuard — hides / shows children based on role OR permission checks.
 *
 * Props:
 *   roles       {string[]}  — user must have ANY of these roles (OR logic)
 *   permissions {string[]}  — user must have ANY of these permission codes (OR logic)
 *   fallback    {ReactNode} — what to render when access is denied (default: null)
 *
 * Logic:
 *   - If both props supplied: user must pass BOTH role AND permission check
 *   - If only roles:          role check only
 *   - If only permissions:    permission check only
 *   - If neither:             always renders children (no restriction)
 *
 * Usage:
 *   <RoleGuard roles={[ROLES.ADMIN, ROLES.BACKOFFICE]}>
 *     <ReviewQueuePage />
 *   </RoleGuard>
 *
 *   <RoleGuard permissions={[PERMISSIONS.DOCUMENT_APPROVE]}>
 *     <ApproveButton />
 *   </RoleGuard>
 *
 *   <RoleGuard roles={[ROLES.ADMIN]} permissions={[PERMISSIONS.ADMIN_ROLES]}>
 *     <RolesPage />
 *   </RoleGuard>
 */
export default function RoleGuard({ roles, permissions, children, fallback = null }) {
  const { hasAnyRole, hasAnyPermission } = useUserStore()

  const roleOk       = roles?.length       ? hasAnyRole(roles)             : true
  const permissionOk = permissions?.length ? hasAnyPermission(permissions) : true

  if (!roleOk || !permissionOk) {
    return fallback
  }

  return children
}
