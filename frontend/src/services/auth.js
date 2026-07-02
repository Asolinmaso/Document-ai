import { apiFetch } from './api';

export const login = async (email, password) => {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  
  if (data.token) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }
  
  return data;
};

export const signup = async (name, email, password) => {
  return await apiFetch('/auth/signup', {
    method: 'POST',
    body: { name, email, password },
  });
};

export const getMe = async () => {
  return await apiFetch('/auth/me', {
    method: 'GET',
  });
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};
