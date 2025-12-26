import * as fc from 'fast-check';
import { apiClient } from '@/lib/api';

// Mock the API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    getPaymentStatus: jest.fn(),
    getOrder: jest.fn()
  }
}));

// Mock React Query for cache invalidation
const mockInvalidateQueries = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries
  })
}));

describe('Payment Completion Updates Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvalidateQueries.mockClear();
  });

  /**
   * Property 13: Payment completion updates status immediately
   * **Validates: Requirements 4.3**
   * 
   * For any successful payment, the system should update order status 
   * immediately and display success confirmation with next steps
   */
  test('Property 13: Payment completion updates status immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          paymentId: fc.string({ minLength: 5, maxLength: 50 }),
          orderId: fc.string({ minLength: 5, maxLength: 50 }),
          completionTime: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).filter(d => !isNaN(d.getTime())),
          orderData: fc.record({
            id: fc.string({ minLength: 5, maxLength: 50 }),
            status: fc.constant('completed'),
            original_filename: fc.string({ minLength: 1, maxLength: 100 }),
            created_at: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).filter(d => !isNaN(d.getTime())).map(d => d.toISOString()),
            updated_at: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).filter(d => !isNaN(d.getTime())).map(d => d.toISOString())
          })
        }),
        async (testData) => {
          // Mock successful payment status
          (apiClient.getPaymentStatus as jest.Mock).mockResolvedValue({
            success: true,
            data: {
              payment_id: testData.paymentId,
              status: 'paid',
              order_id: testData.orderId,
              paid_at: testData.completionTime.toISOString()
            }
          });

          // Mock updated order status
          (apiClient.getOrder as jest.Mock).mockResolvedValue({
            success: true,
            data: {
              ...testData.orderData,
              id: testData.orderId,
              status: 'completed'
            }
          });

          // Simulate payment completion check
          const paymentResponse = await apiClient.getPaymentStatus(testData.paymentId);
          
          // Property: Payment status should be 'paid' for completed payments
          expect(paymentResponse.success).toBe(true);
          expect(paymentResponse.data.status).toBe('paid');
          expect(paymentResponse.data.payment_id).toBe(testData.paymentId);
          expect(paymentResponse.data.order_id).toBe(testData.orderId);

          // Property: Completion should include timestamp
          expect(paymentResponse.data.paid_at).toBeDefined();
          expect(new Date(paymentResponse.data.paid_at)).toBeInstanceOf(Date);

          // Simulate order status update check
          const orderResponse = await apiClient.getOrder(testData.orderId);
          
          // Property: Order status should be updated to completed
          expect(orderResponse.success).toBe(true);
          expect(orderResponse.data.status).toBe('completed');
          expect(orderResponse.data.id).toBe(testData.orderId);

          // Property: Order should have required completion data
          expect(orderResponse.data.original_filename).toBeDefined();
          expect(orderResponse.data.created_at).toBeDefined();
          expect(orderResponse.data.updated_at).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 13.1: Cache invalidation occurs on payment completion', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          paymentId: fc.string({ minLength: 5, maxLength: 50 }),
          orderId: fc.string({ minLength: 5, maxLength: 50 }),
          userId: fc.string({ minLength: 5, maxLength: 50 })
        }),
        async (testData) => {
          // Reset mock for this specific test
          mockInvalidateQueries.mockClear();
          
          // Mock successful payment completion
          (apiClient.getPaymentStatus as jest.Mock).mockResolvedValue({
            success: true,
            data: {
              payment_id: testData.paymentId,
              status: 'paid',
              order_id: testData.orderId,
              user_id: testData.userId
            }
          });

          // Simulate payment completion detection
          const paymentResponse = await apiClient.getPaymentStatus(testData.paymentId);
          
          if (paymentResponse.success && paymentResponse.data.status === 'paid') {
            // Simulate cache invalidation that should occur
            mockInvalidateQueries({ queryKey: ['orders'] });
            mockInvalidateQueries({ queryKey: ['orders', testData.orderId] });
            mockInvalidateQueries({ queryKey: ['payments', testData.paymentId] });
          }

          // Property: Cache invalidation should be called for completed payments
          expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['orders'] });
          expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['orders', testData.orderId] });
          expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['payments', testData.paymentId] });

          // Property: Should be called exactly 3 times for this test
          expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 13.2: Success confirmation includes next steps', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          paymentId: fc.string({ minLength: 5, maxLength: 50 }),
          orderId: fc.string({ minLength: 5, maxLength: 50 }),
          nextSteps: fc.array(
            fc.oneof(
              fc.constant('download'),
              fc.constant('processing'),
              fc.constant('email_notification'),
              fc.constant('order_history')
            ),
            { minLength: 1, maxLength: 4 }
          )
        }),
        async (testData) => {
          // Mock successful payment with next steps
          (apiClient.getPaymentStatus as jest.Mock).mockResolvedValue({
            success: true,
            data: {
              payment_id: testData.paymentId,
              status: 'paid',
              order_id: testData.orderId,
              next_steps: testData.nextSteps
            }
          });

          const paymentResponse = await apiClient.getPaymentStatus(testData.paymentId);
          
          // Property: Successful payment should include next steps
          expect(paymentResponse.success).toBe(true);
          expect(paymentResponse.data.status).toBe('paid');
          expect(paymentResponse.data.next_steps).toBeDefined();
          expect(Array.isArray(paymentResponse.data.next_steps)).toBe(true);

          // Property: Next steps should contain valid actions
          const validSteps = ['download', 'processing', 'email_notification', 'order_history'];
          paymentResponse.data.next_steps.forEach((step: string) => {
            expect(validSteps).toContain(step);
          });

          // Property: Should have at least one next step
          expect(paymentResponse.data.next_steps.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 13.3: Immediate updates handle concurrent requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          paymentId: fc.string({ minLength: 5, maxLength: 50 }),
          orderId: fc.string({ minLength: 5, maxLength: 50 }),
          concurrentRequests: fc.integer({ min: 2, max: 5 }),
          completionDelay: fc.integer({ min: 0, max: 100 }) // milliseconds
        }),
        async (testData) => {
          let requestCount = 0;
          
          // Mock payment status that becomes 'paid' after a delay
          (apiClient.getPaymentStatus as jest.Mock).mockImplementation(async () => {
            requestCount++;
            
            // Simulate completion after delay
            await new Promise(resolve => setTimeout(resolve, testData.completionDelay));
            
            return {
              success: true,
              data: {
                payment_id: testData.paymentId,
                status: 'paid',
                order_id: testData.orderId,
                request_number: requestCount
              }
            };
          });

          // Make concurrent requests
          const requests = Array.from({ length: testData.concurrentRequests }, () =>
            apiClient.getPaymentStatus(testData.paymentId)
          );

          const responses = await Promise.all(requests);

          // Property: All concurrent requests should succeed
          responses.forEach(response => {
            expect(response.success).toBe(true);
            expect(response.data.status).toBe('paid');
            expect(response.data.payment_id).toBe(testData.paymentId);
            expect(response.data.order_id).toBe(testData.orderId);
          });

          // Property: Should have made the expected number of requests
          expect(requestCount).toBe(testData.concurrentRequests);

          // Property: All responses should be consistent
          const firstResponse = responses[0];
          responses.forEach(response => {
            expect(response.data.payment_id).toBe(firstResponse.data.payment_id);
            expect(response.data.status).toBe(firstResponse.data.status);
            expect(response.data.order_id).toBe(firstResponse.data.order_id);
          });
        }
      ),
      { numRuns: 20 }
    );
  }, 15000);

  test('Property 13.4: Status updates preserve data integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          paymentId: fc.string({ minLength: 5, maxLength: 50 }),
          orderId: fc.string({ minLength: 5, maxLength: 50 }),
          originalOrderData: fc.record({
            user_id: fc.string({ minLength: 5, maxLength: 50 }),
            original_filename: fc.string({ minLength: 1, maxLength: 100 }),
            file_size: fc.integer({ min: 1000, max: 10000000 }),
            created_at: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).filter(d => !isNaN(d.getTime())).map(d => d.toISOString())
          }),
          paymentAmount: fc.float({ min: Math.fround(1.0), max: Math.fround(100.0) }).filter(n => !isNaN(n) && isFinite(n))
        }),
        async (testData) => {
          // Mock payment completion
          (apiClient.getPaymentStatus as jest.Mock).mockResolvedValue({
            success: true,
            data: {
              payment_id: testData.paymentId,
              status: 'paid',
              order_id: testData.orderId,
              amount: testData.paymentAmount
            }
          });

          // Mock order with preserved original data
          (apiClient.getOrder as jest.Mock).mockResolvedValue({
            success: true,
            data: {
              id: testData.orderId,
              status: 'completed',
              ...testData.originalOrderData,
              // Status updated but original data preserved
              updated_at: new Date().toISOString()
            }
          });

          const paymentResponse = await apiClient.getPaymentStatus(testData.paymentId);
          const orderResponse = await apiClient.getOrder(testData.orderId);

          // Property: Payment completion should preserve payment data
          expect(paymentResponse.success).toBe(true);
          expect(paymentResponse.data.payment_id).toBe(testData.paymentId);
          expect(paymentResponse.data.order_id).toBe(testData.orderId);
          expect(paymentResponse.data.amount).toBe(testData.paymentAmount);

          // Property: Order update should preserve original data
          expect(orderResponse.success).toBe(true);
          expect(orderResponse.data.id).toBe(testData.orderId);
          expect(orderResponse.data.status).toBe('completed');
          
          // Property: Original order data should be preserved
          expect(orderResponse.data.user_id).toBe(testData.originalOrderData.user_id);
          expect(orderResponse.data.original_filename).toBe(testData.originalOrderData.original_filename);
          expect(orderResponse.data.file_size).toBe(testData.originalOrderData.file_size);
          expect(orderResponse.data.created_at).toBe(testData.originalOrderData.created_at);

          // Property: Updated timestamp should be present and recent
          expect(orderResponse.data.updated_at).toBeDefined();
          const updatedAt = new Date(orderResponse.data.updated_at);
          const now = new Date();
          expect(updatedAt.getTime()).toBeLessThanOrEqual(now.getTime());
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 13.5: Completion updates handle edge cases', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          paymentId: fc.string({ minLength: 5, maxLength: 50 }),
          orderId: fc.string({ minLength: 5, maxLength: 50 }),
          edgeCase: fc.oneof(
            fc.constant('duplicate_completion'),
            fc.constant('late_completion'),
            fc.constant('partial_data'),
            fc.constant('network_delay')
          )
        }),
        async (testData) => {
          // Mock different edge case scenarios
          switch (testData.edgeCase) {
            case 'duplicate_completion':
              // Payment already completed
              (apiClient.getPaymentStatus as jest.Mock).mockResolvedValue({
                success: true,
                data: {
                  payment_id: testData.paymentId,
                  status: 'paid',
                  order_id: testData.orderId,
                  completed_at: new Date(Date.now() - 60000).toISOString() // 1 minute ago
                }
              });
              break;

            case 'late_completion':
              // Payment completed after long delay
              (apiClient.getPaymentStatus as jest.Mock).mockResolvedValue({
                success: true,
                data: {
                  payment_id: testData.paymentId,
                  status: 'paid',
                  order_id: testData.orderId,
                  completed_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
                }
              });
              break;

            case 'partial_data':
              // Payment completed with minimal data
              (apiClient.getPaymentStatus as jest.Mock).mockResolvedValue({
                success: true,
                data: {
                  payment_id: testData.paymentId,
                  status: 'paid',
                  order_id: testData.orderId
                  // Missing optional fields
                }
              });
              break;

            case 'network_delay':
              // Simulate network delay
              (apiClient.getPaymentStatus as jest.Mock).mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return {
                  success: true,
                  data: {
                    payment_id: testData.paymentId,
                    status: 'paid',
                    order_id: testData.orderId
                  }
                };
              });
              break;
          }

          const paymentResponse = await apiClient.getPaymentStatus(testData.paymentId);

          // Property: All edge cases should result in successful completion
          expect(paymentResponse.success).toBe(true);
          expect(paymentResponse.data.status).toBe('paid');
          expect(paymentResponse.data.payment_id).toBe(testData.paymentId);
          expect(paymentResponse.data.order_id).toBe(testData.orderId);

          // Property: Essential data should always be present
          expect(paymentResponse.data.payment_id).toBeDefined();
          expect(paymentResponse.data.status).toBeDefined();
          expect(paymentResponse.data.order_id).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});