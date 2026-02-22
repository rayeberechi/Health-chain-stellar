/**
 * Custom hook for authentication operations
 * Provides login, logout, and auth state management
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../stores/auth.store';
import { api } from '../api/http-client';

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    [key: string]: unknown;
  };
}

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, setTokens, setUser, clearAuth } = useAuthStore();

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      try {
        const response = await api.post<LoginResponse>('/auth/login', credentials, {
          skipAuth: true,
        });

        // Store tokens and user
        setTokens(response.access_token, response.refresh_token);
        setUser(response.user);

        return { success: true, user: response.user };
      } catch (error) {
        console.error('Login failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Login failed',
        };
      }
    },
    [setTokens, setUser]
  );

  const logout = useCallback(async () => {
    try {
      // Call logout endpoint (optional - for server-side cleanup)
      if (user?.id) {
        await api.post('/auth/logout', { userId: user.id }).catch(() => {
          // Ignore errors - clear local state anyway
        });
      }
    } finally {
      // Clear auth state
      clearAuth();
      
      // Redirect to login
      router.push('/auth/signin');
    }
  }, [user, clearAuth, router]);

  return {
    user,
    isAuthenticated,
    login,
    logout,
  };
}
