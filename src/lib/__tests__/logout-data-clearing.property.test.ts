/**
 * **Feature: frontend-issues-resolution, Property 6: Logout clears all authentication data**
 * **Validates: Requirements 2.5**
 */

import * as fc from 'fast-check';

// Mock localStorage for testing
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    getAllKeys: () => Object.keys(store),
    getAllData: () => ({ ...store })
  };
})();

// Mock window object
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock fetch for testing - provide comprehensive mock responses
const mockFetch = jest.fn().mockImplementation(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      success: true,
      tokens: {
        access_token: 'new_access_token_' + Date.now(),
        refresh_token: 'new_refresh_token_' + Date.now(),
        expires_in: 3600
      }
    })
  })
);
global.fetch = mockFetch;

// Import the AuthTokenManager after mocking
import { AuthTokenManager } from '../AuthTokenManager';

describe('Logout Data Clearing Property Tests', () => {
  let authTokenManager: AuthTokenManager;

  beforeEach(() => {
    mockLocalStorage.clear();
    authTokenManager = new AuthTokenManager();
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Property 6: Logout clears all authentication data', () => {
    it('should clear all authentication tokens for any stored token data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: fc.string({ minLength: 10, maxLength: 500 })
              .filter(s => s.trim().length >= 10 && /^[a-zA-Z0-9_-]+$/.test(s)),
            refreshToken: fc.string({ minLength: 10, maxLength: 500 })
              .filter(s => s.trim().length >= 10 && /^[a-zA-Z0-9_-]+$/.test(s)),
            expiresAt: fc.date({ min: new Date(), max: new Date(Date.now() + 86400000) })
              .filter(d => !isNaN(d.getTime()))
          }),
          async (tokenData) => {
            // Store tokens first
            authTokenManager.storeTokens(tokenData);

            // Verify tokens are stored
            const storedTokensBefore = authTokenManager.getStoredTokens();
            expect(storedTokensBefore.accessToken).toBe(tokenData.accessToken);
            expect(storedTokensBefore.refreshToken).toBe(tokenData.refreshToken);

            // Property: clearTokens should remove all authentication data
            authTokenManager.clearTokens();

            // Verify all tokens are cleared - AuthTokenManager returns null as any for cleared tokens
            const storedTokensAfter = authTokenManager.getStoredTokens();
            expect(storedTokensAfter.accessToken).toBeNull();
            expect(storedTokensAfter.refreshToken).toBeNull();
            expect(storedTokensAfter.expiresAt).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clear all authentication tokens including whitespace-only tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: fc.oneof(
              // Valid tokens
              fc.string({ minLength: 10, maxLength: 500 })
                .filter(s => s.trim().length >= 10 && /^[a-zA-Z0-9_-]+$/.test(s)),
              // Whitespace-only tokens
              fc.string({ minLength: 1, maxLength: 50 })
                .filter(s => s.trim() === '' && s.length > 0)
            ),
            refreshToken: fc.oneof(
              // Valid tokens
              fc.string({ minLength: 10, maxLength: 500 })
                .filter(s => s.trim().length >= 10 && /^[a-zA-Z0-9_-]+$/.test(s)),
              // Whitespace-only tokens
              fc.string({ minLength: 1, maxLength: 50 })
                .filter(s => s.trim() === '' && s.length > 0)
            ),
            expiresAt: fc.date({ min: new Date(), max: new Date(Date.now() + 86400000) })
              .filter(d => !isNaN(d.getTime()))
          }),
          async (tokenData) => {
            // Directly store tokens in localStorage to test edge cases
            mockLocalStorage.setItem('docfiscal_access_token', tokenData.accessToken);
            mockLocalStorage.setItem('docfiscal_refresh_token', tokenData.refreshToken);
            mockLocalStorage.setItem('docfiscal_token_expires_at', tokenData.expiresAt.toISOString());

            // Verify tokens are stored in localStorage
            expect(mockLocalStorage.getItem('docfiscal_access_token')).toBe(tokenData.accessToken);
            expect(mockLocalStorage.getItem('docfiscal_refresh_token')).toBe(tokenData.refreshToken);

            // Property: clearTokens should remove all authentication data, including whitespace-only tokens
            authTokenManager.clearTokens();

            // Verify all tokens are cleared from localStorage
            expect(mockLocalStorage.getItem('docfiscal_access_token')).toBeNull();
            expect(mockLocalStorage.getItem('docfiscal_refresh_token')).toBeNull();
            expect(mockLocalStorage.getItem('docfiscal_token_expires_at')).toBeNull();

            // Verify getStoredTokens returns null values after clearing
            const storedTokensAfter = authTokenManager.getStoredTokens();
            expect(storedTokensAfter.accessToken).toBeNull();
            expect(storedTokensAfter.refreshToken).toBeNull();
            expect(storedTokensAfter.expiresAt).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clear authentication data even when localStorage contains other data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            authTokens: fc.record({
              accessToken: fc.string({ minLength: 10, maxLength: 500 })
                .filter(s => s.trim().length >= 10 && /^[a-zA-Z0-9_-]+$/.test(s)),
              refreshToken: fc.string({ minLength: 10, maxLength: 500 })
                .filter(s => s.trim().length >= 10 && /^[a-zA-Z0-9_-]+$/.test(s)),
              expiresAt: fc.date({ min: new Date(), max: new Date(Date.now() + 86400000) })
                .filter(d => !isNaN(d.getTime()))
            }),
            otherData: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 50 }).filter(key => 
                !key.startsWith('docfiscal_') && 
                key.trim().length > 0 && 
                key !== '__proto__' && 
                key !== 'constructor' && 
                key !== 'prototype' // Avoid conflicts with auth keys and prototype pollution
              ),
              fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
            )
          }),
          async (testData) => {
            // Store authentication tokens
            authTokenManager.storeTokens(testData.authTokens);

            // Store other non-authentication data
            Object.entries(testData.otherData).forEach(([key, value]) => {
              mockLocalStorage.setItem(key, value);
            });

            // Property: clearTokens should only remove authentication data
            authTokenManager.clearTokens();

            // Verify authentication tokens are cleared
            const clearedTokens = authTokenManager.getStoredTokens();
            expect(clearedTokens.accessToken).toBeNull();
            expect(clearedTokens.refreshToken).toBeNull();
            expect(clearedTokens.expiresAt).toBeNull();

            // Property: Other localStorage data should remain untouched
            Object.entries(testData.otherData).forEach(([key, value]) => {
              expect(mockLocalStorage.getItem(key)).toBe(value);
            });

            // Verify only auth keys were removed
            const finalKeys = mockLocalStorage.getAllKeys();
            const authKeys = ['docfiscal_access_token', 'docfiscal_refresh_token', 'docfiscal_token_expires_at'];
            
            authKeys.forEach(authKey => {
              expect(finalKeys).not.toContain(authKey);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle clearing tokens when no tokens are stored', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null), // No input needed for this test
          async () => {
            // Ensure no tokens are stored initially
            const initialTokens = authTokenManager.getStoredTokens();
            expect(initialTokens.accessToken).toBeNull();
            expect(initialTokens.refreshToken).toBeNull();

            // Property: clearTokens should not throw when no tokens exist
            expect(() => {
              authTokenManager.clearTokens();
            }).not.toThrow();

            // Property: After clearing non-existent tokens, state should remain null
            const finalTokens = authTokenManager.getStoredTokens();
            expect(finalTokens.accessToken).toBeNull();
            expect(finalTokens.refreshToken).toBeNull();
            expect(finalTokens.expiresAt).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle storage errors during token clearing gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: fc.string({ minLength: 10, maxLength: 500 })
              .filter(s => s.trim().length >= 10 && /^[a-zA-Z0-9_-]+$/.test(s)),
            refreshToken: fc.string({ minLength: 10, maxLength: 500 })
              .filter(s => s.trim().length >= 10 && /^[a-zA-Z0-9_-]+$/.test(s)),
            expiresAt: fc.date({ min: new Date(), max: new Date(Date.now() + 86400000) })
              .filter(d => !isNaN(d.getTime()))
          }),
          async (tokenData) => {
            // Store tokens first
            authTokenManager.storeTokens(tokenData);

            // Simulate storage error during removal
            const originalRemoveItem = mockLocalStorage.removeItem;
            let removeCallCount = 0;
            mockLocalStorage.removeItem = (key: string) => {
              removeCallCount++;
              if (removeCallCount <= 2) { // Fail first two calls
                throw new Error('Storage removal failed');
              }
              originalRemoveItem(key);
            };

            // Property: Storage errors during clearing should not crash the application
            expect(() => {
              authTokenManager.clearTokens();
            }).not.toThrow();

            // Restore original removeItem
            mockLocalStorage.removeItem = originalRemoveItem;

            // Property: Even with partial failures, clearing should attempt to remove all tokens
            // (Some tokens might still be present due to simulated failures, but the operation should complete)
            expect(removeCallCount).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clear tokens consistently across multiple clear operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: fc.string({ minLength: 10, maxLength: 500 })
              .filter(s => s.trim().length >= 10 && /^[a-zA-Z0-9_-]+$/.test(s)),
            refreshToken: fc.string({ minLength: 10, maxLength: 500 })
              .filter(s => s.trim().length >= 10 && /^[a-zA-Z0-9_-]+$/.test(s)),
            expiresAt: fc.date({ min: new Date(), max: new Date(Date.now() + 86400000) })
              .filter(d => !isNaN(d.getTime())),
            clearOperations: fc.integer({ min: 1, max: 5 })
          }),
          async (testData) => {
            // Store tokens
            authTokenManager.storeTokens({
              accessToken: testData.accessToken,
              refreshToken: testData.refreshToken,
              expiresAt: testData.expiresAt
            });

            // Verify tokens are stored
            const initialTokens = authTokenManager.getStoredTokens();
            expect(initialTokens.accessToken).toBe(testData.accessToken);

            // Property: Multiple clear operations should be idempotent
            for (let i = 0; i < testData.clearOperations; i++) {
              authTokenManager.clearTokens();

              // After each clear, tokens should be null
              const clearedTokens = authTokenManager.getStoredTokens();
              expect(clearedTokens.accessToken).toBeNull();
              expect(clearedTokens.refreshToken).toBeNull();
              expect(clearedTokens.expiresAt).toBeNull();
            }

            // Property: Final state should be the same regardless of number of clear operations
            const finalTokens = authTokenManager.getStoredTokens();
            expect(finalTokens.accessToken).toBeNull();
            expect(finalTokens.refreshToken).toBeNull();
            expect(finalTokens.expiresAt).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clear tokens and affect authentication state for any authentication scenario', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: fc.string({ minLength: 10, maxLength: 500 })
              .filter(s => s.trim().length >= 10 && /^[a-zA-Z0-9_-]+$/.test(s)),
            refreshToken: fc.string({ minLength: 10, maxLength: 500 })
              .filter(s => s.trim().length >= 10 && /^[a-zA-Z0-9_-]+$/.test(s)),
            expiresAt: fc.date({ 
              min: new Date(Date.now() + 3600000), // 1 hour from now
              max: new Date(Date.now() + 86400000) // 24 hours from now
            }).filter(d => !isNaN(d.getTime()))
          }),
          async (tokenData) => {
            // Store valid tokens with future expiry
            authTokenManager.storeTokens(tokenData);

            // Verify authentication state before clearing
            const validTokenBefore = await authTokenManager.getValidToken();
            expect(validTokenBefore).toBe(tokenData.accessToken);

            const isAuthenticatedBefore = await authTokenManager.isAuthenticated();
            expect(isAuthenticatedBefore).toBe(true);

            // Property: Clearing tokens should affect authentication state
            authTokenManager.clearTokens();

            // Verify authentication state after clearing
            const validTokenAfter = await authTokenManager.getValidToken();
            expect(validTokenAfter).toBeNull();

            const isAuthenticatedAfter = await authTokenManager.isAuthenticated();
            expect(isAuthenticatedAfter).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});