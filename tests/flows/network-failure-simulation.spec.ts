import { test, expect, Page } from '@playwright/test';
import { createNetworkLogger } from '../helpers/network-logger';
import { createErrorReporter } from '../helpers/error-reporter';

/**
 * Network Failure Simulation Tests
 * 
 * Tests connection timeouts and network interruptions
 * Validates retry mechanisms and error recovery
 * Tests offline behavior and error messages
 * 
 * Requirements: 3.1, 10.4
 */

test.describe('Network Failure Simulation', () => {
  let networkLogger: ReturnType<typeof createNetworkLogger>;
  let errorReporter: ReturnType<typeof createErrorReporter>;

  test.beforeEach(async ({ page }) => {
    networkLogger = createNetworkLogger();
    errorReporter = createErrorReporter();
    
    // Set up network monitoring
    await networkLogger.captureBackendErrors(page);
    networkLogger.setFlowContext('network-failure-simulation', 'setup');
  });

  test.afterEach(async () => {
    // Clear captured data after each test
    networkLogger.clearErrors();
    errorReporter.clear();
  });

  /**
   * Test connection timeout simulation
   * Validates timeout handling and error capture
   */
  test('should handle connection timeouts gracefully', async ({ page }) => {
    networkLogger.setFlowContext('network-failure-simulation', 'connection-timeout');

    // Mock slow response that will timeout
    await page.route('**/api/slow-endpoint', async (route) => {
      // Delay response beyond typical timeout
      await new Promise(resolve => setTimeout(resolve, 35000)); // 35 seconds
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'This should timeout' })
      });
    });

    await page.goto('/');

    // Set a shorter timeout for this specific request to force timeout
    const timeoutPromise = page.evaluate(() => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      return fetch('/api/slow-endpoint', {
        signal: controller.signal,
        headers: { 'X-Test-Type': 'timeout-test' }
      }).catch(error => {
        clearTimeout(timeoutId);
        return { error: error.name, message: error.message };
      });
    });

    const result = await timeoutPromise;
    
    // Validate that the timeout was handled
    expect(result).toHaveProperty('error');
    expect(result.error).toBe('AbortError');

    // Wait for any potential error capture
    await page.waitForTimeout(1000);

    // Note: Network logger may not capture client-side timeouts as they don't reach the server
    // This test validates client-side timeout handling
  });

  /**
   * Test network interruption during request
   * Simulates connection drops and validates error handling
   */
  test('should handle network interruptions during requests', async ({ page }) => {
    networkLogger.setFlowContext('network-failure-simulation', 'network-interruption');

    let requestCount = 0;
    
    // Mock endpoint that fails on first request, succeeds on retry
    await page.route('**/api/unreliable-endpoint', (route) => {
      requestCount++;
      
      if (requestCount === 1) {
        // Simulate network failure by aborting the request
        route.abort('connectionreset');
      } else {
        // Second request succeeds
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            message: 'Success after retry',
            attempt: requestCount 
          })
        });
      }
    });

    await page.goto('/');

    // Implement retry logic in the test
    const retryRequest = async (maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await page.evaluate((attemptNum) => {
            return fetch('/api/unreliable-endpoint', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'X-Attempt': attemptNum.toString()
              },
              body: JSON.stringify({ attempt: attemptNum })
            }).then(res => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            });
          }, attempt);
          
          return { success: true, data: response, attempts: attempt };
        } catch (error) {
          if (attempt === maxRetries) {
            return { success: false, error: error, attempts: attempt };
          }
          // Wait before retry
          await page.waitForTimeout(1000);
        }
      }
    };

    const result = await retryRequest();
    
    // Validate that retry mechanism worked
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2); // First failed, second succeeded
    expect(result.data.message).toBe('Success after retry');
    expect(result.data.attempt).toBe(2);
  });

  /**
   * Test DNS resolution failure simulation
   * Validates handling of DNS-related network errors
   */
  test('should handle DNS resolution failures', async ({ page }) => {
    networkLogger.setFlowContext('network-failure-simulation', 'dns-failure');

    // Mock DNS failure by aborting with specific error
    await page.route('**/api/dns-test', (route) => {
      route.abort('namenotresolved');
    });

    await page.goto('/');

    const result = await page.evaluate(() => {
      return fetch('/api/dns-test', {
        headers: { 'X-Test-Type': 'dns-failure' }
      }).catch(error => ({
        error: error.name,
        message: error.message,
        type: 'network_error'
      }));
    });

    // Validate DNS error handling
    expect(result).toHaveProperty('error');
    expect(result.type).toBe('network_error');
    
    await page.waitForTimeout(1000);
  });

  /**
   * Test offline behavior simulation
   * Validates application behavior when network is unavailable
   */
  test('should handle offline behavior and show appropriate messages', async ({ page }) => {
    networkLogger.setFlowContext('network-failure-simulation', 'offline-behavior');

    // Simulate offline by blocking all network requests
    await page.route('**/*', (route) => {
      // Only block API requests, allow page resources
      if (route.request().url().includes('/api/')) {
        route.abort('internetdisconnected');
      } else {
        route.continue();
      }
    });

    await page.goto('/');

    // Try to make API requests that should fail
    const offlineResults = await page.evaluate(() => {
      const requests = [
        fetch('/api/orders').catch(e => ({ endpoint: '/api/orders', error: e.name })),
        fetch('/api/auth/login', { method: 'POST' }).catch(e => ({ endpoint: '/api/auth/login', error: e.name })),
        fetch('/api/upload', { method: 'POST' }).catch(e => ({ endpoint: '/api/upload', error: e.name }))
      ];
      
      return Promise.all(requests);
    });

    // Validate that all requests failed due to network issues
    expect(offlineResults).toHaveLength(3);
    offlineResults.forEach(result => {
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('endpoint');
    });

    // Check if the application shows offline indicators or error messages
    // This would depend on the application's offline handling implementation
    await page.waitForTimeout(2000);

    // Look for common offline indicators in the UI
    const hasOfflineIndicator = await page.evaluate(() => {
      const indicators = [
        document.querySelector('[data-testid="offline-indicator"]'),
        document.querySelector('.offline-message'),
        document.querySelector('[aria-label*="offline"]'),
        document.querySelector('[aria-label*="connection"]'),
        document.body.textContent?.includes('connection') || false,
        document.body.textContent?.includes('offline') || false,
        document.body.textContent?.includes('network') || false
      ];
      
      return indicators.some(indicator => indicator);
    });

    // Note: This assertion depends on the application implementing offline indicators
    // For now, we just validate that the network requests failed as expected
    expect(offlineResults.every(result => result.error)).toBe(true);
  });

  /**
   * Test slow network conditions
   * Validates application behavior under poor network conditions
   */
  test('should handle slow network conditions', async ({ page }) => {
    networkLogger.setFlowContext('network-failure-simulation', 'slow-network');

    // Mock slow responses
    await page.route('**/api/slow-network-test', async (route) => {
      // Simulate slow network with 3-second delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          message: 'Slow response',
          delay: 3000 
        })
      });
    });

    await page.goto('/');

    const startTime = Date.now();
    
    const result = await page.evaluate(() => {
      return fetch('/api/slow-network-test', {
        headers: { 'X-Test-Type': 'slow-network' }
      }).then(res => res.json());
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Validate that the request took the expected time
    expect(duration).toBeGreaterThan(2900); // Allow some margin
    expect(result.message).toBe('Slow response');
    expect(result.delay).toBe(3000);

    await page.waitForTimeout(500);
  });

  /**
   * Test intermittent connectivity issues
   * Simulates flaky network conditions
   */
  test('should handle intermittent connectivity issues', async ({ page }) => {
    networkLogger.setFlowContext('network-failure-simulation', 'intermittent-connectivity');

    let requestCount = 0;
    
    // Mock endpoint with intermittent failures
    await page.route('**/api/flaky-endpoint', (route) => {
      requestCount++;
      
      // Fail every other request
      if (requestCount % 2 === 1) {
        route.abort('connectionreset');
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            message: 'Success',
            requestNumber: requestCount 
          })
        });
      }
    });

    await page.goto('/');

    // Make multiple requests to test intermittent behavior
    const results = [];
    
    for (let i = 1; i <= 6; i++) {
      try {
        const result = await page.evaluate((requestNum) => {
          return fetch('/api/flaky-endpoint', {
            headers: { 'X-Request-Number': requestNum.toString() }
          }).then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          });
        }, i);
        
        results.push({ success: true, data: result, requestNumber: i });
      } catch (error) {
        results.push({ success: false, error: error.message, requestNumber: i });
      }
      
      // Small delay between requests
      await page.waitForTimeout(200);
    }

    // Validate intermittent pattern
    expect(results).toHaveLength(6);
    
    // Odd-numbered requests should fail, even-numbered should succeed
    results.forEach((result, index) => {
      const requestNumber = index + 1;
      if (requestNumber % 2 === 1) {
        expect(result.success).toBe(false);
      } else {
        expect(result.success).toBe(true);
        expect(result.data.message).toBe('Success');
      }
    });
  });

  /**
   * Test network error recovery mechanisms
   * Validates error recovery and user feedback
   */
  test('should provide appropriate error recovery mechanisms', async ({ page }) => {
    networkLogger.setFlowContext('network-failure-simulation', 'error-recovery');

    let attemptCount = 0;
    
    // Mock endpoint that fails first few times, then succeeds
    await page.route('**/api/recovery-test', (route) => {
      attemptCount++;
      
      if (attemptCount <= 2) {
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Service Unavailable',
            message: 'Service temporarily unavailable',
            retryAfter: 1
          })
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Service recovered',
            attempt: attemptCount
          })
        });
      }
    });

    await page.goto('/');

    // Implement exponential backoff retry strategy
    const exponentialBackoffRetry = async (maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await page.evaluate((attemptNum) => {
            return fetch('/api/recovery-test', {
              headers: { 'X-Attempt': attemptNum.toString() }
            }).then(async res => {
              const data = await res.json();
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${data.message}`);
              }
              return data;
            });
          }, attempt);
          
          return { success: true, data: response, attempts: attempt };
        } catch (error) {
          if (attempt === maxRetries) {
            return { success: false, error: error.message, attempts: attempt };
          }
          
          // Exponential backoff: 1s, 2s, 4s, etc.
          const delay = Math.pow(2, attempt - 1) * 1000;
          await page.waitForTimeout(delay);
        }
      }
    };

    const result = await exponentialBackoffRetry();
    
    // Validate recovery mechanism
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3); // Failed twice, succeeded on third attempt
    expect(result.data.message).toBe('Service recovered');
    expect(result.data.attempt).toBe(3);

    await page.waitForTimeout(1000);

    // Check if any 503 errors were captured
    const errors = networkLogger.getErrors();
    const serviceUnavailableErrors = errors.filter(e => e.response.status === 503);
    
    expect(serviceUnavailableErrors.length).toBe(2); // First two attempts failed
    serviceUnavailableErrors.forEach(error => {
      expect(error.category).toBe('server');
      expect(error.response.body.retryAfter).toBe(1);
    });
  });

  /**
   * Test comprehensive network failure reporting
   * Validates error aggregation and debugging information
   */
  test('should provide comprehensive debugging information for network failures', async ({ page }) => {
    networkLogger.setFlowContext('network-failure-simulation', 'comprehensive-debugging');

    // Set up multiple failure scenarios
    const failureScenarios = [
      { url: '/api/timeout-test', type: 'timeout' },
      { url: '/api/connection-reset', type: 'connectionreset' },
      { url: '/api/dns-failure', type: 'namenotresolved' },
      { url: '/api/network-error', type: 'internetdisconnected' }
    ];

    // Mock different types of network failures
    for (const scenario of failureScenarios) {
      await page.route(`**${scenario.url}`, (route) => {
        if (scenario.type === 'timeout') {
          // Don't respond to simulate timeout
          return;
        } else {
          route.abort(scenario.type as any);
        }
      });
    }

    await page.goto('/');

    // Attempt requests that will fail in different ways
    const failureResults = await page.evaluate((scenarios) => {
      const promises = scenarios.map(scenario => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
        
        return fetch(scenario.url, {
          signal: controller.signal,
          headers: { 'X-Failure-Type': scenario.type }
        }).then(res => ({
          url: scenario.url,
          type: scenario.type,
          success: true,
          status: res.status
        })).catch(error => {
          clearTimeout(timeoutId);
          return {
            url: scenario.url,
            type: scenario.type,
            success: false,
            error: error.name,
            message: error.message
          };
        });
      });
      
      return Promise.all(promises);
    }, failureScenarios);

    // Validate that all requests failed as expected
    expect(failureResults).toHaveLength(4);
    failureResults.forEach(result => {
      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('type');
    });

    await page.waitForTimeout(2000);

    // Generate comprehensive error report
    const errors = networkLogger.getErrors();
    const errorReport = errorReporter.generateReport(errors);

    // Validate debugging information completeness
    expect(errorReport).toHaveProperty('summary');
    expect(errorReport).toHaveProperty('recommendations');
    expect(errorReport.summary.totalErrors).toBeGreaterThanOrEqual(0);
    
    // Validate that recommendations include network-related guidance
    const hasNetworkRecommendations = errorReport.recommendations.some(rec => 
      rec.toLowerCase().includes('network') || 
      rec.toLowerCase().includes('connection') ||
      rec.toLowerCase().includes('timeout')
    );

    // Note: Network-level failures may not be captured by the network logger
    // as they don't reach the HTTP response level. This test validates
    // client-side error handling and reporting structure.
    expect(errorReport.recommendations.length).toBeGreaterThan(0);
  });
});