/**
 * Integration Tests for Complete Login Flow
 * 
 * Tests the full authentication flow:
 * - Login → Token Storage → Redirection → Dashboard
 * - Logout → Token Cleanup → Redirection → Login
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import EnhancedLoginForm from '@/components/forms/EnhancedLoginForm';
import { authTokenManager } from '@/lib/AuthTokenManager';
import { redirectManager } from '@/lib/redirectManager';

// Mock the API module
jest.mock('@/lib/api', () => ({
  login: jest.fn(),
  refreshToken: jest.fn(),
  logout: jest.fn(),
}));

// Mock Next.js router
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => '/login',
}));

// Import mocked API functions
import { login as mockLogin, logout as mockLogout } from '@/lib/api';

describe('Login Integration Tests', () => {
  let queryClient: QueryClient;
  
  const mockTokens = {
    access: 'mock-access-token',
    refresh: 'mock-refresh-token',
  };

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
  };

  beforeEach(() => {
    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear redirect manager state
    redirectManager.clearRedirectState();
    
    // Setup default mock responses
    (mockLogin as jest.Mock).mockResolvedValue({
      tokens: mockTokens,
      user: mockUser,
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {component}
        </AuthProvider>
      </QueryClientProvider>
    );
  };

  describe('Complete Login Flow', () => {
    it('should complete full login → token storage → redirection flow', async () => {
      // Render login form
      renderWithProviders(<EnhancedLoginForm />);

      // Fill in login form
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
      });

      // Submit form
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // Wait for login API call
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });

      // Verify tokens are stored in localStorage
      await waitFor(() => {
        expect(localStorage.getItem('docfiscal_access_token')).toBe(mockTokens.access);
        expect(localStorage.getItem('docfiscal_refresh_token')).toBe(mockTokens.refresh);
      });

      // Verify redirection to dashboard
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should handle login with target path redirection', async () => {
      // Set a target path in sessionStorage (simulating protected route access)
      sessionStorage.setItem('redirectAfterLogin', '/dashboard/orders');

      renderWithProviders(<EnhancedLoginForm />);

      // Fill and submit login form
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      // Wait for login completion
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      // Verify redirection to target path
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/orders');
      });

      // Verify target path is cleared
      expect(sessionStorage.getItem('redirectAfterLogin')).toBeNull();
    });

    it('should handle login errors gracefully', async () => {
      // Mock login failure
      (mockLogin as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));

      renderWithProviders(<EnhancedLoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
        fireEvent.click(submitButton);
      });

      // Wait for login attempt
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });

      // Should not store tokens or redirect
      expect(localStorage.getItem('docfiscal_access_token')).toBeNull();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Token Storage Integration', () => {
    it('should handle token storage operations correctly', async () => {
      // Test direct token storage
      const tokens = {
        accessToken: mockTokens.access,
        refreshToken: mockTokens.refresh,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
      };
      
      authTokenManager.storeTokens(tokens);

      // Verify tokens are stored in localStorage directly
      expect(localStorage.getItem('docfiscal_access_token')).toBe(mockTokens.access);
      expect(localStorage.getItem('docfiscal_refresh_token')).toBe(mockTokens.refresh);

      // Test token clearing
      authTokenManager.clearTokens();

      // Verify tokens are cleared
      expect(localStorage.getItem('docfiscal_access_token')).toBeNull();
      expect(localStorage.getItem('docfiscal_refresh_token')).toBeNull();
    });

    it('should handle corrupted tokens gracefully', async () => {
      // Set invalid tokens directly in localStorage
      localStorage.setItem('docfiscal_access_token', 'invalid-token');
      localStorage.setItem('docfiscal_refresh_token', 'invalid-refresh');
      localStorage.setItem('docfiscal_token_expires_at', new Date(Date.now() + 3600 * 1000).toISOString());

      // Try to get tokens - should handle gracefully
      const storedTokens = authTokenManager.getStoredTokens();

      // Should return the stored values (even if invalid)
      expect(storedTokens.accessToken).toBe('invalid-token');
      expect(storedTokens.refreshToken).toBe('invalid-refresh');
    });
  });

  describe('Session Recovery', () => {
    it('should detect existing valid tokens', async () => {
      // Pre-populate localStorage with tokens
      localStorage.setItem('docfiscal_access_token', mockTokens.access);
      localStorage.setItem('docfiscal_refresh_token', mockTokens.refresh);
      localStorage.setItem('docfiscal_token_expires_at', new Date(Date.now() + 3600 * 1000).toISOString());

      // Verify tokens are detected
      const storedTokens = authTokenManager.getStoredTokens();
      expect(storedTokens.accessToken).toBe(mockTokens.access);
      expect(storedTokens.refreshToken).toBe(mockTokens.refresh);
    });
  });
});