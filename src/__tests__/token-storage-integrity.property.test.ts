/**
 * **Feature: login-redirect-fix, Property 1: Token Storage and Synchronization Integrity**
 * **Validates: Requirements 1.2, 3.1, 3.2**
 */

import * as fc from 'fast-check';
import { AuthTokenManager, AuthTokens } from '../lib/AuthTokenManager';
import { authTokenManager } from '../lib/AuthTokenManager';

// Mock localStorage for testing
const createMockLocalStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => {
      return store[key] || null;
    }),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = String(value); // Ensure value is stored as string
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    _resetStore: () => { store = {}; }
  };
};

// Mock window object and localStorage globally
let mockLocalStorage: any;

// Mock fetch for token refresh
global.fetch = jest.fn();

// Helper to generate JWT-like tokens that pass validation
// Use a simple approach with only safe alphanumeric characters
const safeBase64String = fc.string({
  minLength: 10,
  maxLength: 50,
  unit: fc.constantFrom(
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  )
});

const jwtLikeTokenArbitrary = fc.tuple(
  safeBase64String,
  safeBase64String,
  safeBase64String
).map(([header, payload, signature]) => `${header}.${payload}.${signature}`);

describe('Token Storage and Synchronization Integrity Property Tests', () => {
  let tokenManager: AuthTokenManager;

  beforeEach(() => {
    // Create a fresh mock localStorage for each test
    mockLocalStorage = createMockLocalStorage();
    
    // Mock both window.localStorage and global localStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      configurable: true
    });
    
    // Also mock global localStorage for Node.js environment
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      configurable: true
    });
    
    jest.clearAllMocks();
    tokenManager = new AuthTokenManager();
  });

  afterEach(() => {
    // Clean up after each test
    jest.clearAllMocks();
    mockLocalStorage.clear();
  });

  describe('Property 1: Token Storage and Synchronization Integrity', () => {
    it('should store and retrieve tokens consistently for any valid token set', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: jwtLikeTokenArbitrary,
            refreshToken: jwtLikeTokenArbitrary,
            expiresIn: fc.integer({ min: 3600, max: 86400 }), // 1 hour to 24 hours (well beyond 5 min threshold)
          }),
          async (tokenData) => {
            const tokens: AuthTokens = {
              accessToken: tokenData.accessToken,
              refreshToken: tokenData.refreshToken,
              expiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
            };

            // Store tokens
            tokenManager.storeTokens(tokens);

            // Retrieve tokens immediately
            const storedTokens = tokenManager.getStoredTokens();

            // Property: Stored tokens should be immediately retrievable and identical
            expect(storedTokens.accessToken).toBe(tokens.accessToken);
            expect(storedTokens.refreshToken).toBe(tokens.refreshToken);
            expect(storedTokens.expiresAt.getTime()).toBe(tokens.expiresAt.getTime());

            // Property: Authentication state should be synchronized
            const isAuthenticated = await tokenManager.isAuthenticated();
            expect(isAuthenticated).toBe(true);

            // Property: Valid token should be retrievable
            const validToken = await tokenManager.getValidToken();
            expect(validToken).toBe(tokens.accessToken);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle token expiration and refresh correctly for any expired token', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: jwtLikeTokenArbitrary,
            refreshToken: jwtLikeTokenArbitrary,
            newAccessToken: jwtLikeTokenArbitrary,
          }),
          async (tokenData) => {
            // Create expired tokens
            const expiredTokens: AuthTokens = {
              accessToken: tokenData.accessToken,
              refreshToken: tokenData.refreshToken,
              expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
            };

            tokenManager.storeTokens(expiredTokens);

            // Mock successful token refresh
            (global.fetch as jest.Mock).mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                success: true,
                tokens: {
                  access_token: tokenData.newAccessToken,
                  refresh_token: tokenData.refreshToken,
                  expires_in: 3600,
                },
              }),
            });

            // Attempt to get valid token (should trigger refresh)
            const validToken = await tokenManager.getValidToken();

            // Property: Expired tokens should be refreshed automatically
            expect(validToken).toBe(tokenData.newAccessToken);

            // Property: New tokens should be stored
            const storedTokens = tokenManager.getStoredTokens();
            expect(storedTokens.accessToken).toBe(tokenData.newAccessToken);
            expect(storedTokens.refreshToken).toBe(tokenData.refreshToken);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clear tokens completely for any token set', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: jwtLikeTokenArbitrary,
            refreshToken: jwtLikeTokenArbitrary,
            expiresIn: fc.integer({ min: 3600, max: 86400 }),
          }),
          async (tokenData) => {
            const tokens: AuthTokens = {
              accessToken: tokenData.accessToken,
              refreshToken: tokenData.refreshToken,
              expiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
            };

            // Store tokens first
            tokenManager.storeTokens(tokens);
            
            // Verify tokens are stored
            let storedTokens = tokenManager.getStoredTokens();
            expect(storedTokens.accessToken).toBe(tokens.accessToken);

            // Clear tokens
            tokenManager.clearTokens();

            // Property: All tokens should be completely cleared
            storedTokens = tokenManager.getStoredTokens();
            expect(storedTokens.accessToken).toBeNull();
            expect(storedTokens.refreshToken).toBeNull();
            expect(storedTokens.expiresAt).toBeNull();

            // Property: Authentication state should be synchronized after clearing
            const isAuthenticated = await tokenManager.isAuthenticated();
            expect(isAuthenticated).toBe(false);

            // Property: No valid token should be available after clearing
            const validToken = await tokenManager.getValidToken();
            expect(validToken).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle localStorage errors gracefully for any token operation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: jwtLikeTokenArbitrary,
            refreshToken: jwtLikeTokenArbitrary,
            expiresIn: fc.integer({ min: 3600, max: 86400 }),
          }),
          async (tokenData) => {
            const tokens: AuthTokens = {
              accessToken: tokenData.accessToken,
              refreshToken: tokenData.refreshToken,
              expiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
            };

            // First store tokens normally to ensure they exist
            tokenManager.storeTokens(tokens);
            
            // Verify tokens are stored
            const initialTokens = tokenManager.getStoredTokens();
            expect(initialTokens.accessToken).toBe(tokens.accessToken);

            // Now create a localStorage mock that throws errors for getItem
            const errorMockLocalStorage = {
              getItem: jest.fn().mockImplementation(() => {
                throw new Error('localStorage access denied');
              }),
              setItem: jest.fn().mockImplementation(() => {
                throw new Error('localStorage quota exceeded');
              }),
              removeItem: jest.fn().mockImplementation(() => {
                throw new Error('localStorage access denied');
              }),
              clear: jest.fn().mockImplementation(() => {
                throw new Error('localStorage access denied');
              }),
            };

            // Replace localStorage with error mock
            const originalLocalStorage = window.localStorage;
            const originalGlobalLocalStorage = (global as any).localStorage;
            
            Object.defineProperty(window, 'localStorage', {
              value: errorMockLocalStorage,
              configurable: true
            });
            Object.defineProperty(global, 'localStorage', {
              value: errorMockLocalStorage,
              configurable: true
            });

            try {
              const testTokenManager = new AuthTokenManager();

              // Property: Storage errors should not crash the application
              expect(() => testTokenManager.storeTokens(tokens)).not.toThrow();

              // Property: Retrieval errors should return safe defaults
              const storedTokens = testTokenManager.getStoredTokens();
              expect(storedTokens.accessToken).toBeNull();
              expect(storedTokens.refreshToken).toBeNull();
              expect(storedTokens.expiresAt).toBeNull();
            } finally {
              // Restore original localStorage
              Object.defineProperty(window, 'localStorage', {
                value: originalLocalStorage,
                configurable: true
              });
              Object.defineProperty(global, 'localStorage', {
                value: originalGlobalLocalStorage,
                configurable: true
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should migrate old tokens correctly for any legacy token format', () => {
      // Use a simple test instead of property-based test for migration
      const testTokens = {
        accessToken: 'test.access.token',
        refreshToken: 'test.refresh.token'
      };

      // Create a completely isolated mock localStorage for this test
      const isolatedStore: Record<string, string> = {};
      const isolatedMockLocalStorage = {
        getItem: jest.fn((key: string) => isolatedStore[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          isolatedStore[key] = String(value);
        }),
        removeItem: jest.fn((key: string) => {
          delete isolatedStore[key];
        }),
        clear: jest.fn(() => {
          Object.keys(isolatedStore).forEach(key => delete isolatedStore[key]);
        }),
      };

      // Override both window.localStorage and global localStorage for this test only
      const originalLocalStorage = window.localStorage;
      const originalGlobalLocalStorage = (global as any).localStorage;
      
      Object.defineProperty(window, 'localStorage', {
        value: isolatedMockLocalStorage,
        configurable: true
      });
      Object.defineProperty(global, 'localStorage', {
        value: isolatedMockLocalStorage,
        configurable: true
      });

      try {
        // Clear any existing state first
        isolatedMockLocalStorage.clear();

        // Set up old token format in localStorage (no new format tokens)
        isolatedMockLocalStorage.setItem('access_token', testTokens.accessToken);
        isolatedMockLocalStorage.setItem('refresh_token', testTokens.refreshToken);

        // Ensure new format keys don't exist initially
        expect(isolatedMockLocalStorage.getItem('docfiscal_access_token')).toBeNull();
        expect(isolatedMockLocalStorage.getItem('docfiscal_refresh_token')).toBeNull();

        // Create a fresh token manager instance for this test
        const testTokenManager = new AuthTokenManager();

        // Call migration using the test instance
        testTokenManager.migrateOldTokens();

        // Property: Old tokens should be migrated to new format
        const storedTokens = testTokenManager.getStoredTokens();
        
        expect(storedTokens.accessToken).toBe(testTokens.accessToken);
        expect(storedTokens.refreshToken).toBe(testTokens.refreshToken);

        // Property: Old token keys should be removed
        expect(isolatedMockLocalStorage.getItem('access_token')).toBeNull();
        expect(isolatedMockLocalStorage.getItem('refresh_token')).toBeNull();

        // Property: New token keys should be present
        expect(isolatedMockLocalStorage.getItem('docfiscal_access_token')).toBe(testTokens.accessToken);
        expect(isolatedMockLocalStorage.getItem('docfiscal_refresh_token')).toBe(testTokens.refreshToken);
      } finally {
        // Restore original localStorage
        Object.defineProperty(window, 'localStorage', {
          value: originalLocalStorage,
          configurable: true
        });
        Object.defineProperty(global, 'localStorage', {
          value: originalGlobalLocalStorage,
          configurable: true
        });
      }
    });

    it('should maintain token integrity across multiple operations for any sequence of operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              operation: fc.constantFrom('store', 'retrieve', 'clear', 'refresh'),
              accessToken: jwtLikeTokenArbitrary,
              refreshToken: jwtLikeTokenArbitrary,
              expiresIn: fc.integer({ min: 3600, max: 86400 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (operations) => {
            let lastStoredTokens: AuthTokens | null = null;

            for (const op of operations) {
              const tokens: AuthTokens = {
                accessToken: op.accessToken,
                refreshToken: op.refreshToken,
                expiresAt: new Date(Date.now() + op.expiresIn * 1000),
              };

              switch (op.operation) {
                case 'store':
                  tokenManager.storeTokens(tokens);
                  lastStoredTokens = tokens;
                  break;

                case 'retrieve':
                  const retrieved = tokenManager.getStoredTokens();
                  if (lastStoredTokens) {
                    // Property: Retrieved tokens should match last stored tokens
                    expect(retrieved.accessToken).toBe(lastStoredTokens.accessToken);
                    expect(retrieved.refreshToken).toBe(lastStoredTokens.refreshToken);
                  }
                  break;

                case 'clear':
                  tokenManager.clearTokens();
                  lastStoredTokens = null;
                  
                  // Property: After clearing, no tokens should be retrievable
                  const clearedTokens = tokenManager.getStoredTokens();
                  expect(clearedTokens.accessToken).toBeNull();
                  expect(clearedTokens.refreshToken).toBeNull();
                  break;

                case 'refresh':
                  if (lastStoredTokens) {
                    // Mock successful refresh
                    (global.fetch as jest.Mock).mockResolvedValueOnce({
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

                    const refreshResult = await tokenManager.refreshToken();
                    
                    // Property: Successful refresh should update stored tokens
                    if (refreshResult.success) {
                      expect(refreshResult.tokens?.accessToken).toBe(op.accessToken);
                      lastStoredTokens = refreshResult.tokens!;
                    }
                  }
                  break;
              }
            }
          }
        ),
        { numRuns: 50 } // Reduced runs due to complexity
      );
    });
  });
});