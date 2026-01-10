/**
 * Debug script to trace the complete login token flow
 * Run this in the browser console after attempting a login
 */

console.log('🔍 Login Token Flow Debug Script');
console.log('=================================');

// Override console.log to capture API logs
const originalLog = console.log;
const apiLogs = [];

console.log = function(...args) {
  const message = args.join(' ');
  if (message.includes('🔄 Making request') || 
      message.includes('📡 Response status') || 
      message.includes('✅ Success response') ||
      message.includes('🔐 Storing tokens')) {
    apiLogs.push(message);
  }
  originalLog.apply(console, args);
};

// Function to test login and capture token flow
async function debugLoginFlow(email = 'test@example.com', password = 'password123') {
  console.log('🚀 Starting debug login flow...');
  console.log('Email:', email);
  
  try {
    // Clear existing tokens first
    localStorage.removeItem('docfiscal_access_token');
    localStorage.removeItem('docfiscal_refresh_token');
    localStorage.removeItem('docfiscal_token_expires_at');
    console.log('🧹 Cleared existing tokens');
    
    // Make direct API call to see raw response
    const apiUrl = 'http://localhost:8000';
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });
    
    console.log('📡 Raw API Response Status:', response.status);
    console.log('📡 Raw API Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('📦 Raw API Response Data:', JSON.stringify(data, null, 2));
      
      // Analyze token structure
      if (data && data.tokens) {
        console.log('\n🔍 Token Analysis:');
        console.log('Access Token:', data.tokens.access_token ? 'Present' : 'Missing');
        console.log('Refresh Token:', data.tokens.refresh_token ? 'Present' : 'Missing');
        console.log('Expires In:', data.tokens.expires_in);
        
        if (data.tokens.access_token) {
          const accessToken = data.tokens.access_token;
          console.log('\n🔍 Access Token Details:');
          console.log('  - Type:', typeof accessToken);
          console.log('  - Length:', accessToken.length);
          console.log('  - First 100 chars:', accessToken.substring(0, 100));
          console.log('  - Parts (split by "."):', accessToken.split('.').length);
          console.log('  - Parts lengths:', accessToken.split('.').map(p => p.length));
          
          // Try to decode JWT parts
          try {
            const parts = accessToken.split('.');
            if (parts.length === 3) {
              const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
              const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
              console.log('  - Header:', header);
              console.log('  - Payload:', payload);
            }
          } catch (e) {
            console.log('  - JWT decode error:', e.message);
          }
        }
        
        if (data.tokens.refresh_token) {
          const refreshToken = data.tokens.refresh_token;
          console.log('\n🔍 Refresh Token Details:');
          console.log('  - Type:', typeof refreshToken);
          console.log('  - Length:', refreshToken.length);
          console.log('  - First 100 chars:', refreshToken.substring(0, 100));
          console.log('  - Parts (split by "."):', refreshToken.split('.').length);
          console.log('  - Parts lengths:', refreshToken.split('.').map(p => p.length));
        }
      } else {
        console.log('❌ No tokens found in response');
      }
    } else {
      const errorText = await response.text();
      console.log('❌ API Error Response:', errorText);
    }
    
  } catch (error) {
    console.log('❌ Debug login error:', error);
  }
  
  // Check what got stored
  console.log('\n📦 Post-login localStorage:');
  const storedAccess = localStorage.getItem('docfiscal_access_token');
  const storedRefresh = localStorage.getItem('docfiscal_refresh_token');
  const storedExpires = localStorage.getItem('docfiscal_token_expires_at');
  
  console.log('Stored Access Token:', storedAccess ? `${storedAccess.substring(0, 50)}...` : 'null');
  console.log('Stored Refresh Token:', storedRefresh ? `${storedRefresh.substring(0, 50)}...` : 'null');
  console.log('Stored Expires At:', storedExpires);
  
  // Show captured API logs
  console.log('\n📋 Captured API Logs:');
  apiLogs.forEach(log => console.log(log));
  
  console.log('\n✅ Debug login flow completed');
}

// Make the function available globally
window.debugLoginFlow = debugLoginFlow;

console.log('✅ Debug script loaded');
console.log('💡 Usage: debugLoginFlow("your-email@example.com", "your-password")');
console.log('💡 Or use default test credentials: debugLoginFlow()');