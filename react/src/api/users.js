import instance from './axios';

/**
 * Get user by ID
 * @param {number} userId - User ID
 * @returns {Promise} Response with user data
 */
export const getUser = async (userId) => {
  const response = await instance.get(`/api/users/${userId}`);
  return response.data;
};

/**
 * Update user profile
 * @param {number} userId - User ID
 * @param {Object} data - Update data (e.g., user_type)
 * @returns {Promise} Response with updated user data
 */
export const updateUser = async (userId, data) => {
  const response = await instance.patch(`/api/users/${userId}`, data);
  return response.data;
};

/**
 * Get user statistics
 * @param {number} userId - User ID
 * @returns {Promise} Response with user statistics
 */
export const getUserStats = async (userId) => {
  const response = await instance.get(`/api/users/${userId}/stats`);
  return response.data;
};
