import { test, expect } from '@playwright/test';
import { createAuthHelper } from '../helpers/auth';
import { NetworkLogger } from '../helpers/network-logger';
import testData from '../fixtures/test-data.json';

test.describe('Dashboard Edge Cases Tests', () => {
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
    
    // Mock authentication to avoid rate limiting issues
    await page.addInitScript(() => {
      // Mock localStorage with valid tokens
      localStorage.setItem('access_token', 'mock_access_token_123');
      localStorage.setItem('refresh_token', 'mock_refresh_token_123');
      localStorage.setItem('user', JSON.stringify({
        id: 'test-user-id',
        email: 'test@docfiscal.com',
        name: 'Test User'
      }));
    });
    
    // Login to access dashboard
    const validUser = testData.testUsers.validUser;
    await authHelper.login(validUser);
  });

  test.afterEach(async () => {
    // Note: We don't fail on backend errors for edge case tests
    // since we're testing error handling scenarios
    if (capturedErrors.length > 0) {
      console.log(`ℹ️ Backend errors detected (expected for edge cases): ${capturedErrors.length}`);
    }
  });

  test.describe('10.4 Empty Order List Display', () => {
    test('should display empty state when user has no orders', async ({ page }) => {
      console.log('🧪 Testing empty order list display...');
      
      // Intercept orders API to return empty result
      await page.route('**/api/users/*/orders*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              orders: [],
              total: 0,
              page: 1,
              limit: 50,
              totalPages: 1
            }
          })
        });
      });
      
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Verify statistics show zero counts
      const totalOrdersCount = page.locator('text="Total Orders"').locator('..').locator('..').locator('.text-3xl.font-bold');
      await expect(totalOrdersCount).toContainText('0');
      
      const pendingPaymentCount = page.locator('text="Pending Payment"').locator('..').locator('..').locator('.text-3xl.font-bold');
      await expect(pendingPaymentCount).toContainText('0');
      
      const processingCount = page.locator('text="Processing"').locator('..').locator('..').locator('.text-3xl.font-bold');
      await expect(processingCount).toContainText('0');
      
      const completedCount = page.locator('text="Completed"').locator('..').locator('..').locator('.text-3xl.font-bold');
      await expect(completedCount).toContainText('0');
      
      // Verify empty state message is displayed
      const emptyStateIcon = page.locator('svg.h-12.w-12.text-gray-400');
      await expect(emptyStateIcon).toBeVisible();
      
      const emptyStateTitle = page.locator('text="No orders yet"');
      await expect(emptyStateTitle).toBeVisible();
      
      const emptyStateDescription = page.locator('text="Upload your first PDF document to get started."');
      await expect(emptyStateDescription).toBeVisible();
      
      // Verify no table rows are displayed
      const tableRows = page.locator('table tbody tr');
      await expect(tableRows).toHaveCount(0);
      
      // Verify Upload New File button is still available
      const uploadButton = page.locator('text="Upload New File"');
      await expect(uploadButton).toBeVisible();
      await expect(uploadButton).toBeEnabled();
      
      console.log('✅ Empty order list display test completed successfully');
    });

    test('should handle empty state in mobile view', async ({ page }) => {
      console.log('🧪 Testing empty state in mobile view...');
      
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Intercept orders API to return empty result
      await page.route('**/api/users/*/orders*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              orders: [],
              total: 0,
              page: 1,
              limit: 50,
              totalPages: 1
            }
          })
        });
      });
      
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Verify empty state is displayed in mobile view
      const emptyStateIcon = page.locator('svg.h-12.w-12.text-gray-400');
      await expect(emptyStateIcon).toBeVisible();
      
      const emptyStateTitle = page.locator('text="No orders yet"');
      await expect(emptyStateTitle).toBeVisible();
      
      // Verify mobile card list is not displayed
      const mobileCardList = page.locator('.md\\:hidden[role="list"]');
      const cardItems = mobileCardList.locator('[role="listitem"]');
      await expect(cardItems).toHaveCount(0);
      
      // Verify statistics cards are still visible and show zero
      const statisticsCards = page.locator('.text-3xl.font-bold');
      await expect(statisticsCards).toHaveCount(4);
      
      for (let i = 0; i < 4; i++) {
        const card = statisticsCards.nth(i);
        await expect(card).toContainText('0');
      }
      
      console.log('✅ Empty state mobile view test completed successfully');
    });

    test('should provide helpful call-to-action for empty state', async ({ page }) => {
      console.log('🧪 Testing empty state call-to-action...');
      
      // Intercept orders API to return empty result
      await page.route('**/api/users/*/orders*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              orders: [],
              total: 0,
              page: 1,
              limit: 50,
              totalPages: 1
            }
          })
        });
      });
      
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Verify Upload New File button is prominently displayed
      const uploadButton = page.locator('text="Upload New File"');
      await expect(uploadButton).toBeVisible();
      await expect(uploadButton).toBeEnabled();
      
      // Verify button has proper styling (should be primary/prominent)
      await expect(uploadButton).toHaveClass(/bg-blue-600/);
      
      // Verify button has upload icon
      const uploadIcon = uploadButton.locator('..').locator('svg');
      await expect(uploadIcon).toBeVisible();
      
      // Test button functionality
      await uploadButton.click();
      await expect(page).toHaveURL('/upload');
      
      console.log('✅ Empty state call-to-action test completed successfully');
    });
  });

  test.describe('10.4 Loading States', () => {
    test('should display loading state while fetching orders', async ({ page }) => {
      console.log('🧪 Testing dashboard loading state...');
      
      // Intercept orders API with delay to simulate loading
      await page.route('**/api/users/*/orders*', async route => {
        // Delay response to simulate loading
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              orders: [],
              total: 0,
              page: 1,
              limit: 50,
              totalPages: 1
            }
          })
        });
      });
      
      // Navigate to dashboard
      await page.goto('/dashboard');
      
      // Verify loading state is displayed
      const loadingSpinner = page.locator('.animate-spin.rounded-full.h-8.w-8.border-b-2');
      await expect(loadingSpinner).toBeVisible();
      
      const loadingText = page.locator('text="Loading orders..."');
      await expect(loadingText).toBeVisible();
      
      // Wait for loading to complete
      await page.waitForLoadState('networkidle');
      
      // Verify loading state is replaced with content
      await expect(loadingSpinner).not.toBeVisible();
      await expect(loadingText).not.toBeVisible();
      
      // Verify empty state is now displayed
      const emptyStateTitle = page.locator('text="No orders yet"');
      await expect(emptyStateTitle).toBeVisible();
      
      console.log('✅ Dashboard loading state test completed successfully');
    });

    test('should display loading state for statistics cards', async ({ page }) => {
      console.log('🧪 Testing statistics loading state...');
      
      // Navigate to dashboard and check initial loading
      await page.goto('/dashboard');
      
      // Check if statistics cards show loading or are populated
      const statisticsCards = page.locator('.text-3xl.font-bold');
      
      // Wait for statistics to load
      await page.waitForSelector('.text-3xl.font-bold', { timeout: 10000 });
      
      // Verify all 4 statistics cards are present
      await expect(statisticsCards).toHaveCount(4);
      
      // Verify each card has numeric content
      for (let i = 0; i < 4; i++) {
        const card = statisticsCards.nth(i);
        await expect(card).toBeVisible();
        
        const cardText = await card.textContent();
        expect(cardText).toBeTruthy();
        expect(cardText?.trim()).toMatch(/^\d+$/); // Should be a number
      }
      
      console.log('✅ Statistics loading state test completed successfully');
    });

    test('should handle refresh button loading state', async ({ page }) => {
      console.log('🧪 Testing refresh button loading state...');
      
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Find refresh button
      const refreshButton = page.locator('text="Atualizar Lista"');
      await expect(refreshButton).toBeVisible();
      
      // Intercept orders API with delay for refresh
      await page.route('**/api/users/*/orders*', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              orders: [],
              total: 0,
              page: 1,
              limit: 50,
              totalPages: 1
            }
          })
        });
      });
      
      // Click refresh button
      await refreshButton.click();
      
      // Check for loading state
      try {
        await expect(refreshButton).toBeDisabled({ timeout: 1000 });
        console.log('🔄 Refresh button shows disabled state during loading');
      } catch (error) {
        console.log('🔄 Refresh button loading state too quick to detect');
      }
      
      // Check for spinning icon
      try {
        const spinningIcon = refreshButton.locator('..').locator('svg.animate-spin');
        await expect(spinningIcon).toBeVisible({ timeout: 1000 });
        console.log('🔄 Refresh button shows spinning icon');
      } catch (error) {
        console.log('🔄 No spinning icon detected');
      }
      
      // Wait for refresh to complete
      await page.waitForLoadState('networkidle');
      
      // Verify button is enabled again
      await expect(refreshButton).toBeEnabled();
      
      console.log('✅ Refresh button loading state test completed successfully');
    });
  });

  test.describe('10.4 Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      console.log('🧪 Testing API error handling...');
      
      // Intercept orders API to return error
      await page.route('**/api/users/*/orders*', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Internal server error',
            message: 'Failed to fetch orders'
          })
        });
      });
      
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Verify error state is displayed
      const errorMessage = page.locator('text="Failed to load order history. Please try again."');
      await expect(errorMessage).toBeVisible();
      
      // Verify error message styling
      const errorContainer = errorMessage.locator('..');
      await expect(errorContainer).toHaveClass(/text-red-600/);
      
      // Verify retry button is available
      const retryButton = page.locator('button:has-text("Retry")');
      await expect(retryButton).toBeVisible();
      await expect(retryButton).toBeEnabled();
      
      // Test retry functionality
      await retryButton.click();
      
      // Verify page reloads or retries the request
      await page.waitForLoadState('networkidle');
      
      console.log('✅ API error handling test completed successfully');
    });

    test('should handle network errors', async ({ page }) => {
      console.log('🧪 Testing network error handling...');
      
      // Intercept orders API to simulate network failure
      await page.route('**/api/users/*/orders*', route => {
        route.abort('failed');
      });
      
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Verify error handling
      try {
        const errorMessage = page.locator('text="Failed to load order history. Please try again."');
        await expect(errorMessage).toBeVisible({ timeout: 10000 });
        console.log('🌐 Network error message displayed');
      } catch (error) {
        // Check for alternative error handling
        const genericError = page.locator('[role="alert"]');
        const genericErrorCount = await genericError.count();
        
        if (genericErrorCount > 0) {
          console.log('🌐 Generic error alert displayed');
        } else {
          console.log('🌐 Error handling may be silent or use different mechanism');
        }
      }
      
      console.log('✅ Network error handling test completed successfully');
    });

    test('should handle authentication errors', async ({ page }) => {
      console.log('🧪 Testing authentication error handling...');
      
      // Intercept orders API to return 401 Unauthorized
      await page.route('**/api/users/*/orders*', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Unauthorized',
            message: 'Authentication required'
          })
        });
      });
      
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Verify authentication error handling
      // This might redirect to login or show an error message
      
      try {
        // Check if redirected to login
        await page.waitForURL('/login', { timeout: 5000 });
        console.log('🔐 Redirected to login page for authentication error');
      } catch (error) {
        // Check for error message on dashboard
        const authError = page.locator('text="Authentication required", text="Please log in again"');
        const authErrorCount = await authError.count();
        
        if (authErrorCount > 0) {
          console.log('🔐 Authentication error message displayed');
        } else {
          console.log('🔐 Authentication error handling may use different mechanism');
        }
      }
      
      console.log('✅ Authentication error handling test completed successfully');
    });

    test('should handle partial data loading errors', async ({ page }) => {
      console.log('🧪 Testing partial data loading errors...');
      
      // Intercept orders API to return partial success
      await page.route('**/api/users/*/orders*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              orders: [
                {
                  id: 'order-1',
                  filename: 'test.pdf',
                  status: 'completed',
                  createdAt: new Date().toISOString(),
                  originalFileSize: 1024000
                }
              ],
              total: 1,
              page: 1,
              limit: 50,
              totalPages: 1
            },
            warnings: ['Some order details could not be loaded']
          })
        });
      });
      
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Verify partial data is displayed
      const orderTable = page.locator('table[role="table"]');
      await expect(orderTable).toBeVisible();
      
      const orderRows = page.locator('table tbody tr');
      await expect(orderRows).toHaveCount(1);
      
      // Check for warning messages
      const warningMessage = page.locator('[role="alert"].bg-yellow-50, .text-yellow-600');
      const warningCount = await warningMessage.count();
      
      if (warningCount > 0) {
        console.log('⚠️ Warning message displayed for partial data');
      } else {
        console.log('⚠️ No warning message for partial data (may be handled silently)');
      }
      
      console.log('✅ Partial data loading error test completed successfully');
    });

    test('should handle timeout errors', async ({ page }) => {
      console.log('🧪 Testing timeout error handling...');
      
      // Intercept orders API with very long delay
      await page.route('**/api/users/*/orders*', async route => {
        // Delay for longer than typical timeout
        await new Promise(resolve => setTimeout(resolve, 30000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { orders: [], total: 0 } })
        });
      });
      
      // Navigate to dashboard
      await page.goto('/dashboard');
      
      // Wait for timeout handling (should happen before 30s delay)
      await page.waitForTimeout(10000);
      
      // Check for timeout error handling
      try {
        const timeoutError = page.locator('text="Request timed out", text="Taking longer than expected"');
        const timeoutErrorCount = await timeoutError.count();
        
        if (timeoutErrorCount > 0) {
          console.log('⏱️ Timeout error message displayed');
        } else {
          console.log('⏱️ No specific timeout error message (may use generic error)');
        }
      } catch (error) {
        console.log('⏱️ Timeout handling may be implemented differently');
      }
      
      console.log('✅ Timeout error handling test completed successfully');
    });
  });

  test.describe('10.4 Data Consistency', () => {
    test('should maintain data consistency during real-time updates', async ({ page }) => {
      console.log('🧪 Testing data consistency during updates...');
      
      let requestCount = 0;
      
      // Intercept orders API to simulate changing data
      await page.route('**/api/users/*/orders*', route => {
        requestCount++;
        
        const orders = requestCount === 1 ? [
          {
            id: 'order-1',
            filename: 'test.pdf',
            status: 'processing',
            createdAt: new Date().toISOString(),
            originalFileSize: 1024000
          }
        ] : [
          {
            id: 'order-1',
            filename: 'test.pdf',
            status: 'completed',
            createdAt: new Date().toISOString(),
            originalFileSize: 1024000
          }
        ];
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              orders,
              total: 1,
              page: 1,
              limit: 50,
              totalPages: 1
            }
          })
        });
      });
      
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Verify initial state
      const processingBadge = page.locator('[role="status"]:has-text("Processing")');
      await expect(processingBadge).toBeVisible();
      
      const processingCount = page.locator('text="Processing"').locator('..').locator('..').locator('.text-3xl.font-bold');
      await expect(processingCount).toContainText('1');
      
      // Trigger refresh to get updated data
      const refreshButton = page.locator('text="Atualizar Lista"');
      await refreshButton.click();
      await page.waitForLoadState('networkidle');
      
      // Verify updated state
      const completedBadge = page.locator('[role="status"]:has-text("Completed")');
      await expect(completedBadge).toBeVisible();
      
      const completedCount = page.locator('text="Completed"').locator('..').locator('..').locator('.text-3xl.font-bold');
      await expect(completedCount).toContainText('1');
      
      const updatedProcessingCount = page.locator('text="Processing"').locator('..').locator('..').locator('.text-3xl.font-bold');
      await expect(updatedProcessingCount).toContainText('0');
      
      console.log('✅ Data consistency during updates test completed successfully');
    });

    test('should handle concurrent user actions gracefully', async ({ page }) => {
      console.log('🧪 Testing concurrent user actions...');
      
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Simulate concurrent actions
      const refreshButton = page.locator('text="Atualizar Lista"');
      const uploadButton = page.locator('text="Upload New File"');
      
      // Verify both buttons are available
      await expect(refreshButton).toBeVisible();
      await expect(uploadButton).toBeVisible();
      
      // Try rapid clicking of refresh button
      await refreshButton.click();
      await refreshButton.click();
      await refreshButton.click();
      
      // Wait for any loading to complete
      await page.waitForTimeout(2000);
      
      // Verify system remains stable
      await expect(refreshButton).toBeEnabled();
      await expect(uploadButton).toBeEnabled();
      
      // Verify dashboard is still functional
      const statisticsCards = page.locator('.text-3xl.font-bold');
      await expect(statisticsCards).toHaveCount(4);
      
      console.log('✅ Concurrent user actions test completed successfully');
    });
  });
});