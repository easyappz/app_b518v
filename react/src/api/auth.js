import instance from './axios';

export const loginWithTelegram = async (telegramData) => {
  const response = await instance.post('/api/auth/telegram', telegramData);
  return response.data;
};

export const login = async (username, password) => {
  const response = await instance.post('/api/auth/login', {
    username,
    password
  });
  return response.data;
};

export const register = async (username, password, firstName) => {
  const response = await instance.post('/api/auth/register', {
    username,
    password,
    first_name: firstName || null
  });
  return response.data;
};

export const logout = async () => {
  const response = await instance.post('/api/auth/logout');
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await instance.get('/api/auth/me');
  return response.data;
};
