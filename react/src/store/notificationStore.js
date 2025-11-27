import { create } from 'zustand';
import { getNotifications, markAsRead } from '../api/notifications';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  page: 1,
  hasMore: true,

  fetchNotifications: async (params = {}) => {
    set({ isLoading: true });
    try {
      const data = await getNotifications(params);
      const unreadCount = data.results.filter(n => !n.is_read).length;
      
      set({ 
        notifications: data.results,
        unreadCount,
        hasMore: !!data.next,
        isLoading: false 
      });
      
      return data;
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  markAsRead: async (id) => {
    try {
      const updatedNotification = await markAsRead(id);
      
      set((state) => {
        const notifications = state.notifications.map(n => 
          n.id === id ? { ...n, is_read: true } : n
        );
        const unreadCount = notifications.filter(n => !n.is_read).length;
        
        return { 
          notifications,
          unreadCount 
        };
      });
      
      return updatedNotification;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  },

  updateUnreadCount: () => {
    const { notifications } = get();
    const unreadCount = notifications.filter(n => !n.is_read).length;
    set({ unreadCount });
  },
}));

export default useNotificationStore;
