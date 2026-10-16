import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services';

/**
 * Auth store — persisted to localStorage under key 'super-auth'.
 * Only the token and slim user object are persisted.
 * The full user profile is always fetched fresh from /api/auth/me.
 */
const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      // ── Actions ────────────────────────────────────────────────────────────
      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authService.register(data);
          const { user, token } = res.data.data;
          set({ user, token, isLoading: false });
          return { success: true };
        } catch (err) {
          const error = err.userMessage || 'Registration failed';
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      login: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authService.login(data);
          const { user, token } = res.data.data;
          set({ user, token, isLoading: false });
          return { success: true, role: user.role };
        } catch (err) {
          const error = err.userMessage || 'Login failed';
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      logout: async () => {
        try {
          await authService.logout();
        } finally {
          set({ user: null, token: null, error: null });
        }
      },

      fetchMe: async () => {
        // Called on app load to refresh user data from server
        const { token } = get();
        if (!token) return;
        set({ isLoading: true });
        try {
          const res = await authService.getMe();
          set({ user: res.data.data.user, isLoading: false });
        } catch {
          // Token invalid — clear store
          set({ user: null, token: null, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'super-auth',
      // Only persist token and slim user (not loading/error state)
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

export default useAuthStore;
