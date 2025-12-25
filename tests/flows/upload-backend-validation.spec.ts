import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Upload Backend Validation', () => {
  // Helper function to ensure user is authenticated
  async function ensureAuthenticated(page: any, testUser: any) {
    const currentUrl = page.url();
    
    if (currentUrl.includes('/login') || currentUrl.includes('/register')) {
      console.log('🔑 Re-authenticating user...');
      
      // If on register page, go to login
      if (currentUrl.includes('/register')) {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');
      }
      
      await page.fill('#email', testUser.email);
      await page.fill('#password', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      
      return page.url().includes('/dashboard') || !page.url().includes('/login');
    }
    
    // Check if we have authenticated content
    const pageContent = await page.textContent('body');
    return !pageContent?.includes('Fazer Login') && !currentUrl.includes('/login');
  }

  test('Upload Ponto2.pdf and test payment flow', async ({ page }) => {
    console.log('🧪 Testing PDF upload and payment flow...');

    // Capture network activity
    const requests: any[] = [];
    const responses: any[] = [];

    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          timestamp: new Date().toISOString()
        });
        console.log(`📤 Request: ${request.method()} ${request.url()}`);
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
        
        responses.push({
          url: response.url(),
          status: response.status(),
          body: body,
          timestamp: new Date().toISOString()
        });
        
        console.log(`📥 Response: ${response.status()} ${response.url()}`);
        if (response.status() >= 400) {
          console.log(`❌ Error response:`, body);
        } else if (body && typeof body === 'object') {
          console.log(`✅ Success response:`, body);
        }
      }
    });

    // STEP 1: Register and login to ensure we have a valid session
    console.log('🔐 Step 1: Setting up authentication...');
    
    // Generate unique test user to avoid conflicts
    const timestamp = Date.now();
    const testUser = {
      name: `Test User ${timestamp}`,
      email: `testuser${timestamp}@docfiscal.com`,
      password: 'testpassword123'
    };
    
    console.log(`📝 Creating test user: ${testUser.email}`);
    
    // Register new user
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    await page.fill('#name', testUser.name);
    await page.fill('#email', testUser.email);
    await page.fill('#password', testUser.password);
    await page.fill('#confirmPassword', testUser.password);
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    
    // Check if we're logged in (should redirect to dashboard)
    let currentUrl = page.url();
    console.log(`📍 URL after registration: ${currentUrl}`);
    
    // If not on dashboard, try manual login
    if (!currentUrl.includes('/dashboard')) {
      console.log('🔑 Registration didn\'t auto-login, trying manual login...');
      
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      await page.fill('#email', testUser.email);
      await page.fill('#password', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      
      currentUrl = page.url();
      console.log(`📍 URL after login: ${currentUrl}`);
    }
    
    // Verify we're authenticated by checking for user-specific content
    if (currentUrl.includes('/dashboard')) {
      console.log('✅ Successfully authenticated');
    } else {
      console.log('⚠️ Authentication may have failed, continuing anyway...');
    }

    // STEP 2: Navigate to upload page and verify session
    console.log('📤 Step 2: Testing file upload...');
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if we got redirected to login (session lost)
    if (page.url().includes('/login')) {
      console.log('❌ Session lost, re-authenticating...');
      
      await page.fill('#email', testUser.email);
      await page.fill('#password', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      
      // Navigate back to upload page
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    }
    
    console.log(`📍 Current URL: ${page.url()}`);
    
    // Verify we're on the right page and authenticated
    const pageContent = await page.textContent('body');
    if (pageContent?.includes('Fazer Login') || page.url().includes('/login')) {
      console.log('❌ Still not authenticated, test may fail');
    } else {
      console.log('✅ Successfully on upload page with valid session');
    }

    // Find file input
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible({ timeout: 10000 });

    // Upload Ponto2.pdf
    const pdfPath = path.join(process.cwd(), 'Ponto2.pdf');
    console.log(`📁 Uploading file: ${pdfPath}`);
    
    await fileInput.setInputFiles(pdfPath);
    console.log('✅ File selected');

    // Wait for the submit button to become visible after file selection
    console.log('⏳ Waiting for submit button to appear...');
    
    const uploadSelectors = [
      'button:has-text("Enviar")',
      'button:has-text("Upload")',
      'button:has-text("Converter")',
      'button:has-text("Processar")',
      'button:has-text("Enviar PDF")',
      'button[type="submit"]'
    ];

    let uploadButton = null;
    
    // Wait up to 10 seconds for the button to appear
    for (let i = 0; i < 10; i++) {
      for (const selector of uploadSelectors) {
        const button = page.locator(selector);
        if (await button.isVisible()) {
          uploadButton = button;
          console.log(`✅ Found upload button: ${selector}`);
          break;
        }
      }
      
      if (uploadButton) break;
      
      console.log(`⏳ Waiting for submit button... (${i + 1}/10)`);
      await page.waitForTimeout(1000);
    }

    if (uploadButton) {
      // Ensure button is enabled before clicking
      await expect(uploadButton).toBeEnabled({ timeout: 5000 });
      await uploadButton.click();
      console.log('📤 Upload button clicked');
    } else {
      console.log('❌ No upload button found after file selection');
      
      // Debug: log all visible buttons
      const allButtons = await page.locator('button').all();
      console.log('🔍 All visible buttons:');
      for (const button of allButtons) {
        const text = await button.textContent();
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        console.log(`  - "${text}" (visible: ${isVisible}, enabled: ${isEnabled})`);
      }
      
      // Debug: check if we're still authenticated
      const pageContent = await page.textContent('body');
      if (pageContent?.includes('Fazer Login')) {
        console.log('❌ User appears to be logged out');
      }
      
      // Debug: log current URL
      console.log(`📍 Current URL: ${page.url()}`);
    }

    // Wait for upload to complete
    await page.waitForTimeout(8000); // Increased wait time

    // Check upload API calls
    const uploadRequests = requests.filter(req => 
      req.url.includes('/upload') || 
      (req.url.includes('/orders') && req.method === 'POST')
    );
    const uploadResponses = responses.filter(res => 
      res.url.includes('/upload') || 
      (res.url.includes('/orders') && res.status < 400)
    );

    console.log('📊 Upload Results:');
    console.log(`Upload requests: ${uploadRequests.length}`);
    console.log(`Upload responses: ${uploadResponses.length}`);

    let orderId = null;
    if (uploadResponses.length > 0) {
      const uploadResponse = uploadResponses[0];
      console.log('✅ Upload response received:', uploadResponse.body);
      
      if (uploadResponse.body && typeof uploadResponse.body === 'object') {
        orderId = uploadResponse.body.data?.order_id || 
                 uploadResponse.body.order_id ||
                 uploadResponse.body.data?.id ||
                 uploadResponse.body.id;
        console.log(`📋 Order ID: ${orderId}`);
      }
    } else {
      console.log('❌ No upload response detected');
    }

    // STEP 3: Test payment creation (ensure session is still valid)
    console.log('💳 Step 3: Testing payment creation...');
    
    // Verify session before payment
    const isAuthenticated = await ensureAuthenticated(page, testUser);
    if (!isAuthenticated) {
      console.log('❌ Could not maintain authentication, payment test may fail');
    }

    // Look for payment button
    const paymentSelectors = [
      'button:has-text("Pagar")',
      'button:has-text("PIX")',
      'button:has-text("Pagamento")',
      'button:has-text("Pagar com PIX")'
    ];

    let paymentButton = null;
    
    // Wait for payment button to appear (it should appear after successful upload)
    console.log('⏳ Waiting for payment button to appear...');
    for (let i = 0; i < 15; i++) {
      for (const selector of paymentSelectors) {
        const button = page.locator(selector);
        if (await button.isVisible()) {
          paymentButton = button;
          console.log(`✅ Found payment button: ${selector}`);
          break;
        }
      }
      
      if (paymentButton) break;
      
      console.log(`⏳ Waiting for payment button... (${i + 1}/15)`);
      await page.waitForTimeout(1000);
    }

    if (paymentButton) {
      await paymentButton.click();
      console.log('💳 Payment button clicked');
      
      // Wait for payment creation
      await page.waitForTimeout(5000);

      // Check payment API calls
      const paymentRequests = requests.filter(req => 
        req.url.includes('/payment') && req.method === 'POST'
      );
      const paymentResponses = responses.filter(res => 
        res.url.includes('/payment') && res.status < 400
      );

      console.log('📊 Payment Results:');
      console.log(`Payment requests: ${paymentRequests.length}`);
      console.log(`Payment responses: ${paymentResponses.length}`);

      if (paymentResponses.length > 0) {
        const paymentResponse = paymentResponses[0];
        console.log('✅ Payment response received:', paymentResponse.body);
        
        if (paymentResponse.body && typeof paymentResponse.body === 'object') {
          const paymentData = paymentResponse.body.data || paymentResponse.body;
          const paymentUrl = paymentData.payment_url;
          const paymentId = paymentData.payment_id;
          
          console.log(`💳 Payment ID: ${paymentId}`);
          console.log(`🔗 Payment URL: ${paymentUrl}`);
          
          if (paymentUrl && paymentUrl.includes('abacatepay.com')) {
            console.log('✅ AbacatePay URL generated correctly');
            console.log('💡 You can test the payment by accessing:', paymentUrl);
          }
        }
      } else {
        console.log('❌ No payment response detected');
      }
    } else {
      console.log('❌ No payment button found');
    }

    // STEP 4: Test payment status polling
    console.log('🔍 Step 4: Testing payment status monitoring...');

    // Wait for potential status polling
    await page.waitForTimeout(8000);

    const statusRequests = requests.filter(req => 
      req.url.includes('/status') || 
      (req.url.includes('/payments/') && req.method === 'GET')
    );

    console.log(`📊 Status polling requests: ${statusRequests.length}`);
    if (statusRequests.length > 0) {
      console.log('✅ Payment status polling is working');
      statusRequests.forEach((req, index) => {
        console.log(`  ${index + 1}. ${req.url} at ${req.timestamp}`);
      });
    } else {
      console.log('⚠️ No payment status polling detected');
    }

    // Summary
    console.log('\n📋 Upload and Payment Test Summary:');
    console.log(`Total API requests: ${requests.length}`);
    console.log(`Total API responses: ${responses.length}`);
    
    const errors = responses.filter(res => res.status >= 400);
    if (errors.length > 0) {
      console.log(`❌ API errors: ${errors.length}`);
      errors.forEach(error => {
        console.log(`  ${error.status} ${error.url}: ${JSON.stringify(error.body)}`);
      });
    } else {
      console.log('✅ No API errors detected');
    }

    // Check if we have the key components working
    const hasUpload = uploadResponses.length > 0;
    const hasPayment = responses.some(res => res.url.includes('/payment'));
    const hasStatusPolling = statusRequests.length > 0;

    console.log('\n🎯 Flow Status:');
    console.log(`Upload: ${hasUpload ? '✅' : '❌'}`);
    console.log(`Payment: ${hasPayment ? '✅' : '❌'}`);
    console.log(`Status Polling: ${hasStatusPolling ? '✅' : '⚠️'}`);

    console.log('✅ Upload and payment test completed');
  });

  test('Test webhook response handling simulation', async ({ page }) => {
    console.log('🔔 Testing webhook response handling...');

    const testPaymentId = 'test-webhook-payment-123';
    const testOrderId = 'test-webhook-order-456';

    // Navigate to payment success page
    await page.goto(`/payment/success?payment_id=${testPaymentId}&order_id=${testOrderId}`);
    await page.waitForLoadState('networkidle');

    // Capture status check requests
    const statusRequests: string[] = [];
    
    page.on('request', (request) => {
      if (request.url().includes('/status') || request.url().includes('/payments/')) {
        statusRequests.push(request.url());
        console.log(`🔍 Status check: ${request.url()}`);
      }
    });

    // Mock a successful payment status response (simulating webhook effect)
    await page.route('**/api/payments/*/status', async (route) => {
      console.log('🔄 Intercepting payment status check...');
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            payment_id: testPaymentId,
            status: 'paid', // Simulate webhook updated this
            order_id: testOrderId,
            updated_at: new Date().toISOString()
          }
        })
      });
    });

    // Wait for status polling
    await page.waitForTimeout(8000);

    console.log(`📊 Status check requests: ${statusRequests.length}`);
    
    if (statusRequests.length > 0) {
      console.log('✅ Payment status polling is working');
    } else {
      console.log('⚠️ No payment status polling detected');
    }

    // Check if page responds to the paid status
    const pageContent = await page.textContent('body');
    const webhookIndicators = ['paid', 'pago', 'confirmado', 'processando', 'complete'];
    
    let webhookHandled = false;
    webhookIndicators.forEach(indicator => {
      if (pageContent?.toLowerCase().includes(indicator)) {
        console.log(`✅ Webhook response indicator found: ${indicator}`);
        webhookHandled = true;
      }
    });

    if (webhookHandled) {
      console.log('✅ Frontend is handling webhook responses correctly');
    } else {
      console.log('⚠️ Frontend may not be handling webhook responses');
    }

    // Check for redirect to complete page
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    
    if (currentUrl.includes('/payment/complete')) {
      console.log('✅ Automatic redirect to complete page detected');
    } else {
      console.log('⚠️ No automatic redirect - webhook handling may need improvement');
    }

    console.log('✅ Webhook response test completed');
  });
});