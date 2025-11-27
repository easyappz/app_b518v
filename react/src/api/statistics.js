import instance from './axios';

/**
 * Get user statistics for analytics
 * @param {number} userId - User ID
 * @param {number} period - Period in days (7, 30, 90)
 * @returns {Promise} Statistics data
 */
export const getUserStatistics = async (userId, period = 30) => {
  const response = await instance.get(`/api/users/${userId}/stats`, {
    params: { period }
  });
  return response.data;
};

/**
 * Get user referrals with statistics
 * @param {number} userId - User ID
 * @param {number} depth - Referral depth (1-10)
 * @returns {Promise} Referrals data
 */
export const getUserReferralsStats = async (userId, depth = 10) => {
  const response = await instance.get(`/api/user/${userId}/referrals`, {
    params: { depth }
  });
  return response.data;
};

/**
 * Get transactions for analytics
 * @param {Object} params - Filter parameters
 * @returns {Promise} Transactions data
 */
export const getTransactionsForAnalytics = async (params = {}) => {
  const response = await instance.get('/api/transactions', {
    params: {
      page_size: 1000,
      ...params
    }
  });
  return response.data;
};
