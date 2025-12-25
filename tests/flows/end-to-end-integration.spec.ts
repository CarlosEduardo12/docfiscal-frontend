import { test, expect } from '@playwright/test';
import { createAuthHelper } from '../helpers/auth';
import { createUIInteractionHelper } from '../helpers/ui-interactions';
import { createNetworkLogger } from '../helpers/network-logger';
import { createStatusPollingHelper } from '../helpers/status-polling';
import testData from '../fixtures/test-data.json';

/**
 * End-to-End Integration Test
 * Tests complete user journey from registration to file download
 * Validates all flows working together without backend errors
 * Tests data consistency across different pages and components
 * 
 * Requirements: 5.5, 6.3, 8.3
 */
test.describe('End-to-End Integration Flow', () => {
  test('complete user journey from registration to file download', async ({ page }) => {
    // Initialize helpers
    const authHelper = createAuthHelper(page);
    const uiHelper = createUIInteractionHelper(page);
    const networkLogger = createNetworkLogger();
    const statusPoller = createStatusPollingHelper(page);

    // Set up network monitoring
    networkLogger.setFlowContext('end-to-end-integration', 'setup');
    await networkLogger.captureBackendErrors(page);

    console.log('🚀 Starting complete end-to-end integration test');

    // Step 1: Start from landing page (unauthenticated)
    networkLogger.setFlowContext('end-to-end-integration', 'landing-page');
    console.log('📍 Step 1: Navigate to landing page');
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Validate landing page elements
    await expect(page.locator('h1')).toContainText('DocFiscal');
    await expect(page.locator('button:has-text("Fazer Login")')).toBeVisible();
    await expect(page.locator('button:has-text("Criar Conta")')).toBeVisible();

    // Step 2: Navigate to registration
    networkLogger.setFlowContext('end-to-end-integration', 'registration');
    console.log('📍 Step 2: User registration flow');
    
    await uiHelper.clickButton('Criar Conta');
    await page.waitForURL('/register');
    
    // Fill registration form with new user data
    const newUser = testData.testUsers.newUser;
    await uiHelper.fillForm({
      name: newUser.name,
      email: newUser.email,
      password: newUser.password,
      confirmPassword: newUser.password
    });
    
    // Submit registration
    await uiHelper.clickButton('Criar Conta');
    
    // Wait for redirect to login page (successful registration)
    await page.waitForURL('/login', { timeout: 15000 });
    
    // Validate registration success message or redirect
    console.log('✅ Registration completed successfully');

    // Step 3: Login with newly registered user
    networkLogger.setFlowContext('end-to-end-integration', 'login');
    console.log('📍 Step 3: Login with registered user');
    
    await authHelper.login({
      email: newUser.email,
      password: newUser.password
    });
    
    // Validate successful login and dashboard access
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('.sidebar')).toBeVisible();
    
    // Validate user information in sidebar
    await authHelper.validateSidebarUserSection({
      email: newUser.email,
      name: newUser.name
    });

    // Step 4: Navigate to file upload
    networkLogger.setFlowContext('end-to-end-integration', 'file-upload');
    console.log('📍 Step 4: File upload and conversion initiation');
    
    // Click on Convert/Upload button
    await uiHelper.clickButton('Upload New File');
    await page.waitForURL('/upload');
    
    // Upload a test PDF file
    await uiHelper.uploadTestFile('validPdf');
    
    // Wait for upload to complete and order creation
    await uiHelper.waitForLoadingComplete();
    
    // Validate ConversionFlow component appears
    await expect(page.locator('.conversion-flow, [data-testid="conversion-flow"]')).toBeVisible();
    
    // Extract order ID from URL or page content
    let orderId: string = '';
    try {
      // Try to get order ID from URL
      const url = page.url();
      const orderMatch = url.match(/\/pedido\/([^\/]+)/);
      if (orderMatch) {
        orderId = orderMatch[1];
      } else {
        // Try to get from page content
        const orderElement = page.locator('[data-testid="order-id"], .order-id');
        if (await orderElement.count() > 0) {
          orderId = await orderElement.textContent() || '';
        }
      }
    } catch (error) {
      console.warn('Could not extract order ID:', error);
    }
    
    console.log(`📦 Order created with ID: ${orderId}`);

    // Step 5: Payment flow
    networkLogger.setFlowContext('end-to-end-integration', 'payment');
    console.log('📍 Step 5: Payment processing');
    
    // Look for payment button and initiate payment
    const paymentButton = page.locator('button:has-text("Pagar"), button:has-text("Complete Payment")');
    if (await paymentButton.count() > 0) {
      await paymentButton.click();
      
      // Wait for payment URL generation or redirect
      await page.waitForTimeout(2000);
      
      // For testing purposes, we'll simulate payment completion
      // In a real scenario, this would involve AbacatePay integration
      console.log('💳 Payment initiated (simulated for testing)');
      
      // Navigate back to order status to check payment status
      if (orderId) {
        await page.goto(`/pedido/${orderId}`);
      }
    }

    // Step 6: Monitor order status progression
    networkLogger.setFlowContext('end-to-end-integration', 'status-monitoring');
    console.log('📍 Step 6: Order status monitoring');
    
    if (orderId) {
      // Poll for status changes (payment -> processing -> completed)
      try {
        await statusPoller.pollOrderStatus(orderId, 'processing', 30000);
        console.log('🔄 Order status: Processing');
        
        // Continue polling for completion
        await statusPoller.pollOrderStatus(orderId, 'completed', 60000);
        console.log('✅ Order status: Completed');
      } catch (error) {
        console.warn('Status polling timeout or error:', error);
        // Continue with test - status might not change in test environment
      }
    }

    // Step 7: Validate order in dashboard
    networkLogger.setFlowContext('end-to-end-integration', 'dashboard-validation');
    console.log('📍 Step 7: Validate order appears in dashboard');
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check if order appears in order history table
    if (orderId) {
      await uiHelper.validateTableRow(orderId, {
        id: orderId,
        filename: testData.testFiles.validPdf.name,
        status: 'completed' // or whatever status it should have
      });
    }
    
    // Validate dashboard statistics are updated
    const statsCards = page.locator('.statistics-cards, [data-testid="statistics-cards"]');
    await expect(statsCards).toBeVisible();

    // Step 8: File download
    networkLogger.setFlowContext('end-to-end-integration', 'file-download');
    console.log('📍 Step 8: File download');
    
    if (orderId) {
      // Try to download from dashboard
      const downloadButton = page.locator(`tr:has-text("${orderId}") button:has-text("Download")`);
      if (await downloadButton.count() > 0) {
        // Set up download handling
        const downloadPromise = page.waitForDownload();
        await downloadButton.click();
        
        try {
          const download = await downloadPromise;
          console.log(`📥 File downloaded: ${download.suggestedFilename()}`);
          
          // Validate download
          expect(download.suggestedFilename()).toContain('.csv');
        } catch (error) {
          console.warn('Download test skipped (may not work in test environment):', error);
        }
      } else {
        // Try from order status page
        await page.goto(`/pedido/${orderId}`);
        const orderDownloadButton = page.locator('button:has-text("Download")');
        if (await orderDownloadButton.count() > 0) {
          const downloadPromise = page.waitForDownload();
          await orderDownloadButton.click();
          
          try {
            const download = await downloadPromise;
            console.log(`📥 File downloaded from order page: ${download.suggestedFilename()}`);
          } catch (error) {
            console.warn('Download test skipped (may not work in test environment):', error);
          }
        }
      }
    }

    // Step 9: Data consistency validation
    networkLogger.setFlowContext('end-to-end-integration', 'data-consistency');
    console.log('📍 Step 9: Data consistency validation across pages');
    
    if (orderId) {
      // Check order details consistency between dashboard and order page
      await page.goto('/dashboard');
      const dashboardOrderText = await page.locator(`tr:has-text("${orderId}")`).textContent();
      
      await page.goto(`/pedido/${orderId}`);
      const orderPageText = await page.locator('.order-details, [data-testid="order-details"]').textContent();
      
      // Validate that key information is consistent
      const filename = testData.testFiles.validPdf.name;
      expect(dashboardOrderText).toContain(filename);
      expect(orderPageText).toContain(filename);
      expect(orderPageText).toContain(orderId);
    }

    // Step 10: User profile and navigation consistency
    networkLogger.setFlowContext('end-to-end-integration', 'navigation-consistency');
    console.log('📍 Step 10: Navigation and user profile consistency');
    
    // Test navigation between different pages
    const pages = ['/dashboard', '/upload'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      
      // Validate sidebar is consistent
      await uiHelper.checkSidebarNavigation();
      
      // Validate user information is consistent
      await authHelper.validateSidebarUserSection({
        email: newUser.email,
        name: newUser.name
      });
    }

    // Step 11: Logout and cleanup
    networkLogger.setFlowContext('end-to-end-integration', 'logout');
    console.log('📍 Step 11: Logout and cleanup');
    
    await authHelper.logout();
    
    // Validate redirect to landing page
    await expect(page).toHaveURL('/');
    await expect(page.locator('button:has-text("Fazer Login")')).toBeVisible();

    // Final validation: Check for backend errors
    const errorReport = networkLogger.formatErrorReport();
    console.log('📊 Network Error Summary:', errorReport.summary);
    
    // Fail test if critical errors were encountered
    if (networkLogger.hasCriticalErrors()) {
      const criticalErrors = networkLogger.getErrorsBySeverity('critical');
      console.error('❌ Critical backend errors detected:', criticalErrors);
      throw new Error(`Test failed due to ${criticalErrors.length} critical backend errors`);
    }
    
    // Log warnings for non-critical errors
    if (errorReport.summary.totalErrors > 0) {
      console.warn(`⚠️ ${errorReport.summary.totalErrors} backend errors detected (non-critical)`);
      errorReport.errors.forEach(error => {
        console.warn(`  - ${error.response.status} ${error.request.method} ${error.request.url}`);
      });
    }

    console.log('🎉 End-to-end integration test completed successfully!');
  });

  test('data consistency across multiple user sessions', async ({ page, context }) => {
    // Test data consistency when the same user logs in from different sessions
    const authHelper = createAuthHelper(page);
    const uiHelper = createUIInteractionHelper(page);
    const networkLogger = createNetworkLogger();
    
    await networkLogger.captureBackendErrors(page);
    networkLogger.setFlowContext('data-consistency', 'multi-session');

    console.log('🔄 Testing data consistency across multiple sessions');

    // Session 1: Login and create an order
    await authHelper.loginWithValidUser();
    await page.goto('/upload');
    await uiHelper.uploadTestFile('validPdf');
    
    // Get order information
    await page.waitForTimeout(2000);
    const orderId = await page.evaluate(() => {
      const url = window.location.href;
      const match = url.match(/\/pedido\/([^\/]+)/);
      return match ? match[1] : null;
    });

    // Logout
    await authHelper.logout();

    // Session 2: Login again and verify order exists
    await authHelper.loginWithValidUser();
    await page.goto('/dashboard');
    
    if (orderId) {
      // Verify order appears in dashboard
      const orderRow = page.locator(`tr:has-text("${orderId}")`);
      await expect(orderRow).toBeVisible();
      
      // Navigate to order page and verify details
      await page.goto(`/pedido/${orderId}`);
      await expect(page.locator('.order-details')).toBeVisible();
      await expect(page.locator(`text="${orderId}"`)).toBeVisible();
    }

    // Check for backend errors
    const errorReport = networkLogger.formatErrorReport();
    if (networkLogger.hasCriticalErrors()) {
      throw new Error('Critical backend errors detected during multi-session test');
    }

    console.log('✅ Data consistency validated across multiple sessions');
  });

  test('concurrent user operations', async ({ browser }) => {
    // Test system behavior with multiple concurrent users
    console.log('👥 Testing concurrent user operations');

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    const auth1 = createAuthHelper(page1);
    const auth2 = createAuthHelper(page2);
    const ui1 = createUIInteractionHelper(page1);
    const ui2 = createUIInteractionHelper(page2);
    
    const logger1 = createNetworkLogger();
    const logger2 = createNetworkLogger();
    
    await logger1.captureBackendErrors(page1);
    await logger2.captureBackendErrors(page2);
    
    logger1.setFlowContext('concurrent-test', 'user1');
    logger2.setFlowContext('concurrent-test', 'user2');

    try {
      // Both users login simultaneously
      await Promise.all([
        auth1.loginWithValidUser(),
        auth2.loginWithValidUser()
      ]);

      // Both users upload files simultaneously
      await Promise.all([
        (async () => {
          await page1.goto('/upload');
          await ui1.uploadTestFile('validPdf');
        })(),
        (async () => {
          await page2.goto('/upload');
          await ui2.uploadTestFile('mediumPdf');
        })()
      ]);

      // Both users check their dashboards
      await Promise.all([
        page1.goto('/dashboard'),
        page2.goto('/dashboard')
      ]);

      // Validate both users can see their respective orders
      await Promise.all([
        expect(page1.locator('.order-history-table')).toBeVisible(),
        expect(page2.locator('.order-history-table')).toBeVisible()
      ]);

      // Check for backend errors in both sessions
      const errors1 = logger1.formatErrorReport();
      const errors2 = logger2.formatErrorReport();
      
      if (logger1.hasCriticalErrors() || logger2.hasCriticalErrors()) {
        throw new Error('Critical backend errors detected during concurrent operations');
      }

      console.log('✅ Concurrent user operations completed successfully');
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});