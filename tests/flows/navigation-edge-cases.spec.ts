import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth';
import { UIInteractionHelper } from '../helpers/ui-interactions';
import { NetworkLogger } from '../helpers/network-logger';
import { ErrorReporter } from '../helpers/error-reporter';
import testData from '../fixtures/test-data.json';

test.describe('6.3 Navigation Edge Cases Unit Tests', () => {
  let authHelper: AuthHelper;
  let uiHelper: UIInteractionHelper;
  let networkLogger: NetworkLogger;
  let errorReporter: ErrorReporter;
  let networkErrors: any[] = [];

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    uiHelper = new UIInteractionHelper(page);
    networkLogger = new NetworkLogger();
    errorReporter = new ErrorReporter();
    networkErrors = [];

    // Set up network error capture
    networkLogger.captureBackendErrors(page, networkErrors);
  });

  test.afterEach(async () => {
    // Report any network errors found during test
    if (networkErrors.length > 0) {
      const report = errorReporter.generateReport(networkErrors, []);
      console.error('Network errors detected:', JSON.stringify(report, null, 2));
      throw new Error(`Test failed due to ${networkErrors.length} backend errors`);
    }
  });

  test('should handle navigation without authentication correctly', async ({ page }) => {
    console.log('🧪 Testing navigation without authentication...');

    // Try to access dashboard without authentication
    await page.goto('/dashboard');
    
    // Should redirect to login or show landing page
    const currentUrl = page.url();
    const isOnLogin = currentUrl.includes('/login');
    const isOnLanding = currentUrl === page.url().replace(/\/dashboard.*/, '/');
    
    expect(isOnLogin || isOnLanding).toBeTruthy();
    
    // Verify authenticated navigation items are not accessible
    if (isOnLanding) {
      await expect(page.locator('text=All files')).not.toBeVisible();
      await expect(page.locator('text=History')).not.toBeVisible();
      await expect(page.locator('text=Settings')).not.toBeVisible();
    }
    
    console.log('✅ Unauthenticated navigation handling verified');
  });

  test('should handle navigation with authentication correctly', async ({ page }) => {
    console.log('🧪 Testing navigation with authentication...');

    // Login first
    await authHelper.login(testData.testUsers.validUser.email, testData.testUsers.validUser.password);
    
    // Verify authenticated user can access protected routes
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
    
    // Verify authenticated navigation items are visible
    await expect(page.locator('text=All files')).toBeVisible();
    
    // Verify user can navigate between authenticated pages
    await page.goto('/');
    await expect(page).toHaveURL('/');
    
    // Verify sidebar is present on authenticated pages
    await expect(page.locator('text=DocFiscal')).toBeVisible();
    await expect(page.locator('text=Convert')).toBeVisible();
    
    console.log('✅ Authenticated navigation handling verified');
  });

  test('should display recent files with different order statuses correctly', async ({ page }) => {
    console.log('🧪 Testing recent files display with different order statuses...');

    // Login first
    await authHelper.login(testData.testUsers.validUser.email, testData.testUsers.validUser.password);
    
    // Wait for orders to potentially load
    await page.waitForTimeout(2000);
    
    // Check if recent files section exists
    const recentFilesSection = page.locator('text=Recent Files');
    
    if (await recentFilesSection.isVisible()) {
      console.log('Recent files found, testing status display...');
      
      // Look for different status indicators
      const statusElements = page.locator('text=/completed|processing|pending|failed|paid/i');
      const statusCount = await statusElements.count();
      
      if (statusCount > 0) {
        // Verify each status has appropriate styling
        for (let i = 0; i < Math.min(statusCount, 3); i++) {
          const statusElement = statusElements.nth(i);
          const statusText = await statusElement.textContent();
          
          if (statusText) {
            const lowerStatus = statusText.toLowerCase();
            
            // Verify status-specific styling exists
            if (lowerStatus.includes('completed')) {
              await expect(statusElement).toHaveClass(/green|success/);
            } else if (lowerStatus.includes('processing') || lowerStatus.includes('paid')) {
              await expect(statusElement).toHaveClass(/blue|info|processing/);
            } else if (lowerStatus.includes('failed')) {
              await expect(statusElement).toHaveClass(/red|error|danger/);
            } else if (lowerStatus.includes('pending')) {
              await expect(statusElement).toHaveClass(/gray|pending|warning/);
            }
          }
        }
      }
    } else {
      console.log('No recent files found - testing empty state...');
      
      // Verify that when no recent files exist, the section is handled gracefully
      await expect(page.locator('text=Recent Files')).not.toBeVisible();
      
      // Verify navigation still works without recent files
      await expect(page.locator('text=Convert')).toBeVisible();
      await expect(page.locator('text=All files')).toBeVisible();
    }
    
    console.log('✅ Recent files status display verified');
  });

  test('should handle navigation state persistence across page reloads', async ({ page }) => {
    console.log('🧪 Testing navigation state persistence...');

    // Login first
    await authHelper.login(testData.testUsers.validUser.email, testData.testUsers.validUser.password);
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
    
    // Reload the page
    await page.reload();
    
    // Verify user remains authenticated and navigation is intact
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=All files')).toBeVisible();
    await expect(page.locator(`text=${testData.testUsers.validUser.name}`)).toBeVisible();
    
    // Test navigation after reload
    await page.goto('/');
    await expect(page.locator('text=Convert')).toBeVisible();
    
    console.log('✅ Navigation state persistence verified');
  });

  test('should handle broken navigation links gracefully', async ({ page }) => {
    console.log('🧪 Testing broken navigation links handling...');

    // Login first
    await authHelper.login(testData.testUsers.validUser.email, testData.testUsers.validUser.password);
    
    // Try to navigate to a non-existent page
    await page.goto('/non-existent-page');
    
    // Should either show 404 page or redirect to a valid page
    const currentUrl = page.url();
    const is404 = await page.locator('text=/404|not found/i').isVisible();
    const isRedirected = !currentUrl.includes('/non-existent-page');
    
    expect(is404 || isRedirected).toBeTruthy();
    
    // Verify navigation still works after encountering broken link
    await page.goto('/');
    await expect(page.locator('text=Convert')).toBeVisible();
    
    console.log('✅ Broken navigation links handling verified');
  });

  test('should handle logout and navigation state cleanup', async ({ page }) => {
    console.log('🧪 Testing logout and navigation state cleanup...');

    // Login first
    await authHelper.login(testData.testUsers.validUser.email, testData.testUsers.validUser.password);
    
    // Verify authenticated state
    await expect(page.locator('text=All files')).toBeVisible();
    await expect(page.locator(`text=${testData.testUsers.validUser.name}`)).toBeVisible();
    
    // Logout
    await authHelper.logout();
    
    // Verify navigation state is cleaned up
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=All files')).not.toBeVisible();
    await expect(page.locator('text=Recent Files')).not.toBeVisible();
    await expect(page.locator(`text=${testData.testUsers.validUser.name}`)).not.toBeVisible();
    
    // Verify unauthenticated navigation is shown
    await expect(page.locator('button:has-text("Fazer Login")')).toBeVisible();
    await expect(page.locator('button:has-text("Criar Conta")')).toBeVisible();
    
    console.log('✅ Logout and navigation state cleanup verified');
  });

  test('should handle concurrent navigation requests', async ({ page }) => {
    console.log('🧪 Testing concurrent navigation requests...');

    // Login first
    await authHelper.login(testData.testUsers.validUser.email, testData.testUsers.validUser.password);
    
    // Perform rapid navigation changes
    const navigationPromises = [
      page.goto('/'),
      page.goto('/dashboard'),
      page.goto('/'),
    ];
    
    // Wait for all navigation to complete
    await Promise.all(navigationPromises);
    
    // Verify final state is consistent
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Convert')).toBeVisible();
    
    // Verify navigation still works after concurrent requests
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=All files')).toBeVisible();
    
    console.log('✅ Concurrent navigation requests handling verified');
  });
});