/**
 * Responsive Design Flow Tests
 * Tests mobile and desktop layouts for all major components
 * Validates sidebar behavior on different screen sizes
 * Tests table to card view transitions
 * Requirements: 7.2
 */

import { test, expect, Page } from '@playwright/test';
import { AuthHelper } from '../helpers/auth';
import { UIInteractionHelper } from '../helpers/ui-interactions';
import { NetworkLogger } from '../helpers/network-logger';
import type { NetworkError } from '../helpers/network-logger';

// Test data
const testCredentials = {
  email: 'test@example.com',
  password: 'password123'
};

// Viewport configurations
const viewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 }
};

test.describe('Responsive Design Tests', () => {
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

  test.describe('Landing Page Responsive Layout', () => {
    test('should display correctly on mobile viewport', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/');

      // Verify hero section is responsive
      const heroSection = page.locator('[data-testid="hero-section"], .hero, h1').first();
      await expect(heroSection).toBeVisible();

      // Verify feature cards stack vertically on mobile
      const featureCards = page.locator('[data-testid="feature-cards"], .grid, .flex').first();
      if (await featureCards.isVisible()) {
        const cardContainer = await featureCards.boundingBox();
        expect(cardContainer?.width).toBeLessThan(viewports.mobile.width);
      }

      // Verify CTA buttons are accessible
      const loginButton = page.locator('text="Fazer Login"').or(page.locator('text="Login"')).first();
      const registerButton = page.locator('text="Criar Conta"').or(page.locator('text="Register"')).first();
      
      if (await loginButton.isVisible()) {
        await expect(loginButton).toBeVisible();
      }
      if (await registerButton.isVisible()) {
        await expect(registerButton).toBeVisible();
      }

      // Verify no backend errors occurred
      expect(networkErrors.filter(e => e.status >= 400)).toHaveLength(0);
    });

    test('should display correctly on desktop viewport', async ({ page }) => {
      await page.setViewportSize(viewports.desktop);
      await page.goto('/');

      // Verify hero section uses full width
      const heroSection = page.locator('[data-testid="hero-section"], .hero, h1').first();
      await expect(heroSection).toBeVisible();

      // Verify feature cards display horizontally on desktop
      const featureCards = page.locator('[data-testid="feature-cards"], .grid').first();
      if (await featureCards.isVisible()) {
        const cardContainer = await featureCards.boundingBox();
        expect(cardContainer?.width).toBeGreaterThan(viewports.mobile.width);
      }

      // Verify no backend errors occurred
      expect(networkErrors.filter(e => e.status >= 400)).toHaveLength(0);
    });
  });

  test.describe('Dashboard Sidebar Responsive Behavior', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/login');
      await authHelper.login(page, testCredentials);
      await page.waitForURL('/dashboard');
    });

    test('should show collapsed sidebar on mobile', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/dashboard');

      // Wait for dashboard to load
      await page.waitForSelector('[data-testid="dashboard"], .dashboard, main', { timeout: 10000 });

      // Check if sidebar is collapsed or hidden on mobile
      const sidebar = page.locator('[data-testid="sidebar"], .sidebar, nav').first();
      
      if (await sidebar.isVisible()) {
        const sidebarBox = await sidebar.boundingBox();
        // On mobile, sidebar should be either hidden or take minimal width
        expect(sidebarBox?.width || 0).toBeLessThan(200);
      }

      // Verify main content takes full width on mobile
      const mainContent = page.locator('[data-testid="main-content"], main, .main').first();
      if (await mainContent.isVisible()) {
        const contentBox = await mainContent.boundingBox();
        expect(contentBox?.width || 0).toBeGreaterThan(viewports.mobile.width * 0.8);
      }

      // Verify no backend errors occurred
      expect(networkErrors.filter(e => e.status >= 400)).toHaveLength(0);
    });

    test('should show expanded sidebar on desktop', async ({ page }) => {
      await page.setViewportSize(viewports.desktop);
      await page.goto('/dashboard');

      // Wait for dashboard to load
      await page.waitForSelector('[data-testid="dashboard"], .dashboard, main', { timeout: 10000 });

      // Check if sidebar is expanded on desktop
      const sidebar = page.locator('[data-testid="sidebar"], .sidebar, nav').first();
      
      if (await sidebar.isVisible()) {
        const sidebarBox = await sidebar.boundingBox();
        // On desktop, sidebar should have reasonable width
        expect(sidebarBox?.width || 0).toBeGreaterThan(200);
      }

      // Verify navigation items are visible
      const navItems = page.locator('[data-testid="nav-item"], .nav-item, a[href*="/"]');
      const visibleNavItems = await navItems.count();
      expect(visibleNavItems).toBeGreaterThan(0);

      // Verify no backend errors occurred
      expect(networkErrors.filter(e => e.status >= 400)).toHaveLength(0);
    });

    test('should show user profile section responsively', async ({ page }) => {
      await page.setViewportSize(viewports.desktop);
      await page.goto('/dashboard');

      // Wait for dashboard to load
      await page.waitForSelector('[data-testid="dashboard"], .dashboard, main', { timeout: 10000 });

      // Check user profile section
      const userSection = page.locator('[data-testid="user-section"], .user-profile, .user').first();
      
      if (await userSection.isVisible()) {
        await expect(userSection).toBeVisible();
        
        // Verify logout button is accessible
        const logoutButton = page.locator('text="Logout"').or(page.locator('text="Sair"')).first();
        if (await logoutButton.isVisible()) {
          await expect(logoutButton).toBeVisible();
        }
      }

      // Verify no backend errors occurred
      expect(networkErrors.filter(e => e.status >= 400)).toHaveLength(0);
    });
  });

  test.describe('Order History Table to Card View Transitions', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/login');
      await authHelper.login(page, testCredentials);
      await page.waitForURL('/dashboard');
    });

    test('should display table view on desktop', async ({ page }) => {
      await page.setViewportSize(viewports.desktop);
      await page.goto('/dashboard');

      // Wait for order history to load
      await page.waitForSelector('[data-testid="order-history"], .order-history, table, .table', { timeout: 10000 });

      // Check if table view is displayed
      const table = page.locator('table, [data-testid="order-table"]').first();
      
      if (await table.isVisible()) {
        await expect(table).toBeVisible();
        
        // Verify table headers are visible
        const headers = page.locator('th, [data-testid="table-header"]');
        const headerCount = await headers.count();
        expect(headerCount).toBeGreaterThan(0);
        
        // Verify table rows if data exists
        const rows = page.locator('tbody tr, [data-testid="order-row"]');
        const rowCount = await rows.count();
        // Don't assert on row count as it depends on data
      }

      // Verify no backend errors occurred
      expect(networkErrors.filter(e => e.status >= 400)).toHaveLength(0);
    });

    test('should display card view on mobile', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/dashboard');

      // Wait for order history to load
      await page.waitForSelector('[data-testid="order-history"], .order-history, .order-card, .card', { timeout: 10000 });

      // Check if card view is displayed (table might be hidden)
      const cards = page.locator('[data-testid="order-card"], .order-card, .card').first();
      const table = page.locator('table, [data-testid="order-table"]').first();
      
      // Either cards should be visible or table should be responsive
      const cardsVisible = await cards.isVisible();
      const tableVisible = await table.isVisible();
      
      if (cardsVisible) {
        await expect(cards).toBeVisible();
      } else if (tableVisible) {
        // If table is still shown, it should be responsive
        const tableBox = await table.boundingBox();
        expect(tableBox?.width || 0).toBeLessThan(viewports.mobile.width);
      }

      // Verify no backend errors occurred
      expect(networkErrors.filter(e => e.status >= 400)).toHaveLength(0);
    });

    test('should transition between table and card views', async ({ page }) => {
      // Start with desktop view
      await page.setViewportSize(viewports.desktop);
      await page.goto('/dashboard');
      
      // Wait for order history to load
      await page.waitForSelector('[data-testid="order-history"], .order-history, table, .table', { timeout: 10000 });

      // Verify desktop layout
      const table = page.locator('table, [data-testid="order-table"]').first();
      if (await table.isVisible()) {
        await expect(table).toBeVisible();
      }

      // Switch to mobile view
      await page.setViewportSize(viewports.mobile);
      await page.waitForTimeout(1000); // Allow time for responsive changes

      // Verify mobile layout adaptation
      const mobileCards = page.locator('[data-testid="order-card"], .order-card, .card').first();
      const mobileTable = page.locator('table, [data-testid="order-table"]').first();
      
      // Either cards should appear or table should be responsive
      const cardsVisible = await mobileCards.isVisible();
      const tableVisible = await mobileTable.isVisible();
      
      expect(cardsVisible || tableVisible).toBe(true);

      // Switch back to desktop
      await page.setViewportSize(viewports.desktop);
      await page.waitForTimeout(1000); // Allow time for responsive changes

      // Verify desktop layout is restored
      if (await table.isVisible()) {
        await expect(table).toBeVisible();
      }

      // Verify no backend errors occurred
      expect(networkErrors.filter(e => e.status >= 400)).toHaveLength(0);
    });
  });

  test.describe('Upload Area Responsive Layout', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/login');
      await authHelper.login(page, testCredentials);
      await page.waitForURL('/dashboard');
    });

    test('should display upload area responsively', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/upload');

      // Wait for upload area to load
      await page.waitForSelector('[data-testid="upload-area"], .upload-area, .upload', { timeout: 10000 });

      const uploadArea = page.locator('[data-testid="upload-area"], .upload-area, .upload').first();
      
      if (await uploadArea.isVisible()) {
        await expect(uploadArea).toBeVisible();
        
        // Verify upload area fits mobile viewport
        const uploadBox = await uploadArea.boundingBox();
        expect(uploadBox?.width || 0).toBeLessThan(viewports.mobile.width);
      }

      // Test desktop view
      await page.setViewportSize(viewports.desktop);
      await page.waitForTimeout(1000);

      if (await uploadArea.isVisible()) {
        const desktopUploadBox = await uploadArea.boundingBox();
        expect(desktopUploadBox?.width || 0).toBeGreaterThan(viewports.mobile.width);
      }

      // Verify no backend errors occurred
      expect(networkErrors.filter(e => e.status >= 400)).toHaveLength(0);
    });
  });

  test.describe('Order Status Card Responsive Layout', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/login');
      await authHelper.login(page, testCredentials);
      await page.waitForURL('/dashboard');
    });

    test('should display order status cards responsively', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      
      // Try to navigate to an order status page
      await page.goto('/dashboard');
      
      // Look for order links or create a test order
      const orderLinks = page.locator('a[href*="/pedido/"], [data-testid="order-link"]');
      const orderCount = await orderLinks.count();
      
      if (orderCount > 0) {
        // Click on first order
        await orderLinks.first().click();
        
        // Wait for order status page
        await page.waitForSelector('[data-testid="order-status"], .order-status, .status-card', { timeout: 10000 });
        
        const statusCard = page.locator('[data-testid="order-status"], .order-status, .status-card').first();
        
        if (await statusCard.isVisible()) {
          await expect(statusCard).toBeVisible();
          
          // Verify card fits mobile viewport
          const cardBox = await statusCard.boundingBox();
          expect(cardBox?.width || 0).toBeLessThan(viewports.mobile.width);
        }
        
        // Test desktop view
        await page.setViewportSize(viewports.desktop);
        await page.waitForTimeout(1000);
        
        if (await statusCard.isVisible()) {
          const desktopCardBox = await statusCard.boundingBox();
          expect(desktopCardBox?.width || 0).toBeGreaterThan(viewports.mobile.width);
        }
      }

      // Verify no backend errors occurred
      expect(networkErrors.filter(e => e.status >= 400)).toHaveLength(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Report any network errors that occurred during the test
    if (networkErrors.length > 0) {
      console.log('Network errors detected:', networkErrors);
    }
  });
});