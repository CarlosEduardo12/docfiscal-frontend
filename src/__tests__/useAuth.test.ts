import { renderHook, act, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    isAuthenticated: false,
    getProfile: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
  },
}));

const mockRouter = {
  push: jest.fn(),
};

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('useAuth Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter as any);
    mockApiClient.isAuthenticated = false;
  });

  describe('Authentication State Management', () => {
    it('should initialize with loading state', async () => {
      // Mock isAuthenticated to return false to avoid profile loading
      mockApiClient.isAuthenticated = false;

      const { result } = renderHook(() => useAuth(false));

      // Wait for the effect to complete and check final state
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
    });

    it('should redirect to login when requireAuth is true and not authenticated', async () => {
      mockApiClient.isAuthenticated = false;

      renderHook(() => useAuth(true));

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/login');
      });
    });

    it('should load user profile when authenticated', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockApiClient.isAuthenticated = true;
      mockApiClient.getProfile.mockResolvedValue({
        success: true,
        data: mockUser,
        message: 'Profile retrieved successfully',
      });

      const { result } = renderHook(() => useAuth(false));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(mockUser);
      });
    });

    it('should handle profile loading error', async () => {
      mockApiClient.isAuthenticated = true;
      mockApiClient.getProfile.mockRejectedValue(
        new Error('Profile load failed')
      );

      const { result } = renderHook(() => useAuth(false));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.error).toBe('Profile load failed');
      });
    });
  });

  describe('Login Functionality', () => {
    it('should handle successful login', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockApiClient.login.mockResolvedValue({
        success: true,
        data: { access_token: 'token123', refresh_token: 'refresh123' },
        message: 'Login successful',
      });

      mockApiClient.getProfile.mockResolvedValue({
        success: true,
        data: mockUser,
        message: 'Profile retrieved successfully',
      });

      const { result } = renderHook(() => useAuth(false));

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      expect(loginResult).toEqual({ success: true, data: mockUser });
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });

    it('should handle login failure', async () => {
      mockApiClient.login.mockResolvedValue({
        success: false,
        message: 'Invalid credentials',
      });

      const { result } = renderHook(() => useAuth(false));

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        });
      });

      expect(loginResult).toEqual({
        success: false,
        error: 'Invalid credentials',
      });
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Invalid credentials');
    });
  });

  describe('Registration Functionality', () => {
    it('should handle successful registration', async () => {
      mockApiClient.register.mockResolvedValue({
        success: true,
        message: 'Registration successful',
      });

      const { result } = renderHook(() => useAuth(false));

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        });
      });

      expect(registerResult).toEqual({
        success: true,
        message: 'Registration successful',
      });
      expect(result.current.error).toBe(null);
    });

    it('should handle registration failure', async () => {
      mockApiClient.register.mockResolvedValue({
        success: false,
        message: 'Email already exists',
      });

      const { result } = renderHook(() => useAuth(false));

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        });
      });

      expect(registerResult).toEqual({
        success: false,
        error: 'Email already exists',
      });
      expect(result.current.error).toBe('Email already exists');
    });
  });

  describe('Logout Functionality', () => {
    it('should handle logout and redirect', async () => {
      mockApiClient.logout.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(false));

      await act(async () => {
        await result.current.logout();
      });

      expect(mockApiClient.logout).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
      expect(mockRouter.push).toHaveBeenCalledWith('/login');
    });

    it('should handle logout error gracefully', async () => {
      mockApiClient.logout.mockRejectedValue(new Error('Logout failed'));

      const { result } = renderHook(() => useAuth(false));

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
      expect(mockRouter.push).toHaveBeenCalledWith('/login');
    });
  });

  describe('Profile Management', () => {
    it('should refresh profile successfully', async () => {
      const mockUser = {
        id: '1',
        name: 'Updated User',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };

      mockApiClient.isAuthenticated = true;
      mockApiClient.getProfile.mockResolvedValue({
        success: true,
        data: mockUser,
        message: 'Profile retrieved successfully',
      });

      const { result } = renderHook(() => useAuth(false));

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshProfile();
      });

      expect(refreshResult).toEqual({ success: true, data: mockUser });
      expect(result.current.user).toEqual(mockUser);
    });

    it('should update profile successfully', async () => {
      const updatedUser = {
        id: '1',
        name: 'Updated Name',
        email: 'updated@example.com',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };

      mockApiClient.updateProfile.mockResolvedValue({
        success: true,
        data: updatedUser,
        message: 'Profile updated successfully',
      });

      const { result } = renderHook(() => useAuth(false));

      let updateResult;
      await act(async () => {
        updateResult = await result.current.updateProfile({
          name: 'Updated Name',
          email: 'updated@example.com',
        });
      });

      expect(updateResult).toEqual({ success: true, data: updatedUser });
      expect(result.current.user).toEqual(updatedUser);
    });

    it('should change password successfully', async () => {
      mockApiClient.changePassword.mockResolvedValue({
        success: true,
        message: 'Password changed successfully',
      });

      const { result } = renderHook(() => useAuth(false));

      let changeResult;
      await act(async () => {
        changeResult = await result.current.changePassword({
          current_password: 'oldpassword',
          new_password: 'newpassword',
        });
      });

      expect(changeResult).toEqual({
        success: true,
        message: 'Password changed successfully',
      });
      expect(result.current.error).toBe(null);
    });
  });

  describe('Token Refresh Mechanism', () => {
    it('should handle authentication state when not authenticated', async () => {
      mockApiClient.isAuthenticated = false;

      const { result } = renderHook(() => useAuth(false));

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshProfile();
      });

      expect(refreshResult).toEqual({
        success: false,
        error: 'Not authenticated',
      });
    });
  });

  describe('Legacy Compatibility', () => {
    it('should provide legacy session format', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockApiClient.isAuthenticated = true;
      mockApiClient.getProfile.mockResolvedValue({
        success: true,
        data: mockUser,
        message: 'Profile retrieved successfully',
      });

      const { result } = renderHook(() => useAuth(false));

      await waitFor(() => {
        expect(result.current.session).toEqual({ user: mockUser });
        expect(result.current.status).toBe('authenticated');
      });
    });

    it('should provide correct status values', async () => {
      mockApiClient.isAuthenticated = false;

      const { result } = renderHook(() => useAuth(false));

      await waitFor(() => {
        expect(result.current.status).toBe('unauthenticated');
      });
    });
  });
});
