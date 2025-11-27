import instance from './axios';

export const loginWithTelegram = async (telegramData) => {
  const response = await instance.post('/api/auth/telegram', telegramData);
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
