import api from './api';

/**
 * Login – stores token & user in localStorage on success.
 * @returns {{ token: string, user: object }}
 */
export const login = async (email, password) => {
  const data = await api.post('/auth/login', { email, password });

  if (data?.token) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  return data;
};

/**
 * Signup – creates a new account. Does NOT auto-login; caller should call login().
 */
export const signup = async (name, email, password) => {
  return api.post('/auth/signup', { name, email, password });
};

/**
 * Ask the server to email a password-reset link. The response is the same whether or not the
 * account exists, so callers must not imply that it does.
 */
export const forgotPassword = async (email) => {
  return api.post('/auth/forgot-password', { email });
};

/**
 * Set a new password using the token from the reset email.
 */
export const resetPassword = async (token, password) => {
  return api.post('/auth/reset-password', { token, password });
};

/**
 * Fetch current authenticated user from the server.
 * Throws if the token is invalid / expired.
 */
export const getMe = async () => {
  return api.get('/auth/me');
};

/**
 * Clears all auth data from localStorage.
 */
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

/**
 * Returns the raw token stored in localStorage (or null).
 */
export const getToken = () => localStorage.getItem('token');

/**
 * Returns the cached user object from localStorage (or null).
 */
export const getCachedUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
