import { create } from 'zustand'

const useUserStore = create((set, get) => ({
  user: null,
  isLoading: false,

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  clearUser: () => set({ user: null }),

  // Check if current user has a role
  hasRole: (role) => {
    const { user } = get()
    return user?.roles?.includes(role) ?? false
  },

  // Check if user has ANY of the given roles
  hasAnyRole: (roles) => {
    const { user } = get()
    return roles.some(r => user?.roles?.includes(r)) ?? false
  }
}))

export default useUserStore