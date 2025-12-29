import { renderHook, act } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { usePaymentFlow } from '@/hooks/usePaymentFlow';
import { apiClient } from '@/lib/api';
import * as fc from 'fast-check';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getPaymentStatus: jest.fn(),
  },
}));

jest.mock('@/lib/react-query', () => ({
  queryKeys: {
    orders: {
      all: ['orders'],
      byId: (id: string) => ['orders', id],
    },
    payments: {
      byId: (id: string) => ['payments', id],
    },
  },
}));

const mockRouter = {
  push: jest.fn(),
};

const mockQueryClient = {
  invalidateQueries: jest.fn(),
};

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseQueryClient = useQueryClient as jest.MockedFunction<
  typeof useQueryClient
>;

// Mock timers
jest.useFakeTimers();

describe('usePaymentFlow Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter as any);
    mockUseQueryClient.mockReturnValue(mockQueryClient as any);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  /**
   * Property 19: Payment status polling
   * For any payment in progress, the frontend should implement proper status polling to handle webhook-triggered updates
   * Validates: Requirements 8.3
   */
  it('Property 19: Payment status polling - should properly poll payment status for any payment ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary payment IDs and status sequences
        fc.record({
          paymentId: fc
            .string({ minLength: 2, maxLength: 50 })
            .filter((s) => s.trim().length >= 2 && /^[a-zA-Z0-9_-]+$/.test(s)), // Valid alphanumeric IDs only
          statusSequence: fc.array(
            fc.record({
              status: fc.constantFrom(
                'pending',
                'paid',
                'failed',
                'cancelled',
                'expired'
              ),
              order_id: fc
                .string({ minLength: 2, maxLength: 50 })
                .filter(
                  (s) => s.trim().length >= 2 && /^[a-zA-Z0-9_-]+$/.test(s)
                ), // Valid alphanumeric IDs only
              amount: fc.integer({ min: 100, max: 100000 }),
              currency: fc.constantFrom('BRL', 'USD'),
              payment_method: fc.constantFrom('pix', 'credit_card'),
              created_at: fc
                .date({
                  min: new Date('2020-01-01'),
                  max: new Date('2030-01-01'),
                })
                .map((d) => d.toISOString()),
              completed_at: fc
                .option(
                  fc.date({
                    min: new Date('2020-01-01'),
                    max: new Date('2030-01-01'),
                  })
                )
                .map((d) => (d ? d.toISOString() : null)),
              failure_reason: fc.option(
                fc.string({ minLength: 1, maxLength: 100 })
              ),
              error_message: fc.option(
                fc.string({ minLength: 1, maxLength: 100 })
              ),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          pollingInterval: fc.integer({ min: 1000, max: 5000 }),
          maxAttempts: fc.integer({ min: 2, max: 10 }), // Minimum 2 attempts to avoid edge cases
        }),
        async ({ paymentId, statusSequence, pollingInterval, maxAttempts }) => {
          let callCount = 0;
          const onSuccess = jest.fn();
          const onError = jest.fn();

          // Mock API responses based on status sequence
          mockApiClient.getPaymentStatus.mockImplementation(async () => {
            const currentStatus =
              statusSequence[Math.min(callCount, statusSequence.length - 1)];
            callCount++;

            return {
              success: true,
              data: {
                id: paymentId,
                ...currentStatus,
              },
              message: 'Payment status retrieved',
            };
          });

          const { result } = renderHook(() =>
            usePaymentFlow({
              onSuccess,
              onError,
              pollingInterval,
              maxPollingAttempts: maxAttempts,
            })
          );

          // Start polling
          act(() => {
            result.current.startStatusPolling(paymentId);
          });

          // Verify polling started
          expect(result.current.state.status).toBe('polling');
          expect(result.current.isPolling).toBe(true);

          // Simulate polling cycles
          let pollCycles = 0;
          let hasTerminalStatus = false;

          // Process each status in the sequence or until max attempts
          for (
            let i = 0;
            i < Math.min(maxAttempts, statusSequence.length * 2);
            i++
          ) {
            await act(async () => {
              // First call is immediate, subsequent calls use the interval
              jest.advanceTimersByTime(i === 0 ? 100 : pollingInterval);
              await Promise.resolve();
            });

            pollCycles++;
            const currentStatusIndex = Math.min(i, statusSequence.length - 1);
            const currentStatus = statusSequence[currentStatusIndex];

            // Verify API was called with correct payment ID
            expect(mockApiClient.getPaymentStatus).toHaveBeenCalledWith(
              paymentId
            );

            // Check if polling should stop based on status
            if (
              ['paid', 'failed', 'cancelled', 'expired'].includes(
                currentStatus.status
              )
            ) {
              hasTerminalStatus = true;

              // Give the hook time to process the terminal status
              await act(async () => {
                await Promise.resolve();
              });

              if (currentStatus.status === 'paid') {
                expect(result.current.state.status).toBe('completed');
                expect(onSuccess).toHaveBeenCalledWith(
                  paymentId,
                  currentStatus.order_id
                );
              } else {
                expect(result.current.state.status).toBe('failed');
                expect(onError).toHaveBeenCalled();
              }
              expect(result.current.isPolling).toBe(false);
              break;
            } else if (currentStatus.status === 'pending') {
              // Should continue polling unless we've reached max attempts
              if (pollCycles < maxAttempts) {
                expect(result.current.state.status).toBe('polling');
                expect(result.current.isPolling).toBe(true);
              }
            }
          }

          // If no terminal status was reached and we've done enough cycles, check for timeout
          if (!hasTerminalStatus && pollCycles >= maxAttempts) {
            // Advance one more time to trigger the timeout logic
            await act(async () => {
              jest.advanceTimersByTime(pollingInterval);
              await Promise.resolve();
            });

            // Should have timed out
            expect(result.current.state.status).toBe('failed');
            expect(result.current.state.error?.message).toBe(
              'Payment status polling timed out'
            );
            expect(result.current.isPolling).toBe(false);
            expect(onError).toHaveBeenCalledWith({
              type: 'UNKNOWN',
              message: 'Payment status polling timed out',
            });
          }

          // Verify polling can be stopped manually
          if (result.current.isPolling) {
            act(() => {
              result.current.stopPolling();
            });
            expect(result.current.isPolling).toBe(false);
          }

          // Verify polling configuration
          expect(result.current.currentInterval).toBe(pollingInterval);
          expect(result.current.maxAttempts).toBe(maxAttempts);
        }
      ),
      {
        numRuns: 50,
        timeout: 10000,
        // Tag for identification
        examples: [
          [
            {
              paymentId: 'test-payment-123',
              statusSequence: [
                {
                  status: 'pending',
                  order_id: 'order-123',
                  amount: 1000,
                  currency: 'BRL',
                  payment_method: 'pix',
                  created_at: '2023-01-01T00:00:00Z',
                },
                {
                  status: 'paid',
                  order_id: 'order-123',
                  amount: 1000,
                  currency: 'BRL',
                  payment_method: 'pix',
                  created_at: '2023-01-01T00:00:00Z',
                  completed_at: '2023-01-01T00:30:00Z',
                },
              ],
              pollingInterval: 3000,
              maxAttempts: 5,
            },
          ],
        ],
      }
    );
  }, 15000);

  it('Property 19: Payment status polling - should handle API errors during polling gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          paymentId: fc
            .string({ minLength: 2, maxLength: 50 })
            .filter((s) => s.trim().length >= 2 && /^[a-zA-Z0-9_-]+$/.test(s)), // Valid alphanumeric IDs only
          errorSequence: fc.array(
            fc.oneof(
              fc.constant('network_error'),
              fc.constant('api_error'),
              fc.constant('timeout'),
              fc.record({
                status: fc.constantFrom('pending', 'paid', 'failed'),
                order_id: fc
                  .string({ minLength: 2, maxLength: 50 })
                  .filter(
                    (s) => s.trim().length >= 2 && /^[a-zA-Z0-9_-]+$/.test(s)
                  ), // Valid alphanumeric IDs only
                amount: fc.integer({ min: 100, max: 100000 }),
                currency: fc.constantFrom('BRL', 'USD'),
                payment_method: fc.constantFrom('pix', 'credit_card'),
                created_at: fc
                  .date({
                    min: new Date('2020-01-01'),
                    max: new Date('2030-01-01'),
                  })
                  .map((d) => d.toISOString()),
              })
            ),
            { minLength: 1, maxLength: 5 }
          ),
          pollingInterval: fc.integer({ min: 1000, max: 3000 }),
        }),
        async ({ paymentId, errorSequence, pollingInterval }) => {
          let callCount = 0;
          const onError = jest.fn();
          const onSuccess = jest.fn();

          // Mock API responses with errors and successes
          mockApiClient.getPaymentStatus.mockImplementation(async () => {
            const currentResponse =
              errorSequence[Math.min(callCount, errorSequence.length - 1)];
            callCount++;

            if (typeof currentResponse === 'string') {
              // Simulate different types of errors
              switch (currentResponse) {
                case 'network_error':
                  throw new Error('Network error');
                case 'api_error':
                  return {
                    success: false,
                    message: 'API error occurred',
                  };
                case 'timeout':
                  throw new Error('Request timeout');
                default:
                  throw new Error('Unknown error');
              }
            } else {
              // Return successful response
              return {
                success: true,
                data: {
                  id: paymentId,
                  ...currentResponse,
                },
                message: 'Payment status retrieved',
              };
            }
          });

          const { result } = renderHook(() =>
            usePaymentFlow({
              onError,
              onSuccess,
              pollingInterval,
              maxPollingAttempts: 10,
            })
          );

          // Start polling
          act(() => {
            result.current.startStatusPolling(paymentId);
          });

          expect(result.current.state.status).toBe('polling');
          expect(result.current.isPolling).toBe(true);

          // Simulate several polling cycles
          let hasTerminalStatus = false;
          for (let i = 0; i < Math.min(errorSequence.length, 5); i++) {
            await act(async () => {
              jest.advanceTimersByTime(i === 0 ? 100 : pollingInterval);
              await Promise.resolve();
            });

            const currentResponse =
              errorSequence[Math.min(i, errorSequence.length - 1)];

            if (
              typeof currentResponse === 'object' &&
              ['paid', 'failed'].includes(currentResponse.status)
            ) {
              // Terminal status reached - give it a moment to process
              await act(async () => {
                await Promise.resolve();
              });

              hasTerminalStatus = true;
              if (currentResponse.status === 'paid') {
                expect(result.current.state.status).toBe('completed');
                expect(onSuccess).toHaveBeenCalledWith(
                  paymentId,
                  currentResponse.order_id
                );
              } else {
                expect(result.current.state.status).toBe('failed');
                expect(onError).toHaveBeenCalled();
              }
              expect(result.current.isPolling).toBe(false);
              break;
            } else if (
              typeof currentResponse === 'object' &&
              currentResponse.status === 'pending'
            ) {
              // Pending status - should continue polling
              expect(result.current.state.status).toBe('polling');
              expect(result.current.isPolling).toBe(true);
            }
            // For error responses (strings), the hook continues polling but logs errors
            // The status should remain 'polling' and isPolling should remain true
            // unless we've reached max attempts or encountered a terminal status
          }

          // If no terminal status was reached, polling should still be active
          if (!hasTerminalStatus) {
            expect(result.current.state.status).toBe('polling');
            expect(result.current.isPolling).toBe(true);
          }

          // Verify API was called with correct payment ID
          expect(mockApiClient.getPaymentStatus).toHaveBeenCalledWith(
            paymentId
          );
        }
      ),
      {
        numRuns: 30,
        timeout: 8000,
      }
    );
  }, 12000);

  it('Property 19: Payment status polling - should properly invalidate queries on successful payment', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          paymentId: fc
            .string({ minLength: 2, maxLength: 50 })
            .filter((s) => s.trim().length >= 2 && /^[a-zA-Z0-9_-]+$/.test(s)), // Valid alphanumeric IDs only
          orderId: fc
            .string({ minLength: 2, maxLength: 50 })
            .filter((s) => s.trim().length >= 2 && /^[a-zA-Z0-9_-]+$/.test(s)), // Valid alphanumeric IDs only
          amount: fc.integer({ min: 100, max: 100000 }),
          currency: fc.constantFrom('BRL', 'USD'),
          payment_method: fc.constantFrom('pix', 'credit_card'),
        }),
        async ({ paymentId, orderId, amount, currency, payment_method }) => {
          const onSuccess = jest.fn();

          // Mock successful payment response
          mockApiClient.getPaymentStatus.mockResolvedValue({
            success: true,
            data: {
              id: paymentId,
              order_id: orderId,
              status: 'paid',
              amount,
              currency,
              payment_method,
              created_at: '2023-01-01T00:00:00Z',
              completed_at: '2023-01-01T00:30:00Z',
            },
            message: 'Payment status retrieved',
          });

          const { result } = renderHook(() => usePaymentFlow({ onSuccess }));

          // Start polling
          act(() => {
            result.current.startStatusPolling(paymentId);
          });

          // Trigger polling
          await act(async () => {
            jest.advanceTimersByTime(100);
            await Promise.resolve();
          });

          // Verify success callback was called
          expect(onSuccess).toHaveBeenCalledWith(paymentId, orderId);

          // Verify queries were invalidated
          expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ['orders'],
          });
          expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ['orders', orderId],
          });
          expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ['payments', paymentId],
          });

          // Verify polling stopped
          expect(result.current.state.status).toBe('completed');
          expect(result.current.isPolling).toBe(false);
        }
      ),
      {
        numRuns: 25,
        timeout: 5000,
      }
    );
  }, 8000);
});

// Feature: api-endpoints-update, Property 19: Payment status polling
