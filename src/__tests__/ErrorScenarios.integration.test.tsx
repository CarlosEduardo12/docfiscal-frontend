/**
 * Integration Tests for Error Scenarios
 * 
 * Tests authentication behavior under various error conditions:
 * - Invalid tokens
 * - Server unavailable
 * - Network problems
 * 
 * Requirements: 5.1, 5.2, 5.3
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { EnhancedLoginForm } from '@/components/forms/EnhancedLoginForm';
import Dashboard from '@/app/dashboard/page';
import { AuthTokenManager } from '@/lib/AuthTokenManager';

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
import { login as mockLogin, refreshToken as mockRefreshToken } from '@/lib/api';

describe('Error Scenarios Integration Tests', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear console to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console
    jest.restoreAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <AuthProvider>
        {component}
      </AuthProvider>
    );
  };

  describe('Invalid Token Scenarios', () => {
    it('should handle corrupted access token gracefully', async () => {
      // Set corrupted token
      localStorage.setItem('docfiscal_access_token', 'corrupted.token.data');
      localStorage.setItem('docfiscal_refresh_token', 'valid-refresh-token');

      // Mock refresh token success
      (mockRefreshToken as jest.Mock).mockResolvedValue({
        access: 'new-access-token',
        refresh: 'new-refresh-token',
      });

      renderWithProviders(<Dashboard />);

      // Should attempt token refresh
      await waitFor(() => {
        expect(mockRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
      });

      // Should update tokens with new ones
      await waitFor(() => {
        expect(localStorage.getItem('docfiscal_access_token')).toBe('new-access-token');
        expect(localStorage.getItem('docfiscal_refresh_token')).toBe('new-refresh-token');
      });

      // Should not redirect to login if refresh succeeds
      expect(mockReplace).not.toHaveBeenCalledWith('/login');
    });

    it('should handle both tokens being invalid', async () => {
      // Set both tokens as invalid
      localStorage.setItem('docfiscal_access_token', 'invalid-access');
      localStorage.setItem('docfiscal_refresh_token', 'invalid-refresh');

      // Mock refresh token failure
      (mockRefreshToken as jest.Mock).mockRejectedValue(new Error('Invalid refresh token'));

      renderWithProviders(<Dashboard />);

      // Should attempt refresh and fail
      await waitFor(() => {
        expect(mockRefreshToken).toHaveBeenCalledWith('invalid-refresh');
      });

      // Should clear all tokens
      await waitFor(() => {
        expect(localStorage.getItem('docfiscal_access_token')).toBeNull();
        expect(localStorage.getItem('docfiscal_refresh_token')).toBeNull();
      });

      // Should redirect to login
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/login');
      });
    });

    it('should handle malformed JWT tokens', async () => {
      // Set malformed JWT (missing parts)
      localStorage.setItem('docfiscal_access_token', 'not.a.valid.jwt.token');
      localStorage.setItem('docfiscal_refresh_token', 'also.not.valid');

      renderWithProviders(<Dashboard />);

      // Should detect malformed tokens and clear them
      await waitFor(() => {
        expect(localStorage.getItem('docfiscal_access_token')).toBeNull();
        expect(localStorage.getItem('docfiscal_refresh_token')).toBeNull();
      });

      // Should redirect to login
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('Server Unavailable Scenarios', () => {
    it('should handle login when server is down', async () => {
      // Mock server unavailable error
      (mockLogin as jest.Mock).mockRejectedValue(new Error('Network Error'));

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

      // Should attempt login
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Should not store any tokens
      expect(localStorage.getItem('docfiscal_access_token')).toBeNull();
      expect(localStorage.getItem('docfiscal_refresh_token')).toBeNull();

      // Should not redirect
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should handle server returning 500 error', async () => {
      // Mock server error
      const serverError = new Error('Internal Server Error');
      (serverError as any).status = 500;
      (mockLogin as jest.Mock).mockRejectedValue(serverError);

      renderWithProviders(<EnhancedLoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      // Should show appropriate error message
      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });

      // Should not store tokens or redirect
      expect(localStorage.getItem('docfiscal_access_token')).toBeNull();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should handle refresh token when server is unavailable', async () => {
      // Set valid tokens initially
      localStorage.setItem('docfiscal_access_token', 'expired-token');
      localStorage.setItem('docfiscal_refresh_token', 'valid-refresh');

      // Mock refresh failure due to server unavailable
      (mockRefreshToken as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

      renderWithProviders(<Dashboard />);

      // Should attempt refresh
      await waitFor(() => {
        expect(mockRefreshToken).toHaveBeenCalled();
      });

      // Should handle gracefully - keep user logged in with existing tokens
      // or redirect to login depending on implementation
      await waitFor(() => {
        // Either tokens are cleared and redirected to login
        const tokensCleared = !localStorage.getItem('docfiscal_access_token');
        const redirectedToLogin = mockReplace.mock.calls.some(call => call[0] === '/login');
        
        // Or tokens are kept and user stays authenticated
        const tokensKept = localStorage.getItem('docfiscal_access_token') === 'expired-token';
        
        expect(tokensCleared && redirectedToLogin || tokensKept).toBe(true);
      });
    });
  });

  describe('Network Problem Scenarios', () => {
    it('should handle timeout during login', async () => {
      // Mock timeout error
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'TIMEOUT';
      (mockLogin as jest.Mock).mockRejectedValue(timeoutError);

      renderWithProviders(<EnhancedLoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      // Should show timeout-specific error message
      await waitFor(() => {
        expect(screen.getByText(/timeout/i)).toBeInTheDocument();
      });

      // Should allow retry
      expect(submitButton).not.toBeDisabled();
    });

    it('should handle CORS errors', async () => {
      // Mock CORS error
      const corsError = new Error('CORS policy blocked');
      (corsError as any).name = 'TypeError';
      (mockLogin as jest.Mock).mockRejectedValue(corsError);

      renderWithProviders(<EnhancedLoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      // Should show CORS-specific guidance
      await waitFor(() => {
        expect(screen.getByText(/cors/i)).toBeInTheDocument();
      });
    });

    it('should handle intermittent network failures with retry', async () => {
      let attemptCount = 0;
      
      // Mock first attempt fails, second succeeds
      (mockLogin as jest.Mock).mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.reject(new Error('Network temporarily unavailable'));
        }
        return Promise.resolve({
          tokens: { access: 'token', refresh: 'refresh' },
          user: { id: 1, email: 'test@example.com' }
        });
      });

      renderWithProviders(<EnhancedLoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // First attempt
      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      // Should show error from first attempt
      await waitFor(() => {
        expect(screen.getByText(/network temporarily unavailable/i)).toBeInTheDocument();
      });

      // Retry
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // Should succeed on retry
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(2);
        expect(localStorage.getItem('docfiscal_access_token')).toBe('token');
      });
    });
  });

  describe('Edge Case Error Scenarios', () => {
    it('should handle localStorage being unavailable', async () => {
      // Mock localStorage to throw errors
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn(() => {
        throw new Error('localStorage unavailable');
      });

      (mockLogin as jest.Mock).mockResolvedValue({
        tokens: { access: 'token', refresh: 'refresh' },
        user: { id: 1, email: 'test@example.com' }
      });

      renderWithProviders(<EnhancedLoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      // Should handle localStorage error gracefully
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      // Should show appropriate error message
      await waitFor(() => {
        expect(screen.getByText(/storage.*unavailable/i)).toBeInTheDocument();
      });

      // Restore localStorage
      localStorage.setItem = originalSetItem;
    });

    it('should handle JSON parsing errors in stored tokens', async () => {
      // Manually set malformed JSON in localStorage
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn((key) => {
            if (key === 'docfiscal_access_token') {
              return '{"malformed": json}'; // Invalid JSON
            }
            return null;
          }),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn(),
        },
        writable: true
      });

      renderWithProviders(<Dashboard />);

      // Should handle JSON parsing error and clear tokens
      await waitFor(() => {
        expect(localStorage.removeItem).toHaveBeenCalledWith('docfiscal_access_token');
        expect(localStorage.removeItem).toHaveBeenCalledWith('docfiscal_refresh_token');
      });

      // Should redirect to login
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/login');
      });
    });
  });
});