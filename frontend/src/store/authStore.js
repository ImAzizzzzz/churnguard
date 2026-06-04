import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      updateUser: (patch) => set(s => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
      setUser: (u) => set({ user: u }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'churn-auth' }
  )
)