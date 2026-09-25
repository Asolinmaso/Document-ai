import axios from 'axios';

// VITE_API_URL is either a relative path served through the Vite dev proxy ("/api")
// or the absolute URL of the deployed backend ("https://my-backend.onrender.com").
const rawBaseURL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const baseURL = rawBaseURL.endsWith('/api') ? rawBaseURL : `${rawBaseURL}/api`;

const api = axios.create({
  baseURL,
  timeout: 30000,
});

// ── Request interceptor: attach auth token ──────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: normalise errors & handle 401 globally ────────────
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      // Session expired or invalid token – clear local storage
      if (status === 401 || status === 403) {
        const code = data?.code;
        if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID' || status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          // Fire a custom event so App can react without circular imports
          window.dispatchEvent(new CustomEvent('auth:expired', { detail: { reason: data?.error } }));
        }
      }

      const message = data?.error || data?.message || `Request failed with status ${status}`;
      return Promise.reject(new Error(message));
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Request timed out. Please check your connection.'));
    }

    return Promise.reject(new Error(error.message || 'A network error occurred.'));
  }
);

export default api;
