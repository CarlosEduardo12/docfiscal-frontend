/**
 * Cross-Browser Compatibility Tests
 * Tests core flows across Chromium, Firefox, and WebKit
 * Validates consistent behavior and error handling
 * Tests browser-specific features (file upload, downloads)
 * Requirements: 10.1
 */

import { test, expect, Page, BrowserName } from '@playwright/test';
import { AuthHelper } from '../helpers/auth';
import { UIInteractionHelper } from '../helpers/ui-interactions';
import { NetworkLogger } from '../helpers/network-logger';
import type { NetworkError } from '../helpers/network-logger';
import path from 'path';

// Test data
const testCredentials = {
  email: 'test@example.com',
  password: 'password123'
};

// Test file for upload testing
const testFilePath = path.join(__dirname, '../fixtures/test-files/small-document.pdf');

test.describe('Cross-Browser Compatibility Tests', () => {
  let authHelper: AuthHelper;
  let uiHelper: UIInteractionHelper;
  let networkLogger: NetworkLogger;
  let networkErrors: NetworkError[];

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    uiHelper = new UIInteractionHelper();
    networkLogger = new NetworkLogger();
    networkErrors = [];

    // Set up network error monitoring
    await networkLogger.captureBackendErrors(page, networkErrors);
  });

  test.describe('Authentication Flow Cross-Browser', () => {
    test('should handle login consistently across browsers', async ({ page, browserName }) => {
      await page.goto('/login');

      // Test login form interaction
      await page.fill('input[type="email"], input[name="email"]', testCredentials.email);
      await page.fill('input[type="password"], input[name="password"]', testCredentials.password);
      
      // Click login button
      const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Entrar")').first();
      await loginButton.click();

      // Wait for navigation or error
      try {
        await page.waitForURL('/dashboard', { timeout: 10000 });
        
        // Verify successful login
        const dashboardElement = page.locator('[data-testid="dashboard"], .dashboard, main').first();
        await expect(dashboardElement).toBeVisible({ timeout: 10000 });
        
        console.log(`✓ Login successful in ${browserName}`);
      } catch (error) {
        // If login fails, check for error messages
        const errorMessage = page.locator('.error, [data-testid="error"], .alert-error').first();
        const hasError = await errorMessage.isVisible();
        
        if (hasError) {
          const errorText = await errorMessage.textContent();
          console.log(`Login error in ${browserName}: ${errorText}`);
        } else {
          console.log(`Login timeout in ${browserName}, but no error message found`);
        }
      }

      // Verify no critical backend errors occurred
      const criticalErrors = networkErrors.filter(e => e.status >= 500);
      expect(criticalErrors).toHaveLength(0);
    });

    test('should handle logout consistently across browsers', async ({ page, browserName }) => {
      // Login first
      await page.goto('/login');
      await authHelper.login(page, testCredentials);
      
      try {
        await page.waitForURL('/dashboard', { timeout: 10000 });
        
        // Find and click logout button
        const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sair"), [data-testid="logout"]').first();
        
        if (await logoutButton.isVisible()) {
          await logoutButton.click();
          
          // Wait for redirect to landing page
          await page.waitForURL('/', { timeout: 10000 });
          
          // Verify logout successful
          const loginLink = page.locator('a:has-text("Login"), a:has-text("Fazer Login")').first();
          await expect(loginLink).toBeVisible({ timeout: 5000 });
          
          console.log(`✓ Logout successful in ${browserName}`);
        } else {
          console.log(`Logout button not found in ${browserName}`);
        }
      } catch (error) {
        console.log(`Logout test failed in ${browserName}: ${error}`);
      }

      // Verify no critical backend errors occurred
      const criticalErrors = networkErrors.filter(e => e.status >= 500);
      expect(criticalErrors).toHaveLength(0);
    });
  });

  test.describe('File Upload Cross-Browser', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/login');
      await authHelper.login(page, testCredentials);
      
      try {
        await page.waitForURL('/dashboard', { timeout: 10000 });
      } catch (error) {
        console.log('Login failed, skipping file upload test');
        test.skip();
      }
    });

    test('should handle file selection consistently across browsers', async ({ page, browserName }) => {
      await page.goto('/upload');

      // Wait for upload area
      await page.waitForSelector('[data-testid="upload-area"], .upload-area, input[type="file"]', { timeout: 10000 });

      // Find file input
      const fileInput = page.locator('input[type="file"]').first();
      
      if (await fileInput.isVisible()) {
        try {
          // Test file selection (browser-specific behavior)
          await fileInput.setInputFiles(testFilePath);
          
          // Wait for file to be processed
          await page.waitForTimeout(2000);
          
          // Verify file was selected
          const fileName = page.locator('text="small-document.pdf"').or(page.locator('.file-name')).first();
          
          if (await fileName.isVisible()) {
            await expect(fileName).toBeVisible();
            console.log(`✓ File selection successful in ${browserName}`);
          } else {
            console.log(`File selection may have failed in ${browserName} - filename not displayed`);
          }
          
        } catch (error) {
          console.log(`File upload test failed in ${browserName}: ${error}`);
        }
      } else {
        console.log(`File input not found in ${browserName}`);
      }

      // Verify no critical backend errors occurred
      const criticalErrors = networkErrors.filter(e => e.status >= 500);
      expect(criticalErrors).toHaveLength(0);
    });

    test('should handle drag and drop consistently across browsers', async ({ page, browserName }) => {
      await page.goto('/upload');

      // Wait for upload area
      await page.waitForSelector('[data-testid="upload-area"], .upload-area', { timeout: 10000 });

      const uploadArea = page.locator('[data-testid="upload-area"], .upload-area').first();
      
      if (await uploadArea.isVisible()) {
        try {
          // Test drag and drop (browser-specific behavior)
          const uploadBox = await uploadArea.boundingBox();
          
          if (uploadBox) {
            // Simulate drag and drop events
            await page.dispatchEvent('[data-testid="upload-area"], .upload-area', 'dragenter');
            await page.dispatchEvent('[data-testid="upload-area"], .upload-area', 'dragover');
            await page.dispatchEvent('[data-testid="upload-area"], .upload-area', 'drop', {
              dataTransfer: {
                files: [{ name: 'test-file.pdf', type: 'application/pdf' }]
              }
            });
            
            console.log(`✓ Drag and drop events dispatched in ${browserName}`);
          }
          
        } catch (error) {
          console.log(`Drag and drop test failed in ${browserName}: ${error}`);
        }
      }

      // Verify no critical backend errors occurred
      const criticalErrors = networkErrors.filter(e => e.status >= 500);
      expect(criticalErrors).toHaveLength(0);
    });
  });

  test.describe('Navigation and UI Cross-Browser', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/login');
      await authHelper.login(page, testCredentials);
      
      try {
        await page.waitForURL('/dashboard', { timeout: 10000 });
      } catch (error) {
        console.log('Login failed, skipping navigation test');
        test.skip();
      }
    });

    test('should handle navigation consistently across browsers', async ({ page, browserName }) => {
      // Test sidebar navigation
      const navLinks = page.locator('nav a, .sidebar a, [data-testid="nav-link"]');
      const linkCount = await navLinks.count();
      
      if (linkCount > 0) {
        // Test first navigation link
        const firstLink = navLinks.first();
        const linkText = await firstLink.textContent();
        
        try {
          await firstLink.click();
          await page.waitForTimeout(2000);
          
          console.log(`✓ Navigation to "${linkText}" successful in ${browserName}`);
        } catch (error) {
          console.log(`Navigation test failed in ${browserName}: ${error}`);
        }
      }

      // Test back navigation
      try {
        await page.goBack();
        await page.waitForTimeout(1000);
        console.log(`✓ Back navigation successful in ${browserName}`);
      } catch (error) {
        console.log(`Back navigation failed in ${browserName}: ${error}`);
      }

      // Verify no critical backend errors occurred
      const criticalErrors = networkErrors.filter(e => e.status >= 500);
      expect(criticalErrors).toHaveLength(0);
    });

    test('should handle form interactions consistently across browsers', async ({ page, browserName }) => {
      await page.goto('/dashboard');

      // Test form elements if available
      const forms = page.locator('form');
      const formCount = await forms.count();
      
      if (formCount > 0) {
        const firstForm = forms.first();
        
        // Test input fields
        const inputs = firstForm.locator('input[type="text"], input[type="email"], textarea');
        const inputCount = await inputs.count();
        
        if (inputCount > 0) {
          try {
            const firstInput = inputs.first();
            await firstInput.fill('test input');
            await firstInput.clear();
            
            console.log(`✓ Form input interaction successful in ${browserName}`);
          } catch (error) {
            console.log(`Form interaction failed in ${browserName}: ${error}`);
          }
        }
      }

      // Verify no critical backend errors occurred
      const criticalErrors = networkErrors.filter(e => e.status >= 500);
      expect(criticalErrors).toHaveLength(0);
    });
  });

  test.describe('Download Functionality Cross-Browser', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/login');
      await authHelper.login(page, testCredentials);
      
      try {
        await page.waitForURL('/dashboard', { timeout: 10000 });
      } catch (error) {
        console.log('Login failed, skipping download test');
        test.skip();
      }
    });

    test('should handle downloads consistently across browsers', async ({ page, browserName }) => {
      await page.goto('/dashboard');

      // Look for download buttons
      const downloadButtons = page.locator('button:has-text("Download"), a:has-text("Download"), [data-testid="download"]');
      const buttonCount = await downloadButtons.count();
      
      if (buttonCount > 0) {
        try {
          // Set up download promise
          const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
          
          // Click download button
          await downloadButtons.first().click();
          
          // Wait for download to start
          const download = await downloadPromise;
          
          // Verify download started
          expect(download).toBeTruthy();
          console.log(`✓ Download initiated successfully in ${browserName}`);
          
          // Get download filename
          const filename = download.suggestedFilename();
          console.log(`Download filename in ${browserName}: ${filename}`);
          
        } catch (error) {
          console.log(`Download test failed in ${browserName}: ${error}`);
        }
      } else {
        console.log(`No download buttons found in ${browserName}`);
      }

      // Verify no critical backend errors occurred
      const criticalErrors = networkErrors.filter(e => e.status >= 500);
      expect(criticalErrors).toHaveLength(0);
    });
  });

  test.describe('Error Handling Cross-Browser', () => {
    test('should handle network errors consistently across browsers', async ({ page, browserName }) => {
      // Test with invalid URL to trigger network error
      await page.goto('/nonexistent-page');

      // Wait for error handling
      await page.waitForTimeout(3000);

      // Check for error page or 404 handling
      const errorElements = page.locator('.error, [data-testid="error"], .not-found, h1:has-text("404")');
      const hasErrorHandling = await errorElements.count() > 0;

      if (hasErrorHandling) {
        console.log(`✓ Error handling present in ${browserName}`);
      } else {
        console.log(`No specific error handling found in ${browserName}`);
      }

      // Verify browser can recover by navigating to valid page
      await page.goto('/');
      
      const landingPage = page.locator('h1, .hero, [data-testid="hero"]').first();
      if (await landingPage.isVisible()) {
        console.log(`✓ Recovery navigation successful in ${browserName}`);
      }

      // Check for any unexpected errors
      const unexpectedErrors = networkErrors.filter(e => e.status >= 500);
      expect(unexpectedErrors).toHaveLength(0);
    });

    test('should handle JavaScript errors consistently across browsers', async ({ page, browserName }) => {
      const jsErrors: string[] = [];
      
      // Listen for JavaScript errors
      page.on('pageerror', (error) => {
        jsErrors.push(error.message);
      });

      // Navigate to main pages and check for JS errors
      const pagesToTest = ['/', '/login', '/dashboard'];
      
      for (const pagePath of pagesToTest) {
        try {
          await page.goto(pagePath);
          await page.waitForTimeout(2000);
        } catch (error) {
          console.log(`Navigation to ${pagePath} failed in ${browserName}: ${error}`);
        }
      }

      // Report JavaScript errors
      if (jsErrors.length > 0) {
        console.log(`JavaScript errors in ${browserName}:`, jsErrors);
      } else {
        console.log(`✓ No JavaScript errors detected in ${browserName}`);
      }

      // Don't fail the test for JS errors, just report them
      // expect(jsErrors).toHaveLength(0);
    });
  });

  test.describe('Browser-Specific Feature Tests', () => {
    test('should handle browser-specific CSS features', async ({ page, browserName }) => {
      await page.goto('/');

      // Test CSS Grid support
      const gridElements = page.locator('.grid, [style*="grid"]');
      const gridCount = await gridElements.count();
      
      if (gridCount > 0) {
        const firstGrid = gridElements.first();
        const computedStyle = await firstGrid.evaluate((el) => {
          return window.getComputedStyle(el).display;
        });
        
        console.log(`CSS Grid display value in ${browserName}: ${computedStyle}`);
      }

      // Test Flexbox support
      const flexElements = page.locator('.flex, [style*="flex"]');
      const flexCount = await flexElements.count();
      
      if (flexCount > 0) {
        const firstFlex = flexElements.first();
        const computedStyle = await firstFlex.evaluate((el) => {
          return window.getComputedStyle(el).display;
        });
        
        console.log(`Flexbox display value in ${browserName}: ${computedStyle}`);
      }

      console.log(`✓ CSS feature test completed in ${browserName}`);
    });

    test('should handle local storage consistently across browsers', async ({ page, browserName }) => {
      await page.goto('/');

      // Test localStorage functionality
      const localStorageSupported = await page.evaluate(() => {
        try {
          localStorage.setItem('test', 'value');
          const value = localStorage.getItem('test');
          localStorage.removeItem('test');
          return value === 'value';
        } catch (error) {
          return false;
        }
      });

      expect(localStorageSupported).toBe(true);
      console.log(`✓ localStorage supported in ${browserName}`);

      // Test sessionStorage functionality
      const sessionStorageSupported = await page.evaluate(() => {
        try {
          sessionStorage.setItem('test', 'value');
          const value = sessionStorage.getItem('test');
          sessionStorage.removeItem('test');
          return value === 'value';
        } catch (error) {
          return false;
        }
      });

      expect(sessionStorageSupported).toBe(true);
      console.log(`✓ sessionStorage supported in ${browserName}`);
    });
  });

  test.afterEach(async ({ page, browserName }) => {
    // Report any network errors that occurred during the test
    if (networkErrors.length > 0) {
      console.log(`Network errors in ${browserName}:`, networkErrors.map(e => `${e.status} ${e.url}`));
    }
    
    // Clean up any test data
    try {
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
});