# Token Synchronization Issues Analysis

## Overview

The authentication system has **critical token synchronization problems** due to two incompatible token management systems operating simultaneously.

## Token Storage Key Conflicts

### System A: ApiClient (Currently Active)
**File**: `src/lib/api.ts`
**Storage Keys**:
```typescript
localStorage.setItem('access_token', accessToken);
localStorage.setItem('refresh_token', refreshToken);
```

**Usage**: 
- Used by login form
- Used by all components via `useAuthNew`
- **ACTIVE** in current implementation

### System B: AuthTokenManager (Proper Implementation)
**File**: `src/lib/AuthTokenManager.ts`
**Storage Keys**:
```typescript
localStorage.setItem('docfiscal_access_token', tokens.accessToken);
localStorage.setItem('docfiscal_refresh_token', tokens.refreshToken);
localStorage.setItem('docfiscal_token_expires_at', tokens.expiresAt.toISOString());
```

**Usage**:
- Used by `AuthContext`
- **NOT ACTIVE** (AuthProvider not in layout)
- More sophisticated with expiration tracking

## Synchronization Problems

### Problem 1: Token Storage Isolation

```typescript
// Login flow (ApiClient)
apiClient.login() → stores tokens as:
- 'access_token': 'jwt_token_here'
- 'refresh_token': 'refresh_token_here'

// If AuthContext was used (AuthTokenManager)
authTokenManager.getStoredTokens() → looks for:
- 'docfiscal_access_token': null (not found!)
- 'docfiscal_refresh_token': null (not found!)
- 'docfiscal_token_expires_at': null (not found!)

// Result: AuthTokenManager thinks user is not authenticated
```

### Problem 2: Token Refresh Inconsistency

**ApiClient Refresh Logic**:
```typescript
async refreshAccessToken(): Promise<boolean> {
  if (!this.refreshToken) return false;
  
  const response = await this.request('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: this.refreshToken }),
    skipAuth: true,
  });

  if (response.success && response.data?.access_token) {
    this.setTokens(
      response.data.access_token,
      response.data.refresh_token || this.refreshToken
    );
    return true;
  }
  return false;
}
```

**AuthTokenManager Refresh Logic**:
```typescript
async refreshToken(): Promise<TokenRefreshResult> {
  const tokens = this.getStoredTokens(); // Uses different keys!
  
  if (!tokens.refreshToken) {
    return { success: false, error: 'No refresh token available' };
  }
  
  // Makes same API call but stores with different keys
  const newTokens: AuthTokens = {
    accessToken: data.tokens.access_token,
    refreshToken: data.tokens.refresh_token || tokens.refreshToken,
    expiresAt: new Date(Date.now() + (data.tokens.expires_in || 3600) * 1000),
  };

  this.storeTokens(newTokens); // Stores with 'docfiscal_*' keys
}
```

**Result**: Two systems can refresh tokens independently, creating duplicate/conflicting tokens in localStorage.

### Problem 3: Authentication State Desynchronization

**Scenario**: User logs in successfully
```typescript
// Step 1: Login form uses ApiClient
apiClient.login() → Success
localStorage: {
  'access_token': 'valid_jwt',
  'refresh_token': 'valid_refresh'
}

// Step 2: Component uses useAuthNew
useAuthNew.checkAuth() → apiClient.isAuthenticated → true
Component shows authenticated state

// Step 3: If AuthContext was used simultaneously
AuthContext.initializeAuth() → authTokenManager.isAuthenticated() → false
// Because it looks for 'docfiscal_access_token' which doesn't exist

// Result: Same user appears authenticated and unauthenticated simultaneously
```

## Current localStorage State Analysis

### After Successful Login (Current System)
```javascript
localStorage = {
  'access_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  'refresh_token': 'refresh_token_value_here'
}
```

### If AuthTokenManager Was Used
```javascript
localStorage = {
  'docfiscal_access_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  'docfiscal_refresh_token': 'refresh_token_value_here',
  'docfiscal_token_expires_at': '2024-01-15T10:30:00.000Z'
}
```

### Potential Conflict State (Both Systems Active)
```javascript
localStorage = {
  // ApiClient tokens
  'access_token': 'token_from_api_client',
  'refresh_token': 'refresh_from_api_client',
  
  // AuthTokenManager tokens (if it was active)
  'docfiscal_access_token': 'token_from_auth_manager',
  'docfiscal_refresh_token': 'refresh_from_auth_manager',
  'docfiscal_token_expires_at': '2024-01-15T10:30:00.000Z'
}
```

## Race Condition Scenarios

### Scenario 1: Concurrent Token Refresh
```typescript
// Component A triggers refresh via ApiClient
apiClient.refreshAccessToken() // Updates 'access_token'

// Component B triggers refresh via AuthTokenManager (if active)
authTokenManager.refreshToken() // Updates 'docfiscal_access_token'

// Result: Two different tokens for same user, potential conflicts
```

