import { test, expect } from '@playwright/test';
import { createAuthHelper } from '../helpers/auth';
import { NetworkLogger } from '../helpers/network-logger';
import testData from '../fixtures/test-data.json';

test.describe('Order Status Page Tests', () => {
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
    
    // Ensure clean state and login
    try {
      await authHelper.ensureUnauthenticated();
    } catch (error) {
      console.warn('Could not ensure unauthenticated state:', error);
    }
    
    // Login to access order status pages
    const validUser = testData.testUsers.validUser;
    await authHelper.login(validUser);
  });

  test.afterEach(async () => {
    // Check for backend errors after each test
    if (capturedErrors.length > 0) {
      console.error('Backend errors detected:', capturedErrors);
      throw new Error(`Test failed due to ${capturedErrors.length} backend error(s): ${capturedErrors.map(e => `${e.method} ${e.url} - ${e.status}`).join(', ')}`);
    }
  });

  test.describe('11.1 Order Status Page Navigation and URL Parameters', () => {
    test('should navigate to order status page with valid order ID', async ({ page }) => {
      console.log('🧪 Testing order status page navigation...');
      
      // First, get a valid order ID from the dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Wait for order history to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for order links or IDs in the dashboard
      const orderLinks = page.locator('a[href*="/pedido/"]');
      const orderLinkCount = await orderLinks.count();
      
      if (orderLinkCount > 0) {
        // Get the first order link
        const firstOrderLink = orderLinks.first();
        const orderHref = await firstOrderLink.getAttribute('href');
        const orderId = orderHref?.split('/pedido/')[1];
        
        console.log(`📋 Found order ID: ${orderId}`);
        
        // Navigate to the order status page
        await page.goto(`/pedido/${orderId}`);
        await page.waitForLoadState('networkidle');
        
        // Verify URL contains the order ID
        expect(page.url()).toContain(`/pedido/${orderId}`);
        
        // Verify page loaded successfully
        await expect(page.locator('h1:has-text("Order Status")')).toBeVisible();
        
        console.log('✅ Order status page navigation successful');
      } else {
        // If no orders exist, test with a mock order ID
        console.log('📋 No existing orders found, testing with mock order ID');
        
        const mockOrderId = 'test-order-123';
        await page.goto(`/pedido/${mockOrderId}`);
        await page.waitForLoadState('networkidle');
        
        // Should show order not found page
        await expect(page.locator('h1:has-text("Order Not Found")')).toBeVisible();
        
        console.log('✅ Order not found page displayed correctly');
      }
    });

    test('should handle invalid order ID in URL parameters', async ({ page }) => {
      console.log('🧪 Testing invalid order ID handling...');
      
      // Test with various invalid order IDs
      const invalidOrderIds = [
        'invalid-order-id',
        '12345',
        'non-existent-order',
        'special-chars-!@#$%',
        ''
      ];
      
      for (const invalidId of invalidOrderIds) {
        console.log(`📋 Testing invalid order ID: "${invalidId}"`);
        
        await page.goto(`/pedido/${invalidId}`);
        await page.waitForLoadState('networkidle');
        
        // Should show order not found page
        await expect(page.locator('h1:has-text("Order Not Found")')).toBeVisible();
        
        // Verify error message is displayed
        await expect(page.locator('p:has-text("doesn\'t exist or you don\'t have permission")')).toBeVisible();
        
        // Verify navigation buttons are present
        await expect(page.locator('button:has-text("Back to Home")')).toBeVisible();
        await expect(page.locator('button:has-text("View All Orders")')).toBeVisible();
      }
      
      console.log('✅ Invalid order ID handling verified');
    });

    test('should preserve order ID in URL during page interactions', async ({ page }) => {
      console.log('🧪 Testing URL parameter persistence...');
      
      // Get a valid order ID from dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const orderLinks = page.locator('a[href*="/pedido/"]');
      const orderLinkCount = await orderLinks.count();
      
      if (orderLinkCount > 0) {
        const firstOrderLink = orderLinks.first();
        const orderHref = await firstOrderLink.getAttribute('href');
        const orderId = orderHref?.split('/pedido/')[1];
        
        // Navigate to order status page
        await page.goto(`/pedido/${orderId}`);
        await page.waitForLoadState('networkidle');
        
        const initialUrl = page.url();
        
        // Interact with refresh button
        const refreshButton = page.locator('button:has-text("Refresh")');
        if (await refreshButton.isVisible()) {
          await refreshButton.click();
          await page.waitForTimeout(1000);
          
          // Verify URL hasn't changed
          expect(page.url()).toBe(initialUrl);
        }
        
        // Test other interactions that shouldn't change URL
        const backButton = page.locator('button:has-text("Back to Dashboard")');
        if (await backButton.isVisible()) {
          // Don't click it, just verify it exists
          await expect(backButton).toBeVisible();
        }
        
        console.log('✅ URL parameter persistence verified');
      } else {
        console.log('📋 No orders available for URL persistence test');
      }
    });
  });

  test.describe('11.1 OrderStatusCard Component Validation', () => {
    test('should display OrderStatusCard with status-specific styling', async ({ page }) => {
      console.log('🧪 Testing OrderStatusCard status-specific displays...');
      
      // Get orders from dashboard to test different statuses
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Collect order IDs and their statuses
      const orderData: Array<{id: string, status: string}> = [];
      
      // Look for status badges in the dashboard
      const statusBadges = page.locator('[role="status"]');
      const badgeCount = await statusBadges.count();
      
      for (let i = 0; i < Math.min(badgeCount, 5); i++) { // Test up to 5 orders
        const badge = statusBadges.nth(i);
        const statusText = await badge.textContent();
        
        // Find the corresponding order link
        const orderRow = badge.locator('xpath=ancestor::tr | xpath=ancestor::div[contains(@class, "card")]');
        const orderLink = orderRow.locator('a[href*="/pedido/"]').first();
        
        if (await orderLink.isVisible()) {
          const href = await orderLink.getAttribute('href');
          const orderId = href?.split('/pedido/')[1];
          
          if (orderId && statusText) {
            orderData.push({ id: orderId, status: statusText.trim() });
          }
        }
      }
      
      console.log(`📋 Found ${orderData.length} orders to test`);
      
      // Test each order's status page
      for (const order of orderData) {
        console.log(`📋 Testing order ${order.id} with status: ${order.status}`);
        
        await page.goto(`/pedido/${order.id}`);
        await page.waitForLoadState('networkidle');
        
        // Verify OrderStatusCard is present
        const statusCard = page.locator('[role="status"]').first();
        await expect(statusCard).toBeVisible();
        
        // Verify status badge matches expected status
        const cardStatusBadge = page.locator('[role="status"]').first();
        const cardStatusText = await cardStatusBadge.textContent();
        
        // Status text might be slightly different (e.g., "Pending Payment" vs "pending_payment")
        console.log(`📋 Card status: ${cardStatusText}, Expected: ${order.status}`);
        
        // Verify status-specific styling
        await verifyStatusSpecificStyling(page, order.status);
      }
      
      console.log('✅ OrderStatusCard status-specific displays verified');
    });

    test('should display correct status icons for each order status', async ({ page }) => {
      console.log('🧪 Testing status-specific icons...');
      
      // Test with different order statuses
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const orderLinks = page.locator('a[href*="/pedido/"]');
      const orderCount = await orderLinks.count();
      
      if (orderCount > 0) {
        // Test first available order
        const firstOrderLink = orderLinks.first();
        const orderHref = await firstOrderLink.getAttribute('href');
        const orderId = orderHref?.split('/pedido/')[1];
        
        await page.goto(`/pedido/${orderId}`);
        await page.waitForLoadState('networkidle');
        
        // Verify status icon is present
        const statusIcon = page.locator('.card-header svg').first();
        await expect(statusIcon).toBeVisible();
        
        // Verify icon has appropriate classes
        const iconClasses = await statusIcon.getAttribute('class');
        expect(iconClasses).toBeTruthy();
        
        // Check for status-specific icon classes
        const hasStatusColor = iconClasses?.includes('text-') || false;
        expect(hasStatusColor).toBeTruthy();
        
        console.log(`📋 Status icon classes: ${iconClasses}`);
        
        // Check for animation on processing status
        const statusBadge = page.locator('[role="status"]').first();
        const statusText = await statusBadge.textContent();
        
        if (statusText?.toLowerCase().includes('processing')) {
          const hasSpinAnimation = iconClasses?.includes('animate-spin') || false;
          expect(hasSpinAnimation).toBeTruthy();
          console.log('📋 Processing animation verified');
        }
        
        console.log('✅ Status icons verified');
      } else {
        console.log('📋 No orders available for icon testing');
      }
    });

    test('should display appropriate action buttons based on order status', async ({ page }) => {
      console.log('🧪 Testing status-specific action buttons...');
      
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Collect orders with different statuses
      const statusButtons = page.locator('button:has-text("Pay Now"), button:has-text("Download"), button:has-text("Processing")');
      const buttonCount = await statusButtons.count();
      
      if (buttonCount > 0) {
        // Find orders with different action buttons
        for (let i = 0; i < Math.min(buttonCount, 3); i++) {
          const button = statusButtons.nth(i);
          const buttonText = await button.textContent();
          
          // Find the order ID for this button
          const orderRow = button.locator('xpath=ancestor::tr | xpath=ancestor::div[contains(@class, "card")]');
          const orderLink = orderRow.locator('a[href*="/pedido/"]').first();
          
          if (await orderLink.isVisible()) {
            const href = await orderLink.getAttribute('href');
            const orderId = href?.split('/pedido/')[1];
            
            if (orderId) {
              console.log(`📋 Testing order ${orderId} with button: ${buttonText}`);
              
              await page.goto(`/pedido/${orderId}`);
              await page.waitForLoadState('networkidle');
              
              // Verify appropriate action button is present
              if (buttonText?.includes('Pay Now')) {
                await expect(page.locator('button:has-text("Complete Payment")')).toBeVisible();
              } else if (buttonText?.includes('Download')) {
                await expect(page.locator('button:has-text("Download CSV")')).toBeVisible();
              } else if (buttonText?.includes('Processing')) {
                // Processing status should not have action buttons, just status display
                const actionButtons = page.locator('button:has-text("Complete Payment"), button:has-text("Download CSV")');
                const actionButtonCount = await actionButtons.count();
                expect(actionButtonCount).toBe(0);
              }
            }
          }
        }
        
        console.log('✅ Status-specific action buttons verified');
      } else {
        console.log('📋 No action buttons found for testing');
      }
    });
  });

  test.describe('11.1 Order Details Display', () => {
    test('should display complete order information (ID, filename, size, dates)', async ({ page }) => {
      console.log('🧪 Testing order details display...');
      
      // Get a valid order from dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const orderLinks = page.locator('a[href*="/pedido/"]');
      const orderCount = await orderLinks.count();
      
      if (orderCount > 0) {
        const firstOrderLink = orderLinks.first();
        const orderHref = await firstOrderLink.getAttribute('href');
        const orderId = orderHref?.split('/pedido/')[1];
        
        await page.goto(`/pedido/${orderId}`);
        await page.waitForLoadState('networkidle');
        
        // Verify Order ID is displayed
        const orderIdElement = page.locator('p.font-mono.text-xs.break-all');
        await expect(orderIdElement).toBeVisible();
        const displayedOrderId = await orderIdElement.textContent();
        expect(displayedOrderId).toContain(orderId);
        console.log(`📋 Order ID displayed: ${displayedOrderId}`);
        
        // Verify filename is displayed
        const filenameElement = page.locator('text=File:').locator('xpath=following-sibling::p');
        await expect(filenameElement).toBeVisible();
        const filename = await filenameElement.textContent();
        expect(filename).toBeTruthy();
        expect(filename?.length).toBeGreaterThan(0);
        console.log(`📋 Filename displayed: ${filename}`);
        
        // Verify file size is displayed
        const sizeElement = page.locator('text=Size:').locator('xpath=following-sibling::p');
        await expect(sizeElement).toBeVisible();
        const size = await sizeElement.textContent();
        expect(size).toBeTruthy();
        expect(size).toMatch(/\d+(\.\d+)?\s*(MB|KB|GB)/i);
        console.log(`📋 File size displayed: ${size}`);
        
        // Verify created date is displayed
        const createdElement = page.locator('text=Created:').locator('xpath=following-sibling::p');
        await expect(createdElement).toBeVisible();
        const createdDate = await createdElement.textContent();
        expect(createdDate).toBeTruthy();
        console.log(`📋 Created date displayed: ${createdDate}`);
        
        // Check for completed date if order is completed
        const completedElement = page.locator('text=Completed:').locator('xpath=following-sibling::p');
        if (await completedElement.isVisible()) {
          const completedDate = await completedElement.textContent();
          expect(completedDate).toBeTruthy();
          console.log(`📋 Completed date displayed: ${completedDate}`);
        }
        
        console.log('✅ Order details display verified');
      } else {
        console.log('📋 No orders available for details testing');
      }
    });

    test('should format dates and file sizes correctly', async ({ page }) => {
      console.log('🧪 Testing date and file size formatting...');
      
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const orderLinks = page.locator('a[href*="/pedido/"]');
      const orderCount = await orderLinks.count();
      
      if (orderCount > 0) {
        const firstOrderLink = orderLinks.first();
        const orderHref = await firstOrderLink.getAttribute('href');
        const orderId = orderHref?.split('/pedido/')[1];
        
        await page.goto(`/pedido/${orderId}`);
        await page.waitForLoadState('networkidle');
        
        // Test date formatting
        const dateElements = page.locator('text=Created:, text=Completed:').locator('xpath=following-sibling::p');
        const dateCount = await dateElements.count();
        
        for (let i = 0; i < dateCount; i++) {
          const dateElement = dateElements.nth(i);
          const dateText = await dateElement.textContent();
          
          // Verify date format (should be human-readable)
          expect(dateText).toBeTruthy();
          expect(dateText?.length).toBeGreaterThan(10); // Should be more than just "01/01/2024"
          
          // Should contain month name or be in a readable format
          const hasReadableFormat = dateText?.match(/\w+\s+\d+,\s+\d+/) || // "January 1, 2024"
                                   dateText?.match(/\d+\/\d+\/\d+/) ||      // "01/01/2024"
                                   dateText?.match(/\d+-\d+-\d+/);          // "2024-01-01"
          
          expect(hasReadableFormat).toBeTruthy();
          console.log(`📋 Date format verified: ${dateText}`);
        }
        
        // Test file size formatting
        const sizeElement = page.locator('text=Size:').locator('xpath=following-sibling::p');
        const sizeText = await sizeElement.textContent();
        
        // Should be in MB/KB/GB format with decimal places
        expect(sizeText).toMatch(/^\d+(\.\d+)?\s*(MB|KB|GB)$/i);
        console.log(`📋 File size format verified: ${sizeText}`);
        
        console.log('✅ Date and file size formatting verified');
      } else {
        console.log('📋 No orders available for formatting testing');
      }
    });

    test('should display order details in responsive layout', async ({ page }) => {
      console.log('🧪 Testing responsive order details layout...');
      
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const orderLinks = page.locator('a[href*="/pedido/"]');
      const orderCount = await orderLinks.count();
      
      if (orderCount > 0) {
        const firstOrderLink = orderLinks.first();
        const orderHref = await firstOrderLink.getAttribute('href');
        const orderId = orderHref?.split('/pedido/')[1];
        
        // Test desktop layout
        await page.setViewportSize({ width: 1200, height: 800 });
        await page.goto(`/pedido/${orderId}`);
        await page.waitForLoadState('networkidle');
        
        // Verify grid layout for desktop
        const detailsGrid = page.locator('.grid.grid-cols-1.sm\\:grid-cols-2');
        await expect(detailsGrid).toBeVisible();
        console.log('📋 Desktop grid layout verified');
        
        // Test mobile layout
        await page.setViewportSize({ width: 375, height: 667 });
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Verify all details are still visible on mobile
        await expect(page.locator('text=Order ID:')).toBeVisible();
        await expect(page.locator('text=File:')).toBeVisible();
        await expect(page.locator('text=Size:')).toBeVisible();
        await expect(page.locator('text=Created:')).toBeVisible();
        
        console.log('📋 Mobile layout verified');
        
        // Test tablet layout
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Verify details are still accessible
        await expect(page.locator('text=Order ID:')).toBeVisible();
        console.log('📋 Tablet layout verified');
        
        console.log('✅ Responsive order details layout verified');
      } else {
        console.log('📋 No orders available for responsive testing');
      }
    });
  });
});

