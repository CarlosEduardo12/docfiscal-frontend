import { test, expect, Page } from '@playwright/test';
import { createNetworkLogger, NetworkError } from '../helpers/network-logger';
import { createErrorReporter } from '../helpers/error-reporter';

/**
 * Backend Error Simulation Tests
 * 
 * Tests various HTTP error codes (400, 401, 403, 404, 500, 502, 503)
 * Validates error capture and categorization
 * Tests error reporting and evidence collection
 * 
 * Requirements: 3.1, 3.3, 3.5
 */

test.describe('Backend Error Simulation', () => {
  let networkLogger: ReturnType<typeof createNetworkLogger>;
  let errorReporter: ReturnType<typeof createErrorReporter>;

  test.beforeEach(async ({ page }) => {
    networkLogger = createNetworkLogger();
    errorReporter = createErrorReporter();
    
    // Set up network monitoring
    await networkLogger.captureBackendErrors(page);
    networkLogger.setFlowContext('backend-error-simulation', 'setup');
  });

  test.afterEach(async () => {
    // Clear captured data after each test
    networkLogger.clearErrors();
    errorReporter.clear();
  });

  /**
   * Test 400 Bad Request error simulation
   * Validates client error categorization and capture
   */
  test('should capture and categorize 400 Bad Request errors', async ({ page }) => {
    networkLogger.setFlowContext('backend-error-simulation', '400-bad-request');

    // Mock 400 error response
    await page.route('**/api/test-400', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid request parameters',
          code: 'INVALID_PARAMS'
        })
      });
    });

    // Trigger the API call that will return 400
    await page.goto('/');
    await page.evaluate(() => {
      return fetch('/api/test-400', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' })
      });
    });

    // Wait for error to be captured
    await page.waitForTimeout(1000);

    const errors = networkLogger.getErrors();
    expect(errors.length).toBeGreaterThan(0);

    const badRequestError = errors.find(e => e.response.status === 400);
    expect(badRequestError).toBeDefined();
    expect(badRequestError?.category).toBe('client');
    expect(badRequestError?.request.method).toBe('POST');
    expect(badRequestError?.response.body).toMatchObject({
      error: 'Bad Request',
      message: 'Invalid request parameters',
      code: 'INVALID_PARAMS'
    });
  });

  /**
   * Test 401 Unauthorized error simulation
   * Validates authentication error handling and categorization
   */
  test('should capture and categorize 401 Unauthorized errors', async ({ page }) => {
    networkLogger.setFlowContext('backend-error-simulation', '401-unauthorized');

    // Mock 401 error response
    await page.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'Invalid credentials',
          code: 'AUTH_FAILED'
        })
      });
    });

    // Attempt login that will return 401
    await page.goto('/login');
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Wait for error to be captured
    await page.waitForTimeout(2000);

    const errors = networkLogger.getErrors();
    expect(errors.length).toBeGreaterThan(0);

    const authError = errors.find(e => e.response.status === 401);
    expect(authError).toBeDefined();
    expect(authError?.category).toBe('client');
    expect(authError?.severity).toBe('high'); // Auth endpoints are high severity
    expect(authError?.request.url).toContain('/api/auth/login');
  });

  /**
   * Test 403 Forbidden error simulation
   * Validates authorization error handling
   */
  test('should capture and categorize 403 Forbidden errors', async ({ page }) => {
    networkLogger.setFlowContext('backend-error-simulation', '403-forbidden');

    // Mock 403 error response
    await page.route('**/api/admin/**', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Forbidden',
          message: 'Insufficient permissions',
          code: 'ACCESS_DENIED'
        })
      });
    });

    // Trigger API call that will return 403
    await page.goto('/');
    await page.evaluate(() => {
      return fetch('/api/admin/users', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer invalid-token' }
      });
    });

    await page.waitForTimeout(1000);

    const errors = networkLogger.getErrors();
    const forbiddenError = errors.find(e => e.response.status === 403);
    
    expect(forbiddenError).toBeDefined();
    expect(forbiddenError?.category).toBe('client');
    expect(forbiddenError?.response.body.code).toBe('ACCESS_DENIED');
  });

  /**
   * Test 404 Not Found error simulation
   * Validates resource not found error handling
   */
  test('should capture and categorize 404 Not Found errors', async ({ page }) => {
    networkLogger.setFlowContext('backend-error-simulation', '404-not-found');

    // Mock 404 error response
    await page.route('**/api/orders/nonexistent-id', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Not Found',
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        })
      });
    });

    // Trigger API call that will return 404
    await page.goto('/');
    await page.evaluate(() => {
      return fetch('/api/orders/nonexistent-id', {
        method: 'GET'
      });
    });

    await page.waitForTimeout(1000);

    const errors = networkLogger.getErrors();
    const notFoundError = errors.find(e => e.response.status === 404);
    
    expect(notFoundError).toBeDefined();
    expect(notFoundError?.category).toBe('client');
    expect(notFoundError?.severity).toBe('medium'); // Orders endpoint is critical
  });

  /**
   * Test 500 Internal Server Error simulation
   * Validates server error categorization and high severity
   */
  test('should capture and categorize 500 Internal Server Error', async ({ page }) => {
    networkLogger.setFlowContext('backend-error-simulation', '500-server-error');

    // Mock 500 error response
    await page.route('**/api/orders', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal Server Error',
          message: 'Database connection failed',
          code: 'DB_ERROR'
        })
      });
    });

    // Trigger API call that will return 500
    await page.goto('/');
    await page.evaluate(() => {
      return fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'test.pdf' })
      });
    });

    await page.waitForTimeout(1000);

    const errors = networkLogger.getErrors();
    const serverError = errors.find(e => e.response.status === 500);
    
    expect(serverError).toBeDefined();
    expect(serverError?.category).toBe('server');
    expect(serverError?.severity).toBe('critical'); // Orders endpoint with 500 is critical
    expect(serverError?.response.body.code).toBe('DB_ERROR');
  });

  /**
   * Test 502 Bad Gateway error simulation
   * Validates proxy/gateway error handling
   */
  test('should capture and categorize 502 Bad Gateway errors', async ({ page }) => {
    networkLogger.setFlowContext('backend-error-simulation', '502-bad-gateway');

    // Mock 502 error response
    await page.route('**/api/upload', (route) => {
      route.fulfill({
        status: 502,
        contentType: 'text/html',
        body: '<html><body><h1>502 Bad Gateway</h1><p>The server received an invalid response from the upstream server.</p></body></html>'
      });
    });

    // Trigger API call that will return 502
    await page.goto('/');
    await page.evaluate(() => {
      return fetch('/api/upload', {
        method: 'POST',
        body: new FormData()
      });
    });

    await page.waitForTimeout(1000);

    const errors = networkLogger.getErrors();
    const gatewayError = errors.find(e => e.response.status === 502);
    
    expect(gatewayError).toBeDefined();
    expect(gatewayError?.category).toBe('server');
    expect(gatewayError?.severity).toBe('high');
  });

  /**
   * Test 503 Service Unavailable error simulation
   * Validates service unavailable error handling
   */
  test('should capture and categorize 503 Service Unavailable errors', async ({ page }) => {
    networkLogger.setFlowContext('backend-error-simulation', '503-service-unavailable');

    // Mock 503 error response
    await page.route('**/api/**', (route) => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Service Unavailable',
          message: 'Service is temporarily unavailable',
          code: 'SERVICE_DOWN',
          retryAfter: 60
        })
      });
    });

    // Trigger API call that will return 503
    await page.goto('/');
    await page.evaluate(() => {
      return fetch('/api/orders', {
        method: 'GET'
      });
    });

    await page.waitForTimeout(1000);

    const errors = networkLogger.getErrors();
    const serviceError = errors.find(e => e.response.status === 503);
    
    expect(serviceError).toBeDefined();
    expect(serviceError?.category).toBe('server');
    expect(serviceError?.response.body.retryAfter).toBe(60);
  });

  /**
   * Test multiple error types in sequence
   * Validates error aggregation and reporting
   */
  test('should capture and report multiple error types', async ({ page }) => {
    networkLogger.setFlowContext('backend-error-simulation', 'multiple-errors');

    // Mock multiple different error responses
    await page.route('**/api/test-400', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Bad Request' })
      });
    });

    await page.route('**/api/test-401', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' })
      });
    });

    await page.route('**/api/test-500', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    // Trigger multiple API calls
    await page.goto('/');
    await page.evaluate(() => {
      const promises = [
        fetch('/api/test-400'),
        fetch('/api/test-401'),
        fetch('/api/test-500')
      ];
      return Promise.all(promises);
    });

    await page.waitForTimeout(2000);

    const errors = networkLogger.getErrors();
    expect(errors.length).toBe(3);

    // Validate error categorization
    const clientErrors = networkLogger.getErrorsByCategory('client');
    const serverErrors = networkLogger.getErrorsByCategory('server');
    
    expect(clientErrors.length).toBe(2); // 400 and 401
    expect(serverErrors.length).toBe(1); // 500

    // Test error reporting
    const report = networkLogger.formatErrorReport();
    expect(report.summary.totalErrors).toBe(3);
    expect(report.summary.clientErrors).toBe(2);
    expect(report.summary.serverErrors).toBe(1);

    // Generate comprehensive error report
    const errorReport = errorReporter.generateReport(errors);
    expect(errorReport.summary.totalErrors).toBe(3);
    expect(Object.keys(errorReport.errors.byEndpoint).length).toBeGreaterThan(0);
    expect(errorReport.recommendations.length).toBeGreaterThan(0);
  });

  /**
   * Test error capture with request/response headers
   * Validates complete error context capture
   */
  test('should capture complete error context including headers', async ({ page }) => {
    networkLogger.setFlowContext('backend-error-simulation', 'error-context');

    // Mock error response with custom headers
    await page.route('**/api/test-headers', (route) => {
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        headers: {
          'X-Error-Code': 'VALIDATION_FAILED',
          'X-Request-ID': 'req-12345',
          'X-Rate-Limit-Remaining': '0'
        },
        body: JSON.stringify({
          error: 'Unprocessable Entity',
          details: {
            field: 'email',
            message: 'Invalid email format'
          }
        })
      });
    });

    // Trigger API call with custom headers
    await page.goto('/');
    await page.evaluate(() => {
      return fetch('/api/test-headers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Version': '1.0.0',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({ email: 'invalid-email' })
      });
    });

    await page.waitForTimeout(1000);

    const errors = networkLogger.getErrors();
    const headerError = errors.find(e => e.response.status === 422);
    
    expect(headerError).toBeDefined();
    expect(headerError?.request.headers['content-type']).toBe('application/json');
    expect(headerError?.request.headers['x-client-version']).toBe('1.0.0');
    expect(headerError?.response.headers['x-error-code']).toBe('VALIDATION_FAILED');
    expect(headerError?.response.headers['x-request-id']).toBe('req-12345');
    expect(headerError?.response.body.details.field).toBe('email');
  });

  /**
   * Test critical error detection
   * Validates critical error flagging for important endpoints
   */
  test('should identify critical errors on important endpoints', async ({ page }) => {
    networkLogger.setFlowContext('backend-error-simulation', 'critical-errors');

    // Mock critical endpoint failures
    await page.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Database unavailable' })
      });
    });

    await page.route('**/api/orders', (route) => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Service unavailable' })
      });
    });

    // Trigger critical endpoint calls
    await page.goto('/');
    await page.evaluate(() => {
      const promises = [
        fetch('/api/auth/login', { method: 'POST' }),
        fetch('/api/orders', { method: 'GET' })
      ];
      return Promise.all(promises);
    });

    await page.waitForTimeout(1000);

    const errors = networkLogger.getErrors();
    const criticalErrors = networkLogger.getErrorsBySeverity('critical');
    
    expect(criticalErrors.length).toBeGreaterThan(0);
    expect(networkLogger.hasCriticalErrors()).toBe(true);

    // Validate that critical endpoints are properly identified
    const authError = errors.find(e => e.request.url.includes('/api/auth/login'));
    const orderError = errors.find(e => e.request.url.includes('/api/orders'));
    
    expect(authError?.severity).toBe('critical');
    expect(orderError?.severity).toBe('high'); // 503 on orders is high, not critical
  });
});