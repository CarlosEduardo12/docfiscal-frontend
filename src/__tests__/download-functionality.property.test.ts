/**
 * Property-based tests for download functionality
 * **Feature: api-endpoints-update, Property 35-38: Download functionality properties**
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
 */

import fc from 'fast-check';
import { apiClient } from '@/lib/api';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock window.URL methods
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: jest.fn(() => 'mock-blob-url'),
    revokeObjectURL: jest.fn(),
  },
});

// Mock DOM methods
Object.defineProperty(document, 'createElement', {
  value: jest.fn(() => ({
    href: '',
    download: '',
    click: jest.fn(),
    remove: jest.fn(),
  })),
});

Object.defineProperty(document.body, 'appendChild', {
  value: jest.fn(),
});

Object.defineProperty(document.body, 'removeChild', {
  value: jest.fn(),
});

describe('Download Functionality Properties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Property 35: Download link expiration handling', () => {
    it('should handle 410 "Download link expired" responses appropriately', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          fc.record({
            message: fc.string({ minLength: 1, maxLength: 100 }),
            error: fc.string({ minLength: 1, maxLength: 50 }),
            details: fc.record({
              retry_after: fc.integer({ min: 1, max: 3600 }),
              guidance: fc.string({ minLength: 1, maxLength: 200 }),
            }),
          }),
          async (orderId, errorResponse) => {
            // Mock 410 response
            mockFetch.mockResolvedValueOnce({
              status: 410,
              ok: false,
              json: jest.fn().mockResolvedValue(errorResponse),
            });

            try {
              await apiClient.downloadOrder(orderId);
              // Should not reach here
              expect(true).toBe(false);
            } catch (error: any) {
              // Property: 410 responses should throw errors with specific code
              expect(error.code).toBe('DOWNLOAD_LINK_EXPIRED');
              expect(error.message).toBe('Download link expired');
              expect(error.details).toEqual(errorResponse);
            }

            // Property: Should call correct endpoint
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining(`/api/orders/${orderId}/download`),
              expect.objectContaining({
                headers: expect.objectContaining({
                  Authorization: expect.stringMatching(/^Bearer /),
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 36: Download header processing', () => {
    it('should correctly handle Content-Disposition headers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          fc
            .string({ minLength: 1, maxLength: 100 })
            .filter((s) => s.trim().length > 0),
          fc.record({
            header: fc.constantFrom(
              'attachment; filename="document.csv"',
              'attachment; filename=document.csv',
              "attachment; filename='document.csv'",
              "attachment; filename*=UTF-8''document%20name.csv",
              'inline; filename="report.csv"'
            ),
            expectedFilename: fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => {
                const trimmed = s.trim();
                return (
                  trimmed.length > 0 &&
                  !trimmed.includes('"') &&
                  !trimmed.includes("'") &&
                  !trimmed.includes(';') &&
                  !trimmed.includes('\n') &&
                  !trimmed.includes('\r')
                );
              }),
          }),
          async (orderId, blobContent, { header, expectedFilename }) => {
            const mockBlob = new Blob([blobContent], { type: 'text/csv' });
            // Use the expected filename in the header
            const contentDisposition = header.replace(
              /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
              `filename="${expectedFilename}"`
            );

            // Mock successful response with Content-Disposition header
            mockFetch.mockResolvedValueOnce({
              status: 200,
              ok: true,
              headers: {
                get: jest.fn((headerName: string) => {
                  if (headerName === 'Content-Disposition') {
                    return contentDisposition;
                  }
                  return null;
                }),
              },
              blob: jest.fn().mockResolvedValue(mockBlob),
            });

            const result = await apiClient.downloadOrder(orderId);

            // Property: Should return blob and extracted filename
            expect(result.blob).toBe(mockBlob);

            // Property: Should extract filename from Content-Disposition header
            expect(result.filename).toBe(expectedFilename);

            // Property: Should call correct endpoint
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining(`/api/orders/${orderId}/download`),
              expect.objectContaining({
                headers: expect.objectContaining({
                  Authorization: expect.stringMatching(/^Bearer /),
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 37: Download error messaging', () => {
    it('should display appropriate error messages based on error codes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          fc.constantFrom(
            { status: 404, expectedCode: 'ORDER_NOT_FOUND' },
            { status: 410, expectedCode: 'DOWNLOAD_LINK_EXPIRED' },
            { status: 500, expectedCode: 'DOWNLOAD_FAILED' },
            { status: 403, expectedCode: 'DOWNLOAD_FAILED' }
          ),
          fc.record({
            message: fc.string({ minLength: 1, maxLength: 100 }),
            error: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async (orderId, errorConfig, errorResponse) => {
            // Mock error response
            mockFetch.mockResolvedValueOnce({
              status: errorConfig.status,
              ok: false,
              json: jest.fn().mockResolvedValue(errorResponse),
            });

            try {
              await apiClient.downloadOrder(orderId);
              // Should not reach here
              expect(true).toBe(false);
            } catch (error: any) {
              // Property: Error should have appropriate code based on status
              expect(error.code).toBe(errorConfig.expectedCode);

              // Property: Error should have status information
              if (errorConfig.status !== 410) {
                expect(error.status).toBe(errorConfig.status);
              }

              // Property: Error should have details from response
              expect(error.details).toEqual(errorResponse);

              // Property: Error message should be meaningful
              expect(error.message).toBeDefined();
              expect(typeof error.message).toBe('string');
              expect(error.message.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 38: Download retry options', () => {
    it('should provide appropriate retry options for expired download links', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          fc.record({
            message: fc.string({ minLength: 1, maxLength: 100 }),
            error: fc.string({ minLength: 1, maxLength: 50 }),
            details: fc.record({
              retry_after: fc.integer({ min: 1, max: 3600 }),
              guidance: fc.string({ minLength: 1, maxLength: 200 }),
            }),
          }),
          async (orderId, errorResponse) => {
            // Mock 410 response (expired link)
            mockFetch.mockResolvedValueOnce({
              status: 410,
              ok: false,
              json: jest.fn().mockResolvedValue(errorResponse),
            });

            try {
              await apiClient.downloadOrder(orderId);
              // Should not reach here
              expect(true).toBe(false);
            } catch (error: any) {
              // Property: Expired link errors should be identifiable for retry logic
              expect(error.code).toBe('DOWNLOAD_LINK_EXPIRED');
              expect(error.message).toBe('Download link expired');

              // Property: Error should contain details from response
              expect(error.details).toBeDefined();
              expect(error.details).toEqual(errorResponse);

              // Property: If retry information is provided, it should be accessible
              if (error.details.details && error.details.details.retry_after) {
                expect(typeof error.details.details.retry_after).toBe('number');
                expect(error.details.details.retry_after).toBeGreaterThan(0);
              }

              // Property: If guidance is provided, it should be accessible
              if (error.details.details && error.details.details.guidance) {
                expect(typeof error.details.details.guidance).toBe('string');
                expect(error.details.details.guidance.length).toBeGreaterThan(
                  0
                );
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle successful downloads after retry', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          fc
            .string({ minLength: 1, maxLength: 100 })
            .filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
            const trimmed = s.trim();
            return (
              trimmed.length > 0 &&
              !trimmed.includes('"') &&
              !trimmed.includes("'") &&
              !trimmed.includes(';') &&
              !trimmed.includes('\n') &&
              !trimmed.includes('\r')
            );
          }),
          async (orderId, blobContent, filename) => {
            const mockBlob = new Blob([blobContent], { type: 'text/csv' });
            const contentDisposition = `attachment; filename="${filename}"`;

            // Mock successful response
            mockFetch.mockResolvedValueOnce({
              status: 200,
              ok: true,
              headers: {
                get: jest.fn((headerName: string) => {
                  if (headerName === 'Content-Disposition') {
                    return contentDisposition;
                  }
                  return null;
                }),
              },
              blob: jest.fn().mockResolvedValue(mockBlob),
            });

            const result = await apiClient.downloadOrder(orderId);

            // Property: Successful download should return blob and filename
            expect(result.blob).toBe(mockBlob);
            expect(result.filename).toBe(filename);

            // Property: Should call correct endpoint
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining(`/api/orders/${orderId}/download`),
              expect.objectContaining({
                headers: expect.objectContaining({
                  Authorization: expect.stringMatching(/^Bearer /),
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Integration Properties', () => {
    it('should maintain consistent behavior across all download scenarios', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          fc.oneof(
            // Success scenario
            fc.record({
              type: fc.constant('success'),
              status: fc.constant(200),
              blobContent: fc.string({ minLength: 1, maxLength: 1000 }),
              filename: fc
                .string({ minLength: 1, maxLength: 50 })
                .filter((s) => {
                  const trimmed = s.trim();
                  return (
                    trimmed.length > 0 &&
                    !trimmed.includes('"') &&
                    !trimmed.includes("'") &&
                    !trimmed.includes(';') &&
                    !trimmed.includes('\n') &&
                    !trimmed.includes('\r')
                  );
                }),
            }),
            // Expired link scenario
            fc.record({
              type: fc.constant('expired'),
              status: fc.constant(410),
              errorResponse: fc.record({
                message: fc.string({ minLength: 1, maxLength: 100 }),
                error: fc.string({ minLength: 1, maxLength: 50 }),
              }),
            }),
            // Not found scenario
            fc.record({
              type: fc.constant('not_found'),
              status: fc.constant(404),
              errorResponse: fc.record({
                message: fc.string({ minLength: 1, maxLength: 100 }),
                error: fc.string({ minLength: 1, maxLength: 50 }),
              }),
            })
          ),
          async (orderId, scenario) => {
            if (scenario.type === 'success') {
              const mockBlob = new Blob([scenario.blobContent], {
                type: 'text/csv',
              });
              const contentDisposition = `attachment; filename="${scenario.filename}"`;

              mockFetch.mockResolvedValueOnce({
                status: scenario.status,
                ok: true,
                headers: {
                  get: jest.fn((headerName: string) => {
                    if (headerName === 'Content-Disposition') {
                      return contentDisposition;
                    }
                    return null;
                  }),
                },
                blob: jest.fn().mockResolvedValue(mockBlob),
              });

              const result = await apiClient.downloadOrder(orderId);

              // Property: Success should always return blob and filename
              expect(result.blob).toBe(mockBlob);
              expect(result.filename).toBe(scenario.filename);
            } else {
              mockFetch.mockResolvedValueOnce({
                status: scenario.status,
                ok: false,
                json: jest.fn().mockResolvedValue(scenario.errorResponse),
              });

              try {
                await apiClient.downloadOrder(orderId);
                expect(true).toBe(false); // Should not reach here
              } catch (error: any) {
                // Property: All errors should have consistent structure
                expect(error.code).toBeDefined();
                expect(error.message).toBeDefined();
                expect(error.details).toEqual(scenario.errorResponse);

                // Property: Specific error codes for specific statuses
                if (scenario.status === 410) {
                  expect(error.code).toBe('DOWNLOAD_LINK_EXPIRED');
                } else if (scenario.status === 404) {
                  expect(error.code).toBe('ORDER_NOT_FOUND');
                }
              }
            }

            // Property: Should always call correct endpoint regardless of outcome
            expect(mockFetch).toHaveBeenCalledWith(
              expect.stringContaining(`/api/orders/${orderId}/download`),
              expect.objectContaining({
                headers: expect.objectContaining({
                  Authorization: expect.stringMatching(/^Bearer /),
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
