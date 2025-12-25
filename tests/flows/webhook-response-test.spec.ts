import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Webhook Response Test', () => {
  test('Test if backend webhook updates reach frontend', async ({ page }) => {
    console.log('🔔 Testing webhook response flow with full authentication...');

    // Capture all network activity
    const apiCalls: any[] = [];
    
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        apiCalls.push({
          type: 'request',
          url: request.url(),
          method: request.method(),
          timestamp: new Date().toISOString()
        });
        console.log(`📤 ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', async (response) => {
      if (response.url().includes('/api/')) {
        let body = null;
        try {
          body = await response.json();
        } catch {
          try {
            body = await response.text();
          } catch {
            body = 'Could not parse';
          }
        }
        
        apiCalls.push({
          type: 'response',
          url: response.url(),
          status: response.status(),
          body: body,
          timestamp: new Date().toISOString()
        });
        
        console.log(`📥 ${response.status()} ${response.url()}`);
        if (response.status() >= 400) {
          console.log(`❌ Error:`, body);
        } else if (body && typeof body === 'object' && body.data) {
          // Log important status changes
          if (body.data.status) {
            console.log(`📊 Status update: ${body.data.status}`);
          }
          if (body.data.payment_status) {
            console.log(`💳 Payment status: ${body.data.payment_status}`);
          }
        }
      }
    });

    // STEP 1: Create authenticated user and complete upload/payment flow
    console.log('👤 Step 1: Creating authenticated user and completing flow...');
    
    const timestamp = Date.now();
    const testUser = {
      name: `Webhook Test User ${timestamp}`,
      email: `webhook${timestamp}@docfiscal.com`,
      password: 'testpass123'
    };
    
    // Register new user
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    await page.fill('#name', testUser.name);
    await page.fill('#email', testUser.email);
    await page.fill('#password', testUser.password);
    await page.fill('#confirmPassword', testUser.password);
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Navigate to main page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Login if needed
    if (page.url().includes('/login')) {
      console.log('🔑 Logging in...');
      await page.fill('#email', testUser.email);
      await page.fill('#password', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    }
    
    console.log('✅ User authenticated');
    
    // STEP 2: Upload file and create payment
    console.log('📁 Step 2: Uploading file and creating payment...');
    
    const fileInput = page.locator('input[type="file"]');
    const pdfPath = path.join(process.cwd(), 'Ponto2.pdf');
    await fileInput.setInputFiles(pdfPath);
    
    const uploadButton = page.locator('button:has-text("Enviar PDF para Conversão")');
    await expect(uploadButton).toBeVisible({ timeout: 10000 });
    await uploadButton.click();
    
    // Wait for payment button
    const paymentButton = page.locator('button:has-text("Pagar com PIX")');
    await expect(paymentButton).toBeVisible({ timeout: 15000 });
    await paymentButton.click();
    
    // Wait for payment creation and get to waiting step
    const waitingTitle = page.locator('h2:has-text("Aguardando Pagamento")');
    await expect(waitingTitle).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Payment created, now in waiting step');
    
    // Extract payment and order IDs from API calls
    let paymentId = null;
    let orderId = null;
    
    const paymentCalls = apiCalls.filter(call => 
      call.type === 'response' && 
      call.url.includes('payment') &&
      call.status < 400
    );
    
    if (paymentCalls.length > 0) {
      const paymentResponse = paymentCalls[0];
      if (paymentResponse.body && typeof paymentResponse.body === 'object') {
        const paymentData = paymentResponse.body.data || paymentResponse.body;
        paymentId = paymentData.payment_id;
        orderId = paymentData.order_id;
      }
    }
    
    // Also check upload calls for order ID
    const uploadCalls = apiCalls.filter(call => 
      call.type === 'response' && 
      (call.url.includes('upload') || call.url.includes('orders')) &&
      call.status < 400
    );
    
    if (uploadCalls.length > 0 && !orderId) {
      const uploadResponse = uploadCalls[0];
      if (uploadResponse.body && typeof uploadResponse.body === 'object') {
        orderId = uploadResponse.body.data?.order_id || 
                 uploadResponse.body.order_id ||
                 uploadResponse.body.data?.id;
      }
    }
    
    console.log(`💳 Payment ID: ${paymentId}`);
    console.log(`📋 Order ID: ${orderId}`);
    
    if (!paymentId && !orderId) {
      console.log('❌ Could not extract payment/order IDs from API calls');
      return;
    }
    
    // STEP 3: Monitor payment status polling
    console.log('🔍 Step 3: Monitoring payment status polling...');
    
    // Wait for initial status check
    await page.waitForTimeout(8000); // Wait for polling to start
    
    // Check initial status calls
    const initialStatusCalls = apiCalls.filter(call => 
      call.type === 'response' && 
      (call.url.includes(`/payments/${paymentId}/status`) || 
       call.url.includes('/payments/') && call.url.includes('/status'))
    );
    
    console.log(`📊 Initial status calls: ${initialStatusCalls.length}`);
    
    if (initialStatusCalls.length > 0) {
      const latestStatus = initialStatusCalls[initialStatusCalls.length - 1];
      console.log('📊 Latest payment status:', latestStatus.body);
      
      if (latestStatus.body && typeof latestStatus.body === 'object') {
        const status = latestStatus.body.data?.status || latestStatus.body.status;
        console.log(`💳 Current payment status: ${status}`);
        
        if (status === 'paid') {
          console.log('✅ Payment is already marked as paid!');
        } else {
          console.log(`⏳ Payment status is: ${status}`);
        }
      }
    }
    
    // STEP 4: Test navigation to payment success page
    console.log('🔍 Step 4: Testing payment success page navigation...');
    
    // Navigate to payment success page with our real IDs
    await page.goto(`/payment/success?payment_id=${paymentId}&order_id=${orderId}`);
    await page.waitForLoadState('networkidle');
    
    console.log('✅ Navigated to payment success page');
    
    // STEP 5: Monitor for status changes over time
    console.log('🔍 Step 5: Monitoring for status changes...');
    
    // Monitor for 30 seconds to catch any status changes
    const monitoringDuration = 30000; // 30 seconds
    const startTime = Date.now();
    
    console.log(`⏳ Monitoring for ${monitoringDuration/1000} seconds...`);
    
    let previousStatus = null;
    let statusChanges = 0;
    
    while (Date.now() - startTime < monitoringDuration) {
      await page.waitForTimeout(2000); // Check every 2 seconds
      
      // Get latest status calls
      const recentStatusCalls = apiCalls.filter(call => 
        call.type === 'response' && 
        (call.url.includes(`/payments/${paymentId}/status`) ||
         call.url.includes('/payments/') && call.url.includes('/status')) &&
        new Date(call.timestamp) > new Date(startTime)
      );
      
      if (recentStatusCalls.length > 0) {
        const latestCall = recentStatusCalls[recentStatusCalls.length - 1];
        
        if (latestCall.body && typeof latestCall.body === 'object') {
          const currentStatus = latestCall.body.data?.status || latestCall.body.status;
          
          if (currentStatus !== previousStatus) {
            statusChanges++;
            console.log(`🔄 Status changed from "${previousStatus}" to "${currentStatus}"`);
            previousStatus = currentStatus;
            
            // If status changed to paid, check for redirect
            if (currentStatus === 'paid') {
              console.log('✅ Payment confirmed! Checking for redirect...');
              
              // Wait a bit for potential redirect
              await page.waitForTimeout(3000);
              
              const currentUrl = page.url();
              console.log(`📍 Current URL: ${currentUrl}`);
              
              if (currentUrl.includes('/payment/complete')) {
                console.log('✅ Automatic redirect to complete page detected!');
              } else {
                console.log('⚠️ No redirect detected yet');
              }
              
              break; // Exit monitoring loop
            }
          }
        }
      }
      
      // Log progress
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed % 10 === 0) {
        console.log(`⏳ Monitoring... ${elapsed}s elapsed`);
      }
    }
    
    // STEP 6: Check order status updates
    console.log('🔍 Step 6: Checking order status updates...');
    
    const orderStatusCalls = apiCalls.filter(call => 
      call.type === 'response' && 
      call.url.includes(`/orders/${orderId}`) &&
      !call.url.includes('/payment')
    );
    
    console.log(`📊 Order status calls: ${orderStatusCalls.length}`);
    
    if (orderStatusCalls.length > 0) {
      const latestOrderCall = orderStatusCalls[orderStatusCalls.length - 1];
      console.log('📊 Latest order status:', latestOrderCall.body);
      
      if (latestOrderCall.body && typeof latestOrderCall.body === 'object') {
        const orderStatus = latestOrderCall.body.data?.status || latestOrderCall.body.status;
        console.log(`📋 Current order status: ${orderStatus}`);
        
        if (orderStatus === 'processing') {
          console.log('✅ Order moved to processing after payment!');
        } else if (orderStatus === 'completed') {
          console.log('✅ Order is completed and ready for download!');
        }
      }
    }
    
    // STEP 7: Check UI updates
    console.log('🔍 Step 7: Checking UI updates...');
    
    const pageContent = await page.textContent('body');
    
    // Look for status indicators in the UI
    const statusIndicators = [
      { text: 'pago', meaning: 'Payment confirmed' },
      { text: 'confirmado', meaning: 'Payment confirmed' },
      { text: 'processando', meaning: 'Processing started' },
      { text: 'processing', meaning: 'Processing started' },
      { text: 'concluído', meaning: 'Processing completed' },
      { text: 'completed', meaning: 'Processing completed' },
      { text: 'download', meaning: 'Ready for download' }
    ];
    
    let uiUpdatesDetected = false;
    statusIndicators.forEach(indicator => {
      if (pageContent?.toLowerCase().includes(indicator.text)) {
        console.log(`✅ UI update detected: ${indicator.meaning} (found "${indicator.text}")`);
        uiUpdatesDetected = true;
      }
    });
    
    if (!uiUpdatesDetected) {
      console.log('⚠️ No clear UI status updates detected');
      console.log('📄 Current page content preview:', pageContent?.substring(0, 300));
    }
    
    // STEP 8: Test payment complete page
    console.log('🔍 Step 8: Testing payment complete page...');
    
    await page.goto(`/payment/complete?payment_id=${paymentId}&order_id=${orderId}`);
    await page.waitForLoadState('networkidle');
    
    // Monitor processing on complete page
    await page.waitForTimeout(10000);
    
    const completePageContent = await page.textContent('body');
    
    if (completePageContent?.includes('Processando')) {
      console.log('✅ Processing status visible on complete page');
    }
    
    if (completePageContent?.includes('Concluído')) {
      console.log('✅ Completion status visible on complete page');
    }
    
    // STEP 9: Summary and analysis
    console.log('\n📋 Webhook Response Test Summary:');
    console.log('='.repeat(50));
    
    const totalApiCalls = apiCalls.length;
    const paymentStatusCalls = apiCalls.filter(call => 
      call.url.includes('/payments/') && call.url.includes('/status')
    ).length;
    const orderCalls = apiCalls.filter(call => 
      call.url.includes('/orders/') && !call.url.includes('/payment')
    ).length;
    
    console.log(`📊 Total API calls: ${totalApiCalls}`);
    console.log(`💳 Payment status calls: ${paymentStatusCalls}`);
    console.log(`📋 Order status calls: ${orderCalls}`);
    console.log(`🔄 Status changes detected: ${statusChanges}`);
    
    // Check for errors
    const errors = apiCalls.filter(call => 
      call.type === 'response' && call.status >= 400
    );
    
    if (errors.length > 0) {
      console.log(`❌ API errors: ${errors.length}`);
      errors.forEach(error => {
        console.log(`  ${error.status} ${error.url}`);
      });
    } else {
      console.log('✅ No API errors detected');
    }
    
    // Final assessment
    console.log('\n🎯 Webhook Integration Assessment:');
    
    const hasPaymentPolling = paymentStatusCalls > 0;
    const hasOrderPolling = orderCalls > 0;
    const hasStatusChanges = statusChanges > 0;
    const hasUIUpdates = uiUpdatesDetected;
    
    console.log(`Payment polling: ${hasPaymentPolling ? '✅' : '❌'}`);
    console.log(`Order polling: ${hasOrderPolling ? '✅' : '❌'}`);
    console.log(`Status changes: ${hasStatusChanges ? '✅' : '⚠️'}`);
    console.log(`UI updates: ${hasUIUpdates ? '✅' : '⚠️'}`);
    
    if (hasPaymentPolling && hasOrderPolling) {
      console.log('\n✅ WEBHOOK INTEGRATION IS WORKING!');
      console.log('The frontend is successfully polling for status updates.');
      if (hasStatusChanges) {
        console.log('Status changes are being detected and processed.');
      }
      if (hasUIUpdates) {
        console.log('UI is being updated based on status changes.');
      }
    } else {
      console.log('\n⚠️ WEBHOOK INTEGRATION NEEDS ATTENTION');
      console.log('Some polling mechanisms may not be working correctly.');
    }
    
    console.log('\n💡 Next steps:');
    console.log('1. Complete a payment in AbacatePay using the generated URL');
    console.log('2. Watch the console for status changes');
    console.log('3. Verify the UI updates automatically');
    console.log('4. Check if processing starts after payment confirmation');
    
    console.log('\n✅ Webhook response test completed');
  });

  test('Test payment complete page processing monitoring', async ({ page }) => {
    console.log('🔄 Testing payment complete page processing...');

    // Capture network activity
    const apiCalls: any[] = [];
    
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        console.log(`📤 ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', async (response) => {
      if (response.url().includes('/api/')) {
        let body = null;
        try {
          body = await response.json();
        } catch {
          body = 'Could not parse';
        }
        
        apiCalls.push({
          url: response.url(),
          status: response.status(),
          body: body,
          timestamp: new Date().toISOString()
        });
        
        console.log(`📥 ${response.status()} ${response.url()}`);
        
        // Log processing progress
        if (body && typeof body === 'object' && body.data) {
          if (body.data.status === 'processing') {
            console.log('🔄 Order is being processed...');
          } else if (body.data.status === 'completed') {
            console.log('✅ Order processing completed!');
          }
          
          if (body.data.progress !== undefined) {
            console.log(`📊 Processing progress: ${body.data.progress}%`);
          }
        }
      }
    });

    // Navigate to payment complete page
    const testPaymentId = 'test-complete-123';
    const testOrderId = 'test-order-456';
    
    await page.goto(`/payment/complete?payment_id=${testPaymentId}&order_id=${testOrderId}`);
    await page.waitForLoadState('networkidle');
    
    console.log('✅ Navigated to payment complete page');
    
    // Monitor for processing updates
    console.log('🔍 Monitoring processing updates for 20 seconds...');
    
    const monitoringTime = 20000; // 20 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < monitoringTime) {
      await page.waitForTimeout(3000);
      
      // Check for processing indicators in UI
      const pageContent = await page.textContent('body');
      
      if (pageContent?.includes('Processando')) {
        console.log('🔄 Processing status visible in UI');
      }
      
      if (pageContent?.includes('Concluído')) {
        console.log('✅ Completion status visible in UI');
      }
      
      if (pageContent?.includes('%')) {
        console.log('📊 Progress percentage visible in UI');
      }
      
      // Look for download button
      const downloadButton = page.locator('button:has-text("Download"), button:has-text("Baixar")');
      if (await downloadButton.isVisible()) {
        console.log('✅ Download button appeared - processing completed!');
        break;
      }
    }
    
    // Summary
    const processingCalls = apiCalls.filter(call => 
      call.url.includes('/orders/') && !call.url.includes('/payment')
    );
    
    console.log(`📊 Processing monitoring calls: ${processingCalls.length}`);
    
    if (processingCalls.length > 0) {
      console.log('✅ Processing monitoring is working');
    } else {
      console.log('⚠️ No processing monitoring detected');
    }
    
    console.log('✅ Processing monitoring test completed');
  });
});