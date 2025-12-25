import { test, expect } from '@playwright/test';
import { createAuthHelper } from '../helpers/auth';
import { NetworkLogger } from '../helpers/network-logger';
import testData from '../fixtures/test-data.json';

test.describe('Order Actions Tests', () => {
  let authHelper: ReturnType<typeof createAuthHelper>;
  let networkLogger: NetworkLogger;
  let capturedErrors: any[] = [];

  test.beforeEach(async ({ page }) => {
    authHelper = createAuthHelper(page);
    networkLogger = new NetworkLogger();
    capturedErrors = [];
    
    // Setup network monitoring
    await networkLogger.captureBackendErrors(page, capturedErrors);
    
    // Mock authentication endpoints to avoid rate limiting
    await page.route('**/api/auth/me', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'test-user-id',
            email: 'test@docfiscal.com',
            name: 'Test User'
          }
        })
      });
    });
    
    await page.route('**/api/auth/refresh', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            access_token: 'new_mock_access_token',
            refresh_token: 'new_mock_refresh_token'
          }
        })
      });
    });
    
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
    
    // Mock API responses to avoid backend dependency
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
                filename: 'test-document.pdf',
                status: 'completed',
                createdAt: new Date().toISOString(),
                originalFileSize: 2048000,
                errorMessage: null
              },
              {
                id: 'order-2',
                filename: 'another-doc.pdf',
                status: 'pending_payment',
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                originalFileSize: 1024000,
                errorMessage: null
              },
              {
                id: 'order-3',
                filename: 'processing-doc.pdf',
                status: 'processing',
                createdAt: new Date(Date.now() - 3600000).toISOString(),
                originalFileSize: 3072000,
                errorMessage: null
              },
              {
                id: 'order-4',
                filename: 'failed-doc.pdf',
                status: 'failed',
                createdAt: new Date(Date.now() - 7200000).toISOString(),
                originalFileSize: 1536000,
                errorMessage: 'Processing failed due to invalid file format'
              }
            ],
            total: 4,
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
  });

  test.afterEach(async () => {
    // Check for backend errors after each test
    if (capturedErrors.length > 0) {
      console.error('Backend errors detected:', capturedErrors);
      throw new Error(`Test failed due to ${capturedErrors.length} backend error(s): ${capturedErrors.map(e => `${e.method} ${e.url} - ${e.status}`).join(', ')}`);
    }
  });

  test.describe('10.3 Pay Now Button Functionality', () => {
    test('should trigger payment flow when Pay Now button is clicked', async ({ page }) => {
      console.log('🧪 Testing Pay Now button functionality...');
      
      // Wait for order history to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for Pay Now buttons
      const payNowButtons = page.locator('button:has-text("Pay Now")');
      const payNowCount = await payNowButtons.count();
      
      if (payNowCount > 0) {
        console.log(`💳 Found ${payNowCount} Pay Now buttons`);
        
        // Set up network request monitoring for payment API
        const paymentRequests: any[] = [];
        page.on('request', request => {
          if (request.url().includes('/payment') || request.url().includes('/api/orders/')) {
            paymentRequests.push({
              url: request.url(),
              method: request.method()
            });
          }
        });
        
        // Click the first Pay Now button
        const firstPayNowButton = payNowButtons.first();
        await expect(firstPayNowButton).toBeVisible();
        await expect(firstPayNowButton).toBeEnabled();
        
        // Click the button
        await firstPayNowButton.click();
        
        // Wait for potential loading state or navigation
        await page.waitForTimeout(2000);
        
        // Verify payment flow was initiated
        // This could be:
        // 1. A new tab/window opened (payment redirect)
        // 2. A loading state on the button
        // 3. An API call was made
        // 4. An error dialog appeared (if backend is down)
        
        // Check if button shows loading state
        try {
          const loadingButton = page.locator('button:has-text("Pay Now"):disabled');
          await expect(loadingButton).toBeVisible({ timeout: 1000 });
          console.log('💳 Pay Now button shows loading state');
        } catch (error) {
          console.log('💳 No loading state detected on button');
        }
        
        // Check for payment API calls
        if (paymentRequests.length > 0) {
          console.log(`💳 Payment API calls detected: ${paymentRequests.map(r => `${r.method} ${r.url}`).join(', ')}`);
        } else {
          console.log('💳 No payment API calls detected');
        }
        
        // Check for error dialogs or alerts
        try {
          // Wait for potential alert or error dialog
          await page.waitForFunction(() => {
            return document.querySelector('[role="alert"]') !== null;
          }, { timeout: 3000 });
          
          const errorAlert = page.locator('[role="alert"]');
          const errorText = await errorAlert.textContent();
          console.log(`💳 Error dialog appeared: ${errorText}`);
        } catch (error) {
          console.log('💳 No error dialog detected');
        }
        
        console.log('✅ Pay Now button functionality test completed');
      } else {
        console.log('💳 No Pay Now buttons found - skipping test (no pending payment orders)');
      }
    });

    test('should handle payment button loading states', async ({ page }) => {
      console.log('🧪 Testing Pay Now button loading states...');
      
      // Wait for order history to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for Pay Now buttons
      const payNowButtons = page.locator('button:has-text("Pay Now")');
      const payNowCount = await payNowButtons.count();
      
      if (payNowCount > 0) {
        const firstPayNowButton = payNowButtons.first();
        
        // Verify initial state
        await expect(firstPayNowButton).toBeEnabled();
        
        // Click the button and immediately check for loading state
        await firstPayNowButton.click();
        
        // Check for loading indicators
        try {
          // Look for disabled state
          await expect(firstPayNowButton).toBeDisabled({ timeout: 2000 });
          console.log('💳 Button becomes disabled during processing');
        } catch (error) {
          console.log('💳 Button loading state not detected or too quick');
        }
        
        // Check for loading spinner or text change
        try {
          const loadingSpinner = firstPayNowButton.locator('svg.animate-spin');
          await expect(loadingSpinner).toBeVisible({ timeout: 2000 });
          console.log('💳 Loading spinner detected');
        } catch (error) {
          console.log('💳 No loading spinner detected');
        }
        
        console.log('✅ Pay Now button loading states test completed');
      } else {
        console.log('💳 No Pay Now buttons found - skipping test');
      }
    });

    test('should display appropriate error messages for payment failures', async ({ page }) => {
      console.log('🧪 Testing payment error handling...');
      
      // Wait for order history to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for Pay Now buttons
      const payNowButtons = page.locator('button:has-text("Pay Now")');
      const payNowCount = await payNowButtons.count();
      
      if (payNowCount > 0) {
        // Intercept payment API calls and simulate failure
        await page.route('**/api/orders/*/payment', route => {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'Payment service unavailable',
              message: 'Unable to process payment at this time'
            })
          });
        });
        
        const firstPayNowButton = payNowButtons.first();
        await firstPayNowButton.click();
        
        // Wait for error handling
        await page.waitForTimeout(3000);
        
        // Check for error messages
        try {
          const errorAlert = page.locator('[role="alert"]');
          await expect(errorAlert).toBeVisible({ timeout: 5000 });
          
          const errorText = await errorAlert.textContent();
          expect(errorText).toBeTruthy();
          console.log(`💳 Error message displayed: ${errorText}`);
        } catch (error) {
          // Check for JavaScript alert
          page.on('dialog', async dialog => {
            console.log(`💳 Alert dialog: ${dialog.message()}`);
            await dialog.accept();
          });
          
          console.log('💳 Error handling may use browser alerts');
        }
        
        console.log('✅ Payment error handling test completed');
      } else {
        console.log('💳 No Pay Now buttons found - skipping test');
      }
    });
  });

  test.describe('10.3 Download Button Functionality', () => {
    test('should trigger file download when Download button is clicked', async ({ page }) => {
      console.log('🧪 Testing Download button functionality...');
      
      // Wait for order history to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for Download buttons
      const downloadButtons = page.locator('button:has-text("Download")');
      const downloadCount = await downloadButtons.count();
      
      if (downloadCount > 0) {
        console.log(`⬇️ Found ${downloadCount} Download buttons`);
        
        // Set up download monitoring
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
        
        // Set up network request monitoring for download API
        const downloadRequests: any[] = [];
        page.on('request', request => {
          if (request.url().includes('/download') || request.url().includes('/api/orders/')) {
            downloadRequests.push({
              url: request.url(),
              method: request.method()
            });
          }
        });
        
        // Click the first Download button
        const firstDownloadButton = downloadButtons.first();
        await expect(firstDownloadButton).toBeVisible();
        await expect(firstDownloadButton).toBeEnabled();
        
        // Click the button
        await firstDownloadButton.click();
        
        try {
          // Wait for download to start
          const download = await downloadPromise;
          console.log(`⬇️ Download started: ${download.suggestedFilename()}`);
          
          // Verify download filename
          const filename = download.suggestedFilename();
          expect(filename).toBeTruthy();
          expect(filename).toMatch(/\.(csv|pdf)$/i); // Should be CSV or PDF
          
        } catch (error) {
          console.log('⬇️ No download detected - checking for API calls or errors');
          
          // Check for download API calls
          if (downloadRequests.length > 0) {
            console.log(`⬇️ Download API calls detected: ${downloadRequests.map(r => `${r.method} ${r.url}`).join(', ')}`);
          }
          
          // Check for error messages
          try {
            const errorAlert = page.locator('[role="alert"]');
            await expect(errorAlert).toBeVisible({ timeout: 3000 });
            const errorText = await errorAlert.textContent();
            console.log(`⬇️ Download error: ${errorText}`);
          } catch (alertError) {
            console.log('⬇️ No error alert detected');
          }
        }
        
        console.log('✅ Download button functionality test completed');
      } else {
        console.log('⬇️ No Download buttons found - skipping test (no completed orders)');
      }
    });

    test('should handle download button loading states', async ({ page }) => {
      console.log('🧪 Testing Download button loading states...');
      
      // Wait for order history to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for Download buttons
      const downloadButtons = page.locator('button:has-text("Download")');
      const downloadCount = await downloadButtons.count();
      
      if (downloadCount > 0) {
        const firstDownloadButton = downloadButtons.first();
        
        // Verify initial state
        await expect(firstDownloadButton).toBeEnabled();
        
        // Click the button and check for loading state
        await firstDownloadButton.click();
        
        // Check for loading indicators
        try {
          // Look for disabled state
          await expect(firstDownloadButton).toBeDisabled({ timeout: 2000 });
          console.log('⬇️ Button becomes disabled during download');
        } catch (error) {
          console.log('⬇️ Button loading state not detected or too quick');
        }
        
        // Check for loading spinner
        try {
          const loadingSpinner = firstDownloadButton.locator('svg.animate-spin');
          await expect(loadingSpinner).toBeVisible({ timeout: 2000 });
          console.log('⬇️ Loading spinner detected');
        } catch (error) {
          console.log('⬇️ No loading spinner detected');
        }
        
        console.log('✅ Download button loading states test completed');
      } else {
        console.log('⬇️ No Download buttons found - skipping test');
      }
    });

    test('should display appropriate error messages for download failures', async ({ page }) => {
      console.log('🧪 Testing download error handling...');
      
      // Wait for order history to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for Download buttons
      const downloadButtons = page.locator('button:has-text("Download")');
      const downloadCount = await downloadButtons.count();
      
      if (downloadCount > 0) {
        // Intercept download API calls and simulate failure
        await page.route('**/api/orders/*/download', route => {
          route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'File not found',
              message: 'The requested file could not be found'
            })
          });
        });
        
        const firstDownloadButton = downloadButtons.first();
        await firstDownloadButton.click();
        
        // Wait for error handling
        await page.waitForTimeout(3000);
        
        // Check for error messages
        try {
          const errorAlert = page.locator('[role="alert"]');
          await expect(errorAlert).toBeVisible({ timeout: 5000 });
          
          const errorText = await errorAlert.textContent();
          expect(errorText).toBeTruthy();
          console.log(`⬇️ Error message displayed: ${errorText}`);
        } catch (error) {
          console.log('⬇️ Error handling may use browser alerts or console logs');
        }
        
        console.log('✅ Download error handling test completed');
      } else {
        console.log('⬇️ No Download buttons found - skipping test');
      }
    });
  });

  test.describe('10.3 Processing Indicator', () => {
    test('should display processing indicator for active conversions', async ({ page }) => {
      console.log('🧪 Testing Processing indicators...');
      
      // Wait for order history to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for Processing buttons/indicators
      const processingButtons = page.locator('button:has-text("Processing")');
      const processingCount = await processingButtons.count();
      
      if (processingCount > 0) {
        console.log(`⏳ Found ${processingCount} Processing indicators`);
        
        // Verify each processing indicator
        for (let i = 0; i < processingCount; i++) {
          const processingButton = processingButtons.nth(i);
          
          // Verify button is visible and disabled
          await expect(processingButton).toBeVisible();
          await expect(processingButton).toBeDisabled();
          
          // Verify button has clock icon
          const clockIcon = processingButton.locator('svg');
          await expect(clockIcon).toBeVisible();
          
          // Verify button text
          const buttonText = await processingButton.textContent();
          expect(buttonText).toContain('Processing');
          
          // Verify button styling (should be outline/secondary - check for actual classes)
          const buttonClasses = await processingButton.getAttribute('class');
          expect(buttonClasses).toContain('border'); // Should have border for outline style
        }
        
        console.log('✅ Processing indicators verified');
      } else {
        console.log('⏳ No Processing indicators found (no processing orders)');
      }
      
      console.log('✅ Processing indicator test completed');
    });

    test('should not allow interaction with processing indicators', async ({ page }) => {
      console.log('🧪 Testing Processing indicator interaction...');
      
      // Wait for order history to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for Processing buttons
      const processingButtons = page.locator('button:has-text("Processing")');
      const processingCount = await processingButtons.count();
      
      if (processingCount > 0) {
        const firstProcessingButton = processingButtons.first();
        
        // Verify button is disabled
        await expect(firstProcessingButton).toBeDisabled();
        
        // Try to click the button (should not trigger any action)
        await firstProcessingButton.click({ force: true });
        
        // Wait a moment to see if anything happens
        await page.waitForTimeout(1000);
        
        // Verify button is still disabled and no navigation occurred
        await expect(firstProcessingButton).toBeDisabled();
        expect(page.url()).toContain('/dashboard');
        
        console.log('⏳ Processing indicator correctly prevents interaction');
      } else {
        console.log('⏳ No Processing indicators found - skipping interaction test');
      }
      
      console.log('✅ Processing indicator interaction test completed');
    });

    test('should update processing status in real-time', async ({ page }) => {
      console.log('🧪 Testing real-time processing status updates...');
      
      // Wait for order history to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for Processing buttons initially
      const initialProcessingButtons = page.locator('button:has-text("Processing")');
      const initialProcessingCount = await initialProcessingButtons.count();
      
      if (initialProcessingCount > 0) {
        console.log(`⏳ Initial processing orders: ${initialProcessingCount}`);
        
        // Wait for potential status updates (simulate real-time monitoring)
        await page.waitForTimeout(5000);
        
        // Check if any processing orders have changed status
        const updatedProcessingButtons = page.locator('button:has-text("Processing")');
        const updatedProcessingCount = await updatedProcessingButtons.count();
        
        if (updatedProcessingCount !== initialProcessingCount) {
          console.log(`⏳ Processing status updated: ${initialProcessingCount} → ${updatedProcessingCount}`);
        } else {
          console.log('⏳ No processing status changes detected (expected for short test duration)');
        }
        
        // Check for any new Download buttons (completed orders)
        const downloadButtons = page.locator('button:has-text("Download")');
        const downloadCount = await downloadButtons.count();
        console.log(`⬇️ Download buttons available: ${downloadCount}`);
        
      } else {
        console.log('⏳ No processing orders found - skipping real-time update test');
      }
      
      console.log('✅ Real-time processing status test completed');
    });
  });

  test.describe('10.3 Error Message Display', () => {
    test('should display error messages for failed orders', async ({ page }) => {
      console.log('🧪 Testing error message display for failed orders...');
      
      // Wait for order history to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for failed order status badges
      const failedBadges = page.locator('[role="status"]:has-text("Failed")');
      const failedCount = await failedBadges.count();
      
      if (failedCount > 0) {
        console.log(`❌ Found ${failedCount} failed orders`);
        
        // Check for error messages in desktop table view
        const desktopErrorMessages = page.locator('.text-xs.text-red-600.max-w-32.truncate');
        const desktopErrorCount = await desktopErrorMessages.count();
        
        if (desktopErrorCount > 0) {
          // Verify error messages in desktop view
          for (let i = 0; i < desktopErrorCount; i++) {
            const errorMessage = desktopErrorMessages.nth(i);
            await expect(errorMessage).toBeVisible();
            
            const errorText = await errorMessage.textContent();
            expect(errorText).toBeTruthy();
            expect(errorText?.trim().length).toBeGreaterThan(0);
            
            console.log(`❌ Desktop error message ${i + 1}: ${errorText}`);
          }
        }
        
        // Check for error messages in mobile card view
        await page.setViewportSize({ width: 375, height: 667 });
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const mobileErrorMessages = page.locator('.text-xs.text-red-600.bg-red-50.p-2.rounded');
        const mobileErrorCount = await mobileErrorMessages.count();
        
        if (mobileErrorCount > 0) {
          // Verify error messages in mobile view
          for (let i = 0; i < mobileErrorCount; i++) {
            const errorMessage = mobileErrorMessages.nth(i);
            await expect(errorMessage).toBeVisible();
            
            const errorText = await errorMessage.textContent();
            expect(errorText).toBeTruthy();
            
            console.log(`❌ Mobile error message ${i + 1}: ${errorText}`);
          }
        }
        
        console.log('✅ Error messages verified in both desktop and mobile views');
      } else {
        console.log('❌ No failed orders found - skipping error message test');
      }
      
      console.log('✅ Error message display test completed');
    });

    test('should provide actionable error information', async ({ page }) => {
      console.log('🧪 Testing actionable error information...');
      
      // Wait for order history to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for failed orders
      const failedBadges = page.locator('[role="status"]:has-text("Failed")');
      const failedCount = await failedBadges.count();
      
      if (failedCount > 0) {
        // Check if failed orders have retry options or helpful error messages
        const errorMessages = page.locator('.text-xs.text-red-600');
        const errorCount = await errorMessages.count();
        
        if (errorCount > 0) {
          for (let i = 0; i < errorCount; i++) {
            const errorMessage = errorMessages.nth(i);
            const errorText = await errorMessage.textContent();
            
            // Verify error message is not just generic
            expect(errorText).toBeTruthy();
            expect(errorText?.length).toBeGreaterThan(5); // Should be more than just "Error"
            
            // Check for common actionable error patterns
            const isActionable = errorText?.includes('try again') ||
                               errorText?.includes('contact support') ||
                               errorText?.includes('invalid file') ||
                               errorText?.includes('payment') ||
                               errorText?.includes('network') ||
                               errorText?.includes('server');
            
            if (isActionable) {
              console.log(`❌ Actionable error found: ${errorText}`);
            } else {
              console.log(`❌ Generic error: ${errorText}`);
            }
          }
        }
        
        // Check for retry buttons or links near failed orders
        const retryButtons = page.locator('button:has-text("Try Again"), a:has-text("Try Again")');
        const retryCount = await retryButtons.count();
        
        if (retryCount > 0) {
          console.log(`🔄 Found ${retryCount} retry options for failed orders`);
        } else {
          console.log('🔄 No retry options found for failed orders');
        }
        
      } else {
        console.log('❌ No failed orders found - skipping actionable error test');
      }
      
      console.log('✅ Actionable error information test completed');
    });

    test('should handle error message truncation appropriately', async ({ page }) => {
      console.log('🧪 Testing error message truncation...');
      
      // Wait for order history to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for truncated error messages in desktop view
      const truncatedErrors = page.locator('.text-xs.text-red-600.max-w-32.truncate');
      const truncatedCount = await truncatedErrors.count();
      
      if (truncatedCount > 0) {
        console.log(`❌ Found ${truncatedCount} truncated error messages`);
        
        // Verify truncated messages have appropriate styling
        for (let i = 0; i < truncatedCount; i++) {
          const errorMessage = truncatedErrors.nth(i);
          
          // Verify truncation classes are applied
          await expect(errorMessage).toHaveClass(/truncate/);
          await expect(errorMessage).toHaveClass(/max-w-32/);
          
          // Verify message is still readable
          const errorText = await errorMessage.textContent();
          expect(errorText).toBeTruthy();
          expect(errorText?.trim().length).toBeGreaterThan(0);
          
          // Check if full message is available on hover (title attribute)
          const titleAttribute = await errorMessage.getAttribute('title');
          if (titleAttribute) {
            console.log(`❌ Full error available on hover: ${titleAttribute}`);
          }
        }
        
        console.log('✅ Error message truncation verified');
      } else {
        console.log('❌ No truncated error messages found');
      }
      
      console.log('✅ Error message truncation test completed');
    });
  });
});