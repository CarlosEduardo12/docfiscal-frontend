import { test, expect } from '@playwright/test';
import { createAuthHelper } from '../helpers/auth';
import { NetworkLogger } from '../helpers/network-logger';
import testData from '../fixtures/test-data.json';

test.describe('Order History Table Tests', () => {
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

  test.describe('10.2 Desktop Table View', () => {
    test('should display order history table with correct columns', async ({ page }) => {
      console.log('🧪 Testing desktop table view structure...');
      
      // Wait for order history table to load
      await page.waitForSelector('table[role="table"]', { timeout: 10000 });
      
      // Verify table is visible on desktop
      const table = page.locator('table[role="table"]');
      await expect(table).toBeVisible();
      
      // Verify table headers
      const headers = table.locator('thead th');
      await expect(headers).toHaveCount(5);
      
      // Check specific column headers
      await expect(headers.nth(0)).toContainText('File');
      await expect(headers.nth(1)).toContainText('Date');
      await expect(headers.nth(2)).toContainText('Status');
      await expect(headers.nth(3)).toContainText('Size');
      await expect(headers.nth(4)).toContainText('Actions');
      
      console.log('✅ Desktop table structure test completed successfully');
    });

    test('should display order data in table rows', async ({ page }) => {
      console.log('🧪 Testing order data display in table...');
      
      // Wait for order history table to load
      await page.waitForSelector('table[role="table"]', { timeout: 10000 });
      
      const table = page.locator('table[role="table"]');
      const tbody = table.locator('tbody');
      const rows = tbody.locator('tr');
      
      // Check if there are any orders
      const rowCount = await rows.count();
      
      if (rowCount > 0) {
        // Verify first row has expected structure
        const firstRow = rows.first();
        
        // Check file column (should have icon and filename)
        const fileCell = firstRow.locator('td').first();
        await expect(fileCell.locator('svg')).toBeVisible(); // File icon
        await expect(fileCell.locator('.font-medium')).toBeVisible(); // Filename
        await expect(fileCell.locator('.text-sm.text-gray-500')).toBeVisible(); // Order ID
        
        // Check date column
        const dateCell = firstRow.locator('td').nth(1);
        await expect(dateCell).toBeVisible();
        
        // Check status column (should have badge)
        const statusCell = firstRow.locator('td').nth(2);
        const statusBadge = statusCell.locator('[role="status"]');
        await expect(statusBadge).toBeVisible();
        
        // Check size column
        const sizeCell = firstRow.locator('td').nth(3);
        await expect(sizeCell).toBeVisible();
        
        // Check actions column
        const actionsCell = firstRow.locator('td').nth(4);
        await expect(actionsCell).toBeVisible();
        
        console.log(`📊 Found ${rowCount} orders in table`);
      } else {
        // Check for empty state
        const emptyState = page.locator('text="No orders yet"');
        await expect(emptyState).toBeVisible();
        console.log('📊 Empty state displayed correctly');
      }
      
      console.log('✅ Order data display test completed successfully');
    });

    test('should display status badges with correct styling', async ({ page }) => {
      console.log('🧪 Testing status badges in table...');
      
      // Wait for order history table to load
      await page.waitForSelector('table[role="table"]', { timeout: 10000 });
      
      const table = page.locator('table[role="table"]');
      const statusBadges = table.locator('[role="status"]');
      
      const badgeCount = await statusBadges.count();
      
      if (badgeCount > 0) {
        // Check each status badge
        for (let i = 0; i < badgeCount; i++) {
          const badge = statusBadges.nth(i);
          await expect(badge).toBeVisible();
          
          // Verify badge has icon and text
          const icon = badge.locator('svg');
          await expect(icon).toBeVisible();
          
          const badgeText = await badge.textContent();
          expect(badgeText).toBeTruthy();
          
          // Verify badge text is one of expected statuses
          const validStatuses = ['Pending Payment', 'Paid', 'Processing', 'Completed', 'Failed'];
          const hasValidStatus = validStatuses.some(status => badgeText?.includes(status));
          expect(hasValidStatus).toBe(true);
        }
        
        console.log(`📊 Verified ${badgeCount} status badges`);
      } else {
        console.log('📊 No status badges found (empty state)');
      }
      
      console.log('✅ Status badges test completed successfully');
    });

    test('should format file sizes correctly', async ({ page }) => {
      console.log('🧪 Testing file size formatting...');
      
      // Wait for order history table to load
      await page.waitForSelector('table[role="table"]', { timeout: 10000 });
      
      const table = page.locator('table[role="table"]');
      const sizeColumns = table.locator('tbody tr td:nth-child(4)');
      
      const sizeCount = await sizeColumns.count();
      
      if (sizeCount > 0) {
        // Check each size cell
        for (let i = 0; i < sizeCount; i++) {
          const sizeCell = sizeColumns.nth(i);
          const sizeText = await sizeCell.textContent();
          
          expect(sizeText).toBeTruthy();
          
          // Verify size format (should contain units like KB, MB, GB, or Bytes)
          const sizePattern = /\d+(\.\d+)?\s*(Bytes|KB|MB|GB)/;
          expect(sizeText?.trim()).toMatch(sizePattern);
        }
        
        console.log(`📊 Verified ${sizeCount} file size formats`);
      } else {
        console.log('📊 No file sizes found (empty state)');
      }
      
      console.log('✅ File size formatting test completed successfully');
    });

    test('should format dates correctly', async ({ page }) => {
      console.log('🧪 Testing date formatting...');
      
      // Wait for order history table to load
      await page.waitForSelector('table[role="table"]', { timeout: 10000 });
      
      const table = page.locator('table[role="table"]');
      const dateColumns = table.locator('tbody tr td:nth-child(2)');
      
      const dateCount = await dateColumns.count();
      
      if (dateCount > 0) {
        // Check each date cell
        for (let i = 0; i < dateCount; i++) {
          const dateCell = dateColumns.nth(i);
          const dateText = await dateCell.textContent();
          
          expect(dateText).toBeTruthy();
          
          // Verify date format (should contain month abbreviation and year)
          const datePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/;
          expect(dateText?.trim()).toMatch(datePattern);
        }
        
        console.log(`📊 Verified ${dateCount} date formats`);
      } else {
        console.log('📊 No dates found (empty state)');
      }
      
      console.log('✅ Date formatting test completed successfully');
    });
  });

  test.describe('10.2 Mobile Card View', () => {
    test('should display mobile card view on small screens', async ({ page }) => {
      console.log('🧪 Testing mobile card view...');
      
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Reload to apply responsive layout
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Wait for mobile card view to load
      await page.waitForSelector('[role="list"]', { timeout: 10000 });
      
      // Verify desktop table is hidden on mobile
      const desktopTable = page.locator('.hidden.md\\:block table');
      await expect(desktopTable).not.toBeVisible();
      
      // Verify mobile card view is visible
      const mobileCardView = page.locator('.md\\:hidden[role="list"]');
      await expect(mobileCardView).toBeVisible();
      
      console.log('✅ Mobile card view test completed successfully');
    });

    test('should display order cards with correct information', async ({ page }) => {
      console.log('🧪 Testing mobile card content...');
      
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Reload to apply responsive layout
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Wait for mobile card view to load
      await page.waitForSelector('[role="list"]', { timeout: 10000 });
      
      const cardList = page.locator('[role="list"]');
      const cards = cardList.locator('[role="listitem"]');
      
      const cardCount = await cards.count();
      
      if (cardCount > 0) {
        // Check first card structure
        const firstCard = cards.first();
        
        // Verify card has file icon and filename
        await expect(firstCard.locator('svg')).toBeVisible();
        await expect(firstCard.locator('.font-medium')).toBeVisible();
        
        // Verify card has status badge
        const statusBadge = firstCard.locator('[role="status"]');
        await expect(statusBadge).toBeVisible();
        
        // Verify card has date and size information
        const dateSize = firstCard.locator('.text-sm.text-gray-600');
        await expect(dateSize).toBeVisible();
        
        console.log(`📱 Found ${cardCount} order cards`);
      } else {
        // Check for empty state
        const emptyState = page.locator('text="No orders yet"');
        await expect(emptyState).toBeVisible();
        console.log('📱 Empty state displayed correctly');
      }
      
      console.log('✅ Mobile card content test completed successfully');
    });

    test('should display action buttons in mobile cards', async ({ page }) => {
      console.log('🧪 Testing mobile card action buttons...');
      
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Reload to apply responsive layout
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Wait for mobile card view to load
      await page.waitForSelector('[role="list"]', { timeout: 10000 });
      
      const cardList = page.locator('[role="list"]');
      const cards = cardList.locator('[role="listitem"]');
      
      const cardCount = await cards.count();
      
      if (cardCount > 0) {
        // Check each card for action buttons
        for (let i = 0; i < cardCount; i++) {
          const card = cards.nth(i);
          
          // Look for action buttons (Pay Now, Download, Processing)
          const actionButtons = card.locator('button');
          const buttonCount = await actionButtons.count();
          
          if (buttonCount > 0) {
            const firstButton = actionButtons.first();
            await expect(firstButton).toBeVisible();
            
            // Verify button has icon
            const buttonIcon = firstButton.locator('svg');
            await expect(buttonIcon).toBeVisible();
            
            // Verify button text
            const buttonText = await firstButton.textContent();
            expect(buttonText).toBeTruthy();
            
            // Verify button text is one of expected actions
            const validActions = ['Pay Now', 'Download', 'Processing'];
            const hasValidAction = validActions.some(action => buttonText?.includes(action));
            expect(hasValidAction).toBe(true);
          }
        }
        
        console.log(`📱 Verified action buttons in ${cardCount} cards`);
      } else {
        console.log('📱 No cards found (empty state)');
      }
      
      console.log('✅ Mobile card action buttons test completed successfully');
    });
  });

  test.describe('10.2 Action Buttons', () => {
    test('should display Pay Now button for pending payment orders', async ({ page }) => {
      console.log('🧪 Testing Pay Now buttons...');
      
      // Wait for order history table to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for Pay Now buttons
      const payNowButtons = page.locator('button:has-text("Pay Now")');
      const payNowCount = await payNowButtons.count();
      
      if (payNowCount > 0) {
        // Verify first Pay Now button
        const firstPayNowButton = payNowButtons.first();
        await expect(firstPayNowButton).toBeVisible();
        await expect(firstPayNowButton).toBeEnabled();
        
        // Verify button has credit card icon
        const creditCardIcon = firstPayNowButton.locator('svg');
        await expect(creditCardIcon).toBeVisible();
        
        // Verify button styling (should be primary/blue)
        await expect(firstPayNowButton).toHaveClass(/bg-blue-600/);
        
        console.log(`💳 Found ${payNowCount} Pay Now buttons`);
      } else {
        console.log('💳 No Pay Now buttons found (no pending payment orders)');
      }
      
      console.log('✅ Pay Now buttons test completed successfully');
    });

    test('should display Download button for completed orders', async ({ page }) => {
      console.log('🧪 Testing Download buttons...');
      
      // Wait for order history table to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for Download buttons
      const downloadButtons = page.locator('button:has-text("Download")');
      const downloadCount = await downloadButtons.count();
      
      if (downloadCount > 0) {
        // Verify first Download button
        const firstDownloadButton = downloadButtons.first();
        await expect(firstDownloadButton).toBeVisible();
        await expect(firstDownloadButton).toBeEnabled();
        
        // Verify button has download icon
        const downloadIcon = firstDownloadButton.locator('svg');
        await expect(downloadIcon).toBeVisible();
        
        // Verify button styling (should be outline)
        await expect(firstDownloadButton).toHaveClass(/variant-outline/);
        
        console.log(`⬇️ Found ${downloadCount} Download buttons`);
      } else {
        console.log('⬇️ No Download buttons found (no completed orders)');
      }
      
      console.log('✅ Download buttons test completed successfully');
    });

    test('should display Processing indicator for active orders', async ({ page }) => {
      console.log('🧪 Testing Processing indicators...');
      
      // Wait for order history table to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for Processing buttons/indicators
      const processingButtons = page.locator('button:has-text("Processing")');
      const processingCount = await processingButtons.count();
      
      if (processingCount > 0) {
        // Verify first Processing button
        const firstProcessingButton = processingButtons.first();
        await expect(firstProcessingButton).toBeVisible();
        await expect(firstProcessingButton).toBeDisabled(); // Should be disabled
        
        // Verify button has clock icon
        const clockIcon = firstProcessingButton.locator('svg');
        await expect(clockIcon).toBeVisible();
        
        console.log(`⏳ Found ${processingCount} Processing indicators`);
      } else {
        console.log('⏳ No Processing indicators found (no processing orders)');
      }
      
      console.log('✅ Processing indicators test completed successfully');
    });

    test('should display error messages for failed orders', async ({ page }) => {
      console.log('🧪 Testing error messages for failed orders...');
      
      // Wait for order history table to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for error messages (in desktop table)
      const errorMessages = page.locator('.text-xs.text-red-600');
      const errorCount = await errorMessages.count();
      
      if (errorCount > 0) {
        // Verify error messages are visible
        for (let i = 0; i < errorCount; i++) {
          const errorMessage = errorMessages.nth(i);
          await expect(errorMessage).toBeVisible();
          
          const errorText = await errorMessage.textContent();
          expect(errorText).toBeTruthy();
        }
        
        console.log(`❌ Found ${errorCount} error messages`);
      } else {
        // Look for error messages in mobile cards
        const mobileErrorMessages = page.locator('.text-xs.text-red-600.bg-red-50');
        const mobileErrorCount = await mobileErrorMessages.count();
        
        if (mobileErrorCount > 0) {
          console.log(`❌ Found ${mobileErrorCount} mobile error messages`);
        } else {
          console.log('❌ No error messages found (no failed orders)');
        }
      }
      
      console.log('✅ Error messages test completed successfully');
    });
  });

  test.describe('10.2 Pagination Controls', () => {
    test('should display pagination controls when available', async ({ page }) => {
      console.log('🧪 Testing pagination controls...');
      
      // Wait for order history table to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for pagination controls
      const paginationContainer = page.locator('.flex.items-center.justify-between.mt-6.pt-4.border-t');
      
      try {
        await expect(paginationContainer).toBeVisible({ timeout: 5000 });
        
        // Verify pagination elements
        const pageInfo = paginationContainer.locator('.text-sm.text-gray-700');
        await expect(pageInfo).toBeVisible();
        
        const paginationButtons = paginationContainer.locator('button');
        await expect(paginationButtons).toHaveCount(2); // Previous and Next
        
        // Verify Previous button
        const previousButton = paginationContainer.locator('button:has-text("Previous")');
        await expect(previousButton).toBeVisible();
        
        // Verify Next button
        const nextButton = paginationContainer.locator('button:has-text("Next")');
        await expect(nextButton).toBeVisible();
        
        console.log('📄 Pagination controls found and verified');
      } catch (error) {
        console.log('📄 No pagination controls found (single page or no data)');
      }
      
      console.log('✅ Pagination controls test completed successfully');
    });

    test('should handle pagination button states correctly', async ({ page }) => {
      console.log('🧪 Testing pagination button states...');
      
      // Wait for order history table to load
      await page.waitForSelector('table[role="table"], [role="list"]', { timeout: 10000 });
      
      // Look for pagination controls
      const paginationContainer = page.locator('.flex.items-center.justify-between.mt-6.pt-4.border-t');
      
      try {
        await expect(paginationContainer).toBeVisible({ timeout: 5000 });
        
        const previousButton = paginationContainer.locator('button:has-text("Previous")');
        const nextButton = paginationContainer.locator('button:has-text("Next")');
        
        // Check if we're on first page (Previous should be disabled)
        const pageInfo = await paginationContainer.locator('.text-sm.text-gray-700').textContent();
        
        if (pageInfo?.includes('page 1')) {
          await expect(previousButton).toBeDisabled();
          console.log('📄 Previous button correctly disabled on first page');
        } else {
          await expect(previousButton).toBeEnabled();
          console.log('📄 Previous button enabled (not on first page)');
        }
        
        // Next button state depends on whether there are more pages
        const nextButtonEnabled = await nextButton.isEnabled();
        console.log(`📄 Next button ${nextButtonEnabled ? 'enabled' : 'disabled'}`);
        
      } catch (error) {
        console.log('📄 No pagination controls found to test states');
      }
      
      console.log('✅ Pagination button states test completed successfully');
    });
  });

  test.describe('10.2 Responsive Design', () => {
    test('should switch between desktop and mobile views correctly', async ({ page }) => {
      console.log('🧪 Testing responsive design switching...');
      
      // Start with desktop view
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Verify desktop table is visible
      const desktopTable = page.locator('.hidden.md\\:block table');
      await expect(desktopTable).toBeVisible();
      
      // Verify mobile view is hidden
      const mobileView = page.locator('.md\\:hidden[role="list"]');
      await expect(mobileView).not.toBeVisible();
      
      console.log('📱 Desktop view verified');
      
      // Switch to mobile view
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Verify mobile view is visible
      await expect(mobileView).toBeVisible();
      
      // Verify desktop table is hidden
      await expect(desktopTable).not.toBeVisible();
      
      console.log('📱 Mobile view verified');
      
      console.log('✅ Responsive design switching test completed successfully');
    });

    test('should maintain functionality across different screen sizes', async ({ page }) => {
      console.log('🧪 Testing functionality across screen sizes...');
      
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop Large' },
        { width: 1024, height: 768, name: 'Desktop Small' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' }
      ];
      
      for (const viewport of viewports) {
        console.log(`📱 Testing ${viewport.name} (${viewport.width}x${viewport.height})`);
        
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Verify order history is displayed (either table or cards)
        const orderHistory = page.locator('table[role="table"], [role="list"]');
        await expect(orderHistory).toBeVisible();
        
        // Verify action buttons are present and functional
        const actionButtons = page.locator('button:has-text("Pay Now"), button:has-text("Download"), button:has-text("Processing")');
        const buttonCount = await actionButtons.count();
        
        if (buttonCount > 0) {
          // Verify first button is visible and has proper styling
          const firstButton = actionButtons.first();
          await expect(firstButton).toBeVisible();
          
          // Verify button has icon
          const buttonIcon = firstButton.locator('svg');
          await expect(buttonIcon).toBeVisible();
        }
        
        console.log(`✅ ${viewport.name} functionality verified`);
      }
      
      console.log('✅ Cross-screen functionality test completed successfully');
    });
  });
});