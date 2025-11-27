import instance from './axios';

/**
 * Get user notifications with pagination and filters
 * @param {Object} params - Query parameters (is_read, page, page_size)
 * @returns {Promise} Response with paginated notifications list
 */
export const getNotifications = async (params = {}) => {
  const response = await instance.get('/api/notifications', { params });
  return response.data;
};

/**
 * Mark notification as read
 * @param {number} id - Notification ID
 * @returns {Promise} Response with updated notification
 */
export const markAsRead = async (id) => {
  const response = await instance.patch(`/api/notifications/${id}/read`);
  return response.data;
};

/**
 * Subscribe to push notifications
 * @param {Object} data - Push subscription data from browser
 * @returns {Promise} Response with subscription confirmation
 */
export const subscribePush = async (data) => {
  const response = await instance.post('/api/notifications/push-subscribe', data);
  return response.data;
};
