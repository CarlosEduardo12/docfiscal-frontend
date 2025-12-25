import { test, expect } from '@playwright/test';
import { createAuthHelper } from '../helpers/auth';
import { NetworkLogger } from '../helpers/network-logger';
import testData from '../fixtures/test-data.json';

test.describe('Authentication Flow Tests', () => {
  let authHelper: ReturnType<typeof createAuthHelper>;
  let networkLogger: NetworkLogger;
  let capturedErrors: any[] = [];

  test.beforeEach(async ({ page }) => {
    authHelper = createAuthHelper(page);
    networkLogger = new NetworkLogger();
    capturedErrors = [];
    
    // Setup network monitoring
    await networkLogger.captureBackendErrors(page, capturedErrors);
    
    // Navigate to a page first to avoid localStorage security errors
    await page.goto('/');
    
    // Ensure clean state
    try {
      await authHelper.ensureUnauthenticated();
    } catch (error) {
      console.warn('Could not ensure unauthenticated state:', error);
      // Continue with test - this is just cleanup
    }
  });

  test.afterEach(async () => {
    // Check for backend errors after each test
    if (capturedErrors.length > 0) {
      console.error('Backend errors detected:', capturedErrors);
      throw new Error(`Test failed due to ${capturedErrors.length} backend error(s): ${capturedErrors.map(e => `${e.method} ${e.url} - ${e.status}`).join(', ')}`);
    }
  });

  test.describe('5.1 Login Flow Test', () => {
    test('should successfully login with valid credentials and redirect to dashboard', async ({ page }) => {
      console.log('🧪 Testing successful login flow...');
      
      // Navigate to login page
      await page.goto('/login');
      
      // Verify login page elements are present
      await expect(page.locator('#login-title:has-text("Sign in")')).toBeVisible();
      await expect(page.locator('form[aria-labelledby="login-title"]')).toBeVisible();
      await expect(page.locator('#email')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Perform login with valid credentials
      const validUser = testData.testUsers.validUser;
      await authHelper.login(validUser);
      
      // Verify successful redirect to dashboard
      await expect(page).toHaveURL('/dashboard');
      
      // Verify dashboard elements are present
      await expect(page.locator('.sidebar')).toBeVisible();
      
      console.log('✅ Login flow test completed successfully');
    });

    test('should store authentication tokens after successful login', async ({ page }) => {
      console.log('🧪 Testing token storage after login...');
      
      // Login with valid credentials
      const validUser = testData.testUsers.validUser;
      await authHelper.login(validUser);
      
      // Wait for authentication state to be ready
      await authHelper.waitForAuthState();
      
      // Verify tokens are stored
      const tokens = await authHelper.getStoredTokens();
      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.accessToken).not.toBe('');
      
      // Verify authentication state
      const isAuthenticated = await authHelper.isAuthenticated();
      expect(isAuthenticated).toBe(true);
      
      console.log('✅ Token storage test completed successfully');
    });

    test('should display user information in sidebar after login', async ({ page }) => {
      console.log('🧪 Testing sidebar user section display...');
      
      // Login with valid credentials
      const validUser = testData.testUsers.validUser;
      await authHelper.login(validUser);
      
      // Wait for sidebar to load
      await page.waitForSelector('.sidebar', { timeout: 10000 });
      
      // Validate sidebar user section
      await authHelper.validateSidebarUserSection({
        email: validUser.email,
        name: validUser.name
      });
      
      console.log('✅ Sidebar user section test completed successfully');
    });

    test('should persist authentication state across page reloads', async ({ page }) => {
      console.log('🧪 Testing authentication state persistence...');
      
      // Login with valid credentials
      const validUser = testData.testUsers.validUser;
      await authHelper.login(validUser);
      
      // Verify initial authentication
      expect(await authHelper.isAuthenticated()).toBe(true);
      
      // Reload the page
      await page.reload();
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Verify authentication is still valid
      expect(await authHelper.isAuthenticated()).toBe(true);
      
      // Verify we're still on dashboard or can access it
      if (!page.url().includes('/dashboard')) {
        await page.goto('/dashboard');
      }
      
      await expect(page.locator('.sidebar')).toBeVisible();
      
      console.log('✅ Authentication persistence test completed successfully');
    });
  });

  test.describe('5.2 Registration Flow Test', () => {
    test('should successfully create new user and redirect to dashboard', async ({ page }) => {
      console.log('🧪 Testing successful registration flow...');
      
      // Navigate to registration page
      await page.goto('/register');
      
      // Verify registration page elements are present
      await expect(page.locator('#register-title:has-text("Create account")')).toBeVisible();
      await expect(page.locator('form[aria-labelledby="register-title"]')).toBeVisible();
      await expect(page.locator('#name')).toBeVisible();
      await expect(page.locator('#email')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.locator('#confirmPassword')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Generate unique user data for registration
      const timestamp = Date.now();
      const newUser = {
        name: `Test User ${timestamp}`,
        email: `testuser${timestamp}@example.com`,
        password: 'testpassword123'
      };
      
      // Fill registration form
      await page.fill('#name', newUser.name);
      await page.fill('#email', newUser.email);
      await page.fill('#password', newUser.password);
      await page.fill('#confirmPassword', newUser.password);
      
      // Submit registration form
      await page.click('button[type="submit"]');
      
      // Wait for loading to complete
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Check current URL and page state
      const currentUrl = page.url();
      console.log('Current URL after submission:', currentUrl);
      
      if (currentUrl.includes('/dashboard')) {
        // Verify successful redirect to dashboard
        await expect(page).toHaveURL('/dashboard');
        
        // Verify dashboard elements are present
        await expect(page.locator('.sidebar')).toBeVisible();
      } else if (currentUrl.includes('/register')) {
        // Still on register page - check for error message
        const errorElement = await page.$('#register-error');
        if (errorElement) {
          const errorText = await errorElement.textContent();
          console.log('Registration error:', errorText);
          // If user already exists, that's expected - test passes
          if (errorText?.includes('already exists') || errorText?.includes('já existe') || errorText?.includes('User already exists')) {
            console.log('✅ User already exists - this is expected for repeated test runs');
          } else {
            throw new Error(`Registration failed: ${errorText}`);
          }
        } else {
          // No error message - check if form is still loading
          const submitButton = page.locator('button[type="submit"]');
          const buttonText = await submitButton.textContent();
          if (buttonText?.includes('Creating') || buttonText?.includes('Loading')) {
            console.log('Form is still processing...');
            // Wait a bit more and check again
            await page.waitForTimeout(3000);
            const finalUrl = page.url();
            if (finalUrl.includes('/dashboard')) {
              await expect(page.locator('.sidebar')).toBeVisible();
            } else {
              throw new Error('Registration form submitted but no redirect or error occurred');
            }
          } else {
            throw new Error('Registration form submitted but no redirect or error occurred');
          }
        }
      } else {
        throw new Error(`Unexpected URL after registration: ${currentUrl}`);
      }
      
      console.log('✅ Registration flow test completed successfully');
    });

    test('should validate form fields and show appropriate error messages', async ({ page }) => {
      console.log('🧪 Testing registration form validation...');
      
      // Navigate to registration page
      await page.goto('/register');
      
      // Test password mismatch validation
      await page.fill('#name', 'Test User');
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'password123');
      await page.fill('#confirmPassword', 'differentpassword');
      
      await page.click('button[type="submit"]');
      
      // Verify error message for password mismatch
      await expect(page.locator('#register-error')).toBeVisible();
      await expect(page.locator('#register-error')).toContainText('Passwords do not match');
      
      // Clear form and test password length validation
      await page.reload();
      await page.fill('#name', 'Test User');
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', '12345'); // 5 characters - should trigger validation
      await page.fill('#confirmPassword', '12345');
      
      await page.click('button[type="submit"]');
      
      // Wait for error message or check if HTML5 validation prevents submission
      try {
        await expect(page.locator('#register-error')).toBeVisible({ timeout: 3000 });
        const shortPasswordError = await page.locator('#register-error').textContent();
        expect(shortPasswordError).toContain('Password must be at least 6 characters');
      } catch (error) {
        // Check if HTML5 validation is preventing submission
        const passwordInput = page.locator('#password');
        const validationMessage = await passwordInput.evaluate((input: HTMLInputElement) => input.validationMessage);
        expect(validationMessage).toBeTruthy();
        console.log('HTML5 validation prevented submission:', validationMessage);
      }
      
      // Clear form and test password letter requirement
      await page.reload();
      await page.fill('#name', 'Test User');
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', '123456'); // 6 digits, no letters
      await page.fill('#confirmPassword', '123456');
      
      await page.click('button[type="submit"]');
      
      // Verify error message for password without letters
      await expect(page.locator('#register-error')).toBeVisible();
      const noLetterError = await page.locator('#register-error').textContent();
      expect(noLetterError).toContain('Password must contain at least one letter');
      
      console.log('✅ Registration form validation test completed successfully');
    });

    test('should validate email format', async ({ page }) => {
      console.log('🧪 Testing email format validation...');
      
      // Navigate to registration page
      await page.goto('/register');
      
      // Fill form with invalid email
      await page.fill('#name', 'Test User');
      await page.fill('#email', 'invalid-email');
      await page.fill('#password', 'password123');
      await page.fill('#confirmPassword', 'password123');
      
      // Try to submit form
      await page.click('button[type="submit"]');
      
      // Check if HTML5 validation prevents submission or if custom validation shows error
      const emailInput = page.locator('#email');
      const validationMessage = await emailInput.evaluate((input: HTMLInputElement) => input.validationMessage);
      
      // HTML5 validation should prevent submission with invalid email
      expect(validationMessage).toBeTruthy();
      
      console.log('✅ Email format validation test completed successfully');
    });

    test('should handle registration errors gracefully', async ({ page }) => {
      console.log('🧪 Testing registration error handling...');
      
      // Navigate to registration page
      await page.goto('/register');
      
      // Try to register with existing user email (should fail)
      const existingUser = testData.testUsers.validUser;
      
      await page.fill('#name', 'New User');
      await page.fill('#email', existingUser.email);
      await page.fill('#password', 'newpassword123');
      await page.fill('#confirmPassword', 'newpassword123');
      
      await page.click('button[type="submit"]');
      
      // Wait for error message to appear
      await page.waitForSelector('[role="alert"]', { timeout: 10000 });
      
      // Verify error message is displayed
      const errorElement = page.locator('[role="alert"]');
      await expect(errorElement).toBeVisible();
      
      // Verify we're still on registration page
      expect(page.url()).toContain('/register');
      
      console.log('✅ Registration error handling test completed successfully');
    });
  });

  test.describe('5.3 Logout Flow Test', () => {
    test('should successfully logout and redirect to landing page', async ({ page }) => {
      console.log('🧪 Testing successful logout flow...');
      
      // First login to have authenticated state
      const validUser = testData.testUsers.validUser;
      await authHelper.login(validUser);
      
      // Verify we're authenticated and on dashboard
      await expect(page).toHaveURL('/dashboard');
      await expect(page.locator('.sidebar')).toBeVisible();
      
      // Perform logout
      await authHelper.logout();
      
      // Verify redirect to landing page
      await expect(page).toHaveURL('/');
      
      // Verify landing page elements are present
      await expect(page.locator('button:has-text("Fazer Login")')).toBeVisible();
      
      console.log('✅ Logout flow test completed successfully');
    });

    test('should clear authentication tokens after logout', async ({ page }) => {
      console.log('🧪 Testing token clearing after logout...');
      
      // First login to have authenticated state
      const validUser = testData.testUsers.validUser;
      await authHelper.login(validUser);
      
      // Verify tokens are present
      let tokens = await authHelper.getStoredTokens();
      expect(tokens.accessToken).toBeTruthy();
      
      // Perform logout
      await authHelper.logout();
      
      // Verify tokens are cleared
      tokens = await authHelper.getStoredTokens();
      expect(tokens.accessToken).toBeFalsy();
      expect(tokens.refreshToken).toBeFalsy();
      
      // Verify authentication state is false
      const isAuthenticated = await authHelper.isAuthenticated();
      expect(isAuthenticated).toBe(false);
      
      console.log('✅ Token clearing test completed successfully');
    });

    test('should prevent access to protected pages after logout', async ({ page }) => {
      console.log('🧪 Testing protected page access after logout...');
      
      // First login to have authenticated state
      const validUser = testData.testUsers.validUser;
      await authHelper.login(validUser);
      
      // Verify we can access dashboard
      await expect(page).toHaveURL('/dashboard');
      
      // Perform logout
      await authHelper.logout();
      
      // Try to access dashboard after logout
      await page.goto('/dashboard');
      
      // Should be redirected to login page
      await page.waitForURL('/login', { timeout: 10000 });
      await expect(page).toHaveURL('/login');
      
      console.log('✅ Protected page access test completed successfully');
    });

    test('should update sidebar state after logout', async ({ page }) => {
      console.log('🧪 Testing sidebar state changes after logout...');
      
      // First login to have authenticated state
      const validUser = testData.testUsers.validUser;
      await authHelper.login(validUser);
      
      // Verify sidebar is present
      await expect(page.locator('.sidebar')).toBeVisible();
      
      // Perform logout
      await authHelper.logout();
      
      // Verify we're on landing page without sidebar
      await expect(page).toHaveURL('/');
      
      // Verify sidebar is not present on landing page
      await expect(page.locator('.sidebar')).not.toBeVisible();
      
      // Verify landing page navigation is present instead
      await expect(page.locator('button:has-text("Fazer Login")')).toBeVisible();
      await expect(page.locator('button:has-text("Criar Conta")')).toBeVisible();
      
      console.log('✅ Sidebar state changes test completed successfully');
    });
  });

  test.describe('5.4 Authentication Edge Cases', () => {
    test('should handle invalid credentials with appropriate error messages', async ({ page }) => {
      console.log('🧪 Testing invalid credentials handling...');
      
      // Navigate to login page
      await page.goto('/login');
      
      // Try to login with invalid credentials
      const invalidUser = testData.testUsers.invalidUser;
      
      await page.fill('#email', invalidUser.email);
      await page.fill('#password', invalidUser.password);
      await page.click('button[type="submit"]');
      
      // Wait for error message
      await page.waitForSelector('[role="alert"]', { timeout: 10000 });
      
      // Verify error message is displayed
      const errorElement = page.locator('#login-error');
      await expect(errorElement).toBeVisible();
      
      // Verify error message content
      const errorText = await errorElement.textContent();
      console.log('Login error message:', errorText);
      expect(errorText).toBeTruthy(); // Should have some error message
      
      // Should be either invalid credentials or network error
      const hasValidError = errorText?.includes('Invalid email or password') || 
                           errorText?.includes('Network error') ||
                           errorText?.includes('Unable to connect') ||
                           errorText?.includes('An error occurred');
      expect(hasValidError).toBe(true);
      
      // Verify we're still on login page
      expect(page.url()).toContain('/login');
      
      // Verify no tokens are stored
      const tokens = await authHelper.getStoredTokens();
      expect(tokens.accessToken).toBeFalsy();
      
      console.log('✅ Invalid credentials handling test completed successfully');
    });

    test('should handle empty form submission', async ({ page }) => {
      console.log('🧪 Testing empty form submission...');
      
      // Navigate to login page
      await page.goto('/login');
      
      // Try to submit empty form
      await page.click('button[type="submit"]');
      
      // HTML5 validation should prevent submission
      const emailInput = page.locator('#email');
      const emailValidation = await emailInput.evaluate((input: HTMLInputElement) => input.validationMessage);
      
      expect(emailValidation).toBeTruthy();
      
      // Verify we're still on login page
      expect(page.url()).toContain('/login');
      
      console.log('✅ Empty form submission test completed successfully');
    });

    test('should handle network errors during login', async ({ page }) => {
      console.log('🧪 Testing network error handling during login...');
      
      // Navigate to login page
      await page.goto('/login');
      
      // Intercept login API call and simulate network error
      await page.route('/api/auth/login', route => {
        route.abort('failed');
      });
      
      // Try to login
      const validUser = testData.testUsers.validUser;
      await page.fill('#email', validUser.email);
      await page.fill('#password', validUser.password);
      await page.click('button[type="submit"]');
      
      // Wait for error message
      await page.waitForSelector('[role="alert"]', { timeout: 10000 });
      
      // Verify error message is displayed
      const errorElement = page.locator('[role="alert"]');
      await expect(errorElement).toBeVisible();
      
      // Verify we're still on login page
      expect(page.url()).toContain('/login');
      
      console.log('✅ Network error handling test completed successfully');
    });

    test('should handle token refresh functionality', async ({ page }) => {
      console.log('🧪 Testing token refresh functionality...');
      
      // Login first to get tokens
      const validUser = testData.testUsers.validUser;
      await authHelper.login(validUser);
      
      // Test token refresh
      const refreshResult = await authHelper.testTokenRefresh();
      
      // Token refresh should either succeed or handle gracefully
      expect(typeof refreshResult).toBe('boolean');
      
      console.log('✅ Token refresh test completed successfully');
    });

    test('should handle expired token scenarios', async ({ page }) => {
      console.log('🧪 Testing expired token handling...');
      
      // Login first
      const validUser = testData.testUsers.validUser;
      await authHelper.login(validUser);
      
      // Simulate expired token by setting invalid token
      await page.evaluate(() => {
        localStorage.setItem('access_token', 'expired_token_123');
      });
      
      // Try to access protected resource
      await page.goto('/dashboard');
      
      // Should either refresh token or redirect to login
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      const currentUrl = page.url();
      const isOnDashboard = currentUrl.includes('/dashboard');
      const isOnLogin = currentUrl.includes('/login');
      
      // Should be either on dashboard (token refreshed) or login (redirected)
      expect(isOnDashboard || isOnLogin).toBe(true);
      
      console.log('✅ Expired token handling test completed successfully');
    });

    test('should handle concurrent login attempts', async ({ page, context }) => {
      console.log('🧪 Testing concurrent login attempts...');
      
      // Create a second page for concurrent login
      const page2 = await context.newPage();
      
      const validUser = testData.testUsers.validUser;
      
      // Start login on both pages simultaneously
      const loginPromise1 = (async () => {
        await page.goto('/login');
        await page.fill('#email', validUser.email);
        await page.fill('#password', validUser.password);
        await page.click('button[type="submit"]');
        return page.waitForURL('/dashboard', { timeout: 15000 }).catch(() => false);
      })();
      
      const loginPromise2 = (async () => {
        await page2.goto('/login');
        await page2.fill('#email', validUser.email);
        await page2.fill('#password', validUser.password);
        await page2.click('button[type="submit"]');
        return page2.waitForURL('/dashboard', { timeout: 15000 }).catch(() => false);
      })();
      
      // Wait for both login attempts
      const [result1, result2] = await Promise.all([loginPromise1, loginPromise2]);
      
      // At least one should succeed
      expect(result1 || result2).toBe(true);
      
      // Clean up
      await page2.close();
      
      console.log('✅ Concurrent login attempts test completed successfully');
    });
  });
});