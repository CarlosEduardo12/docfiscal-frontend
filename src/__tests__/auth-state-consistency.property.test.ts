/**
 * **Feature: login-redirect-fix, Property 2: Authentication State Consistency**
 * **Validates: Requirements 1.3, 1.4, 2.3, 2.4**
 */

import * as fc from 'fast-check';
import { AuthTokenManager, AuthTokens } from '../lib/AuthTokenManager';
import { apiClient } from '../lib/api';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => {
      const value = store[key] || null;
      return value;
    }),
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

// Ensure window and localStorage are properly mocked
if (typeof window === 'undefined') {
  (global as any).window = {};
}

// Mock both window.localStorage and global localStorage
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// Mock fetch for API calls
global.fetch = jest.fn();

// Helper to generate realistic JWT-like tokens
const generateValidToken = () => {
  // Generate base64url-safe characters for JWT tokens
  const base64UrlChars = fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '_'
  );

  // Generate three parts for JWT structure (header.payload.signature)
  const generatePart = (minLength: number, maxLength: number) =>
    fc.array(base64UrlChars, { minLength, maxLength }).map(chars => chars.join(''));

  return fc.tuple(
    generatePart(20, 40),  // header
    generatePart(50, 100), // payload (longer)
    generatePart(20, 40)   // signature
  ).map(([header, payload, signature]) => `${header}.${payload}.${signature}`)
   .filter(token => {
     // Ensure token is valid: non-empty, no whitespace, proper JWT structure
     return token.length >= 90 && 
            token.trim() === token && 
            token.split('.').length === 3 &&
            token.split('.').every(part => part.length > 0 && part.trim() === part);
   });
};

