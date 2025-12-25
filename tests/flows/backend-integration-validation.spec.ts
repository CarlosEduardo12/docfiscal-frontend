import { test, expect, Page } from '@playwright/test';
import { createNetworkLogger } from '../helpers/network-logger';
import path from 'path';

test.describe('Backend Integration Validation', () => {
  let networkLogger: ReturnType<typeof createNetworkLogger>;
  let capturedRequests: any[] = [];
  let capturedResponses: any[] = [];

  test.beforeEach(async ({ page }) => {
    networkLogger = createNetworkLogger();
    capturedRequests = [];
    capturedResponses = [];

    // Capturar todas as requisições e respostas
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        capturedRequests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData(),
          timestamp: new Date().toISOString()
        });
      }
    });

    page.on('response', async (response) => {
      if (response.url().includes('/api/')) {
        let responseBody = null;
        try {
          responseBody = await response.json();
        } catch {
          try {
            responseBody = await response.text();
          } catch {
            responseBody = 'Could not parse response';
          }
        }

        capturedResponses.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          headers: response.headers(),
          body: responseBody,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Setup network error capture
    await networkLogger.captureBackendErrors(page, []);
  });

  test('Complete flow: Register → Login → Upload Ponto2.pdf → Payment → Webhook Response', async ({ page }) => {
    console.log('🧪 Testing complete backend integration flow...');

    // Generate unique test user
    const timestamp = Date.now();
    const testUser = {
      fullName: `Test User ${timestamp}`,
      email: `testuser${timestamp}@docfiscal.com`,
      password: 'testpassword123'
    };

    console.log(`📝 Using test user: ${testUser.email}`);

    // STEP 1: Register new user
    console.log('🔐 Step 1: Testing user registration...');
    
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Fill registration form using correct IDs
    await page.fill('#name', testUser.fullName);
    await page.fill('#email', testUser.email);
    await page.fill('#password', testUser.password);
    await page.fill('#confirmPassword', testUser.password);

    // Submit registration
    const registerButton = page.locator('button[type="submit"], button:has-text("Criar"), button:has-text("Registrar"), button:has-text("Cadastrar")');
    await registerButton.click();

    // Wait for registration response
    await page.waitForTimeout(3000);

    // Check registration API call
    const registerRequest = capturedRequests.find(req => 
      req.url.includes('/api/auth/register') || req.url.includes('/api/register')
    );
    const registerResponse = capturedResponses.find(res => 
      res.url.includes('/api/auth/register') || res.url.includes('/api/register')
    );

    console.log('📊 Registration API Call:');
    console.log('Request:', registerRequest);
    console.log('Response:', registerResponse);

    if (registerResponse) {
      expect(registerResponse.status).toBeLessThan(400);
      console.log('✅ Registration successful');
    } else {
      console.log('⚠️ No registration API call detected');
    }

    // STEP 2: Login with registered user
    console.log('🔑 Step 2: Testing user login...');

    // Navigate to login if not already redirected
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard')) {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Fill login form using correct IDs
      await page.fill('#email', testUser.email);
      await page.fill('#password', testUser.password);

      // Submit login
      const loginButton = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")');
      await loginButton.click();

      // Wait for login response
      await page.waitForTimeout(3000);
    }

    // Check login API call
    const loginRequest = capturedRequests.find(req => 
      req.url.includes('/api/auth/login') || req.url.includes('/api/login')
    );
    const loginResponse = capturedResponses.find(res => 
      res.url.includes('/api/auth/login') || res.url.includes('/api/login')
    );

    console.log('📊 Login API Call:');
    console.log('Request:', loginRequest);
    console.log('Response:', loginResponse);

    if (loginResponse) {
      expect(loginResponse.status).toBeLessThan(400);
      console.log('✅ Login successful');
      
      // Verify token in response
      if (loginResponse.body && typeof loginResponse.body === 'object') {
        expect(loginResponse.body.success).toBe(true);
        expect(loginResponse.body.data?.access_token).toBeDefined();
        console.log('✅ Access token received');
      }
    } else {
      console.log('⚠️ No login API call detected');
    }

    // Verify we're logged in (should be on dashboard or redirect happened)
    await page.waitForTimeout(2000);
    const finalUrl = page.url();
    console.log(`📍 Current URL after login: ${finalUrl}`);

    // STEP 3: Upload Ponto2.pdf
    console.log('📤 Step 3: Testing PDF upload...');

    // Navigate to upload page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

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
    }

    // Wait for upload to complete
    await page.waitForTimeout(5000);

    // Check upload API call
    const uploadRequest = capturedRequests.find(req => 
      req.url.includes('/api/upload') || req.url.includes('/api/orders')
    );
    const uploadResponse = capturedResponses.find(res => 
      res.url.includes('/api/upload') || (res.url.includes('/api/orders') && res.url.includes('POST'))
    );

    console.log('📊 Upload API Call:');
    console.log('Request:', uploadRequest);
    console.log('Response:', uploadResponse);

    let orderId = null;
    if (uploadResponse) {
      expect(uploadResponse.status).toBeLessThan(400);
      console.log('✅ Upload successful');
      
      if (uploadResponse.body && typeof uploadResponse.body === 'object') {
        orderId = uploadResponse.body.data?.order_id || uploadResponse.body.order_id;
        console.log(`📋 Order ID: ${orderId}`);
      }
    } else {
      console.log('⚠️ No upload API call detected');
    }

    // STEP 4: Create payment
    console.log('💳 Step 4: Testing payment creation...');

    // Look for payment button
    const paymentButton = page.locator('button:has-text("Pagar"), button:has-text("PIX"), button:has-text("Pagamento")');
    await expect(paymentButton.first()).toBeVisible({ timeout: 15000 });

    // Click payment button
    await paymentButton.first().click();
    await page.waitForTimeout(3000);

    // Check payment creation API call
    const paymentRequest = capturedRequests.find(req => 
      req.url.includes('/payment') && req.method === 'POST'
    );
    const paymentResponse = capturedResponses.find(res => 
      res.url.includes('/payment') && res.status < 400
    );

    console.log('📊 Payment Creation API Call:');
    console.log('Request:', paymentRequest);
    console.log('Response:', paymentResponse);

    let paymentId = null;
    let paymentUrl = null;

    if (paymentResponse) {
      expect(paymentResponse.status).toBeLessThan(400);
      console.log('✅ Payment creation successful');
      
      if (paymentResponse.body && typeof paymentResponse.body === 'object') {
        paymentId = paymentResponse.body.data?.payment_id;
        paymentUrl = paymentResponse.body.data?.payment_url;
        console.log(`💳 Payment ID: ${paymentId}`);
        console.log(`🔗 Payment URL: ${paymentUrl}`);
        
        expect(paymentUrl).toContain('abacatepay.com');
        console.log('✅ AbacatePay URL generated correctly');
      }
    } else {
      console.log('⚠️ No payment creation API call detected');
    }

    // STEP 5: Test payment status polling
    console.log('🔍 Step 5: Testing payment status polling...');

    if (paymentId) {
      // Wait for status polling to start
      await page.waitForTimeout(5000);

      // Check for payment status API calls
      const statusRequests = capturedRequests.filter(req => 
        req.url.includes(`/payments/${paymentId}/status`) || 
        req.url.includes('/payment') && req.url.includes('status')
      );
      const statusResponses = capturedResponses.filter(res => 
        res.url.includes(`/payments/${paymentId}/status`) || 
        (res.url.includes('/payment') && res.url.includes('status'))
      );

      console.log(`📊 Payment Status Polling (${statusRequests.length} requests):`);
      statusRequests.forEach((req, index) => {
        console.log(`Request ${index + 1}:`, req.url, req.timestamp);
      });
      statusResponses.forEach((res, index) => {
        console.log(`Response ${index + 1}:`, res.status, res.body);
      });

      if (statusRequests.length > 0) {
        console.log('✅ Payment status polling is working');
      } else {
        console.log('⚠️ No payment status polling detected');
      }
    }

    // STEP 6: Navigate to payment success page to test webhook response handling
    console.log('🎯 Step 6: Testing payment success page and webhook handling...');

    if (paymentId && orderId) {
      // Navigate to payment success page
      await page.goto(`/payment/success?payment_id=${paymentId}&order_id=${orderId}`);
      await page.waitForLoadState('networkidle');

      // Wait for status checking
      await page.waitForTimeout(8000);

      // Check for additional status calls from success page
      const successPageStatusCalls = capturedRequests.filter(req => 
        req.url.includes('/payments/') && req.url.includes('/status') &&
        new Date(req.timestamp) > new Date(Date.now() - 10000) // Last 10 seconds
      );

      console.log(`📊 Success Page Status Calls (${successPageStatusCalls.length}):`);
      successPageStatusCalls.forEach(call => {
        console.log('Status call:', call.url, call.timestamp);
      });

      // Check page content for status indicators
      const pageContent = await page.textContent('body');
      console.log('📄 Success page content indicators:');
      
      const statusIndicators = [
        'Verificando',
        'Aguardando',
        'Pagamento',
        'Status',
        'Processando',
        'Concluído'
      ];

      statusIndicators.forEach(indicator => {
        if (pageContent?.includes(indicator)) {
          console.log(`✅ Found indicator: ${indicator}`);
        }
      });
    }

    // STEP 7: Summary of all API calls
    console.log('📋 Step 7: API Calls Summary');
    console.log('='.repeat(50));
    
    const apiCallsSummary = {
      registration: capturedRequests.filter(req => req.url.includes('register')).length,
      login: capturedRequests.filter(req => req.url.includes('login')).length,
      upload: capturedRequests.filter(req => req.url.includes('upload')).length,
      payment: capturedRequests.filter(req => req.url.includes('payment')).length,
      orders: capturedRequests.filter(req => req.url.includes('orders')).length,
      total: capturedRequests.length
    };

    console.log('📊 API Calls by Type:');
    Object.entries(apiCallsSummary).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} calls`);
    });

    const errorResponses = capturedResponses.filter(res => res.status >= 400);
    console.log(`❌ Error Responses: ${errorResponses.length}`);
    
    if (errorResponses.length > 0) {
      console.log('Error Details:');
      errorResponses.forEach(error => {
        console.log(`  ${error.status} ${error.url}: ${JSON.stringify(error.body)}`);
      });
    }

    const successfulResponses = capturedResponses.filter(res => res.status < 400);
    console.log(`✅ Successful Responses: ${successfulResponses.length}`);

    // STEP 8: Test webhook simulation (if payment was created)
    console.log('🔔 Step 8: Webhook Response Validation');
    
    if (paymentId) {
      console.log(`💡 To test webhook response:`);
      console.log(`1. Access the AbacatePay URL: ${paymentUrl}`);
      console.log(`2. Complete the payment flow`);
      console.log(`3. Backend should receive webhook with payment confirmation`);
      console.log(`4. Frontend should update automatically via polling`);
      
      // Continue monitoring for a bit longer to catch any webhook-triggered updates
      console.log('⏳ Monitoring for webhook-triggered updates...');
      await page.waitForTimeout(10000);
      
      // Check for any new API calls that might indicate webhook processing
      const recentCalls = capturedRequests.filter(req => 
        new Date(req.timestamp) > new Date(Date.now() - 15000) // Last 15 seconds
      );
      
      console.log(`📊 Recent API calls (last 15s): ${recentCalls.length}`);
      recentCalls.forEach(call => {
        console.log(`  ${call.method} ${call.url} at ${call.timestamp}`);
      });
    }

    console.log('✅ Backend integration validation completed');
    console.log('📋 Next steps: Complete payment in AbacatePay to test webhook flow');
  });

  test('Test webhook response handling with mock payment completion', async ({ page }) => {
    console.log('🔔 Testing webhook response handling...');

    // This test simulates what happens when a webhook is received
    // by monitoring the frontend's response to payment status changes

    const testPaymentId = 'test-payment-webhook-123';
    const testOrderId = 'test-order-webhook-456';

    // Navigate to payment success page
    await page.goto(`/payment/success?payment_id=${testPaymentId}&order_id=${testOrderId}`);
    await page.waitForLoadState('networkidle');

    // Mock successful payment response
    await page.route('**/api/payments/*/status', async (route) => {
      const url = route.request().url();
      console.log(`🔍 Intercepted status check: ${url}`);
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            payment_id: testPaymentId,
            status: 'paid', // Simulate webhook updated this to 'paid'
            order_id: testOrderId,
            updated_at: new Date().toISOString()
          }
        })
      });
    });

    // Mock order status as processing after payment
    await page.route('**/api/orders/*', async (route) => {
      const url = route.request().url();
      console.log(`🔍 Intercepted order check: ${url}`);
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: testOrderId,
            status: 'processing', // Simulate webhook triggered processing
            progress: 45,
            filename: 'Ponto2.pdf',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        })
      });
    });

    // Wait for polling to occur
    await page.waitForTimeout(8000);

    // Check if page responds to the 'paid' status
    const pageContent = await page.textContent('body');
    console.log('📄 Page content after mock webhook response:');
    
    // Look for indicators that the frontend processed the webhook response
    const webhookIndicators = [
      'paid',
      'pago',
      'confirmado',
      'processando',
      'processing',
      'complete'
    ];

    let webhookResponseDetected = false;
    webhookIndicators.forEach(indicator => {
      if (pageContent?.toLowerCase().includes(indicator.toLowerCase())) {
        console.log(`✅ Webhook response indicator found: ${indicator}`);
        webhookResponseDetected = true;
      }
    });

    if (webhookResponseDetected) {
      console.log('✅ Frontend is responding to webhook-triggered status changes');
    } else {
      console.log('⚠️ Frontend may not be properly handling webhook responses');
      console.log('📄 Current page content:', pageContent?.substring(0, 500));
    }

    // Check for redirect to complete page (expected behavior when payment is confirmed)
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/payment/complete')) {
      console.log('✅ Automatic redirect to complete page detected');
    } else {
      console.log('⚠️ No automatic redirect detected - may indicate webhook handling issue');
    }

    console.log('✅ Webhook response handling test completed');
  });

  test.afterEach(async () => {
    // Log summary of captured network activity
    console.log('\n📊 Test Summary:');
    console.log(`Total API requests: ${capturedRequests.length}`);
    console.log(`Total API responses: ${capturedResponses.length}`);
    
    const errors = capturedResponses.filter(res => res.status >= 400);
    if (errors.length > 0) {
      console.log(`❌ Errors detected: ${errors.length}`);
      errors.forEach(error => {
        console.log(`  ${error.status} ${error.url}`);
      });
    } else {
      console.log('✅ No API errors detected');
    }
  });
});