import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth';
import { UIInteractionHelper } from '../helpers/ui-interactions';
import { NetworkLogger } from '../helpers/network-logger';
import { ErrorReporter } from '../helpers/error-reporter';
import testData from '../fixtures/test-data.json';

test.describe('6.2 Sidebar Navigation Test', () => {
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

  test('should display navigation menu items with correct active states', async ({ page }) => {
    console.log('🧪 Testing navigation menu items and active states...');

    // Login first to access authenticated sidebar
    await authHelper.login(testData.testUsers.validUser.email, testData.testUsers.validUser.password);
    
    // Verify sidebar is visible
    await expect(page.locator('.sidebar, [data-testid="sidebar"]').or(page.locator('nav'))).toBeVisible();
    
    // Verify DocFiscal logo
    await expect(page.locator('text=DocFiscal')).toBeVisible();
    
    // Verify navigation items
    await expect(page.locator('text=Convert')).toBeVisible();
    await expect(page.locator('text=All files')).toBeVisible();
    await expect(page.locator('text=History')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();
    
    // Test active state for Convert (home page)
    await page.goto('/');
    const convertLink = page.locator('a:has-text("Convert")');
    await expect(convertLink).toHaveClass(/active|text-blue-600|bg-blue-50/);
    
    // Test navigation to dashboard and active state
    await page.goto('/dashboard');
    const allFilesLink = page.locator('a:has-text("All files")');
    await expect(allFilesLink).toHaveClass(/active|text-blue-600|bg-blue-50/);
    
    console.log('✅ Navigation menu items and active states verified');
  });

  test('should display recent files section with proper formatting', async ({ page }) => {
    console.log('🧪 Testing recent files section...');

    // Login first
    await authHelper.login(testData.testUsers.validUser.email, testData.testUsers.validUser.password);
    
    // Wait for potential orders to load
    await page.waitForTimeout(2000);
    
    // Check if recent files section exists
    const recentFilesSection = page.locator('text=Recent Files').locator('..');
    
    if (await recentFilesSection.isVisible()) {
      console.log('Recent files section found, verifying content...');
      
      // Verify recent files are displayed with proper formatting
      const fileItems = page.locator('[data-testid="recent-file"], .recent-file').or(
        page.locator('text=Recent Files').locator('..').locator('a')
      );
      
      const fileCount = await fileItems.count();
      if (fileCount > 0) {
        // Check first file item formatting
        const firstFile = fileItems.first();
        await expect(firstFile).toBeVisible();
        
        // Verify file has status indicator
        await expect(firstFile.locator('text=/completed|processing|pending|failed/i')).toBeVisible();
        
        // Verify file size is displayed
        await expect(firstFile.locator('text=/MB|KB/i')).toBeVisible();
      }
    } else {
      console.log('No recent files found - this is acceptable for new users');
    }
    
    console.log('✅ Recent files section verified');
  });

  test('should display user profile section correctly', async ({ page }) => {
    console.log('🧪 Testing user profile display...');

    // Login first
    await authHelper.login(testData.testUsers.validUser.email, testData.testUsers.validUser.password);
    
    // Verify user profile section is visible
    const userSection = page.locator('[data-testid="user-section"]').or(
      page.locator('text=Log out').locator('..')
    );
    await expect(userSection).toBeVisible();
    
    // Verify user name is displayed
    await expect(page.locator(`text=${testData.testUsers.validUser.name}`)).toBeVisible();
    
    // Verify user email is displayed
    await expect(page.locator(`text=${testData.testUsers.validUser.email}`)).toBeVisible();
    
    // Verify logout button is present
    const logoutButton = page.locator('button:has-text("Log out")');
    await expect(logoutButton).toBeVisible();
    await expect(logoutButton).toBeEnabled();
    
    console.log('✅ User profile section verified');
  });

  test('should handle responsive navigation behavior', async ({ page }) => {
    console.log('🧪 Testing responsive navigation behavior...');

    // Login first
    await authHelper.login(testData.testUsers.validUser.email, testData.testUsers.validUser.password);
    
    // Test desktop layout
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('text=DocFiscal')).toBeVisible();
    await expect(page.locator('text=Convert')).toBeVisible();
    
    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('text=DocFiscal')).toBeVisible();
    
    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    
    // On mobile, sidebar might be collapsed or hidden
    // We should still be able to access navigation somehow
    const navigation = page.locator('nav, .sidebar, [data-testid="sidebar"]');
    
    // Either sidebar is visible or there's a mobile menu
    const sidebarVisible = await navigation.isVisible();
    const mobileMenuButton = page.locator('[data-testid="mobile-menu"], .mobile-menu-button, button[aria-label*="menu"]');
    const mobileMenuExists = await mobileMenuButton.count() > 0;
    
    if (!sidebarVisible && mobileMenuExists) {
      console.log('Mobile menu detected, testing mobile navigation...');
      await mobileMenuButton.click();
      await expect(page.locator('text=Convert')).toBeVisible();
    } else if (sidebarVisible) {
      console.log('Sidebar remains visible on mobile');
      await expect(page.locator('text=Convert')).toBeVisible();
    }
    
    console.log('✅ Responsive navigation behavior verified');
  });

  test('should show unauthenticated navigation when not logged in', async ({ page }) => {
    console.log('🧪 Testing unauthenticated navigation...');

    // Go to landing page without authentication
    await page.goto('/');
    
    // Verify unauthenticated navigation buttons are present
    await expect(page.locator('button:has-text("Fazer Login"), a:has-text("Sign In")')).toBeVisible();
    await expect(page.locator('button:has-text("Criar Conta"), a:has-text("Sign Up")')).toBeVisible();
    
    // Verify authenticated sidebar elements are not present
    await expect(page.locator('text=All files')).not.toBeVisible();
    await expect(page.locator('text=History')).not.toBeVisible();
    await expect(page.locator('text=Recent Files')).not.toBeVisible();
    
    console.log('✅ Unauthenticated navigation verified');
  });
});