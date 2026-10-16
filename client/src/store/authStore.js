import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services';
import { supabase } from '../lib/supabase';
import { ROLES } from '../utils/constants';

/**
 * Auth store — persisted to localStorage under key 'super-auth'.
 * Supports both traditional JWT auth and Supabase OAuth sessions.
 * Security: OAuth sessions always default to the 'customer' role.
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

      setSupabaseSession: (session) => {
        if (!session?.user) {
          const { user } = get();
          if (user?.provider === 'google') {
            set({ user: null, token: null, isLoading: false });
          }
          return;
        }

        const authUser = {
          id: session.user.id,
          name:
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            session.user.email?.split('@')[0] ||
            'Google User',
          email: session.user.email,
          role: ROLES.CUSTOMER, // Security: Always default to customer for OAuth
          avatar: session.user.user_metadata?.avatar_url || null,
          provider: 'google',
        };

        set({
          user: authUser,
          token: session.access_token,
          isLoading: false,
          error: null,
        });
      },

      logout: async () => {
        try {
          if (supabase) {
            await supabase.auth.signOut();
          }
        } catch {
          // Ignore signOut errors
        }

        try {
          await authService.logout();
        } catch {
          // Ignore API logout errors
        } finally {
          set({ user: null, token: null, error: null });
        }
      },

      fetchMe: async () => {
        // 1. Check if Supabase has an active session (e.g. from Google OAuth redirect)
        if (supabase) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              get().setSupabaseSession(session);
              return;
            }
          } catch {
            // Ignore session check error, fall through
          }
        }

        // 2. Fall back to backend token check
        const { token, user } = get();
        if (user?.provider === 'google') {
          // If stored user was from google but no Supabase session exists, clear
          set({ user: null, token: null, isLoading: false });
          return;
        }

        if (!token) {
          set({ isLoading: false });
          return;
        }

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
