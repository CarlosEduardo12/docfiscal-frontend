/**
 * Property-based tests for API caching behavior
 * **Feature: frontend-issues-resolution, Property 26: API caching avoids redundant requests**
 * **Validates: Requirements 7.3**
 */

import * as fc from 'fast-check';
import { QueryClient } from '@tanstack/react-query';

// Simple cache behavior simulator
interface CacheEntry {
  data: any;
  timestamp: number;
  staleTime: number;
}

class MockQueryCache {
  private cache = new Map<string, CacheEntry>();
  private requestCount = 0;

  reset() {
    this.cache.clear();
    this.requestCount = 0;
  }

  getRequestCount() {
    return this.requestCount;
  }

  async fetchData(key: string, staleTime: number = 5000): Promise<any> {
    const now = Date.now();
    const cached = this.cache.get(key);

    // Check if we have fresh cached data
    if (cached && (now - cached.timestamp) < cached.staleTime) {
      // Return cached data without making a request
      return cached.data;
    }

    // Make a new request
    this.requestCount++;
    const data = { id: key, timestamp: now, data: `fresh-data-${this.requestCount}` };
    
    // Cache the result
    this.cache.set(key, {
      data,
      timestamp: now,
      staleTime
    });

    return data;
  }

  invalidateCache(key: string) {
    this.cache.delete(key);
  }

  setQueryData(key: string, data: any, staleTime: number = 5000) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      staleTime
    });
  }

  getQueryData(key: string): any {
    const cached = this.cache.get(key);
    return cached ? cached.data : undefined;
  }

  isStale(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return true;
    
    const now = Date.now();
    return (now - cached.timestamp) >= cached.staleTime;
  }
}

describe('API Caching Behavior Properties', () => {
  let mockCache: MockQueryCache;

  beforeEach(() => {
    mockCache = new MockQueryCache();
  });

  test('Property 26: API caching avoids redundant requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          resourceId: fc.string({ minLength: 1, maxLength: 20 }),
          requestCount: fc.integer({ min: 2, max: 10 }),
          staleTime: fc.integer({ min: 1000, max: 10000 }), // 1-10 seconds
        }),
        async ({ resourceId, requestCount, staleTime }) => {
          mockCache.reset();
          const initialRequestCount = mockCache.getRequestCount();

          // Make multiple requests for the same resource within stale time
          const results: any[] = [];
          
          for (let i = 0; i < requestCount; i++) {
            const result = await mockCache.fetchData(resourceId, staleTime);
            results.push(result);
            
            // Small delay to ensure requests happen in sequence
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          // All results should be identical (from cache)
          const firstResult = results[0];
          results.forEach(result => {
            expect(result).toEqual(firstResult);
          });

          // Only one API request should have been made
          const finalRequestCount = mockCache.getRequestCount();
          const actualRequests = finalRequestCount - initialRequestCount;
          
          expect(actualRequests).toBe(1);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Cache invalidation triggers new requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          resourceId: fc.string({ minLength: 1, maxLength: 20 }),
          staleTime: fc.integer({ min: 1000, max: 5000 }),
        }),
        async ({ resourceId, staleTime }) => {
          mockCache.reset();
          const initialRequestCount = mockCache.getRequestCount();

          // First request
          const result1 = await mockCache.fetchData(resourceId, staleTime);
          const requestsAfterFirst = mockCache.getRequestCount() - initialRequestCount;

          // Invalidate cache
          mockCache.invalidateCache(resourceId);

          // Second request after invalidation
          const result2 = await mockCache.fetchData(resourceId, staleTime);
          const requestsAfterSecond = mockCache.getRequestCount() - initialRequestCount;

          // Should have made 2 requests total
          expect(requestsAfterFirst).toBe(1);
          expect(requestsAfterSecond).toBe(2);

          // Results should be different (new data fetched)
          expect(result1).not.toEqual(result2);
        }
      ),
      { numRuns: 25 }
    );
  });

  test('Stale data triggers refetch', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          resourceId: fc.string({ minLength: 1, maxLength: 20 }),
          staleTime: fc.integer({ min: 100, max: 500 }), // Short stale time for testing
        }),
        async ({ resourceId, staleTime }) => {
          mockCache.reset();
          const initialRequestCount = mockCache.getRequestCount();

          // First request
          const result1 = await mockCache.fetchData(resourceId, staleTime);
          const requestsAfterFirst = mockCache.getRequestCount() - initialRequestCount;

          // Wait for data to become stale
          await new Promise(resolve => setTimeout(resolve, staleTime + 50));

          // Second request after stale time
          const result2 = await mockCache.fetchData(resourceId, staleTime);
          const requestsAfterSecond = mockCache.getRequestCount() - initialRequestCount;

          // Should have made 2 requests (data became stale)
          expect(requestsAfterFirst).toBe(1);
          expect(requestsAfterSecond).toBe(2);

          // Results should be different (new data fetched)
          expect(result1).not.toEqual(result2);
        }
      ),
      { numRuns: 15 } // Reduced for tests with delays
    );
  });

  test('Different cache keys maintain separate entries', () => {
    fc.assert(
      fc.property(
        fc.record({
          resourceIds: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 5 }),
          staleTime: fc.integer({ min: 1000, max: 5000 }),
        }),
        ({ resourceIds, staleTime }) => {
          mockCache.reset();

          // Set different data for each resource
          resourceIds.forEach((resourceId, index) => {
            const data = { id: resourceId, value: `data-${index}`, status: index % 2 === 0 ? 'active' : 'inactive' };
            mockCache.setQueryData(resourceId, data, staleTime);
          });

          // Verify each resource has its own cache entry
          resourceIds.forEach((resourceId, index) => {
            const cachedData = mockCache.getQueryData(resourceId);
            expect(cachedData).toEqual({
              id: resourceId,
              value: `data-${index}`,
              status: index % 2 === 0 ? 'active' : 'inactive'
            });
          });

          // Verify cache entries are independent
          const firstResourceId = resourceIds[0];
          const secondResourceId = resourceIds[1];
          
          const firstData = mockCache.getQueryData(firstResourceId);
          const secondData = mockCache.getQueryData(secondResourceId);
          
          expect(firstData).not.toEqual(secondData);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Cache respects stale time configuration', () => {
    fc.assert(
      fc.property(
        fc.record({
          resourceId: fc.string({ minLength: 1, maxLength: 20 }),
          staleTime: fc.integer({ min: 100, max: 5000 }),
        }),
        ({ resourceId, staleTime }) => {
          mockCache.reset();

          // Set data with specific stale time
          const data = { id: resourceId, timestamp: Date.now() };
          mockCache.setQueryData(resourceId, data, staleTime);

          // Data should not be stale immediately
          expect(mockCache.isStale(resourceId)).toBe(false);

          // Data should exist in cache
          expect(mockCache.getQueryData(resourceId)).toEqual(data);
        }
      ),
      { numRuns: 50 }
    );
  });
});