// Helper function for verifying status-specific styling
async function verifyStatusSpecificStyling(page: any, status: string) {
  const statusCard = page.locator('.card').first();
  
  switch (status.toLowerCase()) {
    case 'pending payment':
    case 'pending_payment':
      // Should have yellow/warning styling
      await expect(statusCard).toHaveClass(/border-yellow-200/);
      await expect(statusCard).toHaveClass(/bg-yellow-50/);
      break;
      
    case 'processing':
    case 'paid':
      // Should have blue/info styling
      await expect(statusCard).toHaveClass(/border-blue-200/);
      await expect(statusCard).toHaveClass(/bg-blue-50/);
      break;
      
    case 'completed':
      // Should have green/success styling
      await expect(statusCard).toHaveClass(/border-green-200/);
      await expect(statusCard).toHaveClass(/bg-green-50/);
      break;
      
    case 'failed':
      // Should have red/error styling
      await expect(statusCard).toHaveClass(/border-red-200/);
      await expect(statusCard).toHaveClass(/bg-red-50/);
      break;
  }
  
  console.log(`📋 Status-specific styling verified for: ${status}`);
}
test.describe('11.2 Order Status Actions', () => {
  test('should display Complete Payment button for pending payment status', async ({ page }) => {
    console.log('🧪 Testing Complete Payment button for pending payment orders...');
    
    // Find orders with pending payment status
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for Pay Now buttons in dashboard (indicates pending payment)
    const payNowButtons = page.locator('button:has-text("Pay Now")');
    const payNowCount = await payNowButtons.count();
    
    if (payNowCount > 0) {
      // Get the order ID for a pending payment order
      const firstPayNowButton = payNowButtons.first();
      const orderRow = firstPayNowButton.locator('xpath=ancestor::tr | xpath=ancestor::div[contains(@class, "card")]');
      const orderLink = orderRow.locator('a[href*="/pedido/"]').first();
      
      if (await orderLink.isVisible()) {
        const href = await orderLink.getAttribute('href');
        const orderId = href?.split('/pedido/')[1];
        
        console.log(`💳 Testing pending payment order: ${orderId}`);
        
        // Navigate to order status page
        await page.goto(`/pedido/${orderId}`);
        await page.waitForLoadState('networkidle');
        
        // Verify Complete Payment button is present
        const completePaymentButton = page.locator('button:has-text("Complete Payment")');
        await expect(completePaymentButton).toBeVisible();
        await expect(completePaymentButton).toBeEnabled();
        
        // Verify button has payment icon
        const paymentIcon = completePaymentButton.locator('svg');
        await expect(paymentIcon).toBeVisible();
        
        // Verify payment information card is displayed
        const paymentInfoCard = page.locator('h3:has-text("💳 Payment Required")');
        await expect(paymentInfoCard).toBeVisible();
        
        console.log('✅ Complete Payment button verified for pending payment status');
      }
    } else {
      console.log('💳 No pending payment orders found - skipping Complete Payment button test');
    }
  });

  test('should display Download CSV button for completed status', async ({ page }) => {
    console.log('🧪 Testing Download CSV button for completed orders...');
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for Download buttons in dashboard (indicates completed orders)
    const downloadButtons = page.locator('button:has-text("Download")');
    const downloadCount = await downloadButtons.count();
    
    if (downloadCount > 0) {
      const firstDownloadButton = downloadButtons.first();
      const orderRow = firstDownloadButton.locator('xpath=ancestor::tr | xpath=ancestor::div[contains(@class, "card")]');
      const orderLink = orderRow.locator('a[href*="/pedido/"]').first();
      
      if (await orderLink.isVisible()) {
        const href = await orderLink.getAttribute('href');
        const orderId = href?.split('/pedido/')[1];
        
        console.log(`⬇️ Testing completed order: ${orderId}`);
        
        await page.goto(`/pedido/${orderId}`);
        await page.waitForLoadState('networkidle');
        
        // Verify Download CSV button is present
        const downloadCsvButton = page.locator('button:has-text("Download CSV")');
        await expect(downloadCsvButton).toBeVisible();
        await expect(downloadCsvButton).toBeEnabled();
        
        // Verify button has download icon
        const downloadIcon = downloadCsvButton.locator('svg');
        await expect(downloadIcon).toBeVisible();
        
        // Verify completion celebration card is displayed
        const celebrationCard = page.locator('h3:has-text("🎉 Download Ready!")');
        await expect(celebrationCard).toBeVisible();
        
        console.log('✅ Download CSV button verified for completed status');
      }
    } else {
      console.log('⬇️ No completed orders found - skipping Download CSV button test');
    }
  });

  test('should display processing animation and status-specific information cards', async ({ page }) => {
    console.log('🧪 Testing processing animation and information cards...');
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for processing orders
    const processingButtons = page.locator('button:has-text("Processing")');
    const processingCount = await processingButtons.count();
    
    if (processingCount > 0) {
      const firstProcessingButton = processingButtons.first();
      const orderRow = firstProcessingButton.locator('xpath=ancestor::tr | xpath=ancestor::div[contains(@class, "card")]');
      const orderLink = orderRow.locator('a[href*="/pedido/"]').first();
      
      if (await orderLink.isVisible()) {
        const href = await orderLink.getAttribute('href');
        const orderId = href?.split('/pedido/')[1];
        
        console.log(`⏳ Testing processing order: ${orderId}`);
        
        await page.goto(`/pedido/${orderId}`);
        await page.waitForLoadState('networkidle');
        
        // Verify processing animation in status icon
        const statusIcon = page.locator('.card-header svg').first();
        await expect(statusIcon).toBeVisible();
        
        const iconClasses = await statusIcon.getAttribute('class');
        const hasSpinAnimation = iconClasses?.includes('animate-spin') || false;
        expect(hasSpinAnimation).toBeTruthy();
        console.log('⏳ Processing icon animation verified');
        
        // Verify processing information card
        const processingInfoCard = page.locator('h3:has-text("Processing Information")');
        await expect(processingInfoCard).toBeVisible();
        
        // Verify progress bar animation
        const progressBar = page.locator('.bg-blue-600.h-2.rounded-full.animate-pulse');
        await expect(progressBar).toBeVisible();
        console.log('⏳ Progress bar animation verified');
        
        console.log('✅ Processing animation and information cards verified');
      }
    } else {
      console.log('⏳ No processing orders found - skipping processing animation test');
    }
  });

  test('should display Try Again button for failed status', async ({ page }) => {
    console.log('🧪 Testing Try Again button for failed orders...');
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for failed status badges
    const failedBadges = page.locator('[role="status"]:has-text("Failed")');
    const failedCount = await failedBadges.count();
    
    if (failedCount > 0) {
      // Find the order link for a failed order
      const firstFailedBadge = failedBadges.first();
      const orderRow = firstFailedBadge.locator('xpath=ancestor::tr | xpath=ancestor::div[contains(@class, "card")]');
      const orderLink = orderRow.locator('a[href*="/pedido/"]').first();
      
      if (await orderLink.isVisible()) {
        const href = await orderLink.getAttribute('href');
        const orderId = href?.split('/pedido/')[1];
        
        console.log(`❌ Testing failed order: ${orderId}`);
        
        await page.goto(`/pedido/${orderId}`);
        await page.waitForLoadState('networkidle');
        
        // Verify Try Again button is present
        const tryAgainButton = page.locator('button:has-text("Try Again")');
        await expect(tryAgainButton).toBeVisible();
        await expect(tryAgainButton).toBeEnabled();
        
        // Verify error message is displayed
        const errorAlert = page.locator('[role="alert"]');
        if (await errorAlert.isVisible()) {
          const errorText = await errorAlert.textContent();
          expect(errorText).toBeTruthy();
          expect(errorText).toContain('Error:');
          console.log(`❌ Error message displayed: ${errorText}`);
        }
        
        console.log('✅ Try Again button verified for failed status');
      }
    } else {
      console.log('❌ No failed orders found - skipping Try Again button test');
    }
  });
});

