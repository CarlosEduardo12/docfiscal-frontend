# Token Validation Debug Guide

## Issue Description
You're seeing token validation errors:
- "Access token has invalid format"
- "Refresh token has invalid format" 
- "Expiration date is invalid"

## Root Cause Analysis

The token validation is failing because the tokens stored in localStorage don't match the expected JWT format. This could be due to:

1. **Backend API returning non-JWT tokens** - The API might be returning simple strings instead of proper JWTs
2. **Token corruption during storage** - Tokens might be getting corrupted when stored/retrieved
3. **Overly strict validation** - The validation logic might be too restrictive

## Enhanced Debugging

I've added detailed logging to the `AuthTokenManager.ts` to help identify the exact issue:

### New Debug Features
- **Detailed token validation logging** - Shows exactly why each token fails validation
- **Token format analysis** - Logs token structure, parts, and lengths
- **Base64 validation details** - Shows which parts fail base64 pattern matching
- **Expiration date parsing** - Detailed logging for date validation

## Debug Scripts Available

### 1. Token Validation Debug Script
**File**: `debug-token-validation.js`
**Usage**: Run in browser console to inspect current localStorage tokens
```javascript
// Copy and paste the contents of debug-token-validation.js into browser console
```

### 2. Login Token Flow Debug Script  
**File**: `debug-login-token-flow.js`
**Usage**: Test complete login flow and capture token details
```javascript
// In browser console:
debugLoginFlow("your-email@example.com", "your-password")
// Or use default test credentials:
debugLoginFlow()
```

## Debugging Steps

### Step 1: Check Current Token Storage
1. Open browser console
2. Run the token validation debug script
3. Look for:
   - What tokens are actually stored
   - Token format (JWT structure: header.payload.signature)
   - Token lengths and content
   - Expiration date format

### Step 2: Test Login Flow
1. Clear existing tokens
2. Run the login flow debug script
3. Examine:
   - Raw API response from backend
   - Token structure in API response
   - How tokens are processed and stored

### Step 3: Analyze Validation Failures
With enhanced logging now active, when you see validation errors, check the console for detailed messages like:
- `🔍 Token validation failed: expected 3 parts, got X`
- `🔍 Token validation failed: header too short (X < 10)`
- `🔍 Token validation failed: payload contains invalid base64 characters`

## Common Issues & Solutions

### Issue 1: Backend Returns Non-JWT Tokens
**Symptoms**: Token has wrong number of parts or doesn't look like JWT
**Solution**: Update backend to return proper JWT tokens or adjust validation

### Issue 2: Token Corruption
**Symptoms**: Tokens look truncated or contain unexpected characters
**Solution**: Check storage mechanism and encoding/decoding

### Issue 3: Overly Strict Validation
**Symptoms**: Tokens look valid but fail validation checks
**Solution**: Adjust validation rules in `isValidTokenFormat()`

## Temporary Workaround

If you need to temporarily bypass validation for debugging:

```typescript
// In AuthTokenManager.ts, temporarily modify isValidTokenFormat():
private isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // TEMPORARY: Allow any non-empty string for debugging
  console.log('🚨 TEMPORARY: Bypassing token validation for debugging');
  return token.trim().length > 0;
}
```

## Next Steps

1. **Run the debug scripts** to understand what tokens are being stored
2. **Check the enhanced console logs** when validation fails
3. **Examine the backend API response** to see what format tokens are in
4. **Share the debug output** so we can identify the specific issue

The enhanced logging will show exactly why tokens are failing validation, making it much easier to identify and fix the root cause.