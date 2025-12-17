/**
 * Property-based tests for state persistence across navigation
 * **Feature: docfiscal-frontend, Property 10: State persistence across navigation**
 * **Validates: Requirements 5.1, 5.5**
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';
import { NavigationStateManager } from '@/lib/navigation-state';

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Setup global mocks
let originalWindow: any;
let originalLocalStorage: any;

beforeEach(() => {
  // Store original values
  originalWindow = global.window;
  originalLocalStorage = global.localStorage;

  // Mock window object
  const windowMock = {
    localStorage: localStorageMock,
    scrollY: 0,
    scrollTo: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };

  // Set up mocks
  (global as any).window = windowMock;
  (global as any).localStorage = localStorageMock;

  // Clear storage before each test
  localStorageMock.clear();
});

afterEach(() => {
  // Restore original values
  (global as any).window = originalWindow;
  (global as any).localStorage = originalLocalStorage;

  localStorageMock.clear();
});

// Generators for test data
const pathGenerator = fc
  .string({ minLength: 1, maxLength: 50 })
  .map((s) => `/${s.replace(/[^a-zA-Z0-9-_]/g, '')}`);

// JSON-safe generators that avoid undefined values
const jsonSafeValue = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.array(fc.string()),
  fc.record({
    id: fc.string(),
    name: fc.string(),
    value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
  })
);

const navigationStateGenerator = fc.record({
  previousPath: fc.option(pathGenerator, { nil: null }),
  scrollPosition: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: null }),
  formData: fc.option(
    fc.dictionary(fc.string({ minLength: 1 }), jsonSafeValue),
    { nil: null }
  ),
  timestamp: fc.integer({ min: Date.now() - 86400000, max: Date.now() }), // Within last 24 hours
});

const pageStateGenerator = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  jsonSafeValue
);

describe('State Persistence Property Tests', () => {
  describe('Property 10: State persistence across navigation', () => {
    it('should preserve navigation state across page refreshes', () => {
      fc.assert(
        fc.property(
          pathGenerator,
          navigationStateGenerator,
          (path, navigationState) => {
            const manager = NavigationStateManager.getInstance();

            // Save navigation state
            manager.saveNavigationState(path, navigationState);

            // Simulate page refresh by creating new manager instance and loading from storage
            const newManager = NavigationStateManager.getInstance();
            newManager.loadFromStorage();

            // Retrieve the state
            const retrievedState = newManager.getNavigationState(path);

            // State should be preserved
            expect(retrievedState).toBeDefined();
            expect(retrievedState?.previousPath).toBe(
              navigationState.previousPath
            );
            expect(retrievedState?.scrollPosition).toBe(
              navigationState.scrollPosition
            );
            expect(retrievedState?.formData).toEqual(navigationState.formData);
            expect(retrievedState?.timestamp).toBeGreaterThanOrEqual(
              navigationState.timestamp
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve page state across navigation', () => {
      fc.assert(
        fc.property(pathGenerator, pageStateGenerator, (path, pageState) => {
          const manager = NavigationStateManager.getInstance();

          // Save page state
          manager.savePageState(path, pageState);

          // Simulate navigation by creating new manager instance and loading from storage
          const newManager = NavigationStateManager.getInstance();
          newManager.loadFromStorage();

          // Retrieve the state
          const retrievedState = newManager.getPageState(path);

          // State should be preserved
          expect(retrievedState).toEqual(pageState);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle multiple paths with different states', () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(pathGenerator, navigationStateGenerator), {
            minLength: 1,
            maxLength: 10,
          }),
          (pathStatePairs) => {
            // Filter out duplicate paths to avoid conflicts
            const uniquePathPairs = pathStatePairs.filter(
              (pair, index, arr) =>
                arr.findIndex((p) => p[0] === pair[0]) === index
            );

            if (uniquePathPairs.length === 0) return; // Skip if no unique paths

            const manager = NavigationStateManager.getInstance();

            // Save states for multiple paths
            uniquePathPairs.forEach(([path, state]) => {
              manager.saveNavigationState(path, state);
            });

            // Simulate page refresh
            const newManager = NavigationStateManager.getInstance();
            newManager.loadFromStorage();

            // Verify all states are preserved
            uniquePathPairs.forEach(([path, originalState]) => {
              const retrievedState = newManager.getNavigationState(path);
              expect(retrievedState).toBeDefined();
              expect(retrievedState?.previousPath).toBe(
                originalState.previousPath
              );
              expect(retrievedState?.scrollPosition).toBe(
                originalState.scrollPosition
              );
              expect(retrievedState?.formData).toEqual(originalState.formData);
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should clean up old navigation states', () => {
      fc.assert(
        fc.property(
          pathGenerator,
          fc.integer({ min: 1, max: 5 }),
          (basePath, numStates) => {
            const manager = NavigationStateManager.getInstance();
            const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago (definitely old)
            const recent = Date.now() - 30 * 60 * 1000; // 30 minutes ago (definitely recent)

            // Create old and recent states
            for (let i = 0; i < numStates; i++) {
              const oldPath = `${basePath}/old-${i}`;
              const recentPath = `${basePath}/recent-${i}`;

              // Manually set old state with old timestamp
              const oldState = {
                timestamp: twoHoursAgo,
                scrollPosition: 100,
                previousPath: null,
                formData: null,
              };

              const recentState = {
                timestamp: recent,
                scrollPosition: 200,
                previousPath: null,
                formData: null,
              };

              // Directly set states to bypass saveNavigationState timestamp update
              (manager as any).state.set(oldPath, oldState);
              (manager as any).state.set(recentPath, recentState);
            }

            // Trigger cleanup
            manager.cleanupOldStates();

            // Verify old states are removed and recent states are preserved
            for (let i = 0; i < numStates; i++) {
              const oldPath = `${basePath}/old-${i}`;
              const recentPath = `${basePath}/recent-${i}`;

              expect(manager.getNavigationState(oldPath)).toBeUndefined();
              expect(manager.getNavigationState(recentPath)).toBeDefined();
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle localStorage errors gracefully', () => {
      fc.assert(
        fc.property(
          pathGenerator,
          navigationStateGenerator,
          (path, navigationState) => {
            const manager = NavigationStateManager.getInstance();

            // Mock localStorage to throw errors
            const originalSetItem = localStorageMock.setItem;
            const originalGetItem = localStorageMock.getItem;

            localStorageMock.setItem = jest.fn(() => {
              throw new Error('Storage quota exceeded');
            });

            // Should not throw when saving fails
            expect(() => {
              manager.saveNavigationState(path, navigationState);
            }).not.toThrow();

            // Mock localStorage to return corrupted data
            localStorageMock.getItem = jest.fn(() => 'invalid json');

            // Should not throw when loading corrupted data
            expect(() => {
              manager.loadFromStorage();
            }).not.toThrow();

            // Restore original methods
            localStorageMock.setItem = originalSetItem;
            localStorageMock.getItem = originalGetItem;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preserve scroll position correctly', () => {
      fc.assert(
        fc.property(
          pathGenerator,
          fc.integer({ min: 0, max: 10000 }),
          (path, scrollPosition) => {
            const manager = NavigationStateManager.getInstance();

            // Save scroll position
            manager.saveNavigationState(path, { scrollPosition });

            // Simulate page refresh
            const newManager = NavigationStateManager.getInstance();
            newManager.loadFromStorage();

            // Retrieve and verify scroll position
            const retrievedState = newManager.getNavigationState(path);
            expect(retrievedState?.scrollPosition).toBe(scrollPosition);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle form data persistence correctly', () => {
      fc.assert(
        fc.property(
          pathGenerator,
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.record({
            name: fc.string(),
            email: fc.emailAddress(),
            age: fc.integer({ min: 18, max: 100 }),
            preferences: fc.array(fc.string()),
          }),
          (path, formId, formData) => {
            const manager = NavigationStateManager.getInstance();

            // Save form data as page state
            manager.savePageState(path, { [formId]: formData });

            // Simulate navigation
            const newManager = NavigationStateManager.getInstance();
            newManager.loadFromStorage();

            // Retrieve and verify form data
            const retrievedPageState = newManager.getPageState(path);
            expect(retrievedPageState?.[formId]).toEqual(formData);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain state isolation between different paths', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(pathGenerator, pathGenerator)
            .filter(([path1, path2]) => path1 !== path2),
          navigationStateGenerator,
          navigationStateGenerator,
          ([path1, path2], state1, state2) => {
            const manager = NavigationStateManager.getInstance();

            // Save different states for different paths
            manager.saveNavigationState(path1, state1);
            manager.saveNavigationState(path2, state2);

            // Simulate page refresh
            const newManager = NavigationStateManager.getInstance();
            newManager.loadFromStorage();

            // Verify states are isolated
            const retrievedState1 = newManager.getNavigationState(path1);
            const retrievedState2 = newManager.getNavigationState(path2);

            expect(retrievedState1?.scrollPosition).toBe(state1.scrollPosition);
            expect(retrievedState2?.scrollPosition).toBe(state2.scrollPosition);
            expect(retrievedState1?.formData).toEqual(state1.formData);
            expect(retrievedState2?.formData).toEqual(state2.formData);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
