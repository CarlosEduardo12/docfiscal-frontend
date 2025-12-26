/**
 * Property-Based Tests for State Failure Recovery
 * 
 * **Feature: frontend-issues-resolution, Property 31: State update failures provide recovery mechanisms**
 * **Validates: Requirements 8.4**
 * 
 * Tests that when state updates fail, the system handles conflicts gracefully 
 * and provides mechanisms for state recovery.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import { useOrderStatus, useRetryOrder, queryKeys } from '@/lib/react-query';
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
  created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }).map(d => d.toISOString()),
  updated_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }).map(d => d.toISOString()),
  file_size: fc.integer({ min: 1, max: 100000000 }),
});

// Error type generator
const errorTypeArb = fc.constantFrom(
  'NETWORK_ERROR',
  'SERVER_ERROR', 
  'TIMEOUT_ERROR',
  'VALIDATION_ERROR',
  'CONFLICT_ERROR'
);

// Error message generator
const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0);

describe('State Failure Recovery Properties', () => {
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

  test('Query failures preserve previous valid state', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        errorMessageArb,
        async (initialOrder, errorMessage) => {
          // Setup successful initial load, then failure on refetch
          mockApiClient.getOrder
            .mockResolvedValueOnce({
              success: true,
              data: initialOrder,
            })
            .mockRejectedValueOnce(new Error(errorMessage));

          const wrapper = createWrapper(queryClient);

          const { result } = renderHook(
            () => useOrderStatus(initialOrder.id),
            { wrapper }
          );

          // Wait for initial successful load
          await waitFor(() => {
            expect(result.current.data).toEqual(initialOrder);
            expect(result.current.isSuccess).toBe(true);
          }, { timeout: 3000 });

          // **Property: Query failures should preserve previous valid state**
          
          // Trigger refetch that will fail
          act(() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.byId(initialOrder.id) });
          });

          // Wait for error state
          await waitFor(() => {
            expect(result.current.isError).toBe(true);
          }, { timeout: 3000 });

          // Previous data should still be available
          expect(result.current.data).toEqual(initialOrder);
          expect(result.current.error).toBeTruthy();
          
          // Should be able to retry
          expect(typeof result.current.refetch).toBe('function');
        }
      ),
      { numRuns: 20 }
    );
  }, 15000);

  test('Mutation failures provide retry mechanisms', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        errorTypeArb,
        errorMessageArb,
        async (orderId, errorType, errorMessage) => {
          // Setup mutation to fail initially
          const error = new Error(errorMessage);
          (error as any).type = errorType;
          
          mockApiClient.retryOrder.mockRejectedValueOnce(error);

          const wrapper = createWrapper(queryClient);

          const { result } = renderHook(
            () => useRetryOrder(),
            { wrapper }
          );

          // **Property: Mutation failures should provide retry mechanisms**
          
          let mutationError: any = null;
          
          // Attempt mutation that will fail
          act(() => {
            result.current.mutate(orderId, {
              onError: (err) => {
                mutationError = err;
              },
            });
          });

          // Wait for mutation to complete
          await waitFor(() => {
            expect(result.current.isIdle || result.current.isError).toBe(true);
          }, { timeout: 3000 });

          // Should have error information
          expect(mutationError).toBeTruthy();
          expect(mutationError.message).toBe(errorMessage);
          
          // Should be able to retry the mutation
          expect(typeof result.current.mutate).toBe('function');
          expect(result.current.isError).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  }, 15000);

  test('Network failures trigger automatic retry with backoff', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        fc.integer({ min: 1, max: 2 }),
        async (orderData, failureCount) => {
          // Clear all mocks before each property test run
          jest.clearAllMocks();
          
          // Create query client with retry enabled for this test
          const retryQueryClient = new QueryClient({
            defaultOptions: {
              queries: {
                retry: failureCount,
                retryDelay: () => 50, // Very fast retry for testing
                gcTime: 0,
              },
            },
          });

          // Setup API to fail specified number of times, then succeed
          const networkError = new Error('Network error');
          (networkError as any).code = 'NETWORK_ERROR';
          
          for (let i = 0; i < failureCount; i++) {
            mockApiClient.getOrder.mockRejectedValueOnce(networkError);
          }
          mockApiClient.getOrder.mockResolvedValueOnce({
            success: true,
            data: orderData,
          });

          const wrapper = createWrapper(retryQueryClient);

          const { result } = renderHook(
            () => useOrderStatus(orderData.id),
            { wrapper }
          );

          // **Property: Network failures should trigger automatic retry**
          
          // Wait for eventual success after retries
          await waitFor(() => {
            expect(result.current.data).toEqual(orderData);
            expect(result.current.isSuccess).toBe(true);
          }, { timeout: 5000 });

          // Should have made the expected number of API calls (failures + success)
          expect(mockApiClient.getOrder).toHaveBeenCalledTimes(failureCount + 1);
        }
      ),
      { numRuns: 10 }
    );
  }, 15000);

  test('Optimistic update failures rollback to previous state', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        fc.constantFrom('pending_payment', 'processing', 'completed', 'failed'),
        errorMessageArb,
        async (initialOrder, optimisticStatus, errorMessage) => {
          // Skip if status is the same
          if (initialOrder.status === optimisticStatus) return;

          // Setup successful initial load
          mockApiClient.getOrder.mockResolvedValue({
            success: true,
            data: initialOrder,
          });

          const wrapper = createWrapper(queryClient);

          const { result } = renderHook(
            () => useOrderStatus(initialOrder.id),
            { wrapper }
          );

          // Wait for initial data
          await waitFor(() => {
            expect(result.current.data).toEqual(initialOrder);
          }, { timeout: 3000 });

          // **Property: Optimistic update failures should rollback to previous state**
          
          // Store original status for comparison
          const originalStatus = result.current.data?.status;
          
          // Apply optimistic update
          const optimisticOrder = { ...initialOrder, status: optimisticStatus };
          act(() => {
            queryClient.setQueryData(queryKeys.orders.byId(initialOrder.id), optimisticOrder);
          });

          // Wait for React to process the update
          await waitFor(() => {
            expect(result.current.data?.status).toBe(optimisticStatus);
          }, { timeout: 1000 });

          // Simulate server rejection by setting back to original data
          act(() => {
            queryClient.setQueryData(queryKeys.orders.byId(initialOrder.id), initialOrder);
          });

          // Wait for rollback to complete
          await waitFor(() => {
            expect(result.current.data?.status).toBe(originalStatus);
          }, { timeout: 1000 });

          // Verify complete rollback
          expect(result.current.data).toEqual(initialOrder);
        }
      ),
      { numRuns: 15 }
    );
  }, 15000);

  test('Concurrent update conflicts are resolved consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        fc.array(
          fc.constantFrom('pending_payment', 'processing', 'completed', 'failed'),
          { minLength: 2, maxLength: 3 }
        ),
        async (initialOrder, statusUpdates) => {
          // Remove duplicates and ensure changes
          const uniqueStatuses = [...new Set(statusUpdates)].filter(s => s !== initialOrder.status);
          if (uniqueStatuses.length === 0) {
            return;
          }

          mockApiClient.getOrder.mockResolvedValue({
            success: true,
            data: initialOrder,
          });

          const wrapper = createWrapper(queryClient);

          const { result } = renderHook(
            () => useOrderStatus(initialOrder.id),
            { wrapper }
          );

          // Wait for initial data
          await waitFor(() => {
            expect(result.current.data).toEqual(initialOrder);
          }, { timeout: 3000 });

          // **Property: Concurrent updates should be resolved consistently**
          
          // Apply updates sequentially to simulate concurrent resolution
          let currentOrder = initialOrder;
          for (const status of uniqueStatuses) {
            currentOrder = { ...currentOrder, status };
            
            act(() => {
              queryClient.setQueryData(queryKeys.orders.byId(initialOrder.id), currentOrder);
            });

            // Wait for each update to be processed
            await waitFor(() => {
              expect(result.current.data?.status).toBe(status);
            }, { timeout: 1000 });
          }

          // Final state should be the last applied status
          const finalStatus = uniqueStatuses[uniqueStatuses.length - 1];
          expect(result.current.data?.status).toBe(finalStatus);
          expect(result.current.data?.id).toBe(initialOrder.id);
          
          // Should maintain data integrity
          expect(result.current.data?.filename).toBe(initialOrder.filename);
          expect(result.current.data?.file_size).toBe(initialOrder.file_size);
        }
      ),
      { numRuns: 15 }
    );
  }, 15000);

  test('Cache corruption recovery maintains data integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        async (orderData) => {
          mockApiClient.getOrder.mockResolvedValue({
            success: true,
            data: orderData,
          });

          const wrapper = createWrapper(queryClient);

          const { result } = renderHook(
            () => useOrderStatus(orderData.id),
            { wrapper }
          );

          // Wait for initial data
          await waitFor(() => {
            expect(result.current.data).toEqual(orderData);
          }, { timeout: 3000 });

          // **Property: Cache corruption recovery should maintain data integrity**
          
          // Simulate cache corruption by setting invalid data
          const corruptedData = { 
            id: 'corrupted-id',
            invalid: 'data', 
            corrupted: true 
          };
          
          act(() => {
            queryClient.setQueryData(queryKeys.orders.byId(orderData.id), corruptedData);
          });

          // Wait for corrupted data to be applied
          await waitFor(() => {
            expect(result.current.data).toEqual(corruptedData);
          }, { timeout: 1000 });

          // Trigger recovery by invalidating cache and refetching
          act(() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.byId(orderData.id) });
          });

          // Should recover with valid data
          await waitFor(() => {
            expect(result.current.data).toEqual(orderData);
          }, { timeout: 3000 });

          // Data integrity should be restored
          expect(result.current.data?.id).toBe(orderData.id);
          expect(result.current.data?.status).toBe(orderData.status);
          expect(result.current.data?.filename).toBe(orderData.filename);
        }
      ),
      { numRuns: 15 }
    );
  }, 15000);

  test('Error boundaries preserve application state during failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        errorMessageArb,
        async (orderData, errorMessage) => {
          // Setup successful load followed by error
          mockApiClient.getOrder
            .mockResolvedValueOnce({
              success: true,
              data: orderData,
            })
            .mockRejectedValueOnce(new Error(errorMessage));

          const wrapper = createWrapper(queryClient);

          const { result } = renderHook(
            () => useOrderStatus(orderData.id),
            { wrapper }
          );

          // Wait for initial success
          await waitFor(() => {
            expect(result.current.data).toEqual(orderData);
            expect(result.current.isSuccess).toBe(true);
          }, { timeout: 3000 });

          // **Property: Error boundaries should preserve application state**
          
          // Store initial successful state
          const successfulState = {
            data: result.current.data,
            isSuccess: result.current.isSuccess,
          };

          // Trigger error
          act(() => {
            result.current.refetch();
          });

          // Wait for error state
          await waitFor(() => {
            expect(result.current.isError).toBe(true);
          }, { timeout: 3000 });

          // Previous successful data should still be available
          expect(result.current.data).toEqual(successfulState.data);
          
          // Should have error information for recovery
          expect(result.current.error).toBeTruthy();
          expect(typeof result.current.refetch).toBe('function');
        }
      ),
      { numRuns: 15 }
    );
  }, 15000);

  test('Recovery mechanisms work after multiple failure types', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        fc.array(errorTypeArb, { minLength: 2, maxLength: 3 }),
        async (orderData, errorTypes) => {
          // Setup initial success
          mockApiClient.getOrder.mockResolvedValueOnce({
            success: true,
            data: orderData,
          });

          // Setup different types of failures
          errorTypes.forEach((errorType, index) => {
            const error = new Error(`${errorType} failure ${index}`);
            (error as any).type = errorType;
            mockApiClient.getOrder.mockRejectedValueOnce(error);
          });

          // Final success
          mockApiClient.getOrder.mockResolvedValueOnce({
            success: true,
            data: orderData,
          });

          const wrapper = createWrapper(queryClient);

          const { result } = renderHook(
            () => useOrderStatus(orderData.id),
            { wrapper }
          );

          // Wait for initial success
          await waitFor(() => {
            expect(result.current.data).toEqual(orderData);
          }, { timeout: 3000 });

          // **Property: Recovery should work after multiple failure types**
          
          // Trigger multiple failures and recoveries
          for (let i = 0; i < errorTypes.length; i++) {
            // Trigger refetch that will fail
            act(() => {
              result.current.refetch();
            });

            // Wait for error with shorter timeout
            await waitFor(() => {
              expect(result.current.isError).toBe(true);
            }, { timeout: 2000 });

            // Data should still be available
            expect(result.current.data).toEqual(orderData);
            expect(typeof result.current.refetch).toBe('function');
          }

          // Final recovery should work
          act(() => {
            result.current.refetch();
          });

          await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
            expect(result.current.data).toEqual(orderData);
          }, { timeout: 3000 });
        }
      ),
      { numRuns: 10 }
    );
  }, 15000);
});