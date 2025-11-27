import { create } from 'zustand';
import { getCurrentUser } from '../api/auth';

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user,
    isLoading: false 
  }),

  logout: () => set({ 
    user: null, 
    isAuthenticated: false,
    isLoading: false 
  }),

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const userData = await getCurrentUser();
      set({ 
        user: userData, 
        isAuthenticated: true,
        isLoading: false 
      });
      return userData;
    } catch (error) {
      set({ 
        user: null, 
        isAuthenticated: false,
        isLoading: false 
      });
      return null;
    }
  },
}));

export default useAuthStore;
