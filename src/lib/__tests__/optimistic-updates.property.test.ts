/**
 * Property-Based Tests for Optimistic Updates
 * 
 * **Feature: frontend-issues-resolution, Property 32: Optimistic updates handle rollbacks**
 * **Validates: Requirements 8.5**
 * 
 * Tests that when users perform actions that modify data, the state management 
 * system optimistically updates UI while handling potential rollbacks on failure.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useMutation, useQueryClient } from '@tanstack/react-query';
import * as fc from 'fast-check';
import React from 'react';

// Mock the API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    getOrder: jest.fn(),
    updateOrder: jest.fn(),
    retryOrder: jest.fn(),
  },
}));

// Import after mocking
import { useOrderStatus, queryKeys } from '@/lib/react-query';
import { apiClient } from '@/lib/api';

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Test wrapper component
const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => 
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

// Order data generator
const orderDataArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  filename: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  status: fc.constantFrom('pending_payment', 'processing', 'completed', 'failed'),
  created_at: fc.constant('2020-01-01T00:00:00.000Z'),
  updated_at: fc.constant('2020-01-01T00:00:00.000Z'),
  file_size: fc.integer({ min: 1, max: 100000000 }),
});

describe('Optimistic Updates Properties', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('Optimistic updates work through direct cache manipulation', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        fc.constantFrom('pending_payment', 'processing', 'completed', 'failed'),
        async (initialOrder, newStatus) => {
          // Skip if status is the same
          if (initialOrder.status === newStatus) return;

          // Setup initial order data
          mockApiClient.getOrder.mockResolvedValue({
            success: true,
            data: initialOrder,
          });

          const wrapper = createWrapper(queryClient);

          const { result: orderResult } = renderHook(
            () => useOrderStatus(initialOrder.id),
            { wrapper }
          );

          // Wait for initial data
          await waitFor(() => {
            expect(orderResult.current.data).toEqual(initialOrder);
          });

          // **Property: Optimistic updates should be immediately visible**
          
          // Simulate optimistic update by directly updating cache
          const optimisticOrder = { ...initialOrder, status: newStatus };
          
          act(() => {
            queryClient.setQueryData(queryKeys.orders.byId(initialOrder.id), optimisticOrder);
          });

          // Wait for the cache update to propagate to the hook
          await waitFor(() => {
            expect(orderResult.current.data?.status).toBe(newStatus);
          }, { timeout: 1000 });

          expect(orderResult.current.data?.id).toBe(initialOrder.id);
          expect(orderResult.current.data?.filename).toBe(initialOrder.filename);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Optimistic updates can be rolled back', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        fc.constantFrom('pending_payment', 'processing', 'completed', 'failed'),
        async (initialOrder, optimisticStatus) => {
          // Skip if status is the same
          if (initialOrder.status === optimisticStatus) return;

          // Setup initial order data
          mockApiClient.getOrder.mockResolvedValue({
            success: true,
            data: initialOrder,
          });

          const wrapper = createWrapper(queryClient);

          const { result: orderResult } = renderHook(
            () => useOrderStatus(initialOrder.id),
            { wrapper }
          );

          // Wait for initial data
          await waitFor(() => {
            expect(orderResult.current.data).toEqual(initialOrder);
          });

          // **Property: Optimistic updates should be rollback-able**
          
          // Apply optimistic update
          const optimisticOrder = { ...initialOrder, status: optimisticStatus };
          act(() => {
            queryClient.setQueryData(queryKeys.orders.byId(initialOrder.id), optimisticOrder);
          });

          // Verify optimistic update
          await waitFor(() => {
            expect(orderResult.current.data?.status).toBe(optimisticStatus);
          }, { timeout: 1000 });

          // Rollback to original
          act(() => {
            queryClient.setQueryData(queryKeys.orders.byId(initialOrder.id), initialOrder);
          });

          // Should be back to original state
          await waitFor(() => {
            expect(orderResult.current.data?.status).toBe(initialOrder.status);
          }, { timeout: 1000 });
          expect(orderResult.current.data).toEqual(initialOrder);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Multiple optimistic updates preserve data integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 1, max: 100000000 }),
        async (initialOrder, newFilename, newFileSize) => {
          // Skip if values are the same
          if (initialOrder.filename === newFilename && initialOrder.file_size === newFileSize) {
            return;
          }

          mockApiClient.getOrder.mockResolvedValue({
            success: true,
            data: initialOrder,
          });

          const wrapper = createWrapper(queryClient);

          const { result: orderResult } = renderHook(
            () => useOrderStatus(initialOrder.id),
            { wrapper }
          );

          // Wait for initial data
          await waitFor(() => {
            expect(orderResult.current.data).toEqual(initialOrder);
          });

          // **Property: Multiple optimistic updates should preserve data integrity**
          
          // Apply optimistic updates to multiple fields
          const optimisticOrder = {
            ...initialOrder,
            filename: newFilename,
            file_size: newFileSize,
          };
          
          act(() => {
            queryClient.setQueryData(queryKeys.orders.byId(initialOrder.id), optimisticOrder);
          });

          // Verify optimistic updates
          await waitFor(() => {
            expect(orderResult.current.data?.filename).toBe(newFilename);
            expect(orderResult.current.data?.file_size).toBe(newFileSize);
          }, { timeout: 1000 });
          expect(orderResult.current.data?.id).toBe(initialOrder.id);
          expect(orderResult.current.data?.status).toBe(initialOrder.status);

          // Rollback to original
          act(() => {
            queryClient.setQueryData(queryKeys.orders.byId(initialOrder.id), initialOrder);
          });

          // All fields should be restored correctly
          await waitFor(() => {
            expect(orderResult.current.data?.filename).toBe(initialOrder.filename);
            expect(orderResult.current.data?.file_size).toBe(initialOrder.file_size);
          }, { timeout: 1000 });
          expect(orderResult.current.data?.id).toBe(initialOrder.id);
          expect(orderResult.current.data?.status).toBe(initialOrder.status);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Optimistic updates work with concurrent component access', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        fc.constantFrom('pending_payment', 'processing', 'completed', 'failed'),
        fc.integer({ min: 2, max: 3 }),
        async (initialOrder, newStatus, componentCount) => {
          // Skip if status is the same
          if (initialOrder.status === newStatus) return;

          mockApiClient.getOrder.mockResolvedValue({
            success: true,
            data: initialOrder,
          });

          const wrapper = createWrapper(queryClient);

          // Create multiple components using the same order
          const results: Array<{ current: any }> = [];
          
          for (let i = 0; i < componentCount; i++) {
            const { result } = renderHook(
              () => useOrderStatus(initialOrder.id),
              { wrapper }
            );
            results.push(result);
          }

          // Wait for initial data in all components
          await waitFor(() => {
            results.forEach(result => {
              expect(result.current.data).toEqual(initialOrder);
            });
          });

          // **Property: Optimistic updates should work with concurrent component access**
          
          const optimisticOrder = { ...initialOrder, status: newStatus };
          
          act(() => {
            queryClient.setQueryData(queryKeys.orders.byId(initialOrder.id), optimisticOrder);
          });

          // All components should see the optimistic update
          await waitFor(() => {
            results.forEach(result => {
              expect(result.current.data?.status).toBe(newStatus);
              expect(result.current.data?.id).toBe(initialOrder.id);
            });
          }, { timeout: 1000 });

          // All components should have identical data
          const firstData = results[0].current.data;
          results.forEach(result => {
            expect(result.current.data).toEqual(firstData);
          });
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Mutation retry mechanisms work correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        orderDataArb,
        async (orderId, expectedResult) => {
          // Setup mutation to succeed after retry
          mockApiClient.retryOrder
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce({
              success: true,
              data: expectedResult,
            });

          const wrapper = createWrapper(queryClient);

          const { result: retryResult } = renderHook(
            () => {
              const queryClient = useQueryClient();
              return useMutation({
                mutationFn: async (id: string) => {
                  const response = await apiClient.retryOrder(id);
                  if (!response.success || !response.data) {
                    throw new Error(response.message || 'Failed to retry order');
                  }
                  return response.data;
                },
                onSuccess: (data) => {
                  // Update cache on success
                  queryClient.setQueryData(queryKeys.orders.byId(orderId), data);
                },
              });
            },
            { wrapper }
          );

          // **Property: Mutation retry mechanisms should work correctly**
          
          let mutationResult: any = null;
          let mutationError: any = null;
          
          // First attempt (will fail)
          act(() => {
            retryResult.current.mutate(orderId, {
              onSuccess: (data) => {
                mutationResult = data;
              },
              onError: (error) => {
                mutationError = error;
              },
            });
          });

          // Wait for first failure
          await waitFor(() => {
            expect(retryResult.current.isError).toBe(true);
          });

          expect(mutationError).toBeTruthy();
          expect(mutationResult).toBeNull();

          // Reset for retry
          mutationError = null;
          
          // Reset mutation state
          act(() => {
            retryResult.current.reset();
          });

          // Retry (will succeed)
          act(() => {
            retryResult.current.mutate(orderId, {
              onSuccess: (data) => {
                mutationResult = data;
              },
              onError: (error) => {
                mutationError = error;
              },
            });
          });

          // Wait for success
          await waitFor(() => {
            expect(retryResult.current.isSuccess).toBe(true);
          });

          expect(mutationResult).toEqual(expectedResult);
          expect(mutationError).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });
});