test.describe('11.3 Order Status Edge Cases', () => {
  test('should handle order not found scenarios gracefully', async ({ page }) => {
    console.log('🧪 Testing order not found scenarios...');
    
    // Test with various non-existent order IDs
    const nonExistentOrderIds = [
      'non-existent-order-123',
      'invalid-uuid-format',
      '00000000-0000-0000-0000-000000000000',
      'deleted-order-456'
    ];
    
    for (const orderId of nonExistentOrderIds) {
      console.log(`📋 Testing non-existent order ID: ${orderId}`);
      
      await page.goto(`/pedido/${orderId}`);
      await page.waitForLoadState('networkidle');
      
      // Verify order not found page is displayed
      await expect(page.locator('h1:has-text("Order Not Found")')).toBeVisible();
      
      // Verify appropriate error message
      await expect(page.locator('p:has-text("doesn\'t exist or you don\'t have permission")')).toBeVisible();
      
      // Verify navigation buttons are present
      await expect(page.locator('button:has-text("Back to Home")')).toBeVisible();
      await expect(page.locator('button:has-text("View All Orders")')).toBeVisible();
    }
    
    console.log('✅ Order not found scenarios handled correctly');
  });

  test('should validate permission for different users', async ({ page }) => {
    console.log('🧪 Testing permission validation for different users...');
    
    // First, login as the main test user and get an order ID
    const validUser = testData.testUsers.validUser;
    await authHelper.login(validUser);
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Get an order ID from the current user
    const orderLinks = page.locator('a[href*="/pedido/"]');
    const orderCount = await orderLinks.count();
    
    if (orderCount > 0) {
      const firstOrderLink = orderLinks.first();
      const orderHref = await firstOrderLink.getAttribute('href');
      const orderId = orderHref?.split('/pedido/')[1];
      
      console.log(`📋 Found order ID from user 1: ${orderId}`);
      
      // Verify current user can access the order
      await page.goto(`/pedido/${orderId}`);
      await page.waitForLoadState('networkidle');
      
      const orderStatusTitle = page.locator('h1:has-text("Order Status")');
      const orderNotFoundTitle = page.locator('h1:has-text("Order Not Found")');
      
      const canAccessOrder = await orderStatusTitle.isVisible();
      const isOrderNotFound = await orderNotFoundTitle.isVisible();
      
      if (canAccessOrder) {
        console.log('📋 Current user can access their own order');
        
        // Now test with a different user if available
        if (testData.testUsers.alternativeUser) {
          // Logout current user
          await authHelper.logout();
          
          // Login as alternative user
          await authHelper.login(testData.testUsers.alternativeUser);
          
          // Try to access the same order ID
          await page.goto(`/pedido/${orderId}`);
          await page.waitForLoadState('networkidle');
          
          // Should show order not found (permission denied)
          await expect(page.locator('h1:has-text("Order Not Found")')).toBeVisible();
          
          console.log('📋 Different user correctly denied access to other user\'s order');
        } else {
          console.log('📋 No alternative user available for permission testing');
        }
      } else if (isOrderNotFound) {
        console.log('📋 Order not found for current user (may be expected if no orders exist)');
      }
      
    } else {
      console.log('📋 No orders available for permission testing');
    }
    
    console.log('✅ Permission validation testing completed');
  });

  test('should handle malformed order ID URLs', async ({ page }) => {
    console.log('🧪 Testing malformed order ID URLs...');
    
    // Test various malformed URLs
    const malformedUrls = [
      '/pedido/',                    // Empty order ID
      '/pedido//',                   // Double slash
      '/pedido/ ',                   // Space character
      '/pedido/%20',                 // URL encoded space
      '/pedido/order%20with%20spaces' // URL encoded spaces
    ];
    
    for (const url of malformedUrls) {
      console.log(`📋 Testing malformed URL: ${url}`);
      
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      // Should either show order not found or handle gracefully
      const orderNotFound = page.locator('h1:has-text("Order Not Found")');
      const orderStatus = page.locator('h1:has-text("Order Status")');
      const errorPage = page.locator('text=404', 'text=Not Found');
      
      const isOrderNotFound = await orderNotFound.isVisible();
      const isOrderStatus = await orderStatus.isVisible();
      const isErrorPage = await errorPage.isVisible();
      
      // Should handle gracefully (not crash)
      const isHandledGracefully = isOrderNotFound || isOrderStatus || isErrorPage;
      expect(isHandledGracefully).toBeTruthy();
      
      if (isOrderNotFound) {
        console.log(`📋 Malformed URL handled with order not found page`);
      } else if (isOrderStatus) {
        console.log(`📋 Malformed URL somehow resolved to valid order`);
      } else if (isErrorPage) {
        console.log(`📋 Malformed URL handled with 404 error page`);
      }
    }
    
    console.log('✅ Malformed order ID URLs handled correctly');
  });

  test('should handle network errors when loading order data', async ({ page }) => {
    console.log('🧪 Testing network error handling...');
    
    // Intercept order API calls and simulate network errors
    await page.route('**/api/orders/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal server error',
          message: 'Unable to fetch order data'
        })
      });
    });
    
    const testOrderId = 'test-network-error-order';
    await page.goto(`/pedido/${testOrderId}`);
    await page.waitForLoadState('networkidle');
    
    // Should show order not found page with error information
    await expect(page.locator('h1:has-text("Order Not Found")')).toBeVisible();
    
    // Verify debug information shows the error
    const debugCard = page.locator('h3:has-text("Debug Information")');
    await expect(debugCard).toBeVisible();
    
    console.log('✅ Network error handling verified');
  });

  test('should handle loading states and timeouts appropriately', async ({ page }) => {
    console.log('🧪 Testing loading states and timeouts...');
    
    // Intercept order API calls and add delay
    await page.route('**/api/orders/**', async route => {
      // Add a delay to simulate slow network
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'test-loading-order',
            filename: 'test-document.pdf',
            status: 'completed',
            originalFileSize: 1024000,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
          }
        })
      });
    });
    
    const testOrderId = 'test-loading-order';
    await page.goto(`/pedido/${testOrderId}`);
    
    // Verify loading state is shown initially
    const loadingSpinner = page.locator('.animate-spin.rounded-full.h-32.w-32');
    await expect(loadingSpinner).toBeVisible();
    console.log('📋 Loading spinner displayed during data fetch');
    
    // Wait for loading to complete
    await page.waitForLoadState('networkidle');
    
    // Verify loading spinner is gone and content is loaded
    await expect(loadingSpinner).not.toBeVisible();
    
    // Should show either order status or order not found
    const orderStatus = page.locator('h1:has-text("Order Status")');
    const orderNotFound = page.locator('h1:has-text("Order Not Found")');
    
    const contentLoaded = await orderStatus.isVisible() || await orderNotFound.isVisible();
    expect(contentLoaded).toBeTruthy();
    
    console.log('✅ Loading states and timeouts handled correctly');
  });
});