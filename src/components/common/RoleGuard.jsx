import useUserStore from '../../store/userStore'

// Hides children if user doesn't have required role
// Usage: <RoleGuard roles={['ECM_ADMIN']}>...</RoleGuard>
export default function RoleGuard({ roles, children, fallback = null }) {
  const { hasAnyRole } = useUserStore()

  if (!hasAnyRole(roles)) {
    return fallback
  }

  return children
}