/**
 * **Feature: login-redirect-fix, Property 4: Session Persistence and Recovery**
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */

import * as fc from 'fast-check';
import { AuthTokenManager, AuthTokens } from '../lib/AuthTokenManager';

// Mock localStorage for testing
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

// Mock window object
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock fetch for token refresh
global.fetch = jest.fn();

// Helper to generate realistic JWT-like tokens
const generateValidToken = () => {
  return fc.integer({ min: 1000000000, max: 9999999999 }).map(randomId => {
    // Create a valid JWT header
    const header = {
      typ: 'JWT',
      alg: 'HS256'
    };
    
    // Create a valid JWT payload with required fields
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: `user_${randomId}`,
      iat: now - 3600, // issued 1 hour ago
      exp: now + 7200, // expires in 2 hours
      aud: 'docfiscal-app',
      iss: 'docfiscal-auth'
    };
    
    // Create a mock signature (not cryptographically valid, but structurally correct)
    const signature = `sig_${randomId}_${Math.random().toString(36).substring(2)}`;
    
    // Encode to base64url
    const encodeBase64Url = (obj: any) => {
      const json = JSON.stringify(obj);
      const base64 = btoa(json);
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };
    
    const encodedHeader = encodeBase64Url(header);
    const encodedPayload = encodeBase64Url(payload);
    const encodedSignature = btoa(signature).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  });
};

