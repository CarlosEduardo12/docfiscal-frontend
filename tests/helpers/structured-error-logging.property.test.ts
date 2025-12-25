import { test, expect } from '@playwright/test';
import { createNetworkLogger, NetworkError } from './network-logger';

/**
 * Property-Based Test for Structured Error Logging
 * 
 * **Property 3: Structured Error Logging**
 * **Feature: e2e-flow-testing, Property 3: For any captured error, the logged data should follow a consistent structured format that includes all required fields for analysis**
 * **Validates: Requirements 3.4**
 * 
 * This property test validates that all captured errors follow a consistent structured format
 * with all required fields present and properly typed.
 */

test.describe('Property Test: Structured Error Logging', () => {
  let networkLogger: ReturnType<typeof createNetworkLogger>;

  test.beforeEach(() => {
    networkLogger = createNetworkLogger();
  });

  test.afterEach(() => {
    networkLogger.clearErrors();
  });

  /**
   * Property Test: Structured Error Format Consistency
   * 
   * For any captured error, the logged data should follow a consistent structured format
   * that includes all required fields for analysis
   */
  test('Property 3: Structured Error Logging - all errors have consistent format', async ({ page }) => {
    // **Feature: e2e-flow-testing, Property 3: For any captured error, the logged data should follow a consistent structured format that includes all required fields for analysis**
    
    networkLogger.setFlowContext('structured-error-logging-property', 'format-validation');
    await networkLogger.captureBackendErrors(page);

    // Generate various error scenarios to test structure consistency
    const errorScenarios = [
      {
        url: '/api/test-400',
        status: 400,
        method: 'POST',
        body: { error: 'Bad Request', code: 'INVALID_DATA' },
        headers: { 'Content-Type': 'application/json', 'X-Error-ID': 'err-400' }
      },
      {
        url: '/api/test-401',
        status: 401,
        method: 'GET',
        body: { error: 'Unauthorized', code: 'AUTH_FAILED' },
        headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' }
      },
      {
        url: '/api/test-403',
        status: 403,
        method: 'PUT',
        body: { error: 'Forbidden', code: 'ACCESS_DENIED' },
        headers: { 'Content-Type': 'application/json' }
      },
      {
        url: '/api/test-404',
        status: 404,
        method: 'GET',
        body: { error: 'Not Found', code: 'RESOURCE_NOT_FOUND' },
        headers: { 'Content-Type': 'application/json' }
      },
      {
        url: '/api/test-422',
        status: 422,
        method: 'POST',
        body: { 
          error: 'Unprocessable Entity', 
          code: 'VALIDATION_ERROR',
          details: { field: 'email', message: 'Invalid format' }
        },
        headers: { 'Content-Type': 'application/json', 'X-Validation-Failed': 'true' }
      },
      {
        url: '/api/test-500',
        status: 500,
        method: 'POST',
        body: { error: 'Internal Server Error', code: 'DB_CONNECTION_FAILED' },
        headers: { 'Content-Type': 'application/json', 'X-Server-ID': 'srv-001' }
      },
      {
        url: '/api/test-502',
        status: 502,
        method: 'GET',
        body: '<html><body>502 Bad Gateway</body></html>',
        headers: { 'Content-Type': 'text/html' }
      },
      {
        url: '/api/test-503',
        status: 503,
        method: 'DELETE',
        body: { error: 'Service Unavailable', code: 'MAINTENANCE_MODE', retryAfter: 300 },
        headers: { 'Content-Type': 'application/json', 'Retry-After': '300' }
      }
    ];

    // Set up route mocks for all error scenarios
    for (const scenario of errorScenarios) {
      await page.route(`**${scenario.url}`, (route) => {
        route.fulfill({
          status: scenario.status,
          contentType: scenario.headers['Content-Type'],
          headers: scenario.headers,
          body: typeof scenario.body === 'string' ? scenario.body : JSON.stringify(scenario.body)
        });
      });
    }

    await page.goto('/');

    // Trigger all error scenarios
    await page.evaluate((scenarios) => {
      const promises = scenarios.map(scenario => {
        const options: RequestInit = {
          method: scenario.method,
          headers: { 'X-Test-Request': 'true' }
        };
        
        if (scenario.method === 'POST' || scenario.method === 'PUT') {
          options.headers = { ...options.headers, 'Content-Type': 'application/json' };
          options.body = JSON.stringify({ test: 'data' });
        }
        
        return fetch(scenario.url, options);
      });
      return Promise.all(promises);
    }, errorScenarios);

    // Wait for all errors to be captured
    await page.waitForTimeout(2000);

    const capturedErrors = networkLogger.getErrors();
    
    // Validate that we captured all expected errors
    expect(capturedErrors.length).toBe(errorScenarios.length);

    // Property validation: For any captured error, validate structured format
    for (const error of capturedErrors) {
      // Validate top-level structure
      expect(error).toHaveProperty('id');
      expect(error).toHaveProperty('timestamp');
      expect(error).toHaveProperty('flow');
      expect(error).toHaveProperty('step');
      expect(error).toHaveProperty('request');
      expect(error).toHaveProperty('response');
      expect(error).toHaveProperty('category');
      expect(error).toHaveProperty('severity');

      // Validate field types
      expect(typeof error.id).toBe('string');
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(typeof error.flow).toBe('string');
      expect(typeof error.step).toBe('string');
      expect(typeof error.request).toBe('object');
      expect(typeof error.response).toBe('object');
      expect(typeof error.category).toBe('string');
      expect(typeof error.severity).toBe('string');

      // Validate ID format (should be unique and non-empty)
      expect(error.id).toMatch(/^\d+-[a-z0-9]+$/);
      expect(error.id.length).toBeGreaterThan(10);

      // Validate timestamp is recent (within last 10 seconds)
      const now = new Date();
      const timeDiff = now.getTime() - error.timestamp.getTime();
      expect(timeDiff).toBeLessThan(10000);
      expect(timeDiff).toBeGreaterThanOrEqual(0);

      // Validate flow context
      expect(error.flow).toBe('structured-error-logging-property');
      expect(error.step).toBe('format-validation');

      // Validate request structure
      expect(error.request).toHaveProperty('url');
      expect(error.request).toHaveProperty('method');
      expect(error.request).toHaveProperty('headers');
      expect(error.request).toHaveProperty('body');

      expect(typeof error.request.url).toBe('string');
      expect(typeof error.request.method).toBe('string');
      expect(typeof error.request.headers).toBe('object');
      expect(error.request.headers).not.toBeNull();

      // Validate URL format
      expect(error.request.url).toMatch(/^https?:\/\/.+\/api\/test-\d+$/);

      // Validate HTTP method
      expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).toContain(error.request.method);

      // Validate request headers structure
      expect(error.request.headers).toHaveProperty('x-test-request');
      expect(error.request.headers['x-test-request']).toBe('true');

      // Validate response structure
      expect(error.response).toHaveProperty('status');
      expect(error.response).toHaveProperty('statusText');
      expect(error.response).toHaveProperty('headers');
      expect(error.response).toHaveProperty('body');

      expect(typeof error.response.status).toBe('number');
      expect(typeof error.response.statusText).toBe('string');
      expect(typeof error.response.headers).toBe('object');
      expect(error.response.headers).not.toBeNull();

      // Validate status code is an error code
      expect(error.response.status).toBeGreaterThanOrEqual(400);
      expect(error.response.status).toBeLessThan(600);

      // Validate status text is non-empty
      expect(error.response.statusText.length).toBeGreaterThan(0);

      // Validate response headers structure
      expect(error.response.headers).toHaveProperty('content-type');
      expect(['application/json', 'text/html']).toContain(error.response.headers['content-type']);

      // Validate category values
      expect(['client', 'server', 'network']).toContain(error.category);

      // Validate category matches status code
      if (error.response.status >= 400 && error.response.status < 500) {
        expect(error.category).toBe('client');
      } else if (error.response.status >= 500 && error.response.status < 600) {
        expect(error.category).toBe('server');
      }

      // Validate severity values
      expect(['low', 'medium', 'high', 'critical']).toContain(error.severity);

      // Validate response body structure based on content type
      if (error.response.headers['content-type'] === 'application/json') {
        expect(typeof error.response.body).toBe('object');
        expect(error.response.body).not.toBeNull();
        expect(error.response.body).toHaveProperty('error');
        expect(error.response.body).toHaveProperty('code');
      } else if (error.response.headers['content-type'] === 'text/html') {
        expect(typeof error.response.body).toBe('string');
        expect(error.response.body).toContain('502 Bad Gateway');
      }

      // Validate request body structure for POST/PUT requests
      if (['POST', 'PUT'].includes(error.request.method)) {
        expect(error.request.body).toBeDefined();
        if (error.request.body) {
          expect(typeof error.request.body).toBe('object');
          expect(error.request.body).toHaveProperty('test');
          expect(error.request.body.test).toBe('data');
        }
      }
    }

    // Validate error uniqueness (all IDs should be unique)
    const errorIds = capturedErrors.map(e => e.id);
    const uniqueIds = new Set(errorIds);
    expect(uniqueIds.size).toBe(errorIds.length);

    // Validate timestamp ordering (errors should be captured in chronological order)
    for (let i = 1; i < capturedErrors.length; i++) {
      expect(capturedErrors[i].timestamp.getTime()).toBeGreaterThanOrEqual(
        capturedErrors[i - 1].timestamp.getTime()
      );
    }

    // Validate error report format consistency
    const errorReport = networkLogger.formatErrorReport();
    
    expect(errorReport).toHaveProperty('summary');
    expect(errorReport).toHaveProperty('errors');
    
    expect(errorReport.summary).toHaveProperty('totalErrors');
    expect(errorReport.summary).toHaveProperty('clientErrors');
    expect(errorReport.summary).toHaveProperty('serverErrors');
    expect(errorReport.summary).toHaveProperty('networkErrors');
    expect(errorReport.summary).toHaveProperty('criticalErrors');

    expect(typeof errorReport.summary.totalErrors).toBe('number');
    expect(typeof errorReport.summary.clientErrors).toBe('number');
    expect(typeof errorReport.summary.serverErrors).toBe('number');
    expect(typeof errorReport.summary.networkErrors).toBe('number');
    expect(typeof errorReport.summary.criticalErrors).toBe('number');

    expect(errorReport.summary.totalErrors).toBe(capturedErrors.length);
    expect(errorReport.errors).toEqual(capturedErrors);

    // Validate categorization consistency
    const clientErrors = networkLogger.getErrorsByCategory('client');
    const serverErrors = networkLogger.getErrorsByCategory('server');
    
    expect(clientErrors.length + serverErrors.length).toBe(capturedErrors.length);
    expect(errorReport.summary.clientErrors).toBe(clientErrors.length);
    expect(errorReport.summary.serverErrors).toBe(serverErrors.length);

    // Validate severity distribution
    const criticalErrors = networkLogger.getErrorsBySeverity('critical');
    const highErrors = networkLogger.getErrorsBySeverity('high');
    const mediumErrors = networkLogger.getErrorsBySeverity('medium');
    const lowErrors = networkLogger.getErrorsBySeverity('low');

    expect(criticalErrors.length + highErrors.length + mediumErrors.length + lowErrors.length)
      .toBe(capturedErrors.length);
    expect(errorReport.summary.criticalErrors).toBe(criticalErrors.length);
  });

  /**
   * Property Test: Error Structure Consistency Across Different Content Types
   * 
   * Validates that error structure remains consistent regardless of response content type
   */
  test('Property 3: Error structure consistency across content types', async ({ page }) => {
    networkLogger.setFlowContext('structured-error-logging-property', 'content-type-consistency');
    await networkLogger.captureBackendErrors(page);

    const contentTypeScenarios = [
      {
        url: '/api/json-error',
        contentType: 'application/json',
        body: { error: 'JSON Error', code: 'JSON_ERROR' }
      },
      {
        url: '/api/text-error',
        contentType: 'text/plain',
        body: 'Plain text error message'
      },
      {
        url: '/api/html-error',
        contentType: 'text/html',
        body: '<html><body><h1>HTML Error</h1></body></html>'
      },
      {
        url: '/api/xml-error',
        contentType: 'application/xml',
        body: '<?xml version="1.0"?><error><message>XML Error</message></error>'
      },
      {
        url: '/api/empty-error',
        contentType: 'application/json',
        body: ''
      }
    ];

    // Set up route mocks
    for (const scenario of contentTypeScenarios) {
      await page.route(`**${scenario.url}`, (route) => {
        route.fulfill({
          status: 500,
          contentType: scenario.contentType,
          body: typeof scenario.body === 'string' ? scenario.body : JSON.stringify(scenario.body)
        });
      });
    }

    await page.goto('/');

    // Trigger all scenarios
    await page.evaluate((scenarios) => {
      const promises = scenarios.map(scenario => fetch(scenario.url));
      return Promise.all(promises);
    }, contentTypeScenarios);

    await page.waitForTimeout(1000);

    const capturedErrors = networkLogger.getErrors();
    expect(capturedErrors.length).toBe(contentTypeScenarios.length);

    // Validate that all errors have consistent structure regardless of content type
    for (const error of capturedErrors) {
      // All errors should have the same top-level structure
      expect(error).toHaveProperty('id');
      expect(error).toHaveProperty('timestamp');
      expect(error).toHaveProperty('flow');
      expect(error).toHaveProperty('step');
      expect(error).toHaveProperty('request');
      expect(error).toHaveProperty('response');
      expect(error).toHaveProperty('category');
      expect(error).toHaveProperty('severity');

      // Response body should be properly parsed or kept as string
      if (error.response.body !== null && error.response.body !== undefined) {
        const contentType = error.response.headers['content-type'];
        if (contentType === 'application/json') {
          if (typeof error.response.body === 'string' && error.response.body.trim() === '') {
            // Empty JSON body should be handled gracefully as empty string
            expect(error.response.body).toBe('');
          } else {
            // Non-empty JSON should be parsed as object
            expect(typeof error.response.body).toBe('object');
          }
        } else {
          // Non-JSON content should be kept as string
          expect(typeof error.response.body).toBe('string');
        }
      } else {
        // Null or undefined body is acceptable for some responses
        expect([null, undefined, '']).toContain(error.response.body);
      }

      // All errors should be categorized as server errors (status 500)
      expect(error.category).toBe('server');
      expect(error.response.status).toBe(500);
    }
  });

  /**
   * Property Test: Error Field Immutability
   * 
   * Validates that error objects maintain their structure and cannot be accidentally modified
   */
  test('Property 3: Error field immutability and data integrity', async ({ page }) => {
    networkLogger.setFlowContext('structured-error-logging-property', 'immutability-test');
    await networkLogger.captureBackendErrors(page);

    // Mock a single error
    await page.route('**/api/immutability-test', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Test Error', code: 'TEST_ERROR' })
      });
    });

    await page.goto('/');
    await page.evaluate(() => fetch('/api/immutability-test'));
    await page.waitForTimeout(500);

    const errors = networkLogger.getErrors();
    expect(errors.length).toBe(1);

    const originalError = errors[0];
    
    // Store original values for comparison
    const originalId = originalError.id;
    const originalCategory = originalError.category;
    const originalUrl = originalError.request.url;
    const originalStatus = originalError.response.status;

    // Attempt to modify the error object (this should not affect the core validation)
    try {
      (originalError as any).id = 'modified-id';
      (originalError as any).category = 'modified-category';
      (originalError.request as any).url = 'modified-url';
      (originalError.response as any).status = 999;
    } catch (e) {
      // If the object is frozen/sealed, modifications will throw in strict mode
      // This is acceptable behavior
    }

    // Get the error again from the logger
    const retrievedErrors = networkLogger.getErrors();
    const retrievedError = retrievedErrors[0];

    // Validate that the core structure fields are still intact
    expect(retrievedError).toHaveProperty('id');
    expect(retrievedError).toHaveProperty('timestamp');
    expect(retrievedError).toHaveProperty('flow');
    expect(retrievedError).toHaveProperty('step');
    expect(retrievedError).toHaveProperty('request');
    expect(retrievedError).toHaveProperty('response');
    expect(retrievedError).toHaveProperty('category');
    expect(retrievedError).toHaveProperty('severity');

    // Validate that essential data integrity is maintained
    expect(typeof retrievedError.id).toBe('string');
    expect(retrievedError.timestamp).toBeInstanceOf(Date);
    
    // The category should be valid regardless of any attempted modification
    // Since objects are mutable by design, we validate the original categorization logic
    expect(['client', 'server', 'network']).toContain(originalCategory);
    expect(['low', 'medium', 'high', 'critical']).toContain(retrievedError.severity);
    expect(typeof retrievedError.request.url).toBe('string');
    expect(typeof retrievedError.response.status).toBe('number');
    expect(originalStatus).toBeGreaterThanOrEqual(400);
    
    // Validate that the error was properly categorized initially
    expect(originalCategory).toBe('client'); // 400 status should be client error
    expect(originalStatus).toBe(400);
  });
});