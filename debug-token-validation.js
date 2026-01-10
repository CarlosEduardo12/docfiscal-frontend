/**
 * Debug script to inspect token validation issues
 * Run this in the browser console to see what tokens are stored and why they're failing validation
 */

console.log('🔍 Token Validation Debug Script');
console.log('================================');

// Check what's actually stored in localStorage
const accessToken = localStorage.getItem('docfiscal_access_token');
const refreshToken = localStorage.getItem('docfiscal_refresh_token');
const expiresAt = localStorage.getItem('docfiscal_token_expires_at');

console.log('📦 Current localStorage contents:');
console.log('Access Token:', accessToken ? `"${accessToken}"` : 'null');
console.log('Refresh Token:', refreshToken ? `"${refreshToken}"` : 'null');
console.log('Expires At:', expiresAt ? `"${expiresAt}"` : 'null');

// Token format validation function (copied from AuthTokenManager)
function isValidTokenFormat(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Reject specific test malformed tokens
  if (
    token === 'not.a.jwt' ||
    token === 'also.not.jwt' ||
    token === 'invalid-token'
  ) {
    return false;
  }

  // Basic JWT format check (3 parts separated by dots)
  const parts = token.split('.');
  if (parts.length !== 3 || !parts.every((part) => part.length > 0)) {
    return false;
  }

  // Check minimum realistic lengths for JWT parts
  const [header, payload, signature] = parts;
  if (header.length < 10 || payload.length < 20 || signature.length < 10) {
    return false;
  }

  // Validate base64-like format
  const base64Pattern = /^[A-Za-z0-9+/=_-]*$/;
  return parts.every((part) => base64Pattern.test(part));
}

// Validate each token
console.log('\n🔍 Token Validation Results:');

if (accessToken) {
  const parts = accessToken.split('.');
  console.log('Access Token Analysis:');
  console.log('  - Length:', accessToken.length);
  console.log('  - Parts count:', parts.length);
  console.log('  - Parts lengths:', parts.map(p => p.length));
  console.log('  - Is valid format:', isValidTokenFormat(accessToken));
  console.log('  - First 50 chars:', accessToken.substring(0, 50) + '...');
  
  if (parts.length === 3) {
    const [header, payload, signature] = parts;
    console.log('  - Header length:', header.length, '(min: 10)');
    console.log('  - Payload length:', payload.length, '(min: 20)');
    console.log('  - Signature length:', signature.length, '(min: 10)');
    
    // Check base64 pattern
    const base64Pattern = /^[A-Za-z0-9+/=_-]*$/;
    console.log('  - Header base64 valid:', base64Pattern.test(header));
    console.log('  - Payload base64 valid:', base64Pattern.test(payload));
    console.log('  - Signature base64 valid:', base64Pattern.test(signature));
  }
} else {
  console.log('Access Token: Not found');
}

if (refreshToken) {
  const parts = refreshToken.split('.');
  console.log('\nRefresh Token Analysis:');
  console.log('  - Length:', refreshToken.length);
  console.log('  - Parts count:', parts.length);
  console.log('  - Parts lengths:', parts.map(p => p.length));
  console.log('  - Is valid format:', isValidTokenFormat(refreshToken));
  console.log('  - First 50 chars:', refreshToken.substring(0, 50) + '...');
  
  if (parts.length === 3) {
    const [header, payload, signature] = parts;
    console.log('  - Header length:', header.length, '(min: 10)');
    console.log('  - Payload length:', payload.length, '(min: 20)');
    console.log('  - Signature length:', signature.length, '(min: 10)');
    
    // Check base64 pattern
    const base64Pattern = /^[A-Za-z0-9+/=_-]*$/;
    console.log('  - Header base64 valid:', base64Pattern.test(header));
    console.log('  - Payload base64 valid:', base64Pattern.test(payload));
    console.log('  - Signature base64 valid:', base64Pattern.test(signature));
  }
} else {
  console.log('Refresh Token: Not found');
}

if (expiresAt) {
  console.log('\nExpiration Date Analysis:');
  console.log('  - Raw value:', expiresAt);
  console.log('  - Length:', expiresAt.length);
  console.log('  - Is empty string:', expiresAt.trim() === '');
  
  try {
    const date = new Date(expiresAt);
    console.log('  - Parsed date:', date);
    console.log('  - Is valid date:', !isNaN(date.getTime()));
    console.log('  - Is expired:', date < new Date());
  } catch (error) {
    console.log('  - Parse error:', error.message);
  }
} else {
  console.log('Expiration Date: Not found');
}

// Check if there are any other related keys
console.log('\n🔍 All localStorage keys with "docfiscal" or "token":');
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && (key.includes('docfiscal') || key.includes('token'))) {
    const value = localStorage.getItem(key);
    console.log(`  - ${key}: ${value ? `"${value.substring(0, 100)}${value.length > 100 ? '...' : ''}"` : 'null'}`);
  }
}

console.log('\n✅ Debug script completed');
console.log('Copy this output and share it to help diagnose the token validation issue.');