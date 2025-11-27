import instance from './axios';

/**
 * Create withdrawal request
 * @param {Object} data - Withdrawal data (amount, method, wallet_address)
 * @returns {Promise} Response with created withdrawal request
 */
export const createWithdrawal = async (data) => {
  const response = await instance.post('/api/withdrawals', data);
  return response.data;
};

/**
 * Get withdrawal requests with pagination and filters
 * @param {Object} params - Query parameters (page, page_size, status)
 * @returns {Promise} Response with paginated withdrawals list
 */
export const getWithdrawals = async (params = {}) => {
  const response = await instance.get('/api/withdrawals', { params });
  return response.data;
};

/**
 * Get withdrawal request details
 * @param {number} id - Withdrawal request ID
 * @returns {Promise} Response with withdrawal details
 */
export const getWithdrawal = async (id) => {
  const response = await instance.get(`/api/withdrawals/${id}`);
  return response.data;
};
