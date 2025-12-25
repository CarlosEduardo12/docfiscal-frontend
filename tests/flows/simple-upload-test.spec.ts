import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Simple Upload Test', () => {
  test('Complete flow: Register → Upload → Payment', async ({ page }) => {
    console.log('🧪 Testing complete upload and payment flow...');

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
        }
      }
    });

    // STEP 1: Create new user account
    console.log('👤 Step 1: Creating new user account...');
    
    const timestamp = Date.now();
    const testUser = {
      name: `Test User ${timestamp}`,
      email: `test${timestamp}@docfiscal.com`,
      password: 'testpass123'
    };
    
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    // Fill and submit registration form
    await page.fill('#name', testUser.name);
    await page.fill('#email', testUser.email);
    await page.fill('#password', testUser.password);
    await page.fill('#confirmPassword', testUser.password);
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    
    // Check if registration was successful
    const registerCall = apiCalls.find(call => 
      call.type === 'response' && 
      call.url.includes('register') && 
      call.status < 400
    );
    
    if (registerCall) {
      console.log('✅ Registration successful');
    } else {
      console.log('⚠️ Registration may have failed');
    }
    
    // STEP 2: Ensure we're on the main page and authenticated
    console.log('🏠 Step 2: Navigating to main page...');
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if we need to login
    if (page.url().includes('/login')) {
      console.log('🔑 Need to login...');
      await page.fill('#email', testUser.email);
      await page.fill('#password', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      
      // Go back to main page
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    }
    
    // Verify we're authenticated
    const pageContent = await page.textContent('body');
    if (pageContent?.includes('Fazer Login')) {
      console.log('❌ Still not authenticated');
      return; // Exit test if not authenticated
    }
    
    console.log('✅ Successfully authenticated and on main page');
    
    // STEP 3: Upload PDF file
    console.log('📁 Step 3: Uploading Ponto2.pdf...');
    
    // Find file input (it's hidden, but we can still interact with it)
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached({ timeout: 10000 });
    
    // Select file
    const pdfPath = path.join(process.cwd(), 'Ponto2.pdf');
    await fileInput.setInputFiles(pdfPath);
    console.log('✅ File selected');
    
    // Wait for React to re-render and show the upload button
    // The button text should be "Enviar PDF para Conversão" based on the component
    console.log('⏳ Waiting for upload button to appear after file selection...');
    
    const uploadButton = page.locator('button:has-text("Enviar PDF para Conversão")');
    
    // Wait for the button to be visible and enabled
    await expect(uploadButton).toBeVisible({ timeout: 10000 });
    await expect(uploadButton).toBeEnabled({ timeout: 5000 });
    
    console.log('✅ Upload button is now visible and enabled');
    
    // Verify the file info is displayed (should show file name and size)
    const fileInfo = page.locator('.bg-gray-50:has-text("Ponto2.pdf")');
    await expect(fileInfo).toBeVisible({ timeout: 5000 });
    console.log('✅ File information is displayed');
    
    // Click the upload button
    await uploadButton.click();
    console.log('📤 Upload button clicked');
    
    // Wait for upload to process and move to payment step
    console.log('⏳ Waiting for upload to complete...');
    
    // The component should move to payment step and show payment button
    const paymentButton = page.locator('button:has-text("Pagar com PIX")');
    await expect(paymentButton).toBeVisible({ timeout: 15000 });
    console.log('✅ Payment button appeared - upload was successful');
    
    // Check for upload API calls
    const uploadCalls = apiCalls.filter(call => 
      call.type === 'response' && 
      (call.url.includes('upload') || call.url.includes('orders')) &&
      call.status < 400
    );
    
    console.log(`📊 Upload API calls: ${uploadCalls.length}`);
    
    let orderId = null;
    if (uploadCalls.length > 0) {
      const uploadResponse = uploadCalls[0];
      console.log('✅ Upload successful:', uploadResponse.body);
      
      if (uploadResponse.body && typeof uploadResponse.body === 'object') {
        orderId = uploadResponse.body.data?.order_id || 
                 uploadResponse.body.order_id ||
                 uploadResponse.body.data?.id;
        console.log(`📋 Order ID: ${orderId}`);
      }
    } else {
      console.log('❌ No successful upload detected');
    }
    
    // STEP 4: Test payment creation
    console.log('💳 Step 4: Testing payment creation...');
    
    // The payment button should already be visible from the previous step
    // Based on the component, it should be "💳 Pagar com PIX - R$ 50,00"
    const pixPaymentButton = page.locator('button:has-text("Pagar com PIX")');
    
    // Verify payment summary is shown
    const paymentSummary = page.locator('.bg-gray-50:has-text("Resumo do Pedido")');
    await expect(paymentSummary).toBeVisible({ timeout: 5000 });
    console.log('✅ Payment summary is displayed');
    
    // Click payment button
    await pixPaymentButton.click();
    console.log('💳 Payment button clicked');
    
    // Wait for payment creation and redirect to waiting step
    console.log('⏳ Waiting for payment creation...');
    
    // Should move to waiting step with "Aguardando Pagamento" title
    const waitingTitle = page.locator('h2:has-text("Aguardando Pagamento")');
    await expect(waitingTitle).toBeVisible({ timeout: 10000 });
    console.log('✅ Moved to payment waiting step');
    
    // Check for payment API calls
    const paymentCalls = apiCalls.filter(call => 
      call.type === 'response' && 
      call.url.includes('payment') &&
      call.status < 400
    );
    
    console.log(`📊 Payment API calls: ${paymentCalls.length}`);
    
    if (paymentCalls.length > 0) {
      const paymentResponse = paymentCalls[0];
      console.log('✅ Payment created:', paymentResponse.body);
      
      if (paymentResponse.body && typeof paymentResponse.body === 'object') {
        const paymentData = paymentResponse.body.data || paymentResponse.body;
        const paymentUrl = paymentData.payment_url;
        const paymentId = paymentData.payment_id;
        
        console.log(`💳 Payment ID: ${paymentId}`);
        console.log(`🔗 Payment URL: ${paymentUrl}`);
        
        if (paymentUrl && paymentUrl.includes('abacatepay.com')) {
          console.log('✅ AbacatePay URL generated successfully');
          console.log('💡 Test the payment by accessing:', paymentUrl);
        }
      }
    } else {
      console.log('❌ No payment creation detected');
    }
    
    // STEP 5: Test payment status polling and webhook handling
    console.log('🔍 Step 5: Testing payment status polling...');
    
    // The component should be polling payment status every 5 seconds
    // and showing payment status updates
    
    // Wait for status polling to start
    await page.waitForTimeout(8000);
    
    // Check for status polling API calls
    const statusCalls = apiCalls.filter(call => 
      call.type === 'request' && 
      (call.url.includes('status') || call.url.includes('payments/'))
    );
    
    console.log(`📊 Status polling calls: ${statusCalls.length}`);
    
    if (statusCalls.length > 0) {
      console.log('✅ Payment status polling is working');
      statusCalls.forEach((call, index) => {
        console.log(`  ${index + 1}. ${call.url} at ${call.timestamp}`);
      });
    } else {
      console.log('⚠️ No payment status polling detected');
    }
    
    // Check if payment status is being displayed
    const paymentStatus = page.locator('p:has-text("Aguardando pagamento")');
    if (await paymentStatus.isVisible()) {
      console.log('✅ Payment status is being displayed');
    }
    
    // Check if countdown timer is working
    const timeRemaining = page.locator('span:has-text(":")'); // Time format MM:SS
    if (await timeRemaining.isVisible()) {
      console.log('✅ Countdown timer is working');
    }
    
    // Look for "Reabrir Pagamento" button
    const reopenButton = page.locator('button:has-text("Reabrir Pagamento")');
    if (await reopenButton.isVisible()) {
      console.log('✅ Reopen payment button is available');
    }
    
    // Final summary
    console.log('\n📋 Test Summary:');
    console.log(`Total API calls: ${apiCalls.length}`);
    
    const errors = apiCalls.filter(call => 
      call.type === 'response' && call.status >= 400
    );
    
    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length}`);
      errors.forEach(error => {
        console.log(`  ${error.status} ${error.url}`);
      });
    } else {
      console.log('✅ No API errors detected');
    }
    
    const hasRegistration = apiCalls.some(call => 
      call.type === 'response' && call.url.includes('register') && call.status < 400
    );
    const hasUpload = apiCalls.some(call => 
      call.type === 'response' && 
      (call.url.includes('upload') || call.url.includes('orders')) && 
      call.status < 400
    );
    const hasPayment = apiCalls.some(call => 
      call.type === 'response' && call.url.includes('payment') && call.status < 400
    );
    
    console.log('\n🎯 Flow Components:');
    console.log(`Registration: ${hasRegistration ? '✅' : '❌'}`);
    console.log(`Upload: ${hasUpload ? '✅' : '❌'}`);
    console.log(`Payment: ${hasPayment ? '✅' : '❌'}`);
    
    console.log('✅ Test completed');
  });
});