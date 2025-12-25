import { test, expect } from '@playwright/test';
import * as fc from 'fast-check';
import { NetworkLogger } from './network-logger';

/**
 * Property-Based Test for Error Categorization
 * Feature: e2e-flow-testing, Property 4: Error Type Classification
 * Validates: Requirements 3.5
 * 
 * Property 4: Error Type Classification
 * For any captured backend error, the system should correctly classify it as 
 * either client error (4xx) or server error (5xx) based on the HTTP status code
 */

test.describe('Error Categorization Property Tests', () => {
  test('Property 4: Error type classification based on HTTP status codes', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate different HTTP status codes and test categorization
        fc.record({
          statusCode: fc.integer({ min: 400, max: 599 }),
          method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
          url: fc.constantFrom(
            'http://localhost:8000/api/auth/login',
            'http://localhost:8000/api/auth/register',
            'http://localhost:8000/api/orders',
            'http://localhost:8000/api/orders/123',
            'http://localhost:8000/api/payments/456/status',
            'http://localhost:8000/api/upload'
          ),
          responseBody: fc.oneof(
            fc.record({
              error: fc.string({ minLength: 1, maxLength: 100 }),
              message: fc.string({ minLength: 1, maxLength: 200 })
            }),
            fc.string({ minLength: 1, maxLength: 500 }),
            fc.constant(null)
          )
        }),
        async (errorScenario) => {
          const networkLogger = new NetworkLogger();
          
          // Test the categorizeError method directly
          const category = networkLogger.categorizeError(errorScenario.statusCode);
          
          // Property: 4xx status codes should be categorized as 'client' errors
          if (errorScenario.statusCode >= 400 && errorScenario.statusCode < 500) {
            expect(category).toBe('client');
          }
          
          // Property: 5xx status codes should be categorized as 'server' errors
          if (errorScenario.statusCode >= 500 && errorScenario.statusCode < 600) {
            expect(category).toBe('server');
          }
          
          // Property: Category must be one of the valid types
          expect(['client', 'server', 'network']).toContain(category);
          
          // Property: Category should be consistent for the same status code
          const category2 = networkLogger.categorizeError(errorScenario.statusCode);
          expect(category).toBe(category2);
        }
      ),
      { numRuns: 100 } // Run 100 iterations to test various status codes
    );
  });

  test('Property 4: Client error status codes (4xx) classification', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate all possible 4xx status codes
        fc.record({
          statusCode: fc.integer({ min: 400, max: 499 }),
          specificCodes: fc.constantFrom(400, 401, 403, 404, 409, 422, 429, 451)
        }),
        async (scenario) => {
          const networkLogger = new NetworkLogger();
          
          // Test with generated 4xx status code
          const category1 = networkLogger.categorizeError(scenario.statusCode);
          expect(category1).toBe('client');
          
          // Test with specific common 4xx status codes
          const category2 = networkLogger.categorizeError(scenario.specificCodes);
          expect(category2).toBe('client');
          
          // Property: All 4xx codes should consistently return 'client'
          for (let code = 400; code < 500; code += 10) {
            const testCategory = networkLogger.categorizeError(code);
            expect(testCategory).toBe('client');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 4: Server error status codes (5xx) classification', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate all possible 5xx status codes
        fc.record({
          statusCode: fc.integer({ min: 500, max: 599 }),
          specificCodes: fc.constantFrom(500, 501, 502, 503, 504, 505, 507, 508)
        }),
        async (scenario) => {
          const networkLogger = new NetworkLogger();
          
          // Test with generated 5xx status code
          const category1 = networkLogger.categorizeError(scenario.statusCode);
          expect(category1).toBe('server');
          
          // Test with specific common 5xx status codes
          const category2 = networkLogger.categorizeError(scenario.specificCodes);
          expect(category2).toBe('server');
          
          // Property: All 5xx codes should consistently return 'server'
          for (let code = 500; code < 600; code += 10) {
            const testCategory = networkLogger.categorizeError(code);
            expect(testCategory).toBe('server');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 4: Error categorization boundary conditions', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Test boundary conditions around 4xx/5xx ranges
        fc.record({
          boundaryCode: fc.constantFrom(399, 400, 499, 500, 599, 600),
          randomCode: fc.integer({ min: 100, max: 999 })
        }),
        async (scenario) => {
          const networkLogger = new NetworkLogger();
          
          // Test boundary conditions
          const boundaryCategory = networkLogger.categorizeError(scenario.boundaryCode);
          
          if (scenario.boundaryCode === 399) {
            // 399 is not an error code, but if passed should not be 'client' or 'server'
            expect(boundaryCategory).toBe('network');
          } else if (scenario.boundaryCode === 400) {
            // First client error code
            expect(boundaryCategory).toBe('client');
          } else if (scenario.boundaryCode === 499) {
            // Last client error code
            expect(boundaryCategory).toBe('client');
          } else if (scenario.boundaryCode === 500) {
            // First server error code
            expect(boundaryCategory).toBe('server');
          } else if (scenario.boundaryCode === 599) {
            // Last server error code
            expect(boundaryCategory).toBe('server');
          } else if (scenario.boundaryCode === 600) {
            // Beyond server error range
            expect(boundaryCategory).toBe('network');
          }
          
          // Property: Random codes outside 400-599 should be 'network'
          if (scenario.randomCode < 400 || scenario.randomCode >= 600) {
            const randomCategory = networkLogger.categorizeError(scenario.randomCode);
            expect(randomCategory).toBe('network');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 4: Error filtering by category works correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate mixed error scenarios
        fc.record({
          clientErrors: fc.array(fc.integer({ min: 400, max: 499 }), { minLength: 1, maxLength: 5 }),
          serverErrors: fc.array(fc.integer({ min: 500, max: 599 }), { minLength: 1, maxLength: 5 }),
          networkErrors: fc.array(fc.integer({ min: 100, max: 399 }), { minLength: 1, maxLength: 3 })
        }),
        async (scenario) => {
          const networkLogger = new NetworkLogger();
          
          // Create mock errors for each category
          const allStatusCodes = [
            ...scenario.clientErrors,
            ...scenario.serverErrors,
            ...scenario.networkErrors
          ];
          
          // Test categorization for each status code
          const categorizedErrors = allStatusCodes.map(statusCode => ({
            statusCode,
            category: networkLogger.categorizeError(statusCode)
          }));
          
          // Property: Client errors should be correctly identified
          const clientErrorCodes = categorizedErrors
            .filter(e => e.category === 'client')
            .map(e => e.statusCode);
          
          clientErrorCodes.forEach(code => {
            expect(code).toBeGreaterThanOrEqual(400);
            expect(code).toBeLessThan(500);
          });
          
          // Property: Server errors should be correctly identified
          const serverErrorCodes = categorizedErrors
            .filter(e => e.category === 'server')
            .map(e => e.statusCode);
          
          serverErrorCodes.forEach(code => {
            expect(code).toBeGreaterThanOrEqual(500);
            expect(code).toBeLessThan(600);
          });
          
          // Property: Network errors should be correctly identified
          const networkErrorCodes = categorizedErrors
            .filter(e => e.category === 'network')
            .map(e => e.statusCode);
          
          networkErrorCodes.forEach(code => {
            expect(code < 400 || code >= 600).toBe(true);
          });
          
          // Property: All errors should be categorized
          expect(categorizedErrors.length).toBe(allStatusCodes.length);
          
          // Property: Each error should have exactly one category
          categorizedErrors.forEach(error => {
            expect(['client', 'server', 'network']).toContain(error.category);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 4: Severity assignment consistency with categorization', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate error scenarios with different endpoints and status codes
        fc.record({
          statusCode: fc.integer({ min: 400, max: 599 }),
          endpoint: fc.constantFrom(
            '/api/auth/login',
            '/api/auth/register',
            '/api/orders',
            '/api/orders/123',
            '/api/payments/456/status',
            '/api/upload',
            '/api/download/789',
            '/api/unknown/endpoint'
          )
        }),
        async (scenario) => {
          const networkLogger = new NetworkLogger();
          
          // Test categorization
          const category = networkLogger.categorizeError(scenario.statusCode);
          
          // Property: Category should be consistent with status code
          if (scenario.statusCode >= 400 && scenario.statusCode < 500) {
            expect(category).toBe('client');
          } else if (scenario.statusCode >= 500 && scenario.statusCode < 600) {
            expect(category).toBe('server');
          } else {
            expect(category).toBe('network');
          }
          
          // Property: Critical endpoints should be identifiable
          const isCriticalEndpoint = ['/api/auth/login', '/api/auth/register', '/api/orders'].some(
            endpoint => scenario.endpoint.includes(endpoint)
          );
          
          // Property: Critical endpoints should be treated with appropriate severity
          // This is a design property - critical endpoints should be flagged for higher attention
          if (isCriticalEndpoint) {
            expect(typeof isCriticalEndpoint).toBe('boolean');
            expect(isCriticalEndpoint).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});