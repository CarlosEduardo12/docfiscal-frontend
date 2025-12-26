/**
 * **Feature: frontend-issues-resolution, Property 4: Authentication tokens are stored securely**
 * **Validates: Requirements 2.1, 2.2**
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
  };
})();

// Mock sessionStorage for testing
const mockSessionStorage = (() => {
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
  };
})();

// Mock window object
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

// Import the AuthTokenManager after mocking
import { AuthTokenManager } from '../AuthTokenManager';

describe('Authentication Token Storage Property Tests', () => {
  let authTokenManager: AuthTokenManager;

  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    authTokenManager = new AuthTokenManager();
  });

  describe('Property 4: Authentication tokens are stored securely', () => {
    it('should store and retrieve tokens securely for any valid token data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: fc.string({ minLength: 10, maxLength: 500 }).filter(s => {
              const trimmed = s.trim();
              return trimmed.length >= 10 && /^[A-Za-z0-9._-]+$/.test(trimmed);
            }),
            refreshToken: fc.string({ minLength: 10, maxLength: 500 }).filter(s => {
              const trimmed = s.trim();
              return trimmed.length >= 10 && /^[A-Za-z0-9._-]+$/.test(trimmed);
            }),
            expiresAt: fc.date({ min: new Date(), max: new Date(Date.now() + 86400000) }).filter(d => !isNaN(d.getTime())) // Future date within 24 hours
          }),
          async (tokenData) => {
            // Property: For any valid token data, storage should preserve all token information
            authTokenManager.storeTokens(tokenData);

            // Verify tokens are stored
            const storedTokens = authTokenManager.getStoredTokens();
            expect(storedTokens).toBeDefined();
            expect(storedTokens.accessToken).toBe(tokenData.accessToken);
            expect(storedTokens.refreshToken).toBe(tokenData.refreshToken);
            expect(storedTokens.expiresAt.getTime()).toBe(tokenData.expiresAt.getTime());

            // Property: Stored tokens should be retrievable after page refresh simulation
            const newManager = new AuthTokenManager();
            const retrievedTokens = newManager.getStoredTokens();
            expect(retrievedTokens).toBeDefined();
            expect(retrievedTokens.accessToken).toBe(tokenData.accessToken);
            expect(retrievedTokens.refreshToken).toBe(tokenData.refreshToken);
            expect(retrievedTokens.expiresAt.getTime()).toBe(tokenData.expiresAt.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle token expiration correctly for any token with expiration time', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: fc.string({ minLength: 10, maxLength: 500 }).filter(s => {
              const trimmed = s.trim();
              return trimmed.length >= 10 && /^[A-Za-z0-9._-]+$/.test(trimmed);
            }),
            refreshToken: fc.string({ minLength: 10, maxLength: 500 }).filter(s => {
              const trimmed = s.trim();
              return trimmed.length >= 10 && /^[A-Za-z0-9._-]+$/.test(trimmed);
            }),
            expiresAt: fc.date({ min: new Date(Date.now() - 86400000), max: new Date(Date.now() + 86400000) }).filter(d => !isNaN(d.getTime())) // Past or future date
          }),
          async (tokenData) => {
            // Store tokens
            authTokenManager.storeTokens(tokenData);

            // Property: Token expiration check should correctly identify expired vs valid tokens
            const isExpired = authTokenManager.isTokenExpired(tokenData.accessToken);
            const expectedExpired = tokenData.expiresAt.getTime() <= Date.now();
            
            expect(isExpired).toBe(expectedExpired);

            // Property: getValidToken should return null for expired tokens, token for valid ones
            const validToken = await authTokenManager.getValidToken();
            if (expectedExpired) {
              expect(validToken).toBeNull();
            } else {
              expect(validToken).toBe(tokenData.accessToken);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain token security across storage operations for any sequence of operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              operation: fc.constantFrom('store', 'retrieve', 'clear'),
              tokenData: fc.record({
                accessToken: fc.string({ minLength: 10, maxLength: 500 }).filter(s => {
                  const trimmed = s.trim();
                  return trimmed.length >= 10 && /^[A-Za-z0-9._-]+$/.test(trimmed);
                }),
                refreshToken: fc.string({ minLength: 10, maxLength: 500 }).filter(s => {
                  const trimmed = s.trim();
                  return trimmed.length >= 10 && /^[A-Za-z0-9._-]+$/.test(trimmed);
                }),
                expiresAt: fc.date({ min: new Date(), max: new Date(Date.now() + 86400000) }).filter(d => !isNaN(d.getTime()))
              })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (operations) => {
            let lastStoredTokens: any = null;

            // Clear storage at the beginning of each test sequence
            authTokenManager.clearTokens();

            for (const op of operations) {
              switch (op.operation) {
                case 'store':
                  authTokenManager.storeTokens(op.tokenData);
                  lastStoredTokens = op.tokenData;
                  
                  // Property: After storing, tokens should be immediately retrievable
                  const storedTokens = authTokenManager.getStoredTokens();
                  expect(storedTokens.accessToken).toBe(op.tokenData.accessToken);
                  expect(storedTokens.refreshToken).toBe(op.tokenData.refreshToken);
                  break;

                case 'retrieve':
                  const retrievedTokens = authTokenManager.getStoredTokens();
                  
                  // Property: Retrieved tokens should match last stored tokens or be null if cleared
                  if (lastStoredTokens) {
                    expect(retrievedTokens.accessToken).toBe(lastStoredTokens.accessToken);
                    expect(retrievedTokens.refreshToken).toBe(lastStoredTokens.refreshToken);
                  } else {
                    expect(retrievedTokens.accessToken).toBeNull();
                    expect(retrievedTokens.refreshToken).toBeNull();
                  }
                  break;

                case 'clear':
                  authTokenManager.clearTokens();
                  lastStoredTokens = null;
                  
                  // Property: After clearing, no tokens should be retrievable
                  const clearedTokens = authTokenManager.getStoredTokens();
                  expect(clearedTokens.accessToken).toBeNull();
                  expect(clearedTokens.refreshToken).toBeNull();
                  break;
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle storage errors gracefully for any storage failure scenario', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: fc.string({ minLength: 10, maxLength: 500 }).filter(s => {
              const trimmed = s.trim();
              return trimmed.length >= 10 && /^[A-Za-z0-9._-]+$/.test(trimmed);
            }),
            refreshToken: fc.string({ minLength: 10, maxLength: 500 }).filter(s => {
              const trimmed = s.trim();
              return trimmed.length >= 10 && /^[A-Za-z0-9._-]+$/.test(trimmed);
            }),
            expiresAt: fc.date({ min: new Date(), max: new Date(Date.now() + 86400000) })
          }),
          async (tokenData) => {
            // Simulate storage failure
            const originalSetItem = mockLocalStorage.setItem;
            mockLocalStorage.setItem = () => {
              throw new Error('Storage quota exceeded');
            };

            // Property: Storage failures should not crash the application
            expect(() => {
              authTokenManager.storeTokens(tokenData);
            }).not.toThrow();

            // Restore original setItem
            mockLocalStorage.setItem = originalSetItem;

            // Property: After storage failure, tokens should not be stored
            const tokens = authTokenManager.getStoredTokens();
            expect(tokens.accessToken).toBeNull();
            expect(tokens.refreshToken).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});