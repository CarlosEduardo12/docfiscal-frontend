/**
 * Integration Tests for Production Environment
 * 
 * Tests authentication behavior in production-like conditions:
 * - HTTPS configuration
 * - Production API URLs
 * - Environment variables
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { EnhancedLoginForm } from '@/components/forms/EnhancedLoginForm';
import Dashboard from '@/app/dashboard/page';
import { environmentConfig } from '@/lib/environmentConfig';

// Mock the API module
jest.mock('@/lib/api', () => ({
  login: jest.fn(),
  refreshToken: jest.fn(),
  logout: jest.fn(),
}));

// Mock environment config
jest.mock('@/lib/environmentConfig', () => ({
  environmentConfig: {
    getApiUrl: jest.fn(),
    isProduction: jest.fn(),
    isSecureContext: jest.fn(),
    getEnvironment: jest.fn(),
  }
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

// Import mocked functions
import { login as mockLogin } from '@/lib/api';

describe('Production Environment Integration Tests', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // Reset environment
    process.env = { ...originalEnv };
    
    // Clear console to avoid noise
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore environment and console
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <AuthProvider>
        {component}
      </AuthProvider>
    );
  };

  describe('Production API URL Configuration', () => {
    it('should use production API URL when NODE_ENV is production', async () => {
      // Set production environment
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_API_URL = 'https://api.docfiscal.com';
      
      // Mock environment config
      (environmentConfig.getApiUrl as jest.Mock).mockReturnValue('https://api.docfiscal.com');
      (environmentConfig.isProduction as jest.Mock).mockReturnValue(true);
      (environmentConfig.getEnvironment as jest.Mock).mockReturnValue('production');

      // Mock successful login
      (mockLogin as jest.Mock).mockResolvedValue({
        tokens: { access: 'prod-token', refresh: 'prod-refresh' },
        user: { id: 1, email: 'test@example.com' }
      });

      renderWithProviders(<EnhancedLoginForm />);

      // Fill and submit form
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      // Verify production API URL is used
      await waitFor(() => {
        expect(environmentConfig.getApiUrl).toHaveBeenCalled();
        expect(mockLogin).toHaveBeenCalled();
      });

      // Verify tokens are stored
      await waitFor(() => {
        expect(localStorage.getItem('docfiscal_access_token')).toBe('prod-token');
      });
    });

    it('should handle different environment configurations', async () => {
      const environments = [
        { env: 'development', url: 'http://localhost:8000' },
        { env: 'staging', url: 'https://staging-api.docfiscal.com' },
        { env: 'production', url: 'https://api.docfiscal.com' }
      ];

      for (const { env, url } of environments) {
        // Reset mocks for each environment
        jest.clearAllMocks();
        localStorage.clear();

        // Set environment
        process.env.NODE_ENV = env;
        process.env.NEXT_PUBLIC_API_URL = url;

        // Mock environment config
        (environmentConfig.getApiUrl as jest.Mock).mockReturnValue(url);
        (environmentConfig.getEnvironment as jest.Mock).mockReturnValue(env);
        (environmentConfig.isProduction as jest.Mock).mockReturnValue(env === 'production');

        // Mock login response
        (mockLogin as jest.Mock).mockResolvedValue({
          tokens: { access: `${env}-token`, refresh: `${env}-refresh` },
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

        // Verify correct API URL is used for each environment
        await waitFor(() => {
          expect(environmentConfig.getApiUrl).toHaveBeenCalled();
          expect(localStorage.getItem('docfiscal_access_token')).toBe(`${env}-token`);
        });
      }
    });
  });

  describe('HTTPS Security Configuration', () => {
    it('should handle secure context in production', async () => {
      // Mock secure HTTPS context
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        writable: true
      });

      // Mock environment as production with HTTPS
      (environmentConfig.isSecureContext as jest.Mock).mockReturnValue(true);
      (environmentConfig.isProduction as jest.Mock).mockReturnValue(true);

      renderWithProviders(<EnhancedLoginForm />);

      // Should not show any security warnings
      expect(screen.queryByText(/insecure context/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/https required/i)).not.toBeInTheDocument();
    });

    it('should warn about insecure context in production', async () => {
      // Mock insecure context
      Object.defineProperty(window, 'isSecureContext', {
        value: false,
        writable: true
      });

      // Mock production environment but insecure context
      (environmentConfig.isSecureContext as jest.Mock).mockReturnValue(false);
      (environmentConfig.isProduction as jest.Mock).mockReturnValue(true);

      renderWithProviders(<EnhancedLoginForm />);

      // Should show security warning in production
      await waitFor(() => {
        // Check if security warning is displayed or logged
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('insecure context')
        );
      });
    });

    it('should handle localStorage in secure context', async () => {
      // Mock secure context
      (environmentConfig.isSecureContext as jest.Mock).mockReturnValue(true);

      // Mock successful login
      (mockLogin as jest.Mock).mockResolvedValue({
        tokens: { access: 'secure-token', refresh: 'secure-refresh' },
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

      // Tokens should be stored securely
      await waitFor(() => {
        expect(localStorage.getItem('docfiscal_access_token')).toBe('secure-token');
        expect(localStorage.getItem('docfiscal_refresh_token')).toBe('secure-refresh');
      });
    });
  });

  describe('CORS Configuration for Production', () => {
    it('should handle CORS preflight requests', async () => {
      // Mock CORS preflight success
      (mockLogin as jest.Mock).mockResolvedValue({
        tokens: { access: 'cors-token', refresh: 'cors-refresh' },
        user: { id: 1, email: 'test@example.com' }
      });

      // Mock production environment
      (environmentConfig.isProduction as jest.Mock).mockReturnValue(true);
      (environmentConfig.getApiUrl as jest.Mock).mockReturnValue('https://api.docfiscal.com');

      renderWithProviders(<EnhancedLoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      // Should complete successfully with CORS headers
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
        expect(localStorage.getItem('docfiscal_access_token')).toBe('cors-token');
      });
    });

    it('should handle CORS errors in production', async () => {
      // Mock CORS error
      const corsError = new Error('CORS policy: No \'Access-Control-Allow-Origin\' header');
      (corsError as any).name = 'TypeError';
      (mockLogin as jest.Mock).mockRejectedValue(corsError);

      // Mock production environment
      (environmentConfig.isProduction as jest.Mock).mockReturnValue(true);

      renderWithProviders(<EnhancedLoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      // Should show CORS-specific error message
      await waitFor(() => {
        expect(screen.getByText(/cors.*policy/i)).toBeInTheDocument();
      });

      // Should provide production-specific guidance
      await waitFor(() => {
        expect(screen.getByText(/contact.*administrator/i)).toBeInTheDocument();
      });
    });
  });

  describe('Environment Variable Validation', () => {
    it('should validate required production environment variables', async () => {
      // Test missing API URL
      delete process.env.NEXT_PUBLIC_API_URL;
      
      // Mock environment config to detect missing variables
      (environmentConfig.getApiUrl as jest.Mock).mockImplementation(() => {
        throw new Error('NEXT_PUBLIC_API_URL is required in production');
      });
      (environmentConfig.isProduction as jest.Mock).mockReturnValue(true);

      renderWithProviders(<EnhancedLoginForm />);

      // Should handle missing environment variables gracefully
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      // Should show configuration error
      await waitFor(() => {
        expect(screen.getByText(/configuration.*error/i)).toBeInTheDocument();
      });
    });

    it('should use fallback values when appropriate', async () => {
      // Clear production API URL but provide fallback
      delete process.env.NEXT_PUBLIC_API_URL;
      
      // Mock fallback behavior
      (environmentConfig.getApiUrl as jest.Mock).mockReturnValue('https://api.docfiscal.com');
      (environmentConfig.isProduction as jest.Mock).mockReturnValue(false); // Development mode

      (mockLogin as jest.Mock).mockResolvedValue({
        tokens: { access: 'fallback-token', refresh: 'fallback-refresh' },
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

      // Should work with fallback configuration
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
        expect(localStorage.getItem('docfiscal_access_token')).toBe('fallback-token');
      });
    });
  });

  describe('Production Performance and Reliability', () => {
    it('should handle high-latency production API responses', async () => {
      // Mock slow API response
      (mockLogin as jest.Mock).mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            tokens: { access: 'slow-token', refresh: 'slow-refresh' },
            user: { id: 1, email: 'test@example.com' }
          }), 2000)
        )
      );

      renderWithProviders(<EnhancedLoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      // Should show loading state during slow response
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();

      // Should complete after delay
      await waitFor(() => {
        expect(localStorage.getItem('docfiscal_access_token')).toBe('slow-token');
      }, { timeout: 3000 });
    });

    it('should handle production load balancer redirects', async () => {
      // Mock redirect response (302)
      let redirectCount = 0;
      (mockLogin as jest.Mock).mockImplementation(() => {
        redirectCount++;
        if (redirectCount === 1) {
          const redirectError = new Error('Redirect');
          (redirectError as any).status = 302;
          return Promise.reject(redirectError);
        }
        return Promise.resolve({
          tokens: { access: 'lb-token', refresh: 'lb-refresh' },
          user: { id: 1, email: 'test@example.com' }
        });
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

      // Should handle redirect and retry
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(2);
        expect(localStorage.getItem('docfiscal_access_token')).toBe('lb-token');
      });
    });
  });
});