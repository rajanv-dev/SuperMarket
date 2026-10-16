import axios from 'axios';

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: '/api',       // Vite proxy forwards to http://localhost:5000/api
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

    // If the server says 401, clear stored auth state and redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('super-auth');
      // Avoid redirect loops on the login page itself
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    // Attach a human-readable message to the error
    error.userMessage = message;
    return Promise.reject(error);
  }
);

export default api;
