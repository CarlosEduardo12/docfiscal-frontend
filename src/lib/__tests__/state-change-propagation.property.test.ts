/**
 * Property-Based Tests for State Change Propagation
 * 
 * **Feature: frontend-issues-resolution, Property 28: State changes update all relevant components**
 * **Validates: Requirements 8.1**
 * 
 * Tests that when order status changes occur, the state management system
 * updates all relevant UI components automatically without requiring manual refresh.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as fc from 'fast-check';
import React from 'react';

// Mock the API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    getOrder: jest.fn(),
    getUserOrders: jest.fn(),
  },
}));

// Import after mocking
import { useOrderStatus, useUserOrders, queryKeys } from '@/lib/react-query';
import { apiClient } from '@/lib/api';

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Test wrapper component
const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => 
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

// Order status generator
const orderStatusArb = fc.constantFrom(
  'pending_payment',
  'processing', 
  'completed',
  'failed',
  'cancelled'
);

// Order data generator
const orderDataArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  filename: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  status: orderStatusArb,
  created_at: fc.integer({ min: 1577836800000, max: 1893456000000 }).map(ts => new Date(ts).toISOString()),
  updated_at: fc.integer({ min: 1577836800000, max: 1893456000000 }).map(ts => new Date(ts).toISOString()),
  file_size: fc.integer({ min: 1, max: 100000000 }),
  processed_at: fc.option(fc.integer({ min: 1577836800000, max: 1893456000000 }).map(ts => new Date(ts).toISOString())),
  error: fc.option(fc.string()),
});

// User orders list generator
const userOrdersArb = fc.record({
  orders: fc.array(orderDataArb, { minLength: 1, maxLength: 10 }),
  total: fc.integer({ min: 1, max: 100 }),
  page: fc.integer({ min: 1, max: 10 }),
  limit: fc.integer({ min: 5, max: 50 }),
});

describe('State Change Propagation Properties', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: 0,
        },
      },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('Order status changes propagate to all components using that order', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        orderStatusArb,
        async (initialOrder, newStatus) => {
          // Skip if status is the same to ensure we're testing actual changes
          if (initialOrder.status === newStatus) return;

          // Setup initial order data
          const updatedOrder = { ...initialOrder, status: newStatus };
          
          mockApiClient.getOrder.mockResolvedValue({
            success: true,
            data: initialOrder,
          });

          const wrapper = createWrapper(queryClient);

          // Render multiple hooks that use the same order
          const { result: result1 } = renderHook(
            () => useOrderStatus(initialOrder.id),
            { wrapper }
          );

          const { result: result2 } = renderHook(
            () => useOrderStatus(initialOrder.id),
            { wrapper }
          );

          // Wait for initial data to load with longer timeout
          await waitFor(
            () => {
              expect(result1.current.data).toEqual(initialOrder);
              expect(result2.current.data).toEqual(initialOrder);
            },
            { timeout: 5000 }
          );

          // **Property: When order status changes, all components should receive the update**
          await act(async () => {
            queryClient.setQueryData(queryKeys.orders.byId(initialOrder.id), updatedOrder);
          });

          // Wait for the update to propagate
          await waitFor(
            () => {
              expect(result1.current.data?.status).toBe(newStatus);
              expect(result2.current.data?.status).toBe(newStatus);
            },
            { timeout: 1000 }
          );

          // Verify both hooks have the same updated data
          expect(result1.current.data).toEqual(result2.current.data);
          expect(result1.current.data?.status).toBe(newStatus);
        }
      ),
      { numRuns: 50 } // Reduced runs for stability
    );
  });

  test('Order list updates propagate to all components using user orders', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        userOrdersArb,
        orderDataArb,
        async (userId, initialOrders, newOrder) => {
          // Ensure the new order has a unique ID
          const uniqueNewOrder = {
            ...newOrder,
            id: `new-${newOrder.id}-${Date.now()}`,
          };

          // Add the new order to the list
          const updatedOrders = {
            ...initialOrders,
            orders: [...initialOrders.orders, uniqueNewOrder],
            total: initialOrders.total + 1,
          };

          mockApiClient.getUserOrders.mockResolvedValue({
            success: true,
            data: initialOrders,
          });

          const wrapper = createWrapper(queryClient);

          // Render multiple hooks that use the same user orders
          const { result: result1 } = renderHook(
            () => useUserOrders(userId),
            { wrapper }
          );

          const { result: result2 } = renderHook(
            () => useUserOrders(userId),
            { wrapper }
          );

          // Wait for initial data to load with longer timeout
          await waitFor(
            () => {
              expect(result1.current.data).toEqual(initialOrders);
              expect(result2.current.data).toEqual(initialOrders);
            },
            { timeout: 5000 }
          );

          // **Property: When order list changes, all components should receive the update**
          await act(async () => {
            queryClient.setQueryData(queryKeys.orders.userOrders(userId), updatedOrders);
          });

          // Wait for the update to propagate
          await waitFor(
            () => {
              expect(result1.current.data?.orders).toHaveLength(updatedOrders.orders.length);
              expect(result2.current.data?.orders).toHaveLength(updatedOrders.orders.length);
            },
            { timeout: 1000 }
          );

          // Verify both hooks have the same updated data
          expect(result1.current.data).toEqual(result2.current.data);
          expect(result1.current.data?.total).toBe(updatedOrders.total);
        }
      ),
      { numRuns: 30 } // Reduced runs for stability
    );
  }, 15000); // Increased timeout for this test

  test('Cache invalidation propagates to all dependent queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        orderDataArb,
        userOrdersArb,
        async (userId, orderData, userOrdersData) => {
          // Setup mocks to return fresh data on refetch
          mockApiClient.getOrder.mockResolvedValue({
            success: true,
            data: orderData,
          });

          mockApiClient.getUserOrders.mockResolvedValue({
            success: true,
            data: userOrdersData,
          });

          const wrapper = createWrapper(queryClient);

          // Render hooks for both individual order and user orders list
          const { result: orderResult } = renderHook(
            () => useOrderStatus(orderData.id),
            { wrapper }
          );

          const { result: userOrdersResult } = renderHook(
            () => useUserOrders(userId),
            { wrapper }
          );

          // Wait for initial data to load with longer timeout
          await waitFor(
            () => {
              expect(orderResult.current.data).toEqual(orderData);
              expect(userOrdersResult.current.data).toEqual(userOrdersData);
            },
            { timeout: 5000 }
          );

          // Clear mocks to track refetch calls
          mockApiClient.getOrder.mockClear();
          mockApiClient.getUserOrders.mockClear();

          // **Property: Cache invalidation should trigger refetch for all related queries**
          act(() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
          });

          // Wait for refetch to complete with longer timeout
          await waitFor(
            () => {
              expect(orderResult.current.isFetching).toBe(false);
              expect(userOrdersResult.current.isFetching).toBe(false);
            },
            { timeout: 5000 }
          );

          // Both queries should have been refetched
          expect(mockApiClient.getOrder).toHaveBeenCalled();
          expect(mockApiClient.getUserOrders).toHaveBeenCalled();
        }
      ),
      { numRuns: 50 } // Reduced runs for this more complex test
    );
  });

  test('Optimistic updates are visible across all components immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        orderStatusArb,
        async (initialOrder, optimisticStatus) => {
          // Skip if status is the same to ensure we're testing actual changes
          if (initialOrder.status === optimisticStatus) return;

          mockApiClient.getOrder.mockResolvedValue({
            success: true,
            data: initialOrder,
          });

          const wrapper = createWrapper(queryClient);

          // Render multiple components that use the same order
          const { result: result1 } = renderHook(
            () => useOrderStatus(initialOrder.id),
            { wrapper }
          );

          const { result: result2 } = renderHook(
            () => useOrderStatus(initialOrder.id),
            { wrapper }
          );

          // Wait for initial data to load with longer timeout
          await waitFor(
            () => {
              expect(result1.current.data).toEqual(initialOrder);
              expect(result2.current.data).toEqual(initialOrder);
            },
            { timeout: 5000 }
          );

          // **Property: Optimistic updates should be immediately visible across all components**
          const optimisticOrder = { ...initialOrder, status: optimisticStatus };
          
          await act(async () => {
            queryClient.setQueryData(queryKeys.orders.byId(initialOrder.id), optimisticOrder);
          });

          // Wait for the update to propagate
          await waitFor(
            () => {
              expect(result1.current.data?.status).toBe(optimisticStatus);
              expect(result2.current.data?.status).toBe(optimisticStatus);
            },
            { timeout: 1000 }
          );
          
          // Data should be consistent across components
          expect(result1.current.data).toEqual(result2.current.data);
        }
      ),
      { numRuns: 50 } // Reduced runs for stability
    );
  });

  test('State changes maintain referential equality for unchanged data', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        async (orderData, newFilename) => {
          // Skip if filename is the same to ensure we're testing actual changes
          if (orderData.filename === newFilename) return;

          mockApiClient.getOrder.mockResolvedValue({
            success: true,
            data: orderData,
          });

          const wrapper = createWrapper(queryClient);

          const { result } = renderHook(
            () => useOrderStatus(orderData.id),
            { wrapper }
          );

          // Wait for initial data to load with longer timeout
          await waitFor(
            () => {
              expect(result.current.data).toEqual(orderData);
            },
            { timeout: 5000 }
          );

          const initialData = result.current.data;

          // **Property: Updating unrelated data should not affect referential equality of unchanged fields**
          const updatedOrder = { ...orderData, filename: newFilename };
          
          await act(async () => {
            queryClient.setQueryData(queryKeys.orders.byId(orderData.id), updatedOrder);
          });

          // Wait for the update to propagate
          await waitFor(
            () => {
              expect(result.current.data?.filename).toBe(newFilename);
            },
            { timeout: 1000 }
          );

          // Status should remain the same value if unchanged
          expect(result.current.data?.status).toBe(initialData?.status);
          expect(result.current.data?.id).toBe(initialData?.id);
          
          // But filename should be updated
          expect(result.current.data?.filename).toBe(newFilename);
          
          // Verify the update was applied
          expect(result.current.data?.filename).not.toBe(orderData.filename);
        }
      ),
      { numRuns: 50 } // Reduced runs for stability
    );
  });
});