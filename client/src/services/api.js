import axios from 'axios';

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true, // send HttpOnly cookie on every request
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ── Request interceptor — attach Bearer token from Zustand store ──────────────
// We import lazily to avoid circular deps; the token is also in the HttpOnly
// cookie so this is a belt-and-suspenders approach for API clients that can't
// read cookies (e.g. mobile, Postman).
api.interceptors.request.use(
  (config) => {
    try {
      const raw = localStorage.getItem('super-auth');
      if (raw) {
        const { state } = JSON.parse(raw);
        if (state?.token) {
          config.headers['Authorization'] = `Bearer ${state.token}`;
        }
      }
    } catch {
      // ignore parse errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — normalise errors ───────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message || error.message || 'An unexpected error occurred';

    // If the server says 401 on an explicitly authenticated action, clear stored token
    if (error.response?.status === 401) {
      const isCartRequest = error.config?.url?.includes('/cart');
      const isPublicProduct = error.config?.url?.includes('/products');

      // Do NOT kick guest shoppers out when browsing products or managing local cart
      if (!isCartRequest && !isPublicProduct) {
        localStorage.removeItem('super-auth');
        const pathname = window.location.pathname;
        if (
          !pathname.startsWith('/login') &&
          !pathname.startsWith('/register') &&
          !pathname.startsWith('/cart') &&
          (pathname.startsWith('/checkout') || pathname.startsWith('/admin') || pathname.startsWith('/orders') || pathname.startsWith('/profile'))
        ) {
          window.location.href = `/login?redirect=${encodeURIComponent(pathname)}`;
        }
      }
    }

    // Attach a human-readable message to the error
    error.userMessage = message;
    return Promise.reject(error);
  }
);

export default api;
