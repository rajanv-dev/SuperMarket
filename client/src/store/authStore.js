import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services';
import { supabase } from '../lib/supabase';
import { ROLES } from '../utils/constants';
import { getAuthRedirectUrl } from '../utils/authRedirect';

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
          // 1. Try Supabase Auth password authentication
          if (supabase) {
            const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({
              email: data.email.trim(),
              password: data.password,
            });

            if (!sbError && sbData?.session) {
              await get().setSupabaseSession(sbData.session);
              const currentUser = get().user;
              return { success: true, role: currentUser?.role || ROLES.CUSTOMER };
            }

            if (sbError && sbError.message === 'Invalid login credentials') {
              throw new Error('Invalid email or password');
            }
          }

          // 2. Fall back to backend auth if Supabase wasn't matched
          const res = await authService.login(data);
          const { user, token } = res.data.data;
          set({ user, token, isLoading: false });
          return { success: true, role: user.role };
        } catch (err) {
          const error = err.message || err.userMessage || 'Login failed';
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      adminLogin: async ({ email, password }) => {
        set({ isLoading: true, error: null });
        try {
          if (!supabase) throw new Error('Authentication service is not initialized');

          const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

          if (sbError) {
            throw new Error(
              sbError.message === 'Invalid login credentials'
                ? 'Invalid administrator email or password'
                : sbError.message
            );
          }

          if (!sbData?.session?.user) {
            throw new Error('Authentication session could not be established');
          }

          // Verify administrator role from database
          const { data: profile, error: profErr } = await supabase
            .from('user_profiles')
            .select('role, is_active, full_name')
            .or(`auth_id.eq.${sbData.session.user.id},email.eq.${sbData.session.user.email}`)
            .maybeSingle();

          if (profErr || !profile) {
            await supabase.auth.signOut();
            throw new Error('No profile associated with this account. Contact system administrator.');
          }

          if (!profile.is_active) {
            await supabase.auth.signOut();
            throw new Error('Your administrator account has been deactivated.');
          }

          if (profile.role !== ROLES.ADMIN) {
            await supabase.auth.signOut();
            throw new Error('Access denied: Your account does not have administrator privileges.');
          }

          await get().setSupabaseSession(sbData.session);
          return { success: true, role: profile.role };
        } catch (err) {
          const error = err.message || 'Admin login failed';
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      resetPassword: async (email) => {
        if (!supabase) throw new Error('Authentication service is not initialized');
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: getAuthRedirectUrl('/admin/login'),
        });
        if (error) throw error;
        return true;
      },

      /**
       * Sets user session from Supabase OAuth or Auth.
       * Updates state immediately to avoid any navbar flashing.
       */
      setSupabaseSession: async (session) => {
        if (!session?.user) {
          const { user } = get();
          if (user?.provider === 'google' || user?.provider === 'supabase') {
            set({ user: null, token: null, isLoading: false });
          }
          return;
        }

        const existingUser = get().user;
        const initialRole =
          existingUser?.id === session.user.id && existingUser?.role
            ? existingUser.role
            : ROLES.CUSTOMER;

        let authUser = {
          ...extractUserProfile(session.user),
          role: initialRole,
        };

        // Query verified database role from public.user_profiles before releasing isLoading
        if (supabase) {
          try {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('role, is_active, full_name')
              .or(`auth_id.eq.${session.user.id},email.eq.${session.user.email}`)
              .maybeSingle();

            if (profile) {
              if (!profile.is_active) {
                set({
                  user: null,
                  token: null,
                  isLoading: false,
                  error: 'Account has been deactivated by administrator',
                });
                return;
              }
              authUser = {
                ...authUser,
                role: profile.role || authUser.role,
                name: profile.full_name || authUser.name,
              };
            }
          } catch (err) {
            console.warn('Profile lookup error:', err);
          }
        }

        set({
          user: authUser,
          token: session.access_token,
          isLoading: false,
          error: null,
        });
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
        const hasAuthCode =
          typeof window !== 'undefined' &&
          (window.location.search.includes('code=') ||
            window.location.hash.includes('access_token='));

        // 1. Check Supabase session first
        if (supabase) {
          try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (session?.user && !error) {
              await get().setSupabaseSession(session);
              return;
            }

            // If an auth code is present in URL, PKCE exchange is in flight;
            // keep isLoading: true so ProtectedRoute waits for onAuthStateChange!
            if (hasAuthCode) {
              setTimeout(() => {
                if (get().isLoading) {
                  set({ isLoading: false });
                }
              }, 4000);
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
