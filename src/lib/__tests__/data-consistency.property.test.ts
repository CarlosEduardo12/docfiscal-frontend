/**
 * Property-Based Tests for Data Consistency
 * 
 * **Feature: frontend-issues-resolution, Property 30: Multiple components receive consistent data**
 * **Validates: Requirements 8.3**
 * 
 * Tests that when multiple components need the same data, the state management 
 * system provides a single source of truth to prevent inconsistencies.
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
    getProfile: jest.fn(),
  },
}));

// Import after mocking
import { useOrderStatus, useUserOrders, useCurrentUser, queryKeys } from '@/lib/react-query';
import { apiClient } from '@/lib/api';

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Test wrapper component
const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => 
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

// Simplified order data generator
const orderDataArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  filename: fc.string({ minLength: 1, maxLength: 50 }),
  status: fc.constantFrom('pending_payment', 'processing', 'completed', 'failed'),
  created_at: fc.constant('2024-01-01T00:00:00.000Z'),
  updated_at: fc.constant('2024-01-01T00:00:00.000Z'),
  file_size: fc.integer({ min: 1000, max: 1000000 }),
});

describe('Data Consistency Properties', () => {
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
    jest.resetAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  test('Multiple components using same order data receive identical data', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        async (orderData) => {
          // Reset mocks for each property run
          jest.clearAllMocks();
          
          mockApiClient.getOrder.mockResolvedValueOnce({
            success: true,
            data: orderData,
          });

          const wrapper = createWrapper(queryClient);

          // Create two hook instances simulating different components
          const { result: result1 } = renderHook(
            () => useOrderStatus(orderData.id),
            { wrapper }
          );
          
          const { result: result2 } = renderHook(
            () => useOrderStatus(orderData.id),
            { wrapper }
          );

          // Wait for both to load
          await waitFor(() => {
            expect(result1.current.data).toEqual(orderData);
            expect(result2.current.data).toEqual(orderData);
          }, { timeout: 5000 });

          // **Property: All components should receive identical data**
          expect(result1.current.data).toEqual(result2.current.data);
          expect(result1.current.data?.id).toBe(orderData.id);
          expect(result2.current.data?.id).toBe(orderData.id);
          expect(result1.current.data?.status).toBe(orderData.status);
          expect(result2.current.data?.status).toBe(orderData.status);

          // Should have made only one API call despite multiple components
          expect(mockApiClient.getOrder).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Data updates propagate consistently to all components', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderDataArb,
        fc.constantFrom('pending_payment', 'processing', 'completed', 'failed'),
        async (initialOrder, newStatus) => {
          // Skip if status is the same
          if (initialOrder.status === newStatus) return;

          // Reset mocks for each property run
          jest.clearAllMocks();
          
          mockApiClient.getOrder.mockResolvedValueOnce({
            success: true,
            data: initialOrder,
          });

          const wrapper = createWrapper(queryClient);

          // Create two components using the same order
          const { result: result1 } = renderHook(
            () => useOrderStatus(initialOrder.id),
            { wrapper }
          );
          
          const { result: result2 } = renderHook(
            () => useOrderStatus(initialOrder.id),
            { wrapper }
          );

          // Wait for initial data to load
          await waitFor(() => {
            expect(result1.current.data).toEqual(initialOrder);
            expect(result2.current.data).toEqual(initialOrder);
          }, { timeout: 5000 });

          // **Property: Data updates should propagate consistently to all components**
          const updatedOrder = { ...initialOrder, status: newStatus };
          
          act(() => {
            queryClient.setQueryData(queryKeys.orders.byId(initialOrder.id), updatedOrder);
          });

          // Wait for updates to propagate
          await waitFor(() => {
            expect(result1.current.data?.status).toBe(newStatus);
            expect(result2.current.data?.status).toBe(newStatus);
          }, { timeout: 2000 });

          // Both components should have the same updated data
          expect(result1.current.data).toEqual(result2.current.data);
          expect(result1.current.data?.status).toBe(newStatus);
          expect(result2.current.data?.status).toBe(newStatus);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Error states are consistent across components', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (orderId, errorMessage) => {
          // Reset mocks for each property run
          jest.clearAllMocks();
          
          const error = new Error(errorMessage);
          mockApiClient.getOrder.mockRejectedValueOnce(error);

          const wrapper = createWrapper(queryClient);

          // Create two components
          const { result: result1 } = renderHook(
            () => useOrderStatus(orderId),
            { wrapper }
          );
          
          const { result: result2 } = renderHook(
            () => useOrderStatus(orderId),
            { wrapper }
          );

          // Wait for error state
          await waitFor(() => {
            expect(result1.current.isError).toBe(true);
            expect(result2.current.isError).toBe(true);
          }, { timeout: 5000 });

          // **Property: Error states should be consistent across all components**
          expect(result1.current.isError).toBe(result2.current.isError);
          expect(result1.current.error).toEqual(result2.current.error);
          expect(result1.current.data).toBeUndefined();
          expect(result2.current.data).toBeUndefined();

          // Should have made at least one API call
          expect(mockApiClient.getOrder).toHaveBeenCalledWith(orderId);
        }
      ),
      { numRuns: 30 }
    );
  }, 15000);
});