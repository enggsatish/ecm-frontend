/**
 * uiStore.js
 * Global UI state — sidebar collapsed, theme, etc.
 * Persisted to localStorage so state survives page reloads.
 */
import { create } from 'zustand'

const STORAGE_KEY = 'ecm-ui-state'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sidebarCollapsed: state.sidebarCollapsed,
    }))
  } catch { /* ignore */ }
}

const persisted = loadState()

const useUiStore = create((set, get) => ({
  sidebarCollapsed: persisted.sidebarCollapsed ?? false,

  toggleSidebar: () => {
    set(s => ({ sidebarCollapsed: !s.sidebarCollapsed }))
    saveState(get())
  },

  setSidebarCollapsed: (collapsed) => {
    set({ sidebarCollapsed: collapsed })
    saveState(get())
  },
}))

export default useUiStore
