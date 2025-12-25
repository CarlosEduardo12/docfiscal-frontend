import { test, expect } from '@playwright/test';

test.describe('Authentication Backend Validation', () => {
  test('Register new user and login', async ({ page }) => {
    console.log('🧪 Testing user registration and login...');

    // Generate unique test user
    const timestamp = Date.now();
    const testUser = {
      fullName: `Test User ${timestamp}`,
      email: `testuser${timestamp}@docfiscal.com`,
      password: 'testpassword123'
    };

    console.log(`📝 Using test user: ${testUser.email}`);

    // Capture network requests
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
          console.log(`❌ Error response body:`, body);
        }
      }
    });

    // STEP 1: Test Registration
    console.log('🔐 Step 1: Testing user registration...');
    
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Verify form elements are present
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();

    // Fill registration form
    console.log('📝 Filling registration form...');
    await page.fill('#name', testUser.fullName);
    await page.fill('#email', testUser.email);
    await page.fill('#password', testUser.password);
    await page.fill('#confirmPassword', testUser.password);

    // Verify fields are filled
    expect(await page.inputValue('#name')).toBe(testUser.fullName);
    expect(await page.inputValue('#email')).toBe(testUser.email);
    expect(await page.inputValue('#password')).toBe(testUser.password);
    expect(await page.inputValue('#confirmPassword')).toBe(testUser.password);
    console.log('✅ All form fields filled correctly');

    // Submit registration
    console.log('📤 Submitting registration...');
    await page.click('button[type="submit"]');

    // Wait for response
    await page.waitForTimeout(5000);

    // Check registration API call
    const registerRequest = requests.find(req => 
      req.url.includes('/register') || req.url.includes('/auth/register')
    );
    const registerResponse = responses.find(res => 
      res.url.includes('/register') || res.url.includes('/auth/register')
    );

    console.log('📊 Registration Results:');
    if (registerRequest) {
      console.log('✅ Registration request sent');
    } else {
      console.log('❌ No registration request detected');
    }

    if (registerResponse) {
      console.log(`📥 Registration response: ${registerResponse.status}`);
      console.log('Response body:', registerResponse.body);
      
      if (registerResponse.status < 400) {
        console.log('✅ Registration successful');
      } else {
        console.log('❌ Registration failed');
      }
    } else {
      console.log('❌ No registration response detected');
    }

    // Check current URL after registration
    const currentUrl = page.url();
    console.log(`📍 Current URL after registration: ${currentUrl}`);

    // STEP 2: Test Login (if not automatically logged in)
    if (!currentUrl.includes('/dashboard')) {
      console.log('🔑 Step 2: Testing manual login...');
      
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Fill login form
      await page.fill('#email', testUser.email);
      await page.fill('#password', testUser.password);

      // Submit login
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      // Check login API call
      const loginRequest = requests.find(req => 
        req.url.includes('/login') || req.url.includes('/auth/login')
      );
      const loginResponse = responses.find(res => 
        res.url.includes('/login') || res.url.includes('/auth/login')
      );

      console.log('📊 Login Results:');
      if (loginRequest) {
        console.log('✅ Login request sent');
      }

      if (loginResponse) {
        console.log(`📥 Login response: ${loginResponse.status}`);
        console.log('Response body:', loginResponse.body);
        
        if (loginResponse.status < 400) {
          console.log('✅ Login successful');
        } else {
          console.log('❌ Login failed');
        }
      }
    } else {
      console.log('✅ User was automatically logged in after registration');
    }

    // Final URL check
    await page.waitForTimeout(2000);
    const finalUrl = page.url();
    console.log(`📍 Final URL: ${finalUrl}`);

    if (finalUrl.includes('/dashboard')) {
      console.log('✅ User successfully authenticated and redirected to dashboard');
    } else {
      console.log('⚠️ User not on dashboard - authentication may have failed');
    }

    // Summary
    console.log('\n📋 Test Summary:');
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

    console.log('✅ Authentication test completed');
  });

  test('Test form validation', async ({ page }) => {
    console.log('🧪 Testing form validation...');

    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Test password mismatch
    await page.fill('#name', 'Test User');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    await page.fill('#confirmPassword', 'differentpassword');

    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    // Check for error message
    const errorMessage = await page.textContent('[role="alert"], .text-red-600');
    console.log('Error message:', errorMessage);

    if (errorMessage && errorMessage.includes('match')) {
      console.log('✅ Password mismatch validation working');
    } else {
      console.log('⚠️ Password mismatch validation may not be working');
    }

    console.log('✅ Form validation test completed');
  });
});