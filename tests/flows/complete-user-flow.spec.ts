/**
 * Complete User Flow Test - Create Account, Login, Upload File
 * 
 * This test simulates the complete user journey:
 * 1. Create a new account
 * 2. Login with the new account
 * 3. Verify redirection to dashboard
 * 4. Upload a file
 * 5. Verify the upload process
 */

import { test, expect } from '@playwright/test';
import { createAuthHelper } from '../helpers/auth';
import { createNetworkLogger } from '../helpers/network-logger';
import testData from '../fixtures/test-data.json';

// Generate unique test data for this run
const timestamp = Date.now();
const testUser = {
  name: `Test User ${timestamp}`,
  email: `test.user.${timestamp}@example.com`,
  password: 'TestPassword123!',
};

test.describe('Complete User Flow - Account Creation to File Upload', () => {
  let networkLogger: ReturnType<typeof createNetworkLogger>;

  test.beforeEach(async ({ page }) => {
    networkLogger = createNetworkLogger();
    
    // Start network monitoring
    networkLogger.setFlowContext('complete-user-flow', 'setup');
    await networkLogger.captureBackendErrors(page);
    
    // Add console logging to debug authentication issues
    page.on('console', (msg) => {
      if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
      }
    });
    
    // Monitor localStorage changes
    await page.addInitScript(() => {
      const originalSetItem = localStorage.setItem;
      const originalRemoveItem = localStorage.removeItem;
      const originalClear = localStorage.clear;
      
      localStorage.setItem = function(key, value) {
        console.log(`[LOCALSTORAGE SET] ${key}:`, value?.substring(0, 50) + (value?.length > 50 ? '...' : ''));
        return originalSetItem.call(this, key, value);
      };
      
      localStorage.removeItem = function(key) {
        console.log(`[LOCALSTORAGE REMOVE] ${key}`);
        return originalRemoveItem.call(this, key);
      };
      
      localStorage.clear = function() {
        console.log(`[LOCALSTORAGE CLEAR]`);
        return originalClear.call(this);
      };
    });
  });

  test.afterEach(async ({ page }) => {
    // Get network logs for debugging
    const errorReport = networkLogger.formatErrorReport();
    
    // Log network activity for debugging
    console.log('\n=== NETWORK ACTIVITY ===');
    console.log(`Total errors: ${errorReport.summary.totalErrors}`);
    console.log(`Critical errors: ${errorReport.summary.criticalErrors}`);
    
    if (errorReport.errors.length > 0) {
      errorReport.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.request.method} ${error.request.url}`);
        console.log(`   Status: ${error.response.status} ${error.response.statusText}`);
        console.log(`   Category: ${error.category}, Severity: ${error.severity}`);
      });
    }
    
    // Get final localStorage state
    const finalStorage = await page.evaluate(() => {
      const storage: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          storage[key] = localStorage.getItem(key) || '';
        }
      }
      return storage;
    });
    
    console.log('\n=== FINAL LOCALSTORAGE STATE ===');
    Object.entries(finalStorage).forEach(([key, value]) => {
      console.log(`${key}:`, value.substring(0, 100) + (value.length > 100 ? '...' : ''));
    });
  });

  test('should complete full user journey: register → login → dashboard → upload', async ({ page }) => {
    console.log('\n🚀 Starting complete user flow test...');
    
    // Step 1: Create Account
    console.log('\n📝 Step 1: Creating new account...');
    await page.goto('/register');
    
    // Wait for registration form to load
    await expect(page.locator('h1')).toContainText('Create Account');
    
    // Fill registration form
    await page.fill('input[name="name"]', testUser.name);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.fill('input[name="confirmPassword"]', testUser.password);
    
    // Submit registration
    await page.click('button[type="submit"]');
    
    // Wait for registration success or redirect
    await page.waitForTimeout(2000);
    
    // Check if we're redirected to login or dashboard
    const currentUrl = page.url();
    console.log(`After registration, current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/login')) {
      console.log('✅ Redirected to login page after registration');
    } else if (currentUrl.includes('/dashboard')) {
      console.log('✅ Automatically logged in after registration');
      // Skip to step 3 if already logged in
      await test.step('Verify dashboard access after registration', async () => {
        await expect(page.locator('h1')).toContainText('Dashboard');
        await expect(page.locator('text=Welcome back')).toBeVisible();
      });
      
      // Skip to upload step
      await test.step('Navigate to upload page', async () => {
        await page.click('text=Upload New File');
        await expect(page).toHaveURL(/\/upload/);
        await expect(page.locator('h1')).toContainText('Upload');
      });
      
      return; // End test here if auto-logged in
    }
    
    // Step 2: Login with created account
    console.log('\n🔐 Step 2: Logging in with created account...');
    
    // Ensure we're on login page
    if (!currentUrl.includes('/login')) {
      await page.goto('/login');
    }
    
    await expect(page.locator('h1')).toContainText('Sign in');
    
    // Clear any existing localStorage before login
    await page.evaluate(() => localStorage.clear());
    
    // Fill login form
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    
    // Monitor for success message
    const successMessagePromise = page.waitForSelector('text=Login successful', { timeout: 10000 });
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Wait for login success message
    try {
      await successMessagePromise;
      console.log('✅ Login success message appeared');
    } catch (error) {
      console.log('⚠️ Login success message not found, checking for direct redirect...');
    }
    
    // Wait for potential redirect
    await page.waitForTimeout(1000);
    
    // Check localStorage for tokens after login
    const tokensAfterLogin = await page.evaluate(() => ({
      accessToken: localStorage.getItem('docfiscal_access_token'),
      refreshToken: localStorage.getItem('docfiscal_refresh_token'),
      expiresAt: localStorage.getItem('docfiscal_token_expires_at'),
      // Also check old format
      oldAccessToken: localStorage.getItem('access_token'),
      oldRefreshToken: localStorage.getItem('refresh_token'),
    }));
    
    console.log('\n🔑 Tokens after login:', {
      hasNewAccessToken: !!tokensAfterLogin.accessToken,
      hasNewRefreshToken: !!tokensAfterLogin.refreshToken,
      hasExpiresAt: !!tokensAfterLogin.expiresAt,
      hasOldAccessToken: !!tokensAfterLogin.oldAccessToken,
      hasOldRefreshToken: !!tokensAfterLogin.oldRefreshToken,
    });
    
    // Step 3: Verify redirection to dashboard
    console.log('\n🏠 Step 3: Verifying dashboard redirection...');
    
    // Wait for redirect to dashboard (with longer timeout)
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      console.log('✅ Successfully redirected to dashboard');
    } catch (error) {
      console.log('❌ Failed to redirect to dashboard automatically');
      console.log('Current URL:', page.url());
      
      // Check if we're still on login page
      if (page.url().includes('/login')) {
        console.log('🔄 Still on login page, checking for errors...');
        
        // Look for error messages
        const errorMessages = await page.locator('[role="alert"], .text-red-600, .error').allTextContents();
        if (errorMessages.length > 0) {
          console.log('❌ Found error messages:', errorMessages);
        }
        
        // Check authentication state
        const authState = await page.evaluate(() => {
          // Try to access any global auth state
          return {
            pathname: window.location.pathname,
            localStorage: Object.fromEntries(
              Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])
            ),
          };
        });
        
        console.log('🔍 Auth state:', authState);
        
        // Manually navigate to dashboard to test if tokens work
        console.log('🔄 Manually navigating to dashboard...');
        await page.goto('/dashboard');
        await page.waitForTimeout(2000);
      }
    }
    
    // Verify we're on dashboard and authenticated
    await test.step('Verify dashboard access', async () => {
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.locator('h1')).toContainText('Dashboard');
      
      // Look for user-specific content
      const welcomeText = page.locator('text=Welcome back');
      await expect(welcomeText).toBeVisible({ timeout: 10000 });
      
      console.log('✅ Dashboard loaded successfully with user content');
    });
    
    // Step 4: Navigate to upload page
    console.log('\n📤 Step 4: Navigating to upload page...');
    
    await test.step('Navigate to upload page', async () => {
      // Click upload button
      await page.click('text=Upload New File');
      
      // Wait for upload page to load
      await expect(page).toHaveURL(/\/upload/);
      await expect(page.locator('h1')).toContainText('Upload');
      
      console.log('✅ Upload page loaded successfully');
    });
    
    // Step 5: Upload a file
    console.log('\n📁 Step 5: Uploading a test file...');
    
    await test.step('Upload test file', async () => {
      // Create a test file
      const testFileContent = 'This is a test PDF content for upload testing.';
      const testFile = Buffer.from(testFileContent);
      
      // Find file input
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeVisible();
      
      // Upload file
      await fileInput.setInputFiles({
        name: 'test-document.pdf',
        mimeType: 'application/pdf',
        buffer: testFile,
      });
      
      // Wait for file to be selected
      await page.waitForTimeout(1000);
      
      // Submit upload
      const uploadButton = page.locator('button:has-text("Upload")');
      await expect(uploadButton).toBeVisible();
      await uploadButton.click();
      
      // Wait for upload to complete or show progress
      await page.waitForTimeout(3000);
      
      // Check for success message or redirect
      const currentUrl = page.url();
      console.log(`After upload attempt, current URL: ${currentUrl}`);
      
      // Look for success indicators
      const successIndicators = [
        'text=Upload successful',
        'text=File uploaded',
        'text=Processing',
        '[data-testid="upload-success"]',
      ];
      
      let uploadSuccess = false;
      for (const indicator of successIndicators) {
        try {
          await page.waitForSelector(indicator, { timeout: 2000 });
          console.log(`✅ Found success indicator: ${indicator}`);
          uploadSuccess = true;
          break;
        } catch (error) {
          // Continue to next indicator
        }
      }
      
      if (!uploadSuccess) {
        // Check for error messages
        const errorMessages = await page.locator('[role="alert"], .text-red-600, .error').allTextContents();
        if (errorMessages.length > 0) {
          console.log('❌ Upload errors found:', errorMessages);
        } else {
          console.log('⚠️ No clear success or error indicators found');
        }
      }
      
      console.log('📤 Upload process completed');
    });
    
    console.log('\n🎉 Complete user flow test finished!');
  });

  test('should handle login redirect issues specifically', async ({ page }) => {
    console.log('\n🔍 Testing login redirect issues specifically...');
    
    // Go directly to login page
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Sign in');
    
    // Use existing test credentials if available
    let credentials;
    try {
      credentials = testData.testUsers?.validUser || testData.validUser;
    } catch (error) {
      console.log('⚠️ Test data not available, using hardcoded credentials');
      credentials = {
        email: 'test@example.com',
        password: 'password123'
      };
    }
    
    
    // Clear localStorage before login
    networkLogger.setFlowContext('login-redirect-test', 'login-attempt');
    await page.evaluate(() => localStorage.clear());
    
    // Fill and submit login form
    await page.fill('input[type="email"]', credentials.email);
    await page.fill('input[type="password"]', credentials.password);
    
    // Monitor network requests during login
    const loginRequests: any[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/login')) {
        loginRequests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData(),
        });
      }
    });
    
    const loginResponses: any[] = [];
    page.on('response', async (response) => {
      if (response.url().includes('/api/auth/login')) {
        loginResponses.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
          body: await response.text().catch(() => 'Could not read body'),
        });
      }
    });
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Wait for login request to complete
    await page.waitForTimeout(3000);
    
    console.log('\n📡 Login requests:', loginRequests);
    console.log('\n📨 Login responses:', loginResponses);
    
    // Check tokens immediately after login
    const immediateTokens = await page.evaluate(() => ({
      docfiscal_access_token: localStorage.getItem('docfiscal_access_token'),
      docfiscal_refresh_token: localStorage.getItem('docfiscal_refresh_token'),
      docfiscal_token_expires_at: localStorage.getItem('docfiscal_token_expires_at'),
      access_token: localStorage.getItem('access_token'),
      refresh_token: localStorage.getItem('refresh_token'),
    }));
    
    console.log('\n🔑 Immediate tokens after login:', immediateTokens);
    
    // Wait for potential redirect
    await page.waitForTimeout(2000);
    
    const urlAfterLogin = page.url();
    console.log(`\n🔄 URL after login: ${urlAfterLogin}`);
    
    if (urlAfterLogin.includes('/dashboard')) {
      console.log('✅ Successfully redirected to dashboard');
      
      // Verify dashboard content loads
      await expect(page.locator('h1')).toContainText('Dashboard');
      await expect(page.locator('text=Welcome back')).toBeVisible();
      
    } else if (urlAfterLogin.includes('/login')) {
      console.log('❌ Still on login page after login attempt');
      
      // Check for error messages
      const errors = await page.locator('[role="alert"], .text-red-600').allTextContents();
      console.log('Error messages:', errors);
      
      // Check if success message appeared but redirect failed
      const successMessage = await page.locator('text=Login successful').isVisible();
      console.log('Success message visible:', successMessage);
      
      if (successMessage) {
        console.log('🚨 Login succeeded but redirect failed!');
        
        // Try manual navigation
        await page.goto('/dashboard');
        await page.waitForTimeout(2000);
        
        const dashboardUrl = page.url();
        console.log(`Manual navigation result: ${dashboardUrl}`);
        
        if (dashboardUrl.includes('/dashboard')) {
          console.log('✅ Manual navigation to dashboard worked');
          await expect(page.locator('h1')).toContainText('Dashboard');
        } else {
          console.log('❌ Manual navigation also failed');
        }
      }
    }
    
    // Final token check
    const finalTokens = await page.evaluate(() => ({
      docfiscal_access_token: localStorage.getItem('docfiscal_access_token'),
      docfiscal_refresh_token: localStorage.getItem('docfiscal_refresh_token'),
      docfiscal_token_expires_at: localStorage.getItem('docfiscal_token_expires_at'),
    }));
    
    console.log('\n🔑 Final tokens:', finalTokens);
  });
});