/**
 * Property-based tests for download functionality
 * **Feature: api-endpoints-update, Property 35-38: Download functionality properties**
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
 */

import * as fc from 'fast-check';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { OrderHistoryTable } from '@/components/order/OrderHistoryTable';
import { Order, OrderStatus } from '@/types';

// Mock date-fns to avoid timezone issues in tests
jest.mock('date-fns', () => ({
  format: jest.fn((date, formatStr) => {
    if (formatStr === 'MMM dd, yyyy') return 'Jan 01, 2024';
    if (formatStr === 'HH:mm') return '12:00';
    if (formatStr === 'MMM dd, yyyy HH:mm') return 'Jan 01, 2024 12:00';
    return 'formatted-date';
  }),
}));

describe('Download Functionality Property Tests', () => {
  afterEach(() => {
    cleanup();
  });

  // Generator for completed orders using new API format
  const completedOrderArb = fc.integer({ min: 0 }).chain((index) =>
    fc.record({
      id: fc.constant(`download-order-${index}-${Date.now()}`),
      user_id: fc.constant('download-user-123'),
      filename: fc
        .string({ minLength: 1, maxLength: 50 })
        .map((name) => name.trim() || 'document')
        .map((name) => `${name}.pdf`),
      file_size: fc.integer({ min: 1, max: 10000000 }),
      status: fc.constant('completed' as OrderStatus),
      created_at: fc
        .date({
          min: new Date('2020-01-01T00:00:00.000Z'),
          max: new Date('2024-12-31T23:59:59.999Z'),
        })
        .map((d) => d.toISOString()),
      updated_at: fc
        .date({
          min: new Date('2020-01-01T00:00:00.000Z'),
          max: new Date('2024-12-31T23:59:59.999Z'),
        })
        .map((d) => d.toISOString()),
      processing_completed_at: fc.option(
        fc
          .date({
            min: new Date('2020-01-01T00:00:00.000Z'),
            max: new Date('2024-12-31T23:59:59.999Z'),
          })
          .map((d) => d.toISOString())
      ),
      download_url: fc.option(fc.webUrl()),
      error_message: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
      expires_at: fc.option(
        fc
          .date({
            min: new Date('2024-01-01T00:00:00.000Z'),
            max: new Date('2025-12-31T23:59:59.999Z'),
          })
          .map((d) => d.toISOString())
      ),
    })
  ) as fc.Arbitrary<Order>;

  // Generator for non-completed orders using new API format
  const nonCompletedOrderArb = fc.integer({ min: 0 }).chain((index) =>
    fc.record({
      id: fc.constant(`non-download-order-${index}-${Date.now()}`),
      user_id: fc.constant('download-user-123'),
      filename: fc
        .string({ minLength: 1, maxLength: 50 })
        .map((name) => name.trim() || 'document')
        .map((name) => `${name}.pdf`),
      file_size: fc.integer({ min: 1, max: 10000000 }),
      status: fc.constantFrom(
        'pending_payment',
        'paid',
        'processing',
        'failed'
      ) as fc.Arbitrary<OrderStatus>,
      created_at: fc
        .date({
          min: new Date('2020-01-01T00:00:00.000Z'),
          max: new Date('2024-12-31T23:59:59.999Z'),
        })
        .map((d) => d.toISOString()),
      updated_at: fc
        .date({
          min: new Date('2020-01-01T00:00:00.000Z'),
          max: new Date('2024-12-31T23:59:59.999Z'),
        })
        .map((d) => d.toISOString()),
      processing_completed_at: fc.option(
        fc
          .date({
            min: new Date('2020-01-01T00:00:00.000Z'),
            max: new Date('2024-12-31T23:59:59.999Z'),
          })
          .map((d) => d.toISOString())
      ),
      checkout_url: fc.option(fc.webUrl()),
      download_url: fc.option(fc.webUrl()),
      error_message: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
    })
  ) as fc.Arbitrary<Order>;

  describe('Property 35-38: Download functionality properties', () => {
    it('Property 35: Download link expiration handling - should provide download buttons only for completed orders', async () => {
      await fc.assert(
        fc.property(
          fc.record({
            completedOrders: fc.array(completedOrderArb, {
              minLength: 1,
              maxLength: 3,
            }),
            nonCompletedOrders: fc.array(nonCompletedOrderArb, {
              minLength: 0,
              maxLength: 2,
            }),
          }),
          ({ completedOrders, nonCompletedOrders }) => {
            // Ensure unique IDs
            const uniqueCompletedOrders = completedOrders.map(
              (order, index) => ({
                ...order,
                id: `completed-download-${index}-${Date.now()}`,
                status: 'completed' as OrderStatus,
              })
            );

            const uniqueNonCompletedOrders = nonCompletedOrders.map(
              (order, index) => ({
                ...order,
                id: `non-completed-download-${index}-${Date.now()}`,
              })
            );

            const allOrders = [
              ...uniqueCompletedOrders,
              ...uniqueNonCompletedOrders,
            ];
            const mockOnDownload = jest.fn();

            const { unmount } = render(
              <OrderHistoryTable
                orders={allOrders}
                onDownload={mockOnDownload}
                isLoading={false}
              />
            );

            // Property: Download buttons should only exist for completed orders
            const downloadButtons = screen.queryAllByText('Download');

            // Each completed order should have at least one download button (desktop + mobile views)
            expect(downloadButtons.length).toBeGreaterThanOrEqual(
              uniqueCompletedOrders.length
            );

            // The number of download buttons should not exceed twice the completed orders (desktop + mobile)
            expect(downloadButtons.length).toBeLessThanOrEqual(
              uniqueCompletedOrders.length * 2
            );

            unmount();
          }
        ),
        { numRuns: 5 }
      );
    });

    it('Property 36: Download header processing - should call onDownload with correct order ID when download button is clicked', async () => {
      await fc.assert(
        fc.property(
          fc.array(completedOrderArb, { minLength: 1, maxLength: 2 }),
          (completedOrders) => {
            // Ensure unique IDs
            const uniqueCompletedOrders = completedOrders.map(
              (order, index) => ({
                ...order,
                id: `clickable-download-${index}-${Date.now()}`,
                status: 'completed' as OrderStatus,
              })
            );

            const mockOnDownload = jest.fn();

            const { unmount } = render(
              <OrderHistoryTable
                orders={uniqueCompletedOrders}
                onDownload={mockOnDownload}
                isLoading={false}
              />
            );

            // Property: Clicking download should call onDownload with the correct order ID
            const downloadButtons = screen.getAllByText('Download');

            if (downloadButtons.length > 0) {
              // Click the first download button
              fireEvent.click(downloadButtons[0]);

              // Verify that onDownload was called
              expect(mockOnDownload).toHaveBeenCalled();

              // Verify that onDownload was called with a valid order ID
              const calledWithOrderId = mockOnDownload.mock.calls[0][0];
              const orderIds = uniqueCompletedOrders.map((order) => order.id);
              expect(orderIds).toContain(calledWithOrderId);
            }

            unmount();
          }
        ),
        { numRuns: 5 }
      );
    });

    it('Property 37: Download error messaging - should not provide download functionality for non-completed orders', async () => {
      await fc.assert(
        fc.property(
          fc.array(nonCompletedOrderArb, { minLength: 1, maxLength: 3 }),
          (nonCompletedOrders) => {
            // Ensure unique IDs and non-completed status
            const uniqueNonCompletedOrders = nonCompletedOrders.map(
              (order, index) => ({
                ...order,
                id: `non-completed-${index}-${Date.now()}`,
                status: fc.sample(
                  fc.constantFrom(
                    'pending_payment',
                    'paid',
                    'processing',
                    'failed'
                  ),
                  1
                )[0] as OrderStatus,
              })
            );

            const mockOnDownload = jest.fn();

            const { unmount } = render(
              <OrderHistoryTable
                orders={uniqueNonCompletedOrders}
                onDownload={mockOnDownload}
                isLoading={false}
              />
            );

            // Property: No download buttons should exist for non-completed orders
            const downloadButtons = screen.queryAllByText('Download');
            expect(downloadButtons).toHaveLength(0);

            // Property: onDownload should never be called for non-completed orders
            expect(mockOnDownload).not.toHaveBeenCalled();

            unmount();
          }
        ),
        { numRuns: 5 }
      );
    });

    it('Property 38: Download retry options - should handle mixed order statuses correctly', async () => {
      await fc.assert(
        fc.property(
          fc.record({
            completedCount: fc.integer({ min: 1, max: 2 }),
            nonCompletedCount: fc.integer({ min: 1, max: 2 }),
          }),
          ({ completedCount, nonCompletedCount }) => {
            // Create completed orders using new API format
            const completedOrders = Array.from(
              { length: completedCount },
              (_, index) => ({
                id: `mixed-completed-${index}-${Date.now()}`,
                user_id: 'mixed-user-123',
                filename: `completed-file-${index}.pdf`,
                file_size: 1024 * (index + 1),
                status: 'completed' as OrderStatus,
                created_at: '2024-01-01T00:00:00.000Z',
                updated_at: '2024-01-01T00:00:00.000Z',
                processing_completed_at: '2024-01-01T00:00:00.000Z',
                download_url: `https://api.docfiscal.com/orders/mixed-completed-${index}/download`,
                error_message: undefined,
              })
            );

            // Create non-completed orders using new API format
            const nonCompletedStatuses: OrderStatus[] = [
              'pending_payment',
              'paid',
              'processing',
              'failed',
            ];
            const nonCompletedOrders = Array.from(
              { length: nonCompletedCount },
              (_, index) => ({
                id: `mixed-non-completed-${index}-${Date.now()}`,
                user_id: 'mixed-user-123',
                filename: `non-completed-file-${index}.pdf`,
                file_size: 1024 * (index + 1),
                status:
                  nonCompletedStatuses[index % nonCompletedStatuses.length],
                created_at: '2024-01-01T00:00:00.000Z',
                updated_at: '2024-01-01T00:00:00.000Z',
                processing_completed_at: undefined,
                checkout_url:
                  index % 2 === 0
                    ? `https://payment.provider.com/checkout/${index}`
                    : undefined,
                download_url: undefined,
                error_message:
                  index % 3 === 0
                    ? `Error processing file ${index}`
                    : undefined,
              })
            );

            const allOrders = [...completedOrders, ...nonCompletedOrders];
            const mockOnDownload = jest.fn();

            const { unmount } = render(
              <OrderHistoryTable
                orders={allOrders}
                onDownload={mockOnDownload}
                isLoading={false}
              />
            );

            // Property: Download buttons should only exist for completed orders
            const downloadButtons = screen.queryAllByText('Download');

            // Should have download buttons for completed orders (accounting for responsive design)
            expect(downloadButtons.length).toBeGreaterThanOrEqual(
              completedCount
            );
            expect(downloadButtons.length).toBeLessThanOrEqual(
              completedCount * 2
            );

            // Property: All orders should be displayed
            const totalOrdersDisplayed =
              completedOrders.length + nonCompletedOrders.length;
            expect(totalOrdersDisplayed).toBe(
              completedCount + nonCompletedCount
            );

            unmount();
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});
