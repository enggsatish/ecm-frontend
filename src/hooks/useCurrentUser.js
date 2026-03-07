import { useQuery } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import useUserStore from '../store/userStore'
import { useEffect } from 'react'

/**
 * Fetches /api/auth/me and stores the result in global Zustand userStore.
 * Used once in AppLayout — all other components read from useUserStore directly.
 *
 * Data shape AFTER apiClient interceptor unwraps ApiResponse<User>:
 *   axios response.data = User   (not { success, data: User } any more)
 *
 * So TanStack query.data = axios response = { data: User, status: 200, ... }
 *   query.data?.data = User  ← one level, not two
 */
export function useCurrentUser() {
  const { setUser } = useUserStore()

  const query = useQuery({
    queryKey: ['currentUser'],
    queryFn:  () => authApi.getMe(),
    staleTime: 5 * 60 * 1000,   // 5 minutes
    retry: 1,
  })

  useEffect(() => {
    // apiClient interceptor already unwrapped ApiResponse<User>
    // query.data = axios response  →  query.data.data = User object
    if (query.data?.data) {
      setUser(query.data.data)
    }
  }, [query.data, setUser])

  return query
}