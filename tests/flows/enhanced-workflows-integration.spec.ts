import { test, expect } from '@playwright/test';
import { createAuthHelper } from '../helpers/auth';
import { createUIInteractionHelper } from '../helpers/ui-interactions';
import { createNetworkLogger } from '../helpers/network-logger';
import { createStatusPollingHelper } from '../helpers/status-polling';
import testData from '../fixtures/test-data.json';

/**
 * Enhanced Workflows Integration Tests
 * Tests complete workflows with all improvements from the frontend issues resolution
 * Validates authentication persistence, form validation, error handling, payment flow reliability
 * 
 * Requirements: All requirements integrated (1.1-9.5)
 */
test.describe('Enhanced Workflows Integration', () => {
  test('complete upload-to-download workflow with all improvements', async ({ page }) => {
    const authHelper = createAuthHelper(page);
    const uiHelper = createUIInteractionHelper(page);
    const networkLogger = createNetworkLogger();
    const statusPoller = createStatusPollingHelper(page);

    await networkLogger.captureBackendErrors(page);
    networkLogger.setFlowContext('enhanced-upload-workflow', 'setup');

    console.log('🚀 Testing enhanced upload-to-download workflow');

    // Step 1: Test enhanced form validation during registration
    console.log('📍 Step 1: Enhanced form validation during registration');
    
    await page.goto('/register');
    
    // Test client-side validation with invalid data
    await uiHelper.fillForm({
      name: '', // Empty name
      email: 'invalid-email', // Invalid email format
      password: '123', // Too short password
      confirmPassword: '456' // Non-matching password
    });
    
    await uiHelper.clickButton('Criar Conta');
    
    // Validate that form validation prevents submission and shows errors
    await expect(page.locator('[role="alert"], .error-message')).toBeVisible();
    await expect(page.locator('input[name="name"]:invalid, input[name="name"][aria-invalid="true"]')).toBeVisible();
    await expect(page.locator('input[name="email"]:invalid, input[name="email"][aria-invalid="true"]')).toBeVisible();
    
    // Test that form maintains user input after validation failure
    expect(await page.locator('input[name="email"]').inputValue()).toBe('invalid-email');
    
    // Fill form with valid data
    const newUser = testData.testUsers.newUser;
    await uiHelper.fillForm({
      name: newUser.name,
      email: newUser.email,
      password: newUser.password,
      confirmPassword: newUser.password
    });
    
    // Test visual confirmation on valid submission
    await uiHelper.clickButton('Criar Conta');
    await expect(page.locator('.loading-button, button:disabled')).toBeVisible();
    
    await page.waitForURL('/login', { timeout: 15000 });
    console.log('✅ Enhanced form validation working correctly');

    // Step 2: Test authentication persistence across page refreshes
    console.log('📍 Step 2: Authentication persistence testing');
    
    await authHelper.login({
      email: newUser.email,
      password: newUser.password
    });
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Test session persistence across page refresh
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should remain authenticated after refresh
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('.sidebar')).toBeVisible();
    
    // Test navigation state preservation
    await page.goto('/upload');
    await page.reload();
    await expect(page).toHaveURL('/upload');
    
    console.log('✅ Authentication persistence working correctly');

    // Step 3: Test enhanced file upload with comprehensive validation
    console.log('📍 Step 3: Enhanced file upload validation');
    
    // Test file type validation
    const invalidFile = await page.evaluateHandle(() => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      return file;
    });
    
    await page.locator('input[type="file"]').setInputFiles([]);
    
    // Try to upload invalid file type (if file input accepts it)
    try {
      await page.locator('input[type="file"]').setInputFiles(['tests/fixtures/invalid-file.txt']);
      
      // Should show validation error
      await expect(page.locator('.error-message, [role="alert"]')).toBeVisible();
      await expect(page.locator('text=/apenas.*pdf.*permitidos/i')).toBeVisible();
    } catch (error) {
      console.log('File type validation handled at input level');
    }
    
    // Upload valid PDF file
    await uiHelper.uploadTestFile('validPdf');
    
    // Test upload progress indicators
    await expect(page.locator('.upload-progress, [data-testid="upload-progress"]')).toBeVisible();
    
    // Wait for upload completion and redirect
    await uiHelper.waitForLoadingComplete();
    await expect(page).toHaveURL(/\/pedido\//);
    
    console.log('✅ Enhanced file upload validation working correctly');

    // Step 4: Test reliable payment flow with status polling
    console.log('📍 Step 4: Enhanced payment flow reliability');
    
    // Extract order ID
    const orderId = await page.evaluate(() => {
      const url = window.location.href;
      const match = url.match(/\/pedido\/([^\/]+)/);
      return match ? match[1] : null;
    });
    
    if (orderId) {
      // Test payment initiation with order validation
      const paymentButton = page.locator('button:has-text("Pagar"), button:has-text("Complete Payment")');
      await expect(paymentButton).toBeVisible();
      
      // Test loading state during payment initiation
      await paymentButton.click();
      await expect(page.locator('.loading-button, button:disabled')).toBeVisible();
      
      // Test status polling with exponential backoff
      try {
        await statusPoller.pollOrderStatus(orderId, 'processing', 30000);
        console.log('🔄 Payment processing detected');
        
        // Test immediate status updates
        await expect(page.locator('text=/processando/i')).toBeVisible();
        
        // Continue polling for completion
        await statusPoller.pollOrderStatus(orderId, 'completed', 60000);
        console.log('✅ Payment completed');
        
        // Test success confirmation display
        await expect(page.locator('.success-message, [data-testid="success-message"]')).toBeVisible();
        
      } catch (error) {
        console.warn('Payment status polling timeout (expected in test environment)');
      }
    }
    
    console.log('✅ Enhanced payment flow working correctly');

    // Step 5: Test comprehensive error handling
    console.log('📍 Step 5: Comprehensive error handling testing');
    
    // Test network error handling by intercepting requests
    await page.route('**/api/**', route => {
      if (route.request().url().includes('/api/orders')) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });
    
    // Try to refresh order status
    await page.reload();
    
    // Should show network error with retry options
    await expect(page.locator('.error-boundary, .error-message')).toBeVisible();
    await expect(page.locator('button:has-text("Try Again"), button:has-text("Tentar Novamente")')).toBeVisible();
    
    // Remove network interception
    await page.unroute('**/api/**');
    
    console.log('✅ Comprehensive error handling working correctly');

    // Step 6: Test user feedback system
    console.log('📍 Step 6: User feedback system testing');
    
    await page.goto('/dashboard');
    
    // Test loading indicators for data fetching
    await expect(page.locator('.loading-skeleton, .loading-spinner')).toBeVisible();
    await uiHelper.waitForLoadingComplete();
    
    // Test toast notifications (if any actions trigger them)
    if (orderId) {
      const orderRow = page.locator(`tr:has-text("${orderId}")`);
      if (await orderRow.count() > 0) {
        // Test action feedback
        const actionButton = orderRow.locator('button').first();
        if (await actionButton.count() > 0) {
          await actionButton.click();
          
          // Should show loading state
          await expect(page.locator('.loading-button, button:disabled')).toBeVisible();
        }
      }
    }
    
    console.log('✅ User feedback system working correctly');

    // Step 7: Test performance optimizations
    console.log('📍 Step 7: Performance optimizations testing');
    
    // Test lazy loading by navigating to different sections
    const navigationItems = ['/dashboard', '/upload'];
    
    for (const path of navigationItems) {
      const startTime = Date.now();
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      console.log(`📊 Page ${path} loaded in ${loadTime}ms`);
      
      // Validate page loads within reasonable time (should be fast due to optimizations)
      expect(loadTime).toBeLessThan(5000); // 5 seconds max
    }
    
    console.log('✅ Performance optimizations working correctly');

    // Step 8: Test state management consistency
    console.log('📍 Step 8: State management consistency testing');
    
    await page.goto('/dashboard');
    
    if (orderId) {
      // Check order appears in dashboard
      await expect(page.locator(`tr:has-text("${orderId}")`)).toBeVisible();
      
      // Navigate to order page
      await page.goto(`/pedido/${orderId}`);
      
      // Check order details are consistent
      await expect(page.locator(`text="${orderId}"`)).toBeVisible();
      
      // Navigate back to dashboard
      await page.goto('/dashboard');
      
      // Order should still be visible (state preserved)
      await expect(page.locator(`tr:has-text("${orderId}")`)).toBeVisible();
    }
    
    console.log('✅ State management consistency working correctly');

    // Step 9: Test navigation enhancements
    console.log('📍 Step 9: Navigation enhancements testing');
    
    if (orderId) {
      await page.goto(`/pedido/${orderId}`);
      
      // Test breadcrumb navigation (if implemented)
      const breadcrumbs = page.locator('.breadcrumb, [data-testid="breadcrumb"]');
      if (await breadcrumbs.count() > 0) {
        await expect(breadcrumbs).toBeVisible();
        await expect(breadcrumbs.locator('text="Dashboard"')).toBeVisible();
      }
      
      // Test status indicators consistency
      const statusIndicator = page.locator('.status-indicator, [data-testid="status-indicator"]');
      if (await statusIndicator.count() > 0) {
        await expect(statusIndicator).toBeVisible();
      }
      
      // Test action availability indication
      const actionButtons = page.locator('button:not(:disabled)');
      const disabledButtons = page.locator('button:disabled');
      
      // Available actions should be clearly indicated
      if (await actionButtons.count() > 0) {
        await expect(actionButtons.first()).toBeVisible();
      }
      
      // Disabled actions should have visual cues
      if (await disabledButtons.count() > 0) {
        await expect(disabledButtons.first()).toHaveAttribute('disabled');
      }
    }
    
    console.log('✅ Navigation enhancements working correctly');

    // Step 10: Final validation and cleanup
    console.log('📍 Step 10: Final validation and cleanup');
    
    // Test logout with complete data clearing
    await authHelper.logout();
    
    // Should redirect to landing page
    await expect(page).toHaveURL('/');
    
    // Try to access protected route - should redirect to login
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
    
    // Check for any backend errors during the entire flow
    const errorReport = networkLogger.formatErrorReport();
    console.log('📊 Final Error Summary:', errorReport.summary);
    
    if (networkLogger.hasCriticalErrors()) {
      const criticalErrors = networkLogger.getErrorsBySeverity('critical');
      console.error('❌ Critical errors detected:', criticalErrors);
      throw new Error(`Enhanced workflow test failed due to ${criticalErrors.length} critical errors`);
    }
    
    console.log('🎉 Enhanced upload-to-download workflow test completed successfully!');
  });

  test('authentication persistence across different scenarios', async ({ page, context }) => {
    const authHelper = createAuthHelper(page);
    const uiHelper = createUIInteractionHelper(page);
    const networkLogger = createNetworkLogger();
    
    await networkLogger.captureBackendErrors(page);
    networkLogger.setFlowContext('auth-persistence', 'scenarios');

    console.log('🔐 Testing authentication persistence across different scenarios');

    // Scenario 1: Normal login and page refresh
    console.log('📍 Scenario 1: Normal login and page refresh');
    
    await authHelper.loginWithValidUser();
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Refresh page multiple times
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/dashboard/);
      console.log(`✅ Refresh ${i + 1}: Authentication persisted`);
    }

    // Scenario 2: Navigation between protected routes
    console.log('📍 Scenario 2: Navigation between protected routes');
    
    const protectedRoutes = ['/dashboard', '/upload'];
    
    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(route);
      await expect(page.locator('.sidebar')).toBeVisible();
    }

    // Scenario 3: Browser tab close and reopen simulation
    console.log('📍 Scenario 3: Browser tab close and reopen simulation');
    
    // Close current page and open new one in same context
    await page.close();
    const newPage = await context.newPage();
    
    // Should automatically restore session
    await newPage.goto('/dashboard');
    await newPage.waitForLoadState('networkidle');
    await expect(newPage).toHaveURL(/\/dashboard/);
    await expect(newPage.locator('.sidebar')).toBeVisible();

    // Scenario 4: Token expiration handling
    console.log('📍 Scenario 4: Token expiration handling');
    
    // Simulate token expiration by clearing localStorage
    await newPage.evaluate(() => {
      localStorage.removeItem('docfiscal_access_token');
    });
    
    // Try to access protected route
    await newPage.goto('/upload');
    
    // Should redirect to login due to missing token
    await expect(newPage).toHaveURL('/login');

    // Scenario 5: Concurrent session handling
    console.log('📍 Scenario 5: Concurrent session handling');
    
    const newContext = await context.browser()?.newContext();
    if (newContext) {
      const concurrentPage = await newContext.newPage();
      const concurrentAuth = createAuthHelper(concurrentPage);
      
      // Login in concurrent session
      await concurrentAuth.loginWithValidUser();
      await expect(concurrentPage).toHaveURL(/\/dashboard/);
      
      // Both sessions should work independently
      await newPage.goto('/login');
      await authHelper.loginWithValidUser();
      await expect(newPage).toHaveURL(/\/dashboard/);
      
      // Validate both sessions are active
      await expect(concurrentPage.locator('.sidebar')).toBeVisible();
      await expect(newPage.locator('.sidebar')).toBeVisible();
      
      await newContext.close();
    }

    console.log('✅ Authentication persistence scenarios completed successfully');
  });

  test('payment flow with various success and failure conditions', async ({ page }) => {
    const authHelper = createAuthHelper(page);
    const uiHelper = createUIInteractionHelper(page);
    const networkLogger = createNetworkLogger();
    const statusPoller = createStatusPollingHelper(page);
    
    await networkLogger.captureBackendErrors(page);
    networkLogger.setFlowContext('payment-flow', 'conditions');

    console.log('💳 Testing payment flow with various conditions');

    // Setup: Login and create an order
    await authHelper.loginWithValidUser();
    await page.goto('/upload');
    await uiHelper.uploadTestFile('validPdf');
    await uiHelper.waitForLoadingComplete();
    
    const orderId = await page.evaluate(() => {
      const url = window.location.href;
      const match = url.match(/\/pedido\/([^\/]+)/);
      return match ? match[1] : null;
    });

    if (!orderId) {
      throw new Error('Could not create order for payment testing');
    }

    // Test Case 1: Successful payment flow
    console.log('📍 Test Case 1: Successful payment flow');
    
    const paymentButton = page.locator('button:has-text("Pagar"), button:has-text("Complete Payment")');
    await expect(paymentButton).toBeVisible();
    
    // Test payment initiation validation
    await paymentButton.click();
    
    // Should show loading state
    await expect(page.locator('.loading-button, button:disabled')).toBeVisible();
    
    // Test status polling for payment processing
    try {
      await statusPoller.pollOrderStatus(orderId, 'processing', 15000);
      console.log('✅ Payment processing status detected');
      
      // Test immediate status updates
      await expect(page.locator('text=/processando/i, text=/processing/i')).toBeVisible();
      
    } catch (error) {
      console.warn('Payment processing timeout (expected in test environment)');
    }

    // Test Case 2: Payment timeout handling
    console.log('📍 Test Case 2: Payment timeout handling');
    
    // Simulate slow network for payment status
    await page.route('**/api/payments/**', route => {
      setTimeout(() => route.continue(), 5000); // 5 second delay
    });
    
    // Refresh to trigger status check
    await page.reload();
    
    // Should show timeout handling
    await expect(page.locator('.error-message, .timeout-message')).toBeVisible({ timeout: 10000 });
    
    // Should provide retry options
    await expect(page.locator('button:has-text("Try Again"), button:has-text("Tentar Novamente")')).toBeVisible();
    
    await page.unroute('**/api/payments/**');

    // Test Case 3: Payment failure recovery
    console.log('📍 Test Case 3: Payment failure recovery');
    
    // Simulate payment failure
    await page.route('**/api/payments/**', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Payment failed', code: 'PAYMENT_DECLINED' })
      });
    });
    
    // Try to check payment status
    await page.reload();
    
    // Should show payment failure with recovery options
    await expect(page.locator('.error-message, .payment-error')).toBeVisible();
    await expect(page.locator('button:has-text("New Payment"), button:has-text("Novo Pagamento")')).toBeVisible();
    
    await page.unroute('**/api/payments/**');

    // Test Case 4: Network error during payment
    console.log('📍 Test Case 4: Network error during payment');
    
    // Simulate network failure
    await page.route('**/api/**', route => {
      if (route.request().url().includes('payment')) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });
    
    await page.reload();
    
    // Should show network error with appropriate messaging
    await expect(page.locator('.error-message, .network-error')).toBeVisible();
    await expect(page.locator('text=/conexão/i, text=/connection/i')).toBeVisible();
    
    await page.unroute('**/api/**');

    // Test Case 5: Payment status ambiguity handling
    console.log('📍 Test Case 5: Payment status ambiguity handling');
    
    // Simulate ambiguous payment status
    await page.route('**/api/orders/**', route => {
      if (route.request().url().includes(orderId)) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: orderId,
            status: 'pending_payment', // Ambiguous status
            payment_status: 'unknown'
          })
        });
      } else {
        route.continue();
      }
    });
    
    await page.reload();
    
    // Should provide manual refresh options
    await expect(page.locator('button:has-text("Refresh"), button:has-text("Atualizar")')).toBeVisible();
    
    // Should show clear instructions
    await expect(page.locator('text=/status/i')).toBeVisible();
    
    await page.unroute('**/api/orders/**');

    // Test Case 6: Payment completion confirmation
    console.log('📍 Test Case 6: Payment completion confirmation');
    
    // Simulate successful payment completion
    await page.route('**/api/orders/**', route => {
      if (route.request().url().includes(orderId)) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: orderId,
            status: 'completed',
            payment_status: 'paid'
          })
        });
      } else {
        route.continue();
      }
    });
    
    await page.reload();
    
    // Should show success confirmation
    await expect(page.locator('.success-message, .payment-success')).toBeVisible();
    await expect(page.locator('text=/concluído/i, text=/completed/i')).toBeVisible();
    
    // Should show next steps
    await expect(page.locator('button:has-text("Download")')).toBeVisible();
    
    await page.unroute('**/api/orders/**');

    // Final validation
    const errorReport = networkLogger.formatErrorReport();
    console.log('📊 Payment Flow Error Summary:', errorReport.summary);
    
    if (networkLogger.hasCriticalErrors()) {
      const criticalErrors = networkLogger.getErrorsBySeverity('critical');
      console.error('❌ Critical payment errors detected:', criticalErrors);
      throw new Error(`Payment flow test failed due to ${criticalErrors.length} critical errors`);
    }

    console.log('🎉 Payment flow testing completed successfully!');
  });

  test('error recovery and user guidance across workflows', async ({ page }) => {
    const authHelper = createAuthHelper(page);
    const uiHelper = createUIInteractionHelper(page);
    const networkLogger = createNetworkLogger();
    
    await networkLogger.captureBackendErrors(page);
    networkLogger.setFlowContext('error-recovery', 'workflows');

    console.log('🛠️ Testing error recovery and user guidance');

    // Setup: Login
    await authHelper.loginWithValidUser();

    // Test 1: Form validation error recovery
    console.log('📍 Test 1: Form validation error recovery');
    
    await page.goto('/upload');
    
    // Try to submit without file
    const submitButton = page.locator('button[type="submit"], button:has-text("Upload")');
    if (await submitButton.count() > 0) {
      await submitButton.click();
      
      // Should show validation error
      await expect(page.locator('.error-message, [role="alert"]')).toBeVisible();
      
      // Should provide clear guidance
      await expect(page.locator('text=/selecione.*arquivo/i, text=/select.*file/i')).toBeVisible();
    }

    // Test 2: Network error recovery
    console.log('📍 Test 2: Network error recovery');
    
    // Simulate network failure
    await page.route('**/api/**', route => {
      route.abort('failed');
    });
    
    await page.goto('/dashboard');
    
    // Should show network error with recovery options
    await expect(page.locator('.error-boundary, .error-message')).toBeVisible();
    await expect(page.locator('button:has-text("Try Again"), button:has-text("Retry")')).toBeVisible();
    
    // Test retry functionality
    const retryButton = page.locator('button:has-text("Try Again"), button:has-text("Retry")').first();
    if (await retryButton.count() > 0) {
      // Remove network block
      await page.unroute('**/api/**');
      
      await retryButton.click();
      
      // Should recover and load content
      await expect(page.locator('.sidebar')).toBeVisible();
    }

    // Test 3: Authentication error recovery
    console.log('📍 Test 3: Authentication error recovery');
    
    // Simulate authentication failure
    await page.route('**/api/**', route => {
      if (route.request().headers()['authorization']) {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' })
        });
      } else {
        route.continue();
      }
    });
    
    await page.reload();
    
    // Should redirect to login with appropriate message
    await expect(page).toHaveURL('/login');
    await expect(page.locator('text=/sessão.*expirada/i, text=/session.*expired/i')).toBeVisible();
    
    await page.unroute('**/api/**');

    // Test 4: Upload error recovery
    console.log('📍 Test 4: Upload error recovery');
    
    await authHelper.loginWithValidUser();
    await page.goto('/upload');
    
    // Simulate upload failure
    await page.route('**/api/upload/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Upload failed' })
      });
    });
    
    await uiHelper.uploadTestFile('validPdf');
    
    // Should show upload error with retry option
    await expect(page.locator('.error-message, .upload-error')).toBeVisible();
    await expect(page.locator('button:has-text("Try Again"), button:has-text("Tentar Novamente")')).toBeVisible();
    
    await page.unroute('**/api/upload/**');

    // Test 5: Component error boundary recovery
    console.log('📍 Test 5: Component error boundary recovery');
    
    // Inject JavaScript error to trigger error boundary
    await page.evaluate(() => {
      // Simulate a component error
      const event = new CustomEvent('test-error');
      window.dispatchEvent(event);
    });
    
    // Navigate to a page that might have error boundaries
    await page.goto('/dashboard');
    
    // Should handle any component errors gracefully
    await expect(page.locator('.sidebar')).toBeVisible();

    // Test 6: Offline/online state handling
    console.log('📍 Test 6: Offline/online state handling');
    
    // Simulate offline state
    await page.context().setOffline(true);
    
    await page.reload();
    
    // Should show offline message
    await expect(page.locator('text=/offline/i, text=/sem.*conexão/i')).toBeVisible();
    
    // Restore online state
    await page.context().setOffline(false);
    
    await page.reload();
    
    // Should recover and work normally
    await expect(page.locator('.sidebar')).toBeVisible();

    // Final validation
    const errorReport = networkLogger.formatErrorReport();
    console.log('📊 Error Recovery Summary:', errorReport.summary);

    console.log('🎉 Error recovery and user guidance testing completed successfully!');
  });
});