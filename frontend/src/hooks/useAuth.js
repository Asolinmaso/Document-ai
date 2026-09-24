import { useState, useEffect, useCallback } from 'react';
import { getMe, logout as logoutService, getCachedUser } from '../services/auth';

/**
 * useAuth – manages authentication state for the app.
 *
 * - On mount, validates any existing token against the server.
 * - Listens for the global 'auth:expired' event (dispatched by api.js
 *   interceptors) to react to 401 responses anywhere in the app.
 * - Provides login / logout helpers that update state correctly.
 */
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Validate the stored token on app startup
  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const userData = await getMe();
        if (!cancelled) {
          setUser(userData);
          // Keep localStorage user cache in sync with server response
          localStorage.setItem('user', JSON.stringify(userData));
        }
      } catch {
        // Token invalid or expired – clean up silently
        if (!cancelled) {
          logoutService();
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    checkAuth();
    return () => { cancelled = true; };
  }, []);

  // Listen for global session-expiry events emitted by the API interceptor
  useEffect(() => {
    const handleExpiry = () => {
      setUser(null);
      setSessionExpired(true);
    };
    window.addEventListener('auth:expired', handleExpiry);
    return () => window.removeEventListener('auth:expired', handleExpiry);
  }, []);

  const logout = useCallback(() => {
    logoutService();
    setUser(null);
    setSessionExpired(false);
  }, []);

  return { user, setUser, loading, logout, sessionExpired, setSessionExpired };
};
