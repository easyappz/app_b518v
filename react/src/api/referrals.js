import instance from './axios';

export const registerUser = async (userData) => {
  const response = await instance.post('/api/user/register', userData);
  return response.data;
};

export const getUserReferrals = async (userId, depth = 1) => {
  const response = await instance.get(`/api/user/${userId}/referrals`, {
    params: { depth }
  });
  return response.data;
};

export const getReferralTree = async (userId) => {
  const response = await instance.get(`/api/user/${userId}/referral-tree`);
  return response.data;
};

export const getReferralLink = async (userId) => {
  const response = await instance.get(`/api/referral/link/${userId}`);
  return response.data;
};
