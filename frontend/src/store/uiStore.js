import { create } from 'zustand'

let _id = 0

const _saved = () => {
  try { return JSON.parse(localStorage.getItem('cg-sidebar-collapsed')) === true }
  catch { return false }
}

export const useUiStore = create((set, get) => ({
  sessionExpired: false,
  setSessionExpired: (v) => set({ sessionExpired: v }),

  // ── Sidebar ──────────────────────────────────────────
  sidebarCollapsed: _saved(),
  toggleSidebar: () => set((s) => {
    const next = !s.sidebarCollapsed
    try { localStorage.setItem('cg-sidebar-collapsed', JSON.stringify(next)) } catch { /* ignore */ }
    return { sidebarCollapsed: next }
  }),

  // ── Toast notifications ──────────────────────────────
  toasts: [],
  pushToast: (toast) => {
    const id = ++_id
    const t = {
      id,
      type: toast.type || 'info',   // info | success | error | warning
      title: toast.title || '',
      message: toast.message || '',
      duration: toast.duration ?? 4500,
    }
    set((s) => ({ toasts: [...s.toasts, t] }))
    if (t.duration > 0) {
      setTimeout(() => get().dismissToast(id), t.duration)
    }
    return id
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}))

/* Convenience helpers usable outside React components (e.g. axios interceptor) */
export const toast = {
  info: (title, message) => useUiStore.getState().pushToast({ type: 'info', title, message }),
  success: (title, message) => useUiStore.getState().pushToast({ type: 'success', title, message }),
  error: (title, message) => useUiStore.getState().pushToast({ type: 'error', title, message }),
  warning: (title, message) => useUiStore.getState().pushToast({ type: 'warning', title, message }),
}
