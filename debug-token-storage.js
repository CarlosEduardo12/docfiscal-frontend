/**
 * Debug Token Storage Issue
 * Tests token storage with actual response data
 */

const { chromium } = require('playwright');

async function debugTokenStorage() {
  console.log('🔍 Starting token storage debug test...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Add console logging
  page.on('console', (msg) => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
  });
  
  try {
    // Go to login page
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('#login-title', { timeout: 10000 });
    
    // Clear localStorage
    await page.evaluate(() => localStorage.clear());
    
    // Fill and submit login form
    await page.fill('input[type="email"]', 'test@docfiscal.com');
    await page.fill('input[type="password"]', 'testpassword123');
    
    // Intercept the login response to see the actual token data
    let loginResponseData = null;
    page.on('response', async (response) => {
      if (response.url().includes('/api/auth/login') && response.status() === 200) {
        try {
          const responseText = await response.text();
          loginResponseData = JSON.parse(responseText);
          console.log('\n📦 Login Response Data:', JSON.stringify(loginResponseData, null, 2));
        } catch (error) {
          console.log('❌ Failed to parse login response:', error);
        }
      }
    });
    
    // Submit login
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Debug token storage directly in browser
    const debugResult = await page.evaluate(() => {
      // Get the actual response data that would be used for token storage
      const mockResponseData = {
        success: true,
        data: {
          access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzI3ZTY5MC0zNGRhLTQ3ODMtODQ2Yy1mYTBkYzIxMDNhZDMiLCJlbWFpbCI6InRlc3RAZG9jZmlzY2FsLmNvbSIsIm5hbWUiOiJUZXN0IFVzZXIiLCJpYXQiOjE3NjcxMjc0NTIsImV4cCI6MTc2NzEzMTA1Mn0.test_signature",
          refresh_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzI3ZTY5MC0zNGRhLTQ3ODMtODQ2Yy1mYTBkYzIxMDNhZDMiLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTc2NzEyNzQ1MiwiZXhwIjoxNzY3MjEzODUyfQ.test_refresh_signature",
          expires_in: 3600,
          user: {
            id: "6727e690-34da-4783-846c-fa0dc2103ad3",
            email: "test@docfiscal.com",
            name: "Test User"
          }
        }
      };
      
      console.log('🧪 Testing token storage with mock data...');
      
      // Create tokens object like AuthContext does
      const tokens = {
        accessToken: mockResponseData.data.access_token,
        refreshToken: mockResponseData.data.refresh_token,
        expiresAt: new Date(Date.now() + mockResponseData.data.expires_in * 1000),
      };
      
      console.log('📋 Tokens to store:', {
        accessTokenLength: tokens.accessToken.length,
        refreshTokenLength: tokens.refreshToken.length,
        expiresAt: tokens.expiresAt.toISOString(),
        accessTokenStart: tokens.accessToken.substring(0, 50) + '...',
        refreshTokenStart: tokens.refreshToken.substring(0, 50) + '...'
      });
      
      // Test token format validation manually
      const isValidAccessToken = (token) => {
        if (!token || typeof token !== 'string') return false;
        const parts = token.split('.');
        return parts.length === 3 && parts.every(part => part.length > 0);
      };
      
      console.log('🔍 Token validation results:', {
        accessTokenValid: isValidAccessToken(tokens.accessToken),
        refreshTokenValid: isValidAccessToken(tokens.refreshToken),
        expiresAtValid: tokens.expiresAt instanceof Date && !isNaN(tokens.expiresAt.getTime())
      });
      
      // Try to store tokens manually
      try {
        localStorage.setItem('docfiscal_access_token', tokens.accessToken);
        localStorage.setItem('docfiscal_refresh_token', tokens.refreshToken);
        localStorage.setItem('docfiscal_token_expires_at', tokens.expiresAt.toISOString());
        
        console.log('✅ Manual token storage successful');
        
        // Verify storage
        const storedAccess = localStorage.getItem('docfiscal_access_token');
        const storedRefresh = localStorage.getItem('docfiscal_refresh_token');
        const storedExpiry = localStorage.getItem('docfiscal_token_expires_at');
        
        console.log('📋 Verification results:', {
          accessStored: !!storedAccess,
          refreshStored: !!storedRefresh,
          expiryStored: !!storedExpiry,
          accessMatches: storedAccess === tokens.accessToken,
          refreshMatches: storedRefresh === tokens.refreshToken,
          expiryMatches: storedExpiry === tokens.expiresAt.toISOString()
        });
        
        return {
          success: true,
          tokensStored: true,
          verification: {
            accessStored: !!storedAccess,
            refreshStored: !!storedRefresh,
            expiryStored: !!storedExpiry
          }
        };
      } catch (error) {
        console.log('❌ Manual token storage failed:', error);
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('\n🔍 Debug Result:', debugResult);
    
    // Check final localStorage state
    const finalStorage = await page.evaluate(() => {
      const storage = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          storage[key] = localStorage.getItem(key);
        }
      }
      return storage;
    });
    
    console.log('\n📋 Final localStorage state:');
    Object.entries(finalStorage).forEach(([key, value]) => {
      if (key.includes('docfiscal') || key.includes('token')) {
        console.log(`  ${key}: ${typeof value === 'string' ? value.substring(0, 100) + (value.length > 100 ? '...' : '') : value}`);
      }
    });
    
    if (loginResponseData) {
      console.log('\n📦 Actual login response tokens:');
      console.log(`  access_token length: ${loginResponseData.data?.access_token?.length || 'N/A'}`);
      console.log(`  refresh_token length: ${loginResponseData.data?.refresh_token?.length || 'N/A'}`);
      console.log(`  expires_in: ${loginResponseData.data?.expires_in || 'N/A'}`);
    }
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the debug test
debugTokenStorage().catch(console.error);