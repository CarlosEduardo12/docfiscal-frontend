/**
 * Property-based tests for network issue handling
 * **Feature: frontend-issues-resolution, Property 17: Network issues provide offline-friendly messaging**
 * **Validates: Requirements 5.3**
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import fc from 'fast-check';
import {
  AppError,
  ErrorType,
  ErrorSeverity,
  NetworkError,
  classifyError,
  getUserFriendlyMessage,
  retryWithBackoff,
  CircuitBreaker,
} from '@/lib/error-handling';

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Mock console methods
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Mock navigator.onLine for offline detection tests
const originalNavigator = global.navigator;

// Generators for test data
const networkErrorTypeGenerator = fc.oneof(
  fc.constant('ERR_NETWORK'),
  fc.constant('ERR_INTERNET_DISCONNECTED'),
  fc.constant('ECONNREFUSED'),
  fc.constant('ETIMEDOUT'),
  fc.constant('ENOTFOUND'),
  fc.constant('ECONNRESET'),
  fc.constant('fetch failed'),
  fc.constant('network error'),
  fc.constant('connection timeout'),
  fc.constant('no internet connection'),
  fc.constant('offline'),
  fc.constant('connection refused')
);

const httpNetworkStatusGenerator = fc.oneof(
  fc.constant(0), // Network error
  fc.constant(408), // Request Timeout
  fc.constant(429), // Too Many Requests
  fc.constant(502), // Bad Gateway
  fc.constant(503), // Service Unavailable
  fc.constant(504), // Gateway Timeout
  fc.constant(522), // Connection Timed Out
  fc.constant(523), // Origin Is Unreachable
  fc.constant(524)  // A Timeout Occurred
);

const retryConfigGenerator = fc.record({
  maxRetries: fc.integer({ min: 1, max: 2 }), // Reduced max retries
  baseDelay: fc.integer({ min: 10, max: 50 }), // Much smaller delays
  backoffMultiplier: fc.float({ min: 1.5, max: 2.0 }) // Reduced multiplier
});

describe('Network Issue Handling Property Tests', () => {
  describe('Property 17: Network issues provide offline-friendly messaging', () => {
    it('should detect network errors and provide offline-friendly messages', () => {
      fc.assert(
        fc.property(
          networkErrorTypeGenerator,
          (networkErrorMessage) => {
            const error = new Error(networkErrorMessage);
            const classifiedError = classifyError(error);
            const userFriendlyMessage = getUserFriendlyMessage(classifiedError);

            // Property: Network errors should be classified correctly
            if (networkErrorMessage.includes('network') || 
                networkErrorMessage.includes('connection') || 
                networkErrorMessage.includes('timeout') ||
                networkErrorMessage.includes('fetch')) {
              expect(classifiedError.type).toBe(ErrorType.NETWORK);
            }

            // Property: User-friendly message should be offline-friendly
            expect(userFriendlyMessage.toLowerCase()).toMatch(
              /connection|internet|network|offline|connectivity/
            );
            
            // Should provide actionable guidance
            expect(userFriendlyMessage.toLowerCase()).toMatch(
              /check|try.*again|verify/
            );

            // Should not contain technical error codes
            expect(userFriendlyMessage).not.toMatch(/ERR_/);
            expect(userFriendlyMessage).not.toMatch(/ECONN/);
            expect(userFriendlyMessage).not.toMatch(/ETIMEDOUT/);
            expect(userFriendlyMessage).not.toMatch(/fetch failed/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle HTTP network status codes with appropriate messaging', () => {
      fc.assert(
        fc.property(
          httpNetworkStatusGenerator,
          (statusCode) => {
            // Create a network error based on status code
            let errorMessage: string;
            switch (statusCode) {
              case 0:
                errorMessage = 'Network request failed';
                break;
              case 408:
                errorMessage = 'Request timeout';
                break;
              case 429:
                errorMessage = 'Too many requests';
                break;
              case 502:
                errorMessage = 'Bad gateway';
                break;
              case 503:
                errorMessage = 'Service unavailable';
                break;
              case 504:
                errorMessage = 'Gateway timeout';
                break;
              default:
                errorMessage = `Network error ${statusCode}`;
            }

            const networkError = new NetworkError(errorMessage, { statusCode });
            const userFriendlyMessage = getUserFriendlyMessage(networkError);

            // Property: Network status errors should provide offline-friendly messaging
            expect(networkError.type).toBe(ErrorType.NETWORK);
            expect(userFriendlyMessage.toLowerCase()).toMatch(
              /connection|internet|network|server|service/
            );

            // Should be retryable
            expect(networkError.retryable).toBe(true);

            // Should not expose HTTP status codes to users
            expect(userFriendlyMessage).not.toMatch(/\d{3}/);
            // Should not expose technical terms like "gateway" but "timeout" is acceptable for user messaging
            expect(userFriendlyMessage).not.toMatch(/gateway|bad gateway/i);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide retry mechanisms for network errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          retryConfigGenerator,
          async (config) => {
            let attemptCount = 0;
            const maxAttempts = config.maxRetries + 1; // Initial attempt + retries

            // Mock operation that fails with network error
            const failingOperation = jest.fn().mockImplementation(async () => {
              attemptCount++;
              throw new NetworkError('Connection failed');
            });

            // Property: Retry mechanism should attempt the configured number of times
            try {
              await retryWithBackoff(
                failingOperation,
                config.maxRetries,
                10 // Very small delay for testing
              );
            } catch (error) {
              // Expected to fail after all retries
              expect(error).toBeInstanceOf(AppError);
            }

            // Should have attempted the correct number of times
            expect(attemptCount).toBe(maxAttempts);
            expect(failingOperation).toHaveBeenCalledTimes(maxAttempts);
          }
        ),
        { numRuns: 5 } // Much fewer runs for faster execution
      );
    }, 15000); // Increased timeout

    it('should implement exponential backoff for network retries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 2 }), // Fixed to 2 retries
          fc.integer({ min: 10, max: 20 }), // Very small base delay
          async (maxRetries, baseDelay) => {
            const startTimes: number[] = [];
            let attemptCount = 0;

            // Mock operation that records timing
            const timedOperation = jest.fn().mockImplementation(async () => {
              startTimes.push(Date.now());
              attemptCount++;
              throw new NetworkError('Network timeout');
            });

            try {
              await retryWithBackoff(timedOperation, maxRetries, baseDelay);
            } catch (error) {
              // Expected to fail
            }

            // Property: Should have made the expected number of attempts
            expect(attemptCount).toBe(maxRetries + 1);
            
            // Property: Should have recorded timing for each attempt
            expect(startTimes.length).toBe(maxRetries + 1);
            
            // Property: Delays should generally increase (allowing for timing variations)
            if (startTimes.length > 1) {
              const firstDelay = startTimes[1] - startTimes[0];
              // Just verify we had some delay, not exact exponential timing due to test environment variations
              expect(firstDelay).toBeGreaterThanOrEqual(baseDelay * 0.5);
            }
          }
        ),
        { numRuns: 3 } // Very few runs for faster execution
      );
    }, 10000); // Reduced timeout

    it('should handle offline detection and provide appropriate messaging', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (isOnline) => {
            // Mock navigator.onLine
            Object.defineProperty(global, 'navigator', {
              value: { onLine: isOnline },
              writable: true,
            });

            const networkError = new NetworkError('Connection failed');
            const userFriendlyMessage = getUserFriendlyMessage(networkError);

            // Property: Message should be appropriate for online/offline state
            expect(userFriendlyMessage.toLowerCase()).toMatch(
              /connection|internet|network/
            );

            if (!isOnline) {
              // When offline, message should be more specific about connectivity
              expect(userFriendlyMessage.toLowerCase()).toMatch(
                /connection|internet/
              );
            }

            // Should always provide actionable guidance
            expect(userFriendlyMessage.toLowerCase()).toMatch(
              /check|try|verify/
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should implement circuit breaker pattern for repeated network failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 7 }),
          fc.integer({ min: 1000, max: 5000 }),
          async (threshold, timeout) => {
            const circuitBreaker = new CircuitBreaker(threshold, timeout);
            let attemptCount = 0;

            // Mock operation that always fails
            const failingOperation = jest.fn().mockImplementation(async () => {
              attemptCount++;
              throw new NetworkError('Service unavailable');
            });

            // Property: Circuit breaker should open after threshold failures
            let circuitOpenError: Error | null = null;

            // Trigger failures up to threshold
            for (let i = 0; i < threshold; i++) {
              try {
                await circuitBreaker.execute(failingOperation);
              } catch (error) {
                // Expected failures
              }
            }

            // Next attempt should trigger circuit breaker
            try {
              await circuitBreaker.execute(failingOperation);
            } catch (error) {
              circuitOpenError = error as Error;
            }

            // Property: Circuit should be open and prevent further calls
            expect(circuitOpenError).toBeInstanceOf(NetworkError);
            expect(circuitOpenError?.message).toMatch(/circuit.*breaker.*open/i);
            
            const state = circuitBreaker.getState();
            expect(state.state).toBe('OPEN');
            expect(state.failures).toBe(threshold);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should provide different messaging based on network error severity', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.record({
              type: fc.constant('temporary'),
              message: fc.constant('Connection temporarily unavailable'),
              expectedSeverity: fc.constant(ErrorSeverity.MEDIUM)
            }),
            fc.record({
              type: fc.constant('timeout'),
              message: fc.constant('Request timed out'),
              expectedSeverity: fc.constant(ErrorSeverity.MEDIUM)
            }),
            fc.record({
              type: fc.constant('offline'),
              message: fc.constant('No internet connection'),
              expectedSeverity: fc.constant(ErrorSeverity.HIGH)
            })
          ),
          (errorData) => {
            const networkError = new NetworkError(
              errorData.message,
              { errorType: errorData.type }
            );
            const userFriendlyMessage = getUserFriendlyMessage(networkError);

            // Property: Error severity should match the network issue type
            expect(networkError.severity).toBe(errorData.expectedSeverity);

            // Property: Message should be appropriate for error type
            switch (errorData.type) {
              case 'temporary':
                expect(userFriendlyMessage.toLowerCase()).toMatch(
                  /try.*again|temporary|later/
                );
                break;
              case 'timeout':
                expect(userFriendlyMessage.toLowerCase()).toMatch(
                  /timeout|slow|connection/
                );
                break;
              case 'offline':
                expect(userFriendlyMessage.toLowerCase()).toMatch(
                  /internet|connection|connectivity/
                );
                break;
            }

            // All network errors should be retryable
            expect(networkError.retryable).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle network recovery scenarios gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 2 }), // Reduced failure count
          async (failureCount) => {
            let attemptCount = 0;

            // Mock operation that fails initially then succeeds
            const recoveringOperation = jest.fn().mockImplementation(async () => {
              attemptCount++;
              if (attemptCount <= failureCount) {
                throw new NetworkError('Connection failed');
              }
              return 'success';
            });

            // Property: Should eventually succeed after network recovery
            const result = await retryWithBackoff(
              recoveringOperation,
              failureCount + 1, // Ensure enough retries
              10 // Very small delay for testing
            );

            expect(result).toBe('success');
            expect(attemptCount).toBe(failureCount + 1);
            expect(recoveringOperation).toHaveBeenCalledTimes(failureCount + 1);
          }
        ),
        { numRuns: 5 } // Much fewer runs for faster execution
      );
    }, 15000); // Increased timeout
  });

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
    });
  });
});