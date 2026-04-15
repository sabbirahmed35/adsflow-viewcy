import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiPost, tokenStorage } from '../lib/api';
import { User } from '@shared/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user, isAuthenticated: true }),

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const data = await apiPost<{ user: User; accessToken: string; refreshToken: string }>(
            '/auth/login',
            { email, password }
          );
          tokenStorage.set(data.accessToken, data.refreshToken);
          set({ user: data.user, isAuthenticated: true });
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true });
        try {
          const data = await apiPost<{ user: User; accessToken: string; refreshToken: string }>(
            '/auth/register',
            { name, email, password }
          );
          tokenStorage.set(data.accessToken, data.refreshToken);
          set({ user: data.user, isAuthenticated: true });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        const refresh = tokenStorage.getRefresh();
        try {
          if (refresh) await apiPost('/auth/logout', { refreshToken: refresh });
        } catch {}
        tokenStorage.clear();
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'adflow-auth',
      partialize: (state: AuthState) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    } as any
  )
);
