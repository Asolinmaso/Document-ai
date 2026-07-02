import api from './api';

export const login = async (email, password) => {
  const data = await api.post('/auth/login', { email, password });
  
  if (data.token) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }
  
  return data;
};

export const signup = async (name, email, password) => {
  return await api.post('/auth/signup', { name, email, password });
};

export const getMe = async () => {
  return await api.get('/auth/me');
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};
