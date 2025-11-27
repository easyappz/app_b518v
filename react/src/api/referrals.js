import instance from './axios';

/**
 * Register user with referral code
 * @param {Object} data - Registration data including optional referrer_code
 * @returns {Promise} Response with registered user data
 */
export const registerWithReferral = async (data) => {
  const response = await instance.post('/api/user/register', data);
  return response.data;
};

/**
 * Get user referrals tree
 * @param {number} userId - User ID
 * @param {number} depth - Depth of referral tree (1-10 levels)
 * @returns {Promise} Response with referrals tree
 */
export const getUserReferrals = async (userId, depth = 1) => {
  const response = await instance.get(`/api/user/${userId}/referrals`, {
    params: { depth }
  });
  return response.data;
};

/**
 * Get full referral tree visualization
 * @param {number} userId - User ID
 * @returns {Promise} Response with complete referral tree
 */
export const getReferralTree = async (userId) => {
  const response = await instance.get(`/api/user/${userId}/referral-tree`);
  return response.data;
};

/**
 * Get user referral link
 * @param {number} userId - User ID
 * @returns {Promise} Response with referral link and QR code
 */
export const getReferralLink = async (userId) => {
  const response = await instance.get(`/api/referral/link/${userId}`);
  return response.data;
};
