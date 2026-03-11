import { useQuery } from '@tanstack/react-query'
import { authApi }   from '../api/authApi'
import useUserStore  from '../store/userStore'
import { useEffect } from 'react'

/**
 * Fetches /api/auth/me and stores the result in global Zustand userStore.
 * Used once in AppLayout — all other components read from useUserStore directly.
 *
 * Returns the full TanStack Query result (including isLoading, isError, error)
 * so RequireAuth can distinguish between:
 *   - Still loading  (isLoading=true)
 *   - Loaded OK      (data set, user populated in store)
 *   - Errored        (isError=true — e.g. 403 inactive account, 503 service down)
 *
 * WHY this matters:
 *   If /api/auth/me returns 403, user stays null forever. RequireAuth checks
 *   isError to detect this and show AccountErrorPage instead of silently
 *   breaking inside AppLayout.
 *
 * API response envelope (after apiClient interceptor unwraps ApiResponse<User>):
 *   axios response.data = User object or ApiResponse wrapper
 *
 * User object shape (Sprint G):
 *   {
 *     id, entraObjectId, displayName, email, department,
 *     roles:       ['ECM_ADMIN', 'ECM_BACKOFFICE', ...],
 *     permissions: ['DOCUMENT:VIEW', 'DOCUMENT:UPLOAD', 'ADMIN:ROLES', ...]
 *   }
 */
export function useCurrentUser() {
  const { setUser } = useUserStore()

  const query = useQuery({
    queryKey: ['currentUser'],
    queryFn:  () => authApi.getMe(),
    staleTime: 5 * 60 * 1000,   // 5 minutes
    retry: 1,                    // one retry — if 403 it will stay 403, no point hammering
  })

  useEffect(() => {
    if (query.data) {
      // apiClient interceptor unwraps ApiResponse<T>; data may be
      // response.data.data (unwrapped) or response.data (raw)
      const raw = query.data?.data ?? query.data

      if (raw && typeof raw === 'object' && raw.email) {
        // Normalise: ensure roles and permissions are always arrays
        const user = {
          ...raw,
          roles:       Array.isArray(raw.roles)       ? raw.roles       : [],
          permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
        }
        setUser(user)
      }
    }
  }, [query.data, setUser])

  // Return full query so RequireAuth can inspect isLoading / isError / error
  return query
}