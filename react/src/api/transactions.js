import instance from './axios';

/**
 * Get user transactions with pagination and filters
 * @param {Object} params - Query parameters (page, page_size, currency_type, transaction_type, date_from, date_to)
 * @returns {Promise} Response with paginated transactions list
 */
export const getTransactions = async (params = {}) => {
  const response = await instance.get('/api/transactions', { params });
  return response.data;
};

/**
 * Process first tournament completion
 * @param {Object} data - Tournament completion data (user_id, tournament_id)
 * @returns {Promise} Response with bonuses distribution info
 */
export const processFirstTournament = async (data) => {
  const response = await instance.post('/api/tournament/first-completed', data);
  return response.data;
};

/**
 * Process user deposit
 * @param {Object} data - Deposit data (user_id, amount, deposit_id)
 * @returns {Promise} Response with deposit processing info
 */
export const processDeposit = async (data) => {
  const response = await instance.post('/api/deposit/processed', data);
  return response.data;
};
