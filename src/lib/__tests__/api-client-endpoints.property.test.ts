/**
 * Property-based tests for API client endpoint consistency
 * Feature: api-endpoints-update
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import fc from 'fast-check';
import { apiClient } from '@/lib/api';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('API Client Endpoint Properties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any stored tokens
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Authentication Endpoints', () => {
    it('Property 1: Registration endpoint consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 1: Registration endpoint consistency
       * Validates: Requirements 1.1
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.string({ minLength: 2, maxLength: 100 }),
            email: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 50 }),
          }),
          async (userData) => {
            // Mock successful response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: { user: userData },
                message: 'Registration successful',
              }),
            });

            await apiClient.register(userData);

            // Verify correct endpoint and method
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining('/api/auth/register'),
              expect.objectContaining({
                method: 'POST',
                body: JSON.stringify(userData),
                headers: expect.objectContaining({
                  'Content-Type': 'application/json',
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2: Login endpoint and response handling', async () => {
      /**
       * Feature: api-endpoints-update, Property 2: Login endpoint and response handling
       * Validates: Requirements 1.2
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 50 }),
          }),
          async (credentials) => {
            // Mock successful login response with new format
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  access_token: 'mock-access-token',
                  refresh_token: 'mock-refresh-token',
                  user: {
                    id: '1',
                    email: credentials.email,
                    name: 'Test User',
                  },
                },
                message: 'Login successful',
              }),
            });

            const response = await apiClient.login(credentials);

            // Verify correct endpoint and method
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining('/api/auth/login'),
              expect.objectContaining({
                method: 'POST',
                body: JSON.stringify(credentials),
                headers: expect.objectContaining({
                  'Content-Type': 'application/json',
                }),
              })
            );

            // Verify response format handling
            expect(response.success).toBe(true);
            expect(response.data).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 3: Token refresh endpoint consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 3: Token refresh endpoint consistency
       * Validates: Requirements 1.3
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }),
          async (refreshToken) => {
            // Set up refresh token
            (apiClient as any).refreshToken = refreshToken;

            // Mock successful refresh response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  access_token: 'new-access-token',
                  refresh_token: refreshToken,
                },
                message: 'Token refreshed',
              }),
            });

            await apiClient.refreshAccessToken();

            // Verify correct endpoint and payload
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining('/api/auth/refresh'),
              expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ refresh_token: refreshToken }),
                headers: expect.objectContaining({
                  'Content-Type': 'application/json',
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 4: Profile endpoint consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 4: Profile endpoint consistency
       * Validates: Requirements 1.4
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }),
          async (accessToken) => {
            // Set up access token
            (apiClient as any).accessToken = accessToken;

            // Mock successful profile response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  id: '1',
                  email: 'test@example.com',
                  name: 'Test User',
                  created_at: '2023-01-01T00:00:00Z',
                  updated_at: '2023-01-01T00:00:00Z',
                },
                message: 'Profile retrieved',
              }),
            });

            await apiClient.getProfile();

            // Verify correct endpoint
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining('/api/auth/me'),
              expect.objectContaining({
                headers: expect.objectContaining({
                  Authorization: `Bearer ${accessToken}`,
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 5: Logout endpoint consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 5: Logout endpoint consistency
       * Validates: Requirements 1.5
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }),
          async (accessToken) => {
            // Set up access token
            (apiClient as any).accessToken = accessToken;

            // Mock successful logout response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                message: 'Logout successful',
              }),
            });

            await apiClient.logout();

            // Verify correct endpoint and method
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining('/api/auth/logout'),
              expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                  Authorization: `Bearer ${accessToken}`,
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('File Upload Endpoints', () => {
    it('Property 6: Upload endpoint format consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 6: Upload endpoint format consistency
       * Validates: Requirements 2.1
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.string({ minLength: 1, maxLength: 100 }),
            size: fc.integer({ min: 1, max: 10000000 }),
          }),
          async (fileData) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Create a mock file
            const file = new File(['test content'], fileData.filename, {
              type: 'application/pdf',
            });

            // Mock successful upload response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  upload_id: 'upload-123',
                  order_id: 'order-456',
                },
                message: 'Upload successful',
              }),
            });

            await apiClient.uploadFile(file);

            // Verify correct endpoint with trailing slash
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining('/api/upload/'),
              expect.objectContaining({
                method: 'POST',
                body: expect.any(FormData),
                headers: expect.objectContaining({
                  Authorization: 'Bearer test-token',
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 7: Upload progress endpoint consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 7: Upload progress endpoint consistency
       * Validates: Requirements 2.2
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (uploadId) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock successful progress response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  upload_id: uploadId,
                  progress: 50,
                  status: 'uploading',
                },
                message: 'Progress retrieved',
              }),
            });

            await apiClient.getUploadProgress(uploadId);

            // Verify correct endpoint format
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining(`/api/upload/${uploadId}/progress`),
              expect.objectContaining({
                headers: expect.objectContaining({
                  Authorization: 'Bearer test-token',
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8: Upload cancellation method consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 8: Upload cancellation method consistency
       * Validates: Requirements 2.3
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (uploadId) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock successful cancellation response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                message: 'Upload cancelled',
              }),
            });

            await apiClient.cancelUpload(uploadId);

            // Verify correct endpoint and DELETE method
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining(`/api/upload/${uploadId}`),
              expect.objectContaining({
                method: 'DELETE',
                headers: expect.objectContaining({
                  Authorization: 'Bearer test-token',
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 9: Upload response processing', async () => {
      /**
       * Feature: api-endpoints-update, Property 9: Upload response processing
       * Validates: Requirements 2.4
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            upload_id: fc.string({ minLength: 1, maxLength: 50 }),
            order_id: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async (responseData) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Create a mock file
            const file = new File(['test content'], 'test.pdf', {
              type: 'application/pdf',
            });

            // Mock successful upload response with standardized format
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: responseData,
                message: 'Upload successful',
              }),
            });

            const response = await apiClient.uploadFile(file);

            // Verify response format processing
            expect(response.success).toBe(true);
            expect(response.data).toEqual(responseData);
            expect(response.data.upload_id).toBe(responseData.upload_id);
            expect(response.data.order_id).toBe(responseData.order_id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Order Management Endpoints', () => {
    it('Property 10: Order listing parameter consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 10: Order listing parameter consistency
       * Validates: Requirements 3.1
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            page: fc.option(fc.integer({ min: 1, max: 100 })),
            limit: fc.option(fc.integer({ min: 1, max: 100 })),
            sort: fc.option(
              fc.constantFrom('created_at', 'filename', 'status')
            ),
            order: fc.option(fc.constantFrom('asc', 'desc')),
            status: fc.option(
              fc.constantFrom(
                'pending_payment',
                'processing',
                'completed',
                'failed'
              )
            ),
          }),
          async (params) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock successful orders response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  orders: [],
                  total: 0,
                  page: params.page || 1,
                  limit: params.limit || 10,
                },
                message: 'Orders retrieved',
              }),
            });

            await apiClient.getOrders(params);

            // Build expected query string
            const expectedParams = new URLSearchParams();
            if (params.page) expectedParams.set('page', params.page.toString());
            if (params.limit)
              expectedParams.set('limit', params.limit.toString());
            if (params.sort) expectedParams.set('sort', params.sort);
            if (params.order) expectedParams.set('order', params.order);
            if (params.status) expectedParams.set('status', params.status);

            const expectedQuery = expectedParams.toString();
            const expectedUrl = expectedQuery
              ? `/api/orders?${expectedQuery}`
              : '/api/orders';

            // Verify correct endpoint and parameters
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining(expectedUrl),
              expect.objectContaining({
                headers: expect.objectContaining({
                  Authorization: 'Bearer test-token',
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 11: Order detail endpoint consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 11: Order detail endpoint consistency
       * Validates: Requirements 3.2
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (orderId) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock successful order response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  id: orderId,
                  user_id: 'user-123',
                  filename: 'test.pdf',
                  file_size: 1024,
                  status: 'completed',
                  created_at: '2023-01-01T00:00:00Z',
                  updated_at: '2023-01-01T00:00:00Z',
                },
                message: 'Order retrieved',
              }),
            });

            await apiClient.getOrder(orderId);

            // Verify correct endpoint
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining(`/api/orders/${orderId}`),
              expect.objectContaining({
                headers: expect.objectContaining({
                  Authorization: 'Bearer test-token',
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 12: Order retry method consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 12: Order retry method consistency
       * Validates: Requirements 3.3
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (orderId) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock successful retry response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  id: orderId,
                  status: 'processing',
                },
                message: 'Order retry initiated',
              }),
            });

            await apiClient.retryOrder(orderId);

            // Verify correct endpoint and POST method
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining(`/api/orders/${orderId}/retry`),
              expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                  Authorization: 'Bearer test-token',
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 13: Order download endpoint consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 13: Order download endpoint consistency
       * Validates: Requirements 3.4
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (orderId) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock successful download response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              headers: {
                get: (name: string) => {
                  if (name === 'Content-Disposition') {
                    return `attachment; filename="test-${orderId}.pdf"`;
                  }
                  return null;
                },
              },
              blob: async () =>
                new Blob(['test content'], { type: 'application/pdf' }),
            });

            await apiClient.downloadOrder(orderId);

            // Verify correct endpoint
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining(`/api/orders/${orderId}/download`),
              expect.objectContaining({
                headers: expect.objectContaining({
                  Authorization: 'Bearer test-token',
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 14: Order response processing', async () => {
      /**
       * Feature: api-endpoints-update, Property 14: Order response processing
       * Validates: Requirements 3.5
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orders: fc.array(
              fc.record({
                id: fc.string({ minLength: 1, maxLength: 50 }),
                user_id: fc.string({ minLength: 1, maxLength: 50 }),
                filename: fc.string({ minLength: 1, maxLength: 100 }),
                file_size: fc.integer({ min: 1, max: 10000000 }),
                status: fc.constantFrom(
                  'pending_payment',
                  'processing',
                  'completed',
                  'failed'
                ),
                created_at: fc.constantFrom(
                  '2023-01-01T00:00:00.000Z',
                  '2023-06-15T12:30:00.000Z',
                  '2024-01-01T00:00:00.000Z'
                ),
                updated_at: fc.constantFrom(
                  '2023-01-01T00:00:00.000Z',
                  '2023-06-15T12:30:00.000Z',
                  '2024-01-01T00:00:00.000Z'
                ),
              }),
              { maxLength: 10 }
            ),
            total: fc.integer({ min: 0, max: 1000 }),
            page: fc.integer({ min: 1, max: 100 }),
            limit: fc.integer({ min: 1, max: 100 }),
          }),
          async (paginationData) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock successful orders response with standardized pagination
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: paginationData,
                message: 'Orders retrieved',
              }),
            });

            const response = await apiClient.getOrders();

            // Verify response format processing
            expect(response.success).toBe(true);
            expect(response.data).toEqual(paginationData);
            expect(response.data.orders).toEqual(paginationData.orders);
            expect(response.data.total).toBe(paginationData.total);
            expect(response.data.page).toBe(paginationData.page);
            expect(response.data.limit).toBe(paginationData.limit);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  describe('Payment Endpoints', () => {
    it('Property 15: Payment initiation endpoint consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 15: Payment initiation endpoint consistency
       * Validates: Requirements 4.1
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (orderId) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock successful payment initiation response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  payment_id: 'payment-123',
                  order_id: orderId,
                  checkout_url: 'https://checkout.example.com/123',
                  qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
                },
                message: 'Payment initiated',
              }),
            });

            await apiClient.initiatePayment(orderId);

            // Verify correct endpoint
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining(
                `/api/payments/orders/${orderId}/payment`
              ),
              expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                  Authorization: 'Bearer test-token',
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 16: Payment status endpoint consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 16: Payment status endpoint consistency
       * Validates: Requirements 4.2
       */
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (paymentId) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock successful payment status response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  payment_id: paymentId,
                  status: 'pending',
                  order_id: 'order-123',
                },
                message: 'Payment status retrieved',
              }),
            });

            await apiClient.getPaymentStatus(paymentId);

            // Verify correct endpoint (without /status suffix)
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining(`/api/payments/${paymentId}`),
              expect.objectContaining({
                headers: expect.objectContaining({
                  Authorization: 'Bearer test-token',
                }),
              })
            );

            // Verify /status suffix is NOT used
            const actualUrl = mockFetch.mock.calls[0][0];
            expect(actualUrl).not.toContain('/status');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 17: Payment response processing', async () => {
      /**
       * Feature: api-endpoints-update, Property 17: Payment response processing
       * Validates: Requirements 4.3
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            payment_id: fc.string({ minLength: 1, maxLength: 50 }),
            order_id: fc.string({ minLength: 1, maxLength: 50 }),
            checkout_url: fc.webUrl(),
            qr_code: fc.option(fc.string({ minLength: 10, maxLength: 100 })),
          }),
          async (paymentData) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock successful payment response with standardized format
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: paymentData,
                message: 'Payment initiated',
              }),
            });

            const response = await apiClient.initiatePayment(
              paymentData.order_id
            );

            // Verify response format processing
            expect(response.success).toBe(true);
            expect(response.data).toEqual(paymentData);
            expect(response.data.checkout_url).toBe(paymentData.checkout_url);
            if (paymentData.qr_code) {
              expect(response.data.qr_code).toBe(paymentData.qr_code);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 18: Payment method support', async () => {
      /**
       * Feature: api-endpoints-update, Property 18: Payment method support
       * Validates: Requirements 4.4
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.string({ minLength: 1, maxLength: 50 }),
            paymentMethod: fc.constantFrom('pix', 'credit_card'),
          }),
          async ({ orderId, paymentMethod }) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock successful payment response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  payment_id: 'payment-123',
                  order_id: orderId,
                  payment_method: paymentMethod,
                  checkout_url: 'https://checkout.example.com/123',
                },
                message: 'Payment initiated',
              }),
            });

            const response = await apiClient.initiatePayment(orderId);

            // Verify payment method is processed correctly
            expect(response.success).toBe(true);
            expect(response.data.payment_method).toBe(paymentMethod);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('User Management Endpoints', () => {
    it('Property 20: Profile update endpoint consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 20: Profile update endpoint consistency
       * Validates: Requirements 5.1
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.option(fc.string({ minLength: 2, maxLength: 100 })),
            email: fc.option(fc.emailAddress()),
          }),
          async (updateData) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock successful profile update response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  id: 'user-123',
                  name: updateData.name || 'Test User',
                  email: updateData.email || 'test@example.com',
                  created_at: '2023-01-01T00:00:00Z',
                  updated_at: '2023-01-01T00:00:00Z',
                },
                message: 'Profile updated',
              }),
            });

            await apiClient.updateProfile(updateData);

            // Verify correct endpoint (uses /me instead of userId)
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining('/api/users/me'),
              expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify(updateData),
                headers: expect.objectContaining({
                  Authorization: 'Bearer test-token',
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 21: Password change endpoint consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 21: Password change endpoint consistency
       * Validates: Requirements 5.2
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            current_password: fc.string({ minLength: 8, maxLength: 50 }),
            new_password: fc.string({ minLength: 8, maxLength: 50 }),
          }),
          async (passwordData) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock successful password change response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                message: 'Password changed successfully',
              }),
            });

            await apiClient.changePassword(passwordData);

            // Verify correct endpoint
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining('/api/users/me/password'),
              expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify(passwordData),
                headers: expect.objectContaining({
                  Authorization: 'Bearer test-token',
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 22: Profile response processing', async () => {
      /**
       * Feature: api-endpoints-update, Property 22: Profile response processing
       * Validates: Requirements 5.3
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            name: fc.string({ minLength: 2, maxLength: 100 }),
            email: fc.emailAddress(),
            created_at: fc.constantFrom(
              '2023-01-01T00:00:00.000Z',
              '2023-06-15T12:30:00.000Z',
              '2024-01-01T00:00:00.000Z'
            ),
            updated_at: fc.constantFrom(
              '2023-01-01T00:00:00.000Z',
              '2023-06-15T12:30:00.000Z',
              '2024-01-01T00:00:00.000Z'
            ),
          }),
          async (userData) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock successful profile response with standardized format
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: userData,
                message: 'Profile updated',
              }),
            });

            const response = await apiClient.updateProfile({
              name: userData.name,
            });

            // Verify response format processing
            expect(response.success).toBe(true);
            expect(response.data).toEqual(userData);
            expect(response.data.created_at).toBe(userData.created_at);
            expect(response.data.updated_at).toBe(userData.updated_at);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 23: Password change validation', async () => {
      /**
       * Feature: api-endpoints-update, Property 23: Password change validation
       * Validates: Requirements 5.4
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            current_password: fc.string({ minLength: 8, maxLength: 50 }),
            new_password: fc.string({ minLength: 8, maxLength: 50 }),
          }),
          async (passwordData) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock successful password change response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                message: 'Password changed successfully',
              }),
            });

            await apiClient.changePassword(passwordData);

            // Verify both current_password and new_password are required
            const callArgs =
              mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
            const requestBody = JSON.parse(callArgs[1].body);
            expect(requestBody).toHaveProperty(
              'current_password',
              passwordData.current_password
            );
            expect(requestBody).toHaveProperty(
              'new_password',
              passwordData.new_password
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Response Format Handling', () => {
    it('Property 24: Standard response format handling', async () => {
      /**
       * Feature: api-endpoints-update, Property 24: Standard response format handling
       * Validates: Requirements 6.1
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            success: fc.boolean(),
            data: fc.option(fc.object()),
            message: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          async (responseFormat) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock response with standardized format
            mockFetch.mockResolvedValueOnce({
              ok: responseFormat.success,
              status: responseFormat.success ? 200 : 400,
              json: async () => responseFormat,
            });

            try {
              const response = await apiClient.getProfile();

              // Verify response format handling
              expect(response.success).toBe(responseFormat.success);
              expect(response.message).toBe(responseFormat.message);
              if (responseFormat.data) {
                expect(response.data).toEqual(responseFormat.data);
              }
            } catch (error) {
              // For failed responses, verify error handling
              if (!responseFormat.success) {
                expect(error.message).toBe(responseFormat.message);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 25: Error format processing', async () => {
      /**
       * Feature: api-endpoints-update, Property 25: Error format processing
       * Validates: Requirements 6.2
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            success: fc.constant(false),
            error: fc.string({ minLength: 1, maxLength: 50 }),
            message: fc.string({ minLength: 1, maxLength: 200 }),
            details: fc.option(
              fc.record({
                field_errors: fc.option(
                  fc.dictionary(fc.string(), fc.array(fc.string()))
                ),
                retry_after: fc.option(fc.integer({ min: 1, max: 3600 })),
                guidance: fc.option(
                  fc.string({ minLength: 1, maxLength: 200 })
                ),
              })
            ),
          }),
          async (errorFormat) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock error response with standardized format
            mockFetch.mockResolvedValueOnce({
              ok: false,
              status: 400,
              json: async () => errorFormat,
            });

            try {
              await apiClient.getProfile();
              // Should not reach here for error responses
              expect(true).toBe(false);
            } catch (error) {
              // Verify error format processing
              expect(error.message).toBe(errorFormat.message);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 26: Error message display', async () => {
      /**
       * Feature: api-endpoints-update, Property 26: Error message display
       * Validates: Requirements 6.3
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            success: fc.constant(false),
            error: fc.string({ minLength: 1, maxLength: 50 }),
            message: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          async (errorResponse) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock error response
            mockFetch.mockResolvedValueOnce({
              ok: false,
              status: 400,
              json: async () => errorResponse,
            });

            try {
              await apiClient.getProfile();
              expect(true).toBe(false); // Should not reach here
            } catch (error) {
              // Verify error message is properly extracted and displayed
              expect(error.message).toBe(errorResponse.message);
              expect(error.message).toBeTruthy();
              expect(typeof error.message).toBe('string');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 27: Validation error display', async () => {
      /**
       * Feature: api-endpoints-update, Property 27: Validation error display
       * Validates: Requirements 6.4
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            success: fc.constant(false),
            error: fc.constant('validation_error'),
            message: fc.string({ minLength: 1, maxLength: 200 }),
            details: fc.record({
              field_errors: fc.dictionary(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
                  minLength: 1,
                  maxLength: 3,
                }),
                { minKeys: 1, maxKeys: 5 } // Ensure at least one field error
              ),
            }),
          }),
          async (validationError) => {
            // Set up access token
            (apiClient as any).accessToken = 'test-token';

            // Mock validation error response
            mockFetch.mockResolvedValueOnce({
              ok: false,
              status: 422,
              json: async () => validationError,
            });

            try {
              await apiClient.updateProfile({ name: 'test' });
              expect(true).toBe(false); // Should not reach here
            } catch (error) {
              // Verify validation error processing
              expect(error.message).toBe(validationError.message);

              // Verify field errors are accessible
              if (validationError.details?.field_errors) {
                const fieldNames = Object.keys(
                  validationError.details.field_errors
                );
                expect(fieldNames.length).toBeGreaterThan(0);

                fieldNames.forEach((fieldName) => {
                  const fieldErrors =
                    validationError.details.field_errors[fieldName];
                  expect(Array.isArray(fieldErrors)).toBe(true);
                  expect(fieldErrors.length).toBeGreaterThan(0);
                });
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Health Check Endpoint', () => {
    it('Property 28: Health check endpoint consistency', async () => {
      /**
       * Feature: api-endpoints-update, Property 28: Health check endpoint consistency
       * Validates: Requirements 7.1
       */
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          // Mock successful health check response
          mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                status: 'healthy',
                services: {
                  database: 'healthy',
                  storage: 'healthy',
                  payment_provider: 'healthy',
                },
              },
              message: 'System is healthy',
            }),
          });

          await apiClient.healthCheck();

          // Verify correct endpoint without authentication
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/health'),
            expect.objectContaining({
              headers: expect.not.objectContaining({
                Authorization: expect.any(String),
              }),
            })
          );
        }),
        { numRuns: 100 }
      );
    });

    it('Property 29: Health response processing', async () => {
      /**
       * Feature: api-endpoints-update, Property 29: Health response processing
       * Validates: Requirements 7.2
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            status: fc.constantFrom('healthy', 'degraded', 'unhealthy'),
            services: fc.record({
              database: fc.constantFrom('healthy', 'degraded', 'unhealthy'),
              storage: fc.constantFrom('healthy', 'degraded', 'unhealthy'),
              payment_provider: fc.constantFrom(
                'healthy',
                'degraded',
                'unhealthy'
              ),
            }),
          }),
          async (healthData) => {
            // Mock health check response with detailed status
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: healthData,
                message: 'Health status retrieved',
              }),
            });

            const response = await apiClient.healthCheck();

            // Verify response format processing
            expect(response.success).toBe(true);
            expect(response.data).toEqual(healthData);
            expect(response.data.services.database).toBe(
              healthData.services.database
            );
            expect(response.data.services.storage).toBe(
              healthData.services.storage
            );
            expect(response.data.services.payment_provider).toBe(
              healthData.services.payment_provider
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 30: Health information display', async () => {
      /**
       * Feature: api-endpoints-update, Property 30: Health information display
       * Validates: Requirements 7.3
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            status: fc.constantFrom('healthy', 'degraded', 'unhealthy'),
            services: fc.record({
              database: fc.constantFrom('healthy', 'degraded', 'unhealthy'),
              storage: fc.constantFrom('healthy', 'degraded', 'unhealthy'),
              payment_provider: fc.constantFrom(
                'healthy',
                'degraded',
                'unhealthy'
              ),
            }),
          }),
          async (healthData) => {
            // Mock health check response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: healthData,
                message: 'Health status retrieved',
              }),
            });

            const response = await apiClient.healthCheck();

            // Verify health information is properly structured for display
            expect(response.data.status).toBeDefined();
            expect(['healthy', 'degraded', 'unhealthy']).toContain(
              response.data.status
            );

            // Verify all required services are present
            expect(response.data.services).toBeDefined();
            expect(response.data.services.database).toBeDefined();
            expect(response.data.services.storage).toBeDefined();
            expect(response.data.services.payment_provider).toBeDefined();

            // Verify service statuses are valid
            Object.values(response.data.services).forEach((serviceStatus) => {
              expect(['healthy', 'degraded', 'unhealthy']).toContain(
                serviceStatus
              );
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
