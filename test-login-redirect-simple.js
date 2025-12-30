/**
 * Simple Login Redirect Test
 * Tests the specific issue: login success but no redirect to dashboard
 */

const { chromium } = require('playwright');

async function testLoginRedirect() {
  console.log('🚀 Starting simple login redirect test...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Add console logging
  page.on('console', (msg) => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
  });
  
  // Monitor localStorage changes
  await page.addInitScript(() => {
    const originalSetItem = localStorage.setItem;
    const originalRemoveItem = localStorage.removeItem;
    
    localStorage.setItem = function(key, value) {
      console.log(`[LOCALSTORAGE SET] ${key}:`, value?.substring(0, 50) + (value?.length > 50 ? '...' : ''));
      return originalSetItem.call(this, key, value);
    };
    
    localStorage.removeItem = function(key) {
      console.log(`[LOCALSTORAGE REMOVE] ${key}`);
      return originalRemoveItem.call(this, key);
    };
  });
  
  try {
    // Step 1: Go to login page
    console.log('\n📝 Step 1: Navigating to login page...');
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('#login-title', { timeout: 10000 });
    console.log('✅ Login page loaded');
    
    // Step 2: Clear localStorage
    console.log('\n🧹 Step 2: Clearing localStorage...');
    await page.evaluate(() => localStorage.clear());
    
    // Step 3: Fill login form with test credentials
    console.log('\n🔐 Step 3: Filling login form...');
    await page.fill('input[type="email"]', 'test@docfiscal.com');
    await page.fill('input[type="password"]', 'testpassword123');
    
    // Step 4: Submit login and monitor
    console.log('\n📤 Step 4: Submitting login form...');
    
    // Monitor network requests
    const requests = [];
    const responses = [];
    
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/login')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
        });
        console.log(`📡 Login request: ${request.method()} ${request.url()}`);
      }
    });
    
    page.on('response', async (response) => {
      if (response.url().includes('/api/auth/login')) {
        const responseData = {
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        };
        
        try {
          const body = await response.text();
          responseData.body = body;
        } catch (error) {
          responseData.body = 'Could not read body';
        }
        
        responses.push(responseData);
        console.log(`📨 Login response: ${response.status()} ${response.statusText()}`);
      }
    });
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Step 5: Wait and check for success message
    console.log('\n⏳ Step 5: Waiting for login response...');
    await page.waitForTimeout(3000);
    
    // Check for success message
    const successMessage = await page.locator('text=Login successful').isVisible();
    console.log(`Success message visible: ${successMessage}`);
    
    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL after login: ${currentUrl}`);
    
    // Check localStorage tokens
    const tokens = await page.evaluate(() => ({
      docfiscal_access_token: localStorage.getItem('docfiscal_access_token'),
      docfiscal_refresh_token: localStorage.getItem('docfiscal_refresh_token'),
      docfiscal_token_expires_at: localStorage.getItem('docfiscal_token_expires_at'),
      access_token: localStorage.getItem('access_token'),
      refresh_token: localStorage.getItem('refresh_token'),
    }));
    
    console.log('\n🔑 Tokens in localStorage:');
    Object.entries(tokens).forEach(([key, value]) => {
      console.log(`  ${key}: ${value ? 'present' : 'missing'}`);
    });
    
    // Step 6: Check for redirect or manually navigate
    console.log('\n🔄 Step 6: Checking redirect behavior...');
    
    if (currentUrl.includes('/dashboard')) {
      console.log('✅ Successfully redirected to dashboard');
    } else if (currentUrl.includes('/login')) {
      console.log('❌ Still on login page - redirect failed');
      
      // Check for error messages
      const errorElements = await page.locator('[role="alert"], .text-red-600').allTextContents();
      if (errorElements.length > 0) {
        console.log('❌ Error messages found:', errorElements);
      }
      
      // Try manual navigation to dashboard
      console.log('🔄 Attempting manual navigation to dashboard...');
      await page.goto('http://localhost:3000/dashboard');
      await page.waitForTimeout(2000);
      
      const dashboardUrl = page.url();
      console.log(`Manual navigation result: ${dashboardUrl}`);
      
      if (dashboardUrl.includes('/dashboard')) {
        console.log('✅ Manual navigation to dashboard successful');
        
        // Check if dashboard content loads
        try {
          await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 5000 });
          console.log('✅ Dashboard content loaded');
        } catch (error) {
          console.log('❌ Dashboard content failed to load');
        }
      } else {
        console.log('❌ Manual navigation also failed - redirected back to:', dashboardUrl);
      }
    }
    
    // Step 7: Print summary
    console.log('\n📊 Test Summary:');
    console.log(`Login requests: ${requests.length}`);
    console.log(`Login responses: ${responses.length}`);
    console.log(`Success message shown: ${successMessage}`);
    console.log(`Tokens stored: ${Object.values(tokens).some(v => v)}`);
    console.log(`Final URL: ${page.url()}`);
    
    // Print detailed response info
    if (responses.length > 0) {
      console.log('\n📨 Response details:');
      responses.forEach((resp, index) => {
        console.log(`  ${index + 1}. Status: ${resp.status} ${resp.statusText}`);
        console.log(`     Body: ${resp.body?.substring(0, 200)}${resp.body?.length > 200 ? '...' : ''}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testLoginRedirect().catch(console.error);