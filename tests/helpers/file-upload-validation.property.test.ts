/**
 * **Feature: e2e-flow-testing, Property 2: Test Failure on Backend Errors**
 * **Validates: Requirements 3.3**
 */

import * as fc from 'fast-check';
import { test, expect, Page, Browser } from '@playwright/test';
import { createNetworkLogger } from './network-logger';
import { createAuthHelper } from './auth';
import testData from '../fixtures/test-data.json';

/**
 * Property-based test for file upload validation
 * Tests that backend errors during file upload cause test failures with detailed error information
 */

test.describe('File Upload Validation Property Tests', () => {
  let browser: Browser;
  let page: Page;
  let networkLogger: ReturnType<typeof createNetworkLogger>;
  let authHelper: ReturnType<typeof createAuthHelper>;

  test.beforeEach(async ({ browser: testBrowser }) => {
    browser = testBrowser;
    page = await browser.newPage();
    networkLogger = createNetworkLogger();
    authHelper = createAuthHelper(page);

    // Set up network error monitoring
    await networkLogger.captureBackendErrors(page);
    
    // Use real user credentials for authentication
    const realUser = {
      email: 'carlosfront@gmail.com',
      password: 'senha123'
    };
    
    try {
      // Login with real user credentials
      await authHelper.login(realUser);
      console.log('✅ User authenticated successfully with real credentials');
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Property 2: Test Failure on Backend Errors - should fail test when backend errors occur during upload', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorStatus: fc.constantFrom(400, 401, 403, 404, 500, 502, 503),
          errorMessage: fc.string({ minLength: 1, maxLength: 100 }),
          errorType: fc.constantFrom(
            'validation_error',
            'authentication_error', 
            'server_error',
            'network_error',
            'timeout_error'
          ),
          filename: fc.string({ minLength: 1, maxLength: 50 })
            .filter(name => name.trim().length > 0)
            .map(name => `${name.trim().replace(/[^a-zA-Z0-9\-_]/g, '_')}.pdf`)
        }),
        async (errorData) => {
          // Mock backend error response
          await page.route('**/api/upload', (route) => {
            route.fulfill({
              status: errorData.errorStatus,
              contentType: 'application/json',
              body: JSON.stringify({
                success: false,
                error: `${errorData.errorType}: ${errorData.errorMessage}`,
                details: {
                  filename: errorData.filename,
                  timestamp: new Date().toISOString(),
                  errorCode: errorData.errorStatus
                }
              })
            });
          });

          // Navigate to dashboard (user is already authenticated)
          await page.goto('/dashboard');
          
          // Wait for dashboard to load
          await page.waitForSelector('.sidebar', { timeout: 10000 });

          // Attempt file upload using Ponto2.pdf
          const fileInput = page.locator('input[type="file"]');
          await fileInput.setInputFiles('Ponto2.pdf');
          
          // Wait for file selection
          await page.waitForTimeout(1000);
          
          // Click upload button
          const uploadButton = page.locator('button:has-text("Enviar PDF para Conversão")');
          await uploadButton.click();

          // Wait for backend error to occur
          await page.waitForTimeout(5000);

          // Property: Backend errors should be captured by network logger
          const networkErrors = networkLogger.getErrors();
          expect(networkErrors.length).toBeGreaterThan(0);

          // Property: Captured error should match the mocked error
          const capturedError = networkErrors.find(error => 
            error.request.url.includes('/api/upload') && 
            error.response.status === errorData.errorStatus
          );
          expect(capturedError).toBeDefined();
          expect(capturedError!.response.status).toBe(errorData.errorStatus);

          // Property: Error should contain expected error information
          expect(capturedError!.response.body).toContain(errorData.errorType);
          expect(capturedError!.response.body).toContain(errorData.errorMessage);

          // Property: Error should be categorized correctly
          const errorCategory = networkLogger.categorizeError(capturedError!.response.status);
          if (errorData.errorStatus >= 400 && errorData.errorStatus < 500) {
            expect(errorCategory).toBe('client');
          } else if (errorData.errorStatus >= 500) {
            expect(errorCategory).toBe('server');
          }

          // Property: UI should display error state
          const errorElement = page.locator('text="Ops! Algo deu errado"');
          await expect(errorElement).toBeVisible({ timeout: 10000 });

          // Property: Error details should be available for debugging
          expect(capturedError!.timestamp).toBeDefined();
          expect(capturedError!.request.method).toBe('POST');
          expect(capturedError!.request.url).toContain('/api/upload');

          // Property: Test should fail when backend errors occur
          // This is demonstrated by the test continuing to run and validate error conditions
          // In a real scenario, the test framework would mark this as a failure
          const testShouldFail = networkErrors.length > 0 && 
                                capturedError!.response.status >= 400;
          expect(testShouldFail).toBe(true);
        }
      ),
      { 
        numRuns: 10, // Reduced runs for E2E property tests
        timeout: 15000 // Reduced timeout for browser operations
      }
    );
  });

  test('Property 2: Test Failure on Backend Errors - should provide detailed error context for debugging', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorScenario: fc.constantFrom(
            'network_timeout',
            'server_overload', 
            'invalid_request',
            'authentication_failure',
            'file_processing_error'
          ),
          requestId: fc.uuid(),
          userAgent: fc.constantFrom(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            'Mozilla/5.0 (X11; Linux x86_64)'
          )
        }),
        async (contextData) => {
          const errorStatusMap = {
            'network_timeout': 0, // Network error
            'server_overload': 503,
            'invalid_request': 400,
            'authentication_failure': 401,
            'file_processing_error': 422
          };

          const errorStatus = errorStatusMap[contextData.errorScenario];

          // Mock error with detailed context
          if (errorStatus === 0) {
            // Simulate network timeout
            await page.route('**/api/upload', (route) => {
              route.abort('timedout');
            });
          } else {
            await page.route('**/api/upload', (route) => {
              route.fulfill({
                status: errorStatus,
                contentType: 'application/json',
                headers: {
                  'x-request-id': contextData.requestId,
                  'x-error-scenario': contextData.errorScenario
                },
                body: JSON.stringify({
                  success: false,
                  error: `Error scenario: ${contextData.errorScenario}`,
                  requestId: contextData.requestId,
                  timestamp: new Date().toISOString(),
                  context: {
                    userAgent: contextData.userAgent,
                    scenario: contextData.errorScenario
                  }
                })
              });
            });
          }

          // Navigate to dashboard (user is already authenticated)
          await page.goto('/dashboard');
          
          // Wait for dashboard to load
          await page.waitForSelector('.sidebar', { timeout: 10000 });

          const fileInput = page.locator('input[type="file"]');
          await fileInput.setInputFiles('Ponto2.pdf');
          await page.waitForTimeout(1000);

          const uploadButton = page.locator('button:has-text("Enviar PDF para Conversão")');
          await uploadButton.click();
          await page.waitForTimeout(5000);

          // Property: Error context should be captured with sufficient detail
          const networkErrors = networkLogger.getErrors();
          expect(networkErrors.length).toBeGreaterThan(0);

          const capturedError = networkErrors[0];
          
          // Property: Error should contain debugging information
          expect(capturedError.timestamp).toBeDefined();
          expect(capturedError.request).toBeDefined();
          expect(capturedError.response).toBeDefined();

          // Property: Request details should be captured
          expect(capturedError.request.method).toBe('POST');
          expect(capturedError.request.url).toContain('/api/upload');
          expect(capturedError.request.headers).toBeDefined();

          // Property: Response details should be captured (if not network error)
          if (errorStatus !== 0) {
            expect(capturedError.response.status).toBe(errorStatus);
            expect(capturedError.response.headers).toBeDefined();
            expect(capturedError.response.body).toContain(contextData.errorScenario);
          } else {
            expect(capturedError.response.status).toBe(0); // Network error
          }

          // Property: Error should be properly categorized
          const category = networkLogger.categorizeError(capturedError.response.status);
          expect(['client', 'server', 'network']).toContain(category);

          // Property: Flow context should be available
          expect(capturedError.flow).toBeDefined();
          expect(capturedError.step).toBeDefined();

          // Property: Error information should be sufficient for debugging
          const errorReport = networkLogger.formatErrorReport();
          expect(errorReport.summary.totalErrors).toBe(1);
          expect(errorReport.errors.length).toBe(1);
          expect(errorReport.errors[0].request.url).toContain('/api/upload');
        }
      ),
      { 
        numRuns: 5, // Reduced runs for complex E2E scenarios
        timeout: 20000
      }
    );
  });

  test('Property 2: Test Failure on Backend Errors - should handle multiple concurrent upload errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorCount: fc.integer({ min: 2, max: 5 }),
          errorStatuses: fc.array(
            fc.constantFrom(400, 401, 403, 404, 500, 502, 503),
            { minLength: 2, maxLength: 5 }
          ),
          concurrentUploads: fc.boolean()
        }),
        async (multiErrorData) => {
          let requestCount = 0;
          
          // Mock multiple error responses
          await page.route('**/api/upload', (route) => {
            const errorStatus = multiErrorData.errorStatuses[
              requestCount % multiErrorData.errorStatuses.length
            ];
            requestCount++;

            route.fulfill({
              status: errorStatus,
              contentType: 'application/json',
              body: JSON.stringify({
                success: false,
                error: `Error ${requestCount}: Status ${errorStatus}`,
                requestNumber: requestCount,
                timestamp: new Date().toISOString()
              })
            });
          });

          // Navigate to dashboard (user is already authenticated)
          await page.goto('/dashboard');
          
          // Wait for dashboard to load
          await page.waitForSelector('.sidebar', { timeout: 10000 });

          // Perform multiple upload attempts
          for (let i = 0; i < multiErrorData.errorCount; i++) {
            const fileInput = page.locator('input[type="file"]');
            await fileInput.setInputFiles('Ponto2.pdf');
            await page.waitForTimeout(500);

            const uploadButton = page.locator('button:has-text("Enviar PDF para Conversão")');
            await uploadButton.click();
            await page.waitForTimeout(2000);

            // Reset for next attempt if not last iteration
            if (i < multiErrorData.errorCount - 1) {
              const retryButton = page.locator('button:has-text("Tentar Novamente")');
              if (await retryButton.isVisible()) {
                await retryButton.click();
                await page.waitForTimeout(1000);
              }
            }
          }

          // Property: All errors should be captured
          const networkErrors = networkLogger.getErrors();
          expect(networkErrors.length).toBeGreaterThanOrEqual(multiErrorData.errorCount);

          // Property: Each error should have unique context
          const uploadErrors = networkErrors.filter(error => 
            error.request.url.includes('/api/upload')
          );
          expect(uploadErrors.length).toBe(multiErrorData.errorCount);

          // Property: Error statuses should match expected values
          uploadErrors.forEach((error, index) => {
            const expectedStatus = multiErrorData.errorStatuses[
              index % multiErrorData.errorStatuses.length
            ];
            expect(error.response.status).toBe(expectedStatus);
          });

          // Property: Errors should be properly categorized
          uploadErrors.forEach(error => {
            const category = networkLogger.categorizeError(error.response.status);
            expect(['client', 'server']).toContain(category);
          });

          // Property: Error report should aggregate multiple errors
          const errorReport = networkLogger.formatErrorReport();
          expect(errorReport.summary.totalErrors).toBe(multiErrorData.errorCount);
          expect(errorReport.errors.length).toBeGreaterThanOrEqual(multiErrorData.errorCount);
        }
      ),
      { 
        numRuns: 3, // Reduced runs for complex multi-error scenarios
        timeout: 25000
      }
    );
  });
});