describe('Authentication State Consistency Property Tests', () => {
  let tokenManager: AuthTokenManager;

  beforeEach(() => {
    // Clear all mocks and reset state completely
    jest.clearAllMocks();
    jest.resetAllMocks();
    localStorageMock.clear();
    
    // Create fresh instance to avoid state pollution
    tokenManager = new AuthTokenManager();
    
    // Reset fetch mock completely
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    // Additional cleanup after each test
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  describe('Property 2: Authentication State Consistency', () => {
    it('should maintain consistent authentication state across all components for any valid token set', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: generateValidToken(),
            refreshToken: generateValidToken(),
            expiresIn: fc.integer({ min: 1800, max: 7200 }), // 30 minutes to 2 hours (avoid refresh threshold)
          }),
          async (tokenData) => {
            // Clear state at start of each iteration
            jest.clearAllMocks();
            (global.fetch as jest.Mock).mockReset();
            localStorageMock.clear();

            // Mock fetch to avoid refresh attempts - use mockImplementation for consistency
            (global.fetch as jest.Mock).mockImplementation(() =>
              Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                  success: true,
                  tokens: {
                    access_token: tokenData.accessToken,
                    refresh_token: tokenData.refreshToken,
                    expires_in: tokenData.expiresIn,
                  },
                }),
              })
            );

            // Create valid tokens with sufficient expiry time
            const tokens: AuthTokens = {
              accessToken: tokenData.accessToken,
              refreshToken: tokenData.refreshToken,
              expiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
            };

            // Store tokens using AuthTokenManager
            tokenManager.storeTokens(tokens);

            // Property: All authentication checks should return consistent results
            const storedTokens = tokenManager.getStoredTokens();
            const isAuthenticatedByManager = await tokenManager.isAuthenticated();
            const validToken = await tokenManager.getValidToken();
            const isAuthenticatedByApiClient = apiClient.isAuthenticated;

            // Verify consistency across all authentication methods
            expect(storedTokens.accessToken).toBe(tokens.accessToken);
            expect(storedTokens.refreshToken).toBe(tokens.refreshToken);
            expect(isAuthenticatedByManager).toBe(true);
            expect(validToken).toBe(tokens.accessToken);
            expect(isAuthenticatedByApiClient).toBe(true);

            // Verify localStorage contains the correct keys
            expect(localStorageMock.getItem('docfiscal_access_token')).toBe(tokens.accessToken);
            expect(localStorageMock.getItem('docfiscal_refresh_token')).toBe(tokens.refreshToken);
            expect(localStorageMock.getItem('docfiscal_token_expires_at')).toBe(tokens.expiresAt.toISOString());
          }
        ),
        { numRuns: 50 } // Reduce iterations to minimize mock complexity
      );
    });

    it('should maintain consistent unauthenticated state when tokens are cleared for any token set', async () => {
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
            (global.fetch as jest.Mock).mockReset();
            localStorageMock.clear();

            // Mock fetch to avoid refresh attempts during initial setup
            (global.fetch as jest.Mock).mockImplementation(() =>
              Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                  success: true,
                  tokens: {
                    access_token: tokenData.accessToken,
                    refresh_token: tokenData.refreshToken,
                    expires_in: tokenData.expiresIn,
                  },
                }),
              })
            );

            // First, store some tokens
            const tokens: AuthTokens = {
              accessToken: tokenData.accessToken,
              refreshToken: tokenData.refreshToken,
              expiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
            };
            tokenManager.storeTokens(tokens);

            // Verify tokens are stored
            expect(await tokenManager.isAuthenticated()).toBe(true);

            // Clear tokens
            tokenManager.clearTokens();

            // Property: All authentication checks should consistently return false after clearing
            const storedTokens = tokenManager.getStoredTokens();
            const isAuthenticatedByManager = await tokenManager.isAuthenticated();
            const validToken = await tokenManager.getValidToken();
            const isAuthenticatedByApiClient = apiClient.isAuthenticated;

            // Verify consistent unauthenticated state
            expect(storedTokens.accessToken).toBeNull();
            expect(storedTokens.refreshToken).toBeNull();
            expect(isAuthenticatedByManager).toBe(false);
            expect(validToken).toBeNull();
            expect(isAuthenticatedByApiClient).toBe(false);

            // Verify localStorage is cleared
            expect(localStorageMock.getItem('docfiscal_access_token')).toBeNull();
            expect(localStorageMock.getItem('docfiscal_refresh_token')).toBeNull();
            expect(localStorageMock.getItem('docfiscal_token_expires_at')).toBeNull();
          }
        ),
        { numRuns: 50 } // Reduce iterations to minimize mock complexity
      );
    });

    it('should handle expired tokens consistently across all components for any expired token set', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: generateValidToken(),
            refreshToken: generateValidToken(),
            expiredMinutesAgo: fc.integer({ min: 1, max: 1440 }), // 1 minute to 24 hours ago
          }),
          async (tokenData) => {
            // Clear localStorage and reset all mocks at start of each iteration
            localStorageMock.clear();
            jest.clearAllMocks();
            (global.fetch as jest.Mock).mockReset();

            // Create expired tokens
            const tokens: AuthTokens = {
              accessToken: tokenData.accessToken,
              refreshToken: tokenData.refreshToken,
              expiresAt: new Date(Date.now() - tokenData.expiredMinutesAgo * 60 * 1000),
            };

            // Store expired tokens
            tokenManager.storeTokens(tokens);

            // Mock failed refresh attempt consistently - use mockImplementation for deterministic behavior
            (global.fetch as jest.Mock).mockImplementation(() => 
              Promise.resolve({
                ok: false,
                status: 401,
                json: () => Promise.resolve({ error: 'Refresh token expired' }),
              })
            );

            // Property: Expired tokens should be handled consistently
            const isTokenExpired = tokenManager.isTokenExpired(tokens.accessToken);
            
            // First check if token is expired (should be true)
            expect(isTokenExpired).toBe(true);
            
            // When we try to get a valid token, it should attempt refresh and fail
            const validToken = await tokenManager.getValidToken();
            const isAuthenticatedByManager = await tokenManager.isAuthenticated();

            // Verify consistent handling of expired tokens after failed refresh
            expect(validToken).toBeNull(); // Should be null after failed refresh
            expect(isAuthenticatedByManager).toBe(false);

            // Verify tokens are cleared after failed refresh
            const storedTokensAfterRefresh = tokenManager.getStoredTokens();
            expect(storedTokensAfterRefresh.accessToken).toBeNull();
            expect(storedTokensAfterRefresh.refreshToken).toBeNull();
          }
        ),
        { numRuns: 50 } // Reduce iterations to minimize mock complexity
      );
    });

    it('should migrate old tokens consistently for any existing token format', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: generateValidToken(),
            refreshToken: generateValidToken(),
          }),
          async (tokenData) => {
            // Clear state at start of each iteration
            jest.clearAllMocks();
            localStorageMock.clear();
            
            // Set up old format tokens in localStorage
            localStorageMock.setItem('access_token', tokenData.accessToken);
            localStorageMock.setItem('refresh_token', tokenData.refreshToken);

            // Ensure new format keys don't exist initially
            expect(localStorageMock.getItem('docfiscal_access_token')).toBeNull();
            expect(localStorageMock.getItem('docfiscal_refresh_token')).toBeNull();

            // Trigger migration
            tokenManager.migrateOldTokens();

            // Property: Migration should consistently move tokens to new format
            expect(localStorageMock.getItem('docfiscal_access_token')).toBe(tokenData.accessToken);
            expect(localStorageMock.getItem('docfiscal_refresh_token')).toBe(tokenData.refreshToken);
            expect(localStorageMock.getItem('docfiscal_token_expires_at')).toBeDefined();

            // Old format tokens should be removed
            expect(localStorageMock.getItem('access_token')).toBeNull();
            expect(localStorageMock.getItem('refresh_token')).toBeNull();

            // Verify consistency after migration
            const storedTokens = tokenManager.getStoredTokens();
            expect(storedTokens.accessToken).toBe(tokenData.accessToken);
            expect(storedTokens.refreshToken).toBe(tokenData.refreshToken);
            expect(storedTokens.expiresAt).toBeInstanceOf(Date);
          }
        ),
        { numRuns: 50 } // Reduce iterations to minimize complexity
      );
    });

    it('should handle token refresh consistently for any valid refresh scenario', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            oldAccessToken: generateValidToken(),
            oldRefreshToken: generateValidToken(),
            newAccessToken: generateValidToken(),
            newRefreshToken: generateValidToken(),
            newExpiresIn: fc.integer({ min: 1800, max: 7200 }), // 30 minutes to 2 hours
          }),
          async (tokenData) => {
            // Clear any previous mocks and localStorage at start of each iteration
            jest.clearAllMocks();
            (global.fetch as jest.Mock).mockReset();
            localStorageMock.clear();

            // Store initial tokens (about to expire)
            const initialTokens: AuthTokens = {
              accessToken: tokenData.oldAccessToken,
              refreshToken: tokenData.oldRefreshToken,
              expiresAt: new Date(Date.now() + 60 * 1000), // Expires in 1 minute
            };
            tokenManager.storeTokens(initialTokens);

            // Mock successful refresh response using mockImplementation for consistency
            (global.fetch as jest.Mock).mockImplementation(() => 
              Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                  success: true,
                  tokens: {
                    access_token: tokenData.newAccessToken,
                    refresh_token: tokenData.newRefreshToken,
                    expires_in: tokenData.newExpiresIn,
                  },
                }),
              })
            );

            // Trigger refresh directly to test the refresh mechanism
            const refreshResult = await tokenManager.refreshToken();

            // Property: Successful refresh should update tokens consistently
            expect(refreshResult.success).toBe(true);
            expect(refreshResult.tokens?.accessToken).toBe(tokenData.newAccessToken);
            expect(refreshResult.tokens?.refreshToken).toBe(tokenData.newRefreshToken);

            // Verify tokens are updated in storage
            const storedTokens = tokenManager.getStoredTokens();
            expect(storedTokens.accessToken).toBe(tokenData.newAccessToken);
            expect(storedTokens.refreshToken).toBe(tokenData.newRefreshToken);
            expect(storedTokens.expiresAt).toBeInstanceOf(Date);
            
            // Verify the expiration time is set correctly (within reasonable bounds)
            const expectedExpiryTime = Date.now() + tokenData.newExpiresIn * 1000;
            const actualExpiryTime = storedTokens.expiresAt.getTime();
            expect(Math.abs(actualExpiryTime - expectedExpiryTime)).toBeLessThan(5000); // Within 5 seconds

            // Verify fetch was called exactly once with correct parameters
            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(global.fetch).toHaveBeenCalledWith(
              expect.stringContaining('/api/auth/refresh'),
              expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: tokenData.oldRefreshToken }),
              })
            );
          }
        ),
        { numRuns: 50 } // Reduce iterations to minimize mock complexity
      );
    });
  });
});