import instance from './axios';

/**
 * Get all users list with filters and pagination
 * @param {Object} params - Query parameters (user_type, rank, search, page, page_size)
 * @returns {Promise} Response with paginated users list
 */
export const getUsers = async (params = {}) => {
  const response = await instance.get('/api/admin/users', { params });
  return response.data;
};

/**
 * Get user details by ID
 * @param {number} id - User ID
 * @returns {Promise} Response with detailed user data
 */
export const getUser = async (id) => {
  const response = await instance.get(`/api/admin/users/${id}`);
  return response.data;
};

/**
 * Update user data
 * @param {number} id - User ID
 * @param {Object} data - Update data (user_type, rank, balances, is_blocked)
 * @returns {Promise} Response with updated user data
 */
export const updateUser = async (id, data) => {
  const response = await instance.patch(`/api/admin/users/${id}`, data);
  return response.data;
};

/**
 * Get all transactions with filters
 * @param {Object} params - Query parameters (user_id, transaction_type, currency, date_from, date_to, page, page_size)
 * @returns {Promise} Response with paginated transactions list
 */
export const getTransactions = async (params = {}) => {
  const response = await instance.get('/api/admin/transactions', { params });
  return response.data;
};

/**
 * Get all withdrawal requests with filters
 * @param {Object} params - Query parameters (status, user_id, page, page_size)
 * @returns {Promise} Response with paginated withdrawals list
 */
export const getWithdrawals = async (params = {}) => {
  const response = await instance.get('/api/admin/withdrawals', { params });
  return response.data;
};

/**
 * Update withdrawal request status
 * @param {number} id - Withdrawal request ID
 * @param {Object} data - Update data (status, rejection_reason)
 * @returns {Promise} Response with updated withdrawal request
 */
export const updateWithdrawal = async (id, data) => {
  const response = await instance.patch(`/api/admin/withdrawals/${id}`, data);
  return response.data;
};

/**
 * Get system statistics
 * @returns {Promise} Response with overall system stats
 */
export const getStats = async () => {
  const response = await instance.get('/api/admin/stats');
  return response.data;
};

/**
 * Get system analytics
 * @param {Object} params - Query parameters (period)
 * @returns {Promise} Response with analytics data
 */
export const getAnalytics = async (params = {}) => {
  const response = await instance.get('/api/admin/analytics', { params });
  return response.data;
};
