'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export function useAuth(requireAuth: boolean = true) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      if (!apiClient.isAuthenticated) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isAuthenticated: false,
        }));

        if (requireAuth) {
          router.push('/login');
        }
        return;
      }

      try {
        const response = await apiClient.getProfile();

        if (response.success && response.data) {
          setState((prev) => ({
            ...prev,
            user: response.data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          }));
        } else {
          throw new Error(response.message || 'Failed to get profile');
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setState((prev) => ({
          ...prev,
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error:
            error instanceof Error ? error.message : 'Authentication failed',
        }));

        if (requireAuth) {
          router.push('/login');
        }
      }
    };

    initializeAuth();
  }, [requireAuth, router]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await apiClient.login(credentials);

      if (response.success && response.data) {
        // Get user profile after successful login
        const profileResponse = await apiClient.getProfile();

        if (profileResponse.success && profileResponse.data) {
          setState((prev) => ({
            ...prev,
            user: profileResponse.data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          }));

          return { success: true, data: profileResponse.data };
        } else {
          throw new Error(
            profileResponse.message || 'Failed to get profile after login'
          );
        }
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Login failed';
      setState((prev) => ({
        ...prev,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      }));

      return { success: false, error: errorMessage };
    }
  }, []);

  const register = useCallback(async (userData: RegisterData) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await apiClient.register(userData);

      if (response.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: null,
        }));

        return { success: true, message: response.message };
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Registration failed';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      return { success: false, error: errorMessage };
    }
  }, []);

  const logout = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });

      router.push('/login');
    }
  }, [router]);

  const refreshProfile = useCallback(async () => {
    if (!apiClient.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await apiClient.getProfile();

      if (response.success && response.data) {
        setState((prev) => ({
          ...prev,
          user: response.data,
          error: null,
        }));

        return { success: true, data: response.data };
      } else {
        throw new Error(response.message || 'Failed to refresh profile');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to refresh profile';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));

      return { success: false, error: errorMessage };
    }
  }, []);

  const updateProfile = useCallback(
    async (data: { name?: string; email?: string }) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await apiClient.updateProfile(data);

        if (response.success && response.data) {
          setState((prev) => ({
            ...prev,
            user: response.data,
            isLoading: false,
            error: null,
          }));

          return { success: true, data: response.data };
        } else {
          throw new Error(response.message || 'Failed to update profile');
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to update profile';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));

        return { success: false, error: errorMessage };
      }
    },
    []
  );

  const changePassword = useCallback(
    async (data: { current_password: string; new_password: string }) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await apiClient.changePassword(data);

        if (response.success) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: null,
          }));

          return { success: true, message: response.message };
        } else {
          throw new Error(response.message || 'Failed to change password');
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to change password';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));

        return { success: false, error: errorMessage };
      }
    },
    []
  );

  return {
    ...state,
    login,
    register,
    logout,
    refreshProfile,
    updateProfile,
    changePassword,
    // Legacy compatibility
    session: state.user ? { user: state.user } : null,
    status: state.isLoading
      ? 'loading'
      : state.isAuthenticated
        ? 'authenticated'
        : 'unauthenticated',
  };
}

export function useRequireAuth() {
  return useAuth(true);
}
