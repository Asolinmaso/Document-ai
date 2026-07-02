import { useState, useEffect } from 'react';
import { getMe, logout as logoutService } from '../services/auth';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await getMe();
          setUser(userData);
        } catch (error) {
          console.error("Auth check failed:", error);
          logoutService();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const logout = () => {
    logoutService();
    setUser(null);
  };

  return { user, setUser, loading, logout };
};