describe('Session Persistence and Recovery Property Tests', () => {
  let tokenManager: AuthTokenManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    tokenManager = new AuthTokenManager();
  });

  describe('Property 4: Session Persistence and Recovery', () => {
    it('should restore valid sessions automatically on page load for any valid token set', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: generateValidToken(),
            refreshToken: generateValidToken(),
            expiresIn: fc.integer({ min: 1800, max: 7200 }), // 30 minutes to 2 hours
          }),
          async (tokenData) => {
            // Clear state at start of each iteration
            jest.clearAllMocks();
            mockLocalStorage.clear();

            // Create valid tokens with sufficient expiry time
            const tokens: AuthTokens = {
              accessToken: tokenData.accessToken,
              refreshToken: tokenData.refreshToken,
              expiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
            };

            // Store tokens (simulating previous session)
            tokenManager.storeTokens(tokens);

            // Create a new token manager instance (simulating page reload)
            const newTokenManager = new AuthTokenManager();

            // Property: Valid session should be restored automatically
            const hasValidSession = await newTokenManager.initialize();
            expect(hasValidSession).toBe(true);

            // Property: Restored tokens should match original tokens
            const restoredTokens = newTokenManager.getStoredTokens();
            expect(restoredTokens.accessToken).toBe(tokens.accessToken);
            expect(restoredTokens.refreshToken).toBe(tokens.refreshToken);
            expect(restoredTokens.expiresAt.getTime()).toBe(tokens.expiresAt.getTime());

            // Property: Authentication state should be restored
            const isAuthenticated = await newTokenManager.isAuthenticated();
            expect(isAuthenticated).toBe(true);

            // Property: Valid token should be immediately available
            const validToken = await newTokenManager.getValidToken();
            expect(validToken).toBe(tokens.accessToken);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should attempt automatic refresh for expired tokens on page load for any expired token set', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            oldAccessToken: generateValidToken(),
            refreshToken: generateValidToken(),
            newAccessToken: generateValidToken(),
            expiredMinutesAgo: fc.integer({ min: 1, max: 60 }), // 1 minute to 1 hour ago
            newExpiresIn: fc.integer({ min: 1800, max: 7200 }), // 30 minutes to 2 hours
          }),
          async (tokenData) => {
            // Clear state at start of each iteration
            jest.clearAllMocks();
            mockLocalStorage.clear();

            // Create expired tokens (simulating previous session with expired tokens)
            const expiredTokens: AuthTokens = {
              accessToken: tokenData.oldAccessToken,
              refreshToken: tokenData.refreshToken,
              expiresAt: new Date(Date.now() - tokenData.expiredMinutesAgo * 60 * 1000),
            };

            // Store expired tokens
            tokenManager.storeTokens(expiredTokens);

            // Mock successful token refresh
            (global.fetch as jest.Mock).mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                success: true,
                tokens: {
                  access_token: tokenData.newAccessToken,
                  refresh_token: tokenData.refreshToken,
                  expires_in: tokenData.newExpiresIn,
                },
              }),
            });

            // Create a new token manager instance (simulating page reload)
            const newTokenManager = new AuthTokenManager();

            // Property: Expired tokens should trigger automatic refresh during initialization
            const hasValidSession = await newTokenManager.initialize();
            expect(hasValidSession).toBe(true);

            // Property: Tokens should be refreshed automatically
            const refreshedTokens = newTokenManager.getStoredTokens();
            expect(refreshedTokens.accessToken).toBe(tokenData.newAccessToken);
            expect(refreshedTokens.refreshToken).toBe(tokenData.refreshToken);

            // Property: Authentication state should be restored after refresh
            const isAuthenticated = await newTokenManager.isAuthenticated();
            expect(isAuthenticated).toBe(true);

            // Property: Valid token should be available after refresh
            const validToken = await newTokenManager.getValidToken();
            expect(validToken).toBe(tokenData.newAccessToken);

            // Property: Refresh endpoint should have been called
            expect(global.fetch).toHaveBeenCalledWith(
              expect.stringContaining('/api/auth/refresh'),
              expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ refresh_token: tokenData.refreshToken }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should gracefully handle refresh failures and clear invalid sessions for any failed refresh scenario', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: generateValidToken(),
            refreshToken: generateValidToken(),
            expiredMinutesAgo: fc.integer({ min: 1, max: 60 }), // 1 minute to 1 hour ago
            failureType: fc.constantFrom('expired_refresh', 'invalid_refresh', 'server_error', 'network_error'),
          }),
          async (tokenData) => {
            // Clear state at start of each iteration
            jest.clearAllMocks();
            mockLocalStorage.clear();

            // Create expired tokens
            const expiredTokens: AuthTokens = {
              accessToken: tokenData.accessToken,
              refreshToken: tokenData.refreshToken,
              expiresAt: new Date(Date.now() - tokenData.expiredMinutesAgo * 60 * 1000),
            };

            // Store expired tokens
            tokenManager.storeTokens(expiredTokens);

            // Mock different types of refresh failures
            switch (tokenData.failureType) {
              case 'expired_refresh':
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                  ok: false,
                  status: 401,
                  text: async () => 'Refresh token expired',
                });
                break;
              case 'invalid_refresh':
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                  ok: false,
                  status: 403,
                  text: async () => 'Invalid refresh token',
                });
                break;
              case 'server_error':
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                  ok: false,
                  status: 500,
                  text: async () => 'Internal server error',
                });
                break;
              case 'network_error':
                (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
                break;
            }

            // Create a new token manager instance (simulating page reload)
            const newTokenManager = new AuthTokenManager();

            // Property: Failed refresh should result in no valid session
            const hasValidSession = await newTokenManager.initialize();
            
            if (tokenData.failureType === 'server_error') {
              // Server errors might not clear tokens immediately
              // The session might still be considered invalid but tokens preserved for retry
              const isAuthenticated = await newTokenManager.isAuthenticated();
              expect(isAuthenticated).toBe(false);
            } else {
              // For expired/invalid refresh tokens, session should be completely cleared
              expect(hasValidSession).toBe(false);
              
              // Property: Invalid tokens should be cleared after failed refresh
              const clearedTokens = newTokenManager.getStoredTokens();
              expect(clearedTokens.accessToken).toBeNull();
              expect(clearedTokens.refreshToken).toBeNull();
              expect(clearedTokens.expiresAt).toBeNull();
            }

            // Property: Authentication state should be false after failed refresh
            const isAuthenticated = await newTokenManager.isAuthenticated();
            expect(isAuthenticated).toBe(false);

            // Property: No valid token should be available after failed refresh
            const validToken = await newTokenManager.getValidToken();
            expect(validToken).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle session recovery across browser restarts for any persistent token set', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: generateValidToken(),
            refreshToken: generateValidToken(),
            expiresIn: fc.integer({ min: 1800, max: 7200 }), // 30 minutes to 2 hours
            simulatedRestartDelay: fc.integer({ min: 1, max: 300 }), // 1 second to 5 minutes
          }),
          async (tokenData) => {
            // Clear state at start of each iteration
            jest.clearAllMocks();
            mockLocalStorage.clear();

            // Create valid tokens
            const tokens: AuthTokens = {
              accessToken: tokenData.accessToken,
              refreshToken: tokenData.refreshToken,
              expiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
            };

            // Store tokens (simulating session before browser restart)
            tokenManager.storeTokens(tokens);

            // Simulate browser restart by creating completely new instances
            // and simulating time passage
            const restartTime = Date.now() + tokenData.simulatedRestartDelay * 1000;
            
            // Mock Date.now to simulate time passage
            const originalDateNow = Date.now;
            Date.now = jest.fn(() => restartTime);

            try {
              // Create new token manager (simulating fresh browser start)
              const postRestartTokenManager = new AuthTokenManager();

              // Property: Session should persist across browser restarts if tokens are still valid
              const expectedValid = restartTime < tokens.expiresAt.getTime();
              
              if (expectedValid) {
                const hasValidSession = await postRestartTokenManager.initialize();
                expect(hasValidSession).toBe(true);

                // Property: Tokens should be restored exactly as they were
                const restoredTokens = postRestartTokenManager.getStoredTokens();
                expect(restoredTokens.accessToken).toBe(tokens.accessToken);
                expect(restoredTokens.refreshToken).toBe(tokens.refreshToken);
                expect(restoredTokens.expiresAt.getTime()).toBe(tokens.expiresAt.getTime());

                // Property: Authentication should work immediately after restart
                const isAuthenticated = await postRestartTokenManager.isAuthenticated();
                expect(isAuthenticated).toBe(true);

                const validToken = await postRestartTokenManager.getValidToken();
                expect(validToken).toBe(tokens.accessToken);
              } else {
                // If tokens expired during simulated restart, they should be handled appropriately
                const hasValidSession = await postRestartTokenManager.initialize();
                expect(hasValidSession).toBe(false);
              }
            } finally {
              // Restore original Date.now
              Date.now = originalDateNow;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain session integrity during concurrent operations for any sequence of session operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              operation: fc.constantFrom('initialize', 'getValidToken', 'refresh', 'clear'),
              accessToken: generateValidToken(),
              refreshToken: generateValidToken(),
              expiresIn: fc.integer({ min: 300, max: 3600 }), // 5 minutes to 1 hour
            }),
            { minLength: 2, maxLength: 8 }
          ),
          async (operations) => {
            // Clear state at start
            jest.clearAllMocks();
            mockLocalStorage.clear();

            let currentTokens: AuthTokens | null = null;
            let operationCount = 0;

            for (const op of operations) {
              operationCount++;

              // Mock successful refresh for any refresh operations
              (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => ({
                  success: true,
                  tokens: {
                    access_token: op.accessToken,
                    refresh_token: op.refreshToken,
                    expires_in: op.expiresIn,
                  },
                }),
              });

              switch (op.operation) {
                case 'initialize':
                  if (currentTokens) {
                    // Store current tokens before initializing
                    tokenManager.storeTokens(currentTokens);
                  }
                  
                  const hasSession = await tokenManager.initialize();
                  
                  // Property: Initialize should return consistent results
                  if (currentTokens && !tokenManager.isTokenExpired(currentTokens.accessToken)) {
                    expect(hasSession).toBe(true);
                  }
                  break;

                case 'getValidToken':
                  const validToken = await tokenManager.getValidToken();
                  
                  // Property: Valid token should be consistent with stored state
                  if (currentTokens && !tokenManager.isTokenExpired(currentTokens.accessToken)) {
                    expect(validToken).toBe(currentTokens.accessToken);
                  }
                  break;

                case 'refresh':
                  const refreshResult = await tokenManager.refreshToken();
                  
                  if (currentTokens) {
                    // Property: Refresh should succeed if we have a refresh token
                    expect(refreshResult.success).toBe(true);
                    
                    if (refreshResult.success && refreshResult.tokens) {
                      currentTokens = refreshResult.tokens;
                    }
                  }
                  break;

                case 'clear':
                  tokenManager.clearTokens();
                  currentTokens = null;
                  
                  // Property: After clearing, no tokens should be available
                  const clearedTokens = tokenManager.getStoredTokens();
                  expect(clearedTokens.accessToken).toBeNull();
                  expect(clearedTokens.refreshToken).toBeNull();
                  
                  const isAuthAfterClear = await tokenManager.isAuthenticated();
                  expect(isAuthAfterClear).toBe(false);
                  break;
              }

              // Property: Token manager state should always be consistent after each operation
              const storedTokens = tokenManager.getStoredTokens();
              const isAuthenticated = await tokenManager.isAuthenticated();
              
              if (currentTokens) {
                expect(storedTokens.accessToken).toBe(currentTokens.accessToken);
                expect(storedTokens.refreshToken).toBe(currentTokens.refreshToken);
                expect(isAuthenticated).toBe(true);
              } else {
                expect(storedTokens.accessToken).toBeNull();
                expect(storedTokens.refreshToken).toBeNull();
                expect(isAuthenticated).toBe(false);
              }
            }
          }
        ),
        { numRuns: 50 } // Reduced runs due to complexity
      );
    });

    it('should handle localStorage corruption gracefully during session recovery for any corrupted state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: generateValidToken(),
            refreshToken: generateValidToken(),
            corruptionType: fc.constantFrom(
              'invalid_json', 'missing_expiry', 'invalid_expiry', 
              'empty_tokens', 'malformed_tokens', 'storage_error'
            ),
          }),
          async (tokenData) => {
            // Clear state at start of each iteration
            jest.clearAllMocks();
            mockLocalStorage.clear();

            // Set up corrupted localStorage state
            switch (tokenData.corruptionType) {
              case 'invalid_json':
                mockLocalStorage.setItem('docfiscal_access_token', tokenData.accessToken);
                mockLocalStorage.setItem('docfiscal_refresh_token', tokenData.refreshToken);
                mockLocalStorage.setItem('docfiscal_token_expires_at', 'invalid-date-string');
                break;
              case 'missing_expiry':
                mockLocalStorage.setItem('docfiscal_access_token', tokenData.accessToken);
                mockLocalStorage.setItem('docfiscal_refresh_token', tokenData.refreshToken);
                // Don't set expiry date
                break;
              case 'invalid_expiry':
                mockLocalStorage.setItem('docfiscal_access_token', tokenData.accessToken);
                mockLocalStorage.setItem('docfiscal_refresh_token', tokenData.refreshToken);
                mockLocalStorage.setItem('docfiscal_token_expires_at', 'not-a-date');
                break;
              case 'empty_tokens':
                mockLocalStorage.setItem('docfiscal_access_token', '');
                mockLocalStorage.setItem('docfiscal_refresh_token', '');
                mockLocalStorage.setItem('docfiscal_token_expires_at', new Date().toISOString());
                break;
              case 'malformed_tokens':
                mockLocalStorage.setItem('docfiscal_access_token', 'not.a.jwt');
                mockLocalStorage.setItem('docfiscal_refresh_token', 'also.not.jwt');
                mockLocalStorage.setItem('docfiscal_token_expires_at', new Date().toISOString());
                break;
              case 'storage_error':
                // Mock localStorage to throw errors
                mockLocalStorage.getItem.mockImplementation(() => {
                  throw new Error('localStorage access denied');
                });
                break;
            }

            // Create new token manager (simulating page load with corrupted state)
            const newTokenManager = new AuthTokenManager();

            // Property: Corrupted state should be handled gracefully without crashes
            expect(async () => {
              await newTokenManager.initialize();
            }).not.toThrow();

            const hasValidSession = await newTokenManager.initialize();

            // Property: Corrupted sessions should be treated as invalid
            expect(hasValidSession).toBe(false);

            // Property: Authentication should be false with corrupted state
            const isAuthenticated = await newTokenManager.isAuthenticated();
            expect(isAuthenticated).toBe(false);

            // Property: No valid token should be available with corrupted state
            const validToken = await newTokenManager.getValidToken();
            expect(validToken).toBeNull();

            // Property: Corrupted tokens should be cleared (if possible)
            if (tokenData.corruptionType !== 'storage_error') {
              const clearedTokens = newTokenManager.getStoredTokens();
              expect(clearedTokens.accessToken).toBeNull();
              expect(clearedTokens.refreshToken).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});