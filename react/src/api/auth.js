import instance from './axios';

/**
 * Authenticate user via Telegram
 * @param {Object} data - Telegram authentication data
 * @returns {Promise} Response with user data
 */
export const telegramAuth = async (data) => {
  const response = await instance.post('/api/auth/telegram', data);
  return response.data;
};

/**
 * Logout current user
 * @returns {Promise} Response with logout confirmation
 */
export const logout = async () => {
  const response = await instance.post('/api/auth/logout');
  return response.data;
};

/**
 * Get current authenticated user
 * @returns {Promise} Response with current user data
 */
export const getCurrentUser = async () => {
  const response = await instance.get('/api/auth/me');
  return response.data;
};