### Scenario 2: Token Expiration Mismatch
```typescript
// ApiClient doesn't track expiration time
apiClient.isAuthenticated → checks if token exists, not if it's expired

// AuthTokenManager tracks expiration
authTokenManager.isAuthenticated() → checks existence AND expiration

// Result: ApiClient thinks token is valid, AuthTokenManager thinks it's expired
```

## Production Issue Root Cause Analysis

### Likely Production Scenario

1. **User logs in successfully**
   - ApiClient stores tokens with standard keys
   - Login form redirects to dashboard

2. **Dashboard loads**
   - Uses `useAuthNew` which calls `apiClient.isAuthenticated`
   - ApiClient finds token in localStorage
   - Dashboard shows authenticated state

3. **Production environment difference**
   - Token might be stored in HTTP context but app runs on HTTPS
   - CORS issues prevent token validation
   - Network latency causes race conditions

4. **Token validation fails**
   - `apiClient.getProfile()` call fails
   - `useAuthNew` sets `isAuthenticated: false`
   - Automatic redirect to login page

5. **Redirect loop**
   - User gets redirected to login despite having valid tokens
   - Login form still works (tokens are there)
   - Process repeats

## Token Migration Strategy

### Option 1: Migrate to AuthTokenManager Keys
```typescript
// Migration function
function migrateTokens() {
  const oldAccessToken = localStorage.getItem('access_token');
  const oldRefreshToken = localStorage.getItem('refresh_token');
  
  if (oldAccessToken && oldRefreshToken) {
    // Store with new keys
    localStorage.setItem('docfiscal_access_token', oldAccessToken);
    localStorage.setItem('docfiscal_refresh_token', oldRefreshToken);
    localStorage.setItem('docfiscal_token_expires_at', 
      new Date(Date.now() + 3600000).toISOString()); // 1 hour default
    
    // Remove old keys
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
}
```

### Option 2: Standardize on Simple Keys
```typescript
// Update AuthTokenManager to use simple keys
class AuthTokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'access_token';
  private static readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private static readonly EXPIRES_AT_KEY = 'token_expires_at';
  // ...
}
```

## Recommended Solution

### 1. Immediate Fix (Minimal Changes)
- Update `AuthTokenManager` to use same keys as `ApiClient`
- Integrate `AuthProvider` into app layout
- Migrate all components to use `AuthContext`

### 2. Long-term Solution (Proper Architecture)
- Remove token management from `ApiClient`
- Make `AuthTokenManager` the single source of truth
- Update all token operations to use `AuthTokenManager`

## Testing Requirements

### Token Synchronization Tests
```typescript
describe('Token Synchronization', () => {
  test('tokens stored by ApiClient can be read by AuthTokenManager', () => {
    // Store tokens via ApiClient
    apiClient.setTokens('access_token', 'refresh_token');
    
    // Read via AuthTokenManager
    const tokens = authTokenManager.getStoredTokens();
    expect(tokens.accessToken).toBe('access_token');
    expect(tokens.refreshToken).toBe('refresh_token');
  });
  
  test('token refresh updates all systems consistently', async () => {
    // Setup initial tokens
    // Trigger refresh
    // Verify both systems see updated tokens
  });
});
```

### Race Condition Tests
```typescript
describe('Race Conditions', () => {
  test('concurrent token refresh operations', async () => {
    // Trigger multiple refresh operations simultaneously
    // Verify final state is consistent
  });
  
  test('concurrent authentication checks', async () => {
    // Multiple components check auth simultaneously
    // Verify consistent results
  });
});
```

## Monitoring and Debugging

### Add Token Synchronization Logging
```typescript
// In AuthTokenManager
storeTokens(tokens: AuthTokens): void {
  console.log('🔐 AuthTokenManager: Storing tokens', {
    accessTokenLength: tokens.accessToken.length,
    hasRefreshToken: !!tokens.refreshToken,
    expiresAt: tokens.expiresAt.toISOString()
  });
  
  // Check for conflicts
  const existingApiToken = localStorage.getItem('access_token');
  if (existingApiToken && existingApiToken !== tokens.accessToken) {
    console.warn('⚠️ Token conflict detected: ApiClient token differs from AuthTokenManager token');
  }
}
```

### Add Authentication State Monitoring
```typescript
// Global auth state monitor
function monitorAuthState() {
  const apiClientAuth = apiClient.isAuthenticated;
  const authManagerTokens = authTokenManager.getStoredTokens();
  const hasAuthManagerTokens = !!(authManagerTokens.accessToken && authManagerTokens.refreshToken);
  
  if (apiClientAuth !== hasAuthManagerTokens) {
    console.error('🚨 Authentication state mismatch detected', {
      apiClientAuth,
      hasAuthManagerTokens,
      localStorage: {
        access_token: !!localStorage.getItem('access_token'),
        docfiscal_access_token: !!localStorage.getItem('docfiscal_access_token')
      }
    });
  }
}
```