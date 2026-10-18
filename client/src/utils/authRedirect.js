/**
 * OAuth Redirect & URL Helper for VRK Supermarket
 * Ensures safe redirects in both Production (Vercel) and Local Development.
 */

const PRODUCTION_ORIGIN = 'https://vrk-supermarket.vercel.app';

/**
 * Returns the exact origin of the current running application.
 * Falls back to production URL if window is undefined or origin is empty.
 */
export const getAppOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return window.location.origin.replace(/\/+$/, '');
  }
  return PRODUCTION_ORIGIN;
};

/**
 * Computes the OAuth redirect URL for Supabase signInWithOAuth.
 * 
 * CRITICAL FOR SUPABASE WILDCARD MATCHING:
 * Supabase glob patterns like `https://vrk-supermarket.vercel.app/**`
 * require the URL to have a trailing slash (`https://vrk-supermarket.vercel.app/`).
 * If sent without trailing slash, Supabase fails the wildcard check and
 * falls back to the dashboard's default Site URL (which might be localhost:5175).
 *
 * @param {string} [path=''] - Optional subpath like '/admin'
 * @returns {string} Fully qualified redirect URL (e.g. 'https://vrk-supermarket.vercel.app/')
 */
export const getAuthRedirectUrl = (path = '') => {
  const origin = getAppOrigin();

  if (path) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${origin}${cleanPath}`;
  }

  // Always ensure a trailing slash for the root redirect
  return `${origin}/`;
};

/**
 * Store the intended user destination before redirecting to OAuth
 */
export const savePostLoginDestination = (pathname) => {
  if (typeof window === 'undefined' || !pathname) return;
  // Ignore auth pages as destinations
  if (pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/admin/login')) {
    return;
  }
  try {
    sessionStorage.setItem('vrk_oauth_destination', pathname);
  } catch {
    // ignore storage quota issues
  }
};

/**
 * Retrieve and clear the intended user destination
 */
export const getAndClearPostLoginDestination = () => {
  if (typeof window === 'undefined') return null;
  try {
    const dest = sessionStorage.getItem('vrk_oauth_destination');
    if (dest) {
      sessionStorage.removeItem('vrk_oauth_destination');
      return dest;
    }
  } catch {
    // ignore
  }
  return null;
};

/**
 * Cleans OAuth parameters (?code=, ?error=, etc.) from the URL
 * without triggering a page reload.
 */
export const cleanAuthUrlParams = () => {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    let changed = false;

    const paramsToRemove = ['code', 'error', 'error_code', 'error_description', 'state'];
    paramsToRemove.forEach((param) => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    });

    if (url.hash && (url.hash.includes('access_token=') || url.hash.includes('error='))) {
      url.hash = '';
      changed = true;
    }

    if (changed) {
      const cleanPath = url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : '');
      window.history.replaceState({}, document.title, cleanPath);
    }
  } catch (err) {
    console.warn('Failed to clean auth URL parameters:', err);
  }
};
