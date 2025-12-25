import { Page, expect } from '@playwright/test';
import testData from '../fixtures/test-data.json';

/**
 * Login credentials interface
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Authentication tokens interface
 */
export interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

/**
 * User information interface
 */
export interface User {
  email: string;
  name: string;
  id?: string;
}

/**
 * Authentication helper for E2E tests
 * Provides utilities for login, logout, and authentication state management
 */
export class AuthHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Login with provided credentials
   */
  async login(credentials: LoginCredentials): Promise<void> {
    console.log(`🔐 Logging in with email: ${credentials.email}`);
    
    // Navigate to login page
    await this.page.goto('/login');
    
    // Wait for login form to be visible
    await this.page.waitForSelector('form[aria-labelledby="login-title"]', { timeout: 10000 });
    
    // Fill in credentials
    await this.page.fill('#email', credentials.email);
    await this.page.fill('#password', credentials.password);
    
    // Submit form
    await this.page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard or error message
    try {
      // Wait for either dashboard or error
      await Promise.race([
        this.page.waitForURL('/dashboard', { timeout: 10000 }),
        this.page.waitForSelector('[role="alert"]', { timeout: 5000 })
      ]);
      
      // Check if we're on dashboard (successful login)
      const currentUrl = this.page.url();
      if (currentUrl.includes('/dashboard')) {
        console.log('✅ Login successful - redirected to dashboard');
        
        // Wait for dashboard to load
        await this.page.waitForSelector('.sidebar', { timeout: 10000 });
      } else {
        // Check for error message
        const errorElement = await this.page.$('[role="alert"]');
        if (errorElement) {
          const errorText = await errorElement.textContent();
          throw new Error(`Login failed: ${errorText}`);
        } else {
          throw new Error('Login failed: Unknown error');
        }
      }
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw error;
    }
  }

  /**
   * Login with valid test user credentials
   */
  async loginWithValidUser(): Promise<void> {
    const credentials = testData.testUsers.validUser;
    await this.login(credentials);
  }

  /**
   * Login with invalid credentials (for testing error handling)
   */
  async loginWithInvalidUser(): Promise<void> {
    const credentials = testData.testUsers.invalidUser;
    await this.login(credentials);
  }

  /**
   * Logout from the application
   */
  async logout(): Promise<void> {
    console.log('🚪 Logging out...');
    
    // Ensure we're on a page with sidebar
    const sidebarExists = await this.page.$('.sidebar');
    if (!sidebarExists) {
      console.warn('⚠️ Sidebar not found - may already be logged out');
      return;
    }
    
    // Look for logout button in sidebar user section
    const logoutButton = await this.page.$('button:has-text("Logout")');
    if (!logoutButton) {
      // Try alternative selectors
      const altLogoutButton = await this.page.$('[data-testid="logout-button"]');
      if (!altLogoutButton) {
        throw new Error('Logout button not found in sidebar');
      }
      await altLogoutButton.click();
    } else {
      await logoutButton.click();
    }
    
    // Wait for redirect to landing page
    await this.page.waitForURL('/', { timeout: 10000 });
    
    // Verify we're on landing page
    await this.page.waitForSelector('button:has-text("Fazer Login")', { timeout: 5000 });
    
    console.log('✅ Logout successful - redirected to landing page');
  }

  /**
   * Check if user is currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      // Check if we have access tokens in localStorage
      const tokens = await this.getStoredTokens();
      if (!tokens.accessToken) {
        return false;
      }
      
      // Check if we can access a protected page
      const currentUrl = this.page.url();
      if (currentUrl.includes('/dashboard') || currentUrl.includes('/pedido/')) {
        // Check if sidebar is present (indicates authenticated state)
        const sidebar = await this.page.$('.sidebar');
        return !!sidebar;
      }
      
      // Try to navigate to dashboard to test authentication
      await this.page.goto('/dashboard');
      
      // If we get redirected to login, we're not authenticated
      await this.page.waitForLoadState('networkidle', { timeout: 5000 });
      const finalUrl = this.page.url();
      
      return !finalUrl.includes('/login');
    } catch (error) {
      console.warn('Authentication check failed:', error);
      return false;
    }
  }

  /**
   * Get stored authentication tokens from localStorage
   */
  async getStoredTokens(): Promise<AuthTokens> {
    try {
      const tokens = await this.page.evaluate(() => {
        return {
          accessToken: localStorage.getItem('access_token'),
          refreshToken: localStorage.getItem('refresh_token')
        };
      });
      
      return tokens;
    } catch (error) {
      console.warn('Could not access localStorage:', error);
      return {
        accessToken: null,
        refreshToken: null
      };
    }
  }

  /**
   * Clear stored authentication tokens
   */
  async clearStoredTokens(): Promise<void> {
    try {
      await this.page.evaluate(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      });
    } catch (error) {
      console.warn('Could not clear localStorage:', error);
      // Continue - this is not critical
    }
  }

  /**
   * Validate sidebar user section displays correct user information
   */
  async validateSidebarUserSection(expectedUser: User): Promise<void> {
    console.log(`👤 Validating sidebar user section for: ${expectedUser.email}`);
    
    // Wait for sidebar to be present
    await this.page.waitForSelector('.sidebar', { timeout: 10000 });
    
    // Look for user profile section in sidebar
    const userSection = await this.page.$('.sidebar [data-testid="user-profile"]');
    if (!userSection) {
      // Try alternative selectors
      const altUserSection = await this.page.$('.sidebar .user-section');
      if (!altUserSection) {
        throw new Error('User profile section not found in sidebar');
      }
    }
    
    // Check if user name or email is displayed
    const sidebarText = await this.page.textContent('.sidebar');
    
    // Validate user information is present
    const hasUserInfo = sidebarText?.includes(expectedUser.name) || 
                       sidebarText?.includes(expectedUser.email);
    
    if (!hasUserInfo) {
      throw new Error(`User information not found in sidebar. Expected: ${expectedUser.name} or ${expectedUser.email}`);
    }
    
    console.log('✅ Sidebar user section validation successful');
  }

  /**
   * Wait for authentication state to be ready
   */
  async waitForAuthState(timeout: number = 10000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const tokens = await this.getStoredTokens();
      if (tokens.accessToken) {
        // Wait a bit more for UI to update
        await this.page.waitForTimeout(500);
        return;
      }
      await this.page.waitForTimeout(100);
    }
    
    throw new Error('Authentication state not ready within timeout');
  }

  /**
   * Validate authentication error handling
   */
  async validateAuthError(expectedErrorMessage?: string): Promise<void> {
    // Wait for error message to appear
    const errorElement = await this.page.waitForSelector('[role="alert"]', { timeout: 5000 });
    
    if (!errorElement) {
      throw new Error('Expected authentication error message not found');
    }
    
    const errorText = await errorElement.textContent();
    
    if (expectedErrorMessage && !errorText?.includes(expectedErrorMessage)) {
      throw new Error(`Expected error message "${expectedErrorMessage}" but got "${errorText}"`);
    }
    
    console.log(`✅ Authentication error validated: ${errorText}`);
  }

  /**
   * Setup authentication for test (login if not already authenticated)
   */
  async ensureAuthenticated(credentials?: LoginCredentials): Promise<void> {
    const isAuth = await this.isAuthenticated();
    
    if (!isAuth) {
      const creds = credentials || testData.testUsers.validUser;
      await this.login(creds);
    }
  }

  /**
   * Setup unauthenticated state for test
   */
  async ensureUnauthenticated(): Promise<void> {
    const isAuth = await this.isAuthenticated();
    
    if (isAuth) {
      await this.logout();
    } else {
      // Clear tokens just in case
      await this.clearStoredTokens();
    }
  }

  /**
   * Test token refresh functionality
   */
  async testTokenRefresh(): Promise<boolean> {
    try {
      // Get current tokens
      const tokens = await this.getStoredTokens();
      if (!tokens.accessToken) {
        throw new Error('No access token available for refresh test');
      }
      
      // Make a request that might trigger token refresh
      const response = await this.page.evaluate(async () => {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        });
        return {
          status: response.status,
          ok: response.ok
        };
      });
      
      // If we get 401, token refresh should be triggered automatically
      if (response.status === 401) {
        // Wait for potential token refresh
        await this.page.waitForTimeout(1000);
        
        // Check if tokens were updated
        const newTokens = await this.getStoredTokens();
        return newTokens.accessToken !== tokens.accessToken;
      }
      
      return response.ok;
    } catch (error) {
      console.error('Token refresh test failed:', error);
      return false;
    }
  }
}

/**
 * Create a new authentication helper instance
 */
export function createAuthHelper(page: Page): AuthHelper {
  return new AuthHelper(page);
}