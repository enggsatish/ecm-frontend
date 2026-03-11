import { create } from 'zustand'

/**
 * Global user store — populated by useCurrentUser hook in AppLayout.
 *
 * Sprint G additions:
 *   - permissions[] array (granular permission codes from ecm-identity enrichment)
 *   - hasPermission(code)      — single permission check
 *   - hasAnyPermission(codes)  — OR check across multiple permissions
 */
const useUserStore = create((set, get) => ({
  user:       null,
  isLoading:  false,

  setUser:    (user)      => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  clearUser:  ()          => set({ user: null }),

  // ── Role helpers ──────────────────────────────────────────────────────────

  /** Returns true if user has the exact role string */
  hasRole: (role) => {
    const { user } = get()
    return user?.roles?.includes(role) ?? false
  },

  /** Returns true if user has ANY of the given roles */
  hasAnyRole: (roles) => {
    const { user } = get()
    if (!roles?.length) return true           // null/empty = no restriction
    return roles.some(r => user?.roles?.includes(r)) ?? false
  },

  // ── Permission helpers ────────────────────────────────────────────────────

  /** Returns true if user has the exact permission code (e.g. 'DOCUMENT:APPROVE') */
  hasPermission: (code) => {
    const { user } = get()
    if (!code) return true
    return user?.permissions?.includes(code) ?? false
  },

  /** Returns true if user has ANY of the given permission codes */
  hasAnyPermission: (codes) => {
    const { user } = get()
    if (!codes?.length) return true
    return codes.some(c => user?.permissions?.includes(c)) ?? false
  },
}))

export default useUserStore
