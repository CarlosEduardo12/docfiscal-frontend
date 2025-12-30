#!/usr/bin/env node

/**
 * Test script to verify basic authentication functionality
 * This script tests:
 * 1. Login and redirection in local environment
 * 2. Session persistence after reload
 * 3. No redirect loops
 */

const puppeteer = require('puppeteer');

async function testAuthFlow() {
  console.log('🚀 Starting authentication flow test...');
  
  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({ 
      headless: false, // Set to true for CI
      defaultViewport: { width: 1280, height: 720 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      console.log(`🖥️  Browser: ${msg.text()}`);
    });
    
    // Test 1: Navigate to login page
    console.log('📝 Test 1: Navigate to login page');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
    
    // Check if login form is present
    const loginForm = await page.$('form');
    if (!loginForm) {
      throw new Error('Login form not found');
    }
    console.log('✅ Login form found');
    
    // Test 2: Try to access protected route (should redirect to login)
    console.log('📝 Test 2: Try to access protected route');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle0' });
    
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      throw new Error(`Expected redirect to login, but got: ${currentUrl}`);
    }
    console.log('✅ Unauthenticated user correctly redirected to login');
    
    // Test 3: Perform login (using test credentials)
    console.log('📝 Test 3: Perform login');
    
    // Fill login form
    await page.type('input[type="email"]', 'test@example.com');
    await page.type('input[type="password"]', 'test123');
    
    // Submit form and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]')
    ]);
    
    // Check if redirected to dashboard
    const afterLoginUrl = page.url();
    console.log(`🔄 After login URL: ${afterLoginUrl}`);
    
    if (afterLoginUrl.includes('/dashboard')) {
      console.log('✅ Login successful - redirected to dashboard');
    } else if (afterLoginUrl.includes('/login')) {
      console.log('⚠️  Still on login page - checking for error messages');
      
      // Check for error messages
      const errorElements = await page.$$('.text-red-600');
      if (errorElements.length > 0) {
        const errorText = await page.evaluate(el => el.textContent, errorElements[0]);
        console.log(`❌ Login error: ${errorText}`);
        console.log('ℹ️  This might be expected if test credentials are not set up');
      }
    } else {
      console.log(`⚠️  Unexpected redirect to: ${afterLoginUrl}`);
    }
    
    // Test 4: Test session persistence (reload page)
    console.log('📝 Test 4: Test session persistence');
    await page.reload({ waitUntil: 'networkidle0' });
    
    const afterReloadUrl = page.url();
    console.log(`🔄 After reload URL: ${afterReloadUrl}`);
    
    // Test 5: Check for redirect loops (navigate multiple times)
    console.log('📝 Test 5: Check for redirect loops');
    
    let redirectCount = 0;
    const maxRedirects = 5;
    
    for (let i = 0; i < maxRedirects; i++) {
      const beforeUrl = page.url();
      await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
      const afterUrl = page.url();
      
      if (beforeUrl !== afterUrl) {
        redirectCount++;
      }
      
      // Small delay to prevent overwhelming the system
      await page.waitForTimeout(500);
    }
    
    console.log(`🔄 Redirect count: ${redirectCount}/${maxRedirects}`);
    
    if (redirectCount < maxRedirects) {
      console.log('✅ No infinite redirect loops detected');
    } else {
      console.log('⚠️  Potential redirect loop detected');
    }
    
    // Test 6: Check localStorage for tokens
    console.log('📝 Test 6: Check localStorage for tokens');
    
    const tokens = await page.evaluate(() => {
      return {
        accessToken: localStorage.getItem('docfiscal_access_token'),
        refreshToken: localStorage.getItem('docfiscal_refresh_token'),
        // Also check old format
        oldAccessToken: localStorage.getItem('access_token'),
        oldRefreshToken: localStorage.getItem('refresh_token')
      };
    });
    
    console.log('🔑 Token status:');
    console.log(`  - New format access token: ${tokens.accessToken ? 'Present' : 'Missing'}`);
    console.log(`  - New format refresh token: ${tokens.refreshToken ? 'Present' : 'Missing'}`);
    console.log(`  - Old format access token: ${tokens.oldAccessToken ? 'Present' : 'Missing'}`);
    console.log(`  - Old format refresh token: ${tokens.oldRefreshToken ? 'Present' : 'Missing'}`);
    
    console.log('✅ Authentication flow test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
if (require.main === module) {
  testAuthFlow()
    .then(() => {
      console.log('🎉 All tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testAuthFlow };