import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services';
import { supabase } from '../lib/supabase';
import { ROLES } from '../utils/constants';

/**
 * Helper to extract Google and Supabase user profile attributes
 * Strictly follows fallback order:
 * Name: full_name -> name -> email prefix -> "My Account"
 * Avatar: avatar_url -> picture -> null
 */
export const extractUserProfile = (sbUser) => {
  if (!sbUser) return null;
  const meta = sbUser.user_metadata || {};

  // Fallback order for name: full_name -> name -> email prefix -> "My Account"
  const emailPrefix = sbUser.email ? sbUser.email.split('@')[0] : '';
  const displayName =
    meta.full_name ||
    meta.name ||
    emailPrefix ||
    'My Account';

  // Profile image: avatar_url -> picture -> null
  const avatarUrl = meta.avatar_url || meta.picture || null;

  return {
    id: sbUser.id,
    name: displayName,
    email: sbUser.email || '',
    avatar: avatarUrl,
    picture: avatarUrl,
    role: ROLES.CUSTOMER, // Security: Always default to customer for OAuth
    provider: sbUser.app_metadata?.provider || 'google',
  };
};

/**
 * Auth store — persisted to localStorage under key 'super-auth'.
 * Supports both traditional JWT auth and Supabase OAuth sessions.
 */
const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: true,
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

      /**
       * Sets user session from Supabase OAuth or Auth.
       * Updates state immediately to avoid any navbar flashing.
       */
      setSupabaseSession: (session) => {
        if (!session?.user) {
          const { user } = get();
          if (user?.provider === 'google' || user?.provider === 'supabase') {
            set({ user: null, token: null, isLoading: false });
          }
          return;
        }

        const authUser = extractUserProfile(session.user);

        // 1. Immediately set user and token synchronously
        set({
          user: authUser,
          token: session.access_token,
          isLoading: false,
          error: null,
        });

        // 2. Background check if this user has an assigned staff/admin role in public.user_profiles
        if (supabase) {
          supabase
            .from('user_profiles')
            .select('role, is_active, full_name')
            .or(`auth_id.eq.${session.user.id},email.eq.${session.user.email}`)
            .maybeSingle()
            .then(({ data: profile }) => {
              if (profile) {
                if (!profile.is_active) {
                  set({ user: null, token: null, isLoading: false, error: 'Account is deactivated' });
                  return;
                }
                const currentUser = get().user;
                if (currentUser && profile.role && profile.role !== currentUser.role) {
                  set({
                    user: {
                      ...currentUser,
                      role: profile.role,
                      name: profile.full_name || currentUser.name,
                    },
                  });
                }
              }
            })
            .catch(() => {
              // Ignore background profile query errors
            });
        }
      },

      setDevRole: (newRole) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, role: newRole } });
        } else {
          set({
            user: {
              id: 'dev-admin-id',
              name: 'Super Admin',
              email: 'admin@super.local',
              role: newRole,
              provider: 'dev',
            },
            token: 'dev-token-admin',
            isLoading: false,
          });
        }
      },

      logout: async () => {
        try {
          if (supabase) {
            await supabase.auth.signOut();
          }
        } catch (err) {
          console.warn('Supabase signOut error:', err);
        }

        try {
          await authService.logout();
        } catch {
          // Ignore API logout errors
        } finally {
          set({ user: null, token: null, error: null, isLoading: false });
        }
      },

      /**
       * Initializes the frontend session.
       * First checks Supabase getSession(). If found, restores session.
       * Otherwise checks persisted token with backend.
       */
      initAuth: async () => {
        // 1. Check Supabase session first
        if (supabase) {
          try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (session?.user && !error) {
              get().setSupabaseSession(session);
              return;
            }
          } catch (err) {
            console.warn('Supabase getSession error:', err);
          }
        }

        // 2. If no Supabase session, check persisted local token
        const { token, user } = get();
        if (user?.provider === 'google' || user?.provider === 'supabase') {
          // If stored user was from google but no active Supabase session exists, clear
          set({ user: null, token: null, isLoading: false });
          return;
        }

        if (!token) {
          set({ isLoading: false });
          return;
        }

        try {
          const res = await authService.getMe();
          set({ user: res.data.data.user, isLoading: false });
        } catch {
          // Token invalid — clear store
          set({ user: null, token: null, isLoading: false });
        }
      },

      fetchMe: async () => {
        return get().initAuth();
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
