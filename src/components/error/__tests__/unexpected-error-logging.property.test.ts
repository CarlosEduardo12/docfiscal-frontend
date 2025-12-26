/**
 * Property-based tests for unexpected error logging
 * **Feature: frontend-issues-resolution, Property 18: Unexpected errors are logged with user-friendly display**
 * **Validates: Requirements 5.4**
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
  classifyError,
  getUserFriendlyMessage,
  logError,
} from '@/lib/error-handling';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Mock console methods to capture logging
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

let consoleErrorSpy: jest.MockedFunction<typeof console.error>;
let consoleWarnSpy: jest.MockedFunction<typeof console.warn>;
let consoleInfoSpy: jest.MockedFunction<typeof console.info>;

beforeEach(() => {
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  // Mock console methods and capture calls
  consoleErrorSpy = jest.fn();
  consoleWarnSpy = jest.fn();
  consoleInfoSpy = jest.fn();
  
  console.error = consoleErrorSpy;
  console.warn = consoleWarnSpy;
  console.info = consoleInfoSpy;

  localStorageMock.clear();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.info = originalConsoleInfo;
  localStorageMock.clear();
});

// Generators for test data
const unexpectedErrorGenerator = fc.oneof(
  fc.record({
    type: fc.constant('TypeError'),
    message: fc.string({ minLength: 1, maxLength: 100 }),
    stack: fc.string({ minLength: 10, maxLength: 500 })
  }),
  fc.record({
    type: fc.constant('ReferenceError'),
    message: fc.string({ minLength: 1, maxLength: 100 }),
    stack: fc.string({ minLength: 10, maxLength: 500 })
  }),
  fc.record({
    type: fc.constant('SyntaxError'),
    message: fc.string({ minLength: 1, maxLength: 100 }),
    stack: fc.string({ minLength: 10, maxLength: 500 })
  }),
  fc.record({
    type: fc.constant('RangeError'),
    message: fc.string({ minLength: 1, maxLength: 100 }),
    stack: fc.string({ minLength: 10, maxLength: 500 })
  })
);

const contextGenerator = fc.record({
  component: fc.string({ minLength: 1, maxLength: 50 }),
  action: fc.string({ minLength: 1, maxLength: 50 }),
  userId: fc.oneof(fc.string(), fc.constant(null)),
  sessionId: fc.string({ minLength: 10, maxLength: 50 }),
  timestamp: fc.date(),
  additionalData: fc.record({
    url: fc.webUrl(),
    userAgent: fc.string({ minLength: 10, maxLength: 200 })
  })
});

describe('Unexpected Error Logging Property Tests', () => {
  describe('Property 18: Unexpected errors are logged with user-friendly display', () => {
    it('should log unexpected errors with detailed information for debugging', () => {
      fc.assert(
        fc.property(
          unexpectedErrorGenerator,
          contextGenerator,
          (errorData, context) => {
            // Create an unexpected error
            let error: Error;
            switch (errorData.type) {
              case 'TypeError':
                error = new TypeError(errorData.message);
                break;
              case 'ReferenceError':
                error = new ReferenceError(errorData.message);
                break;
              case 'SyntaxError':
                error = new SyntaxError(errorData.message);
                break;
              case 'RangeError':
                error = new RangeError(errorData.message);
                break;
              default:
                error = new Error(errorData.message);
            }

            // Set stack trace
            error.stack = errorData.stack;

            // Classify and log the error
            const classifiedError = classifyError(error);
            logError(classifiedError, context.component);

            // Property: Error should be logged to localStorage with detailed information
            const storedLogs = JSON.parse(
              localStorageMock.getItem('docfiscal-error-logs') || '[]'
            );

            expect(storedLogs.length).toBeGreaterThan(0);
            
            const latestLog = storedLogs[storedLogs.length - 1];
            expect(latestLog).toMatchObject({
              errorId: expect.stringMatching(/^[a-z]+-\d+-[a-z0-9]+$/),
              type: expect.any(String),
              severity: expect.any(String),
              message: errorData.message,
              context: context.component,
              timestamp: expect.any(String),
              stack: errorData.stack,
              url: expect.any(String),
              userAgent: expect.any(String)
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should display user-friendly messages while hiding technical details', () => {
      fc.assert(
        fc.property(
          unexpectedErrorGenerator,
          (errorData) => {
            // Create an unexpected error with technical details
            const error = new Error(errorData.message);
            error.stack = errorData.stack;

            const classifiedError = classifyError(error);
            const userFriendlyMessage = getUserFriendlyMessage(classifiedError);

            // Property: User-friendly message should not expose technical details
            expect(userFriendlyMessage).not.toContain(errorData.stack);
            expect(userFriendlyMessage).not.toContain('TypeError');
            expect(userFriendlyMessage).not.toContain('ReferenceError');
            expect(userFriendlyMessage).not.toContain('SyntaxError');
            expect(userFriendlyMessage).not.toContain('RangeError');
            expect(userFriendlyMessage).not.toMatch(/at\s+\w+\s+\(/); // Stack trace pattern

            // Property: Should provide generic but helpful message
            expect(userFriendlyMessage.length).toBeGreaterThan(10);
            expect(userFriendlyMessage.toLowerCase()).toMatch(
              /unexpected|error|try.*again|refresh/
            );

            // Should be user-friendly and actionable
            expect(userFriendlyMessage).toMatch(/[.!]/); // Should end with punctuation
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log errors with appropriate severity levels', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.record({
              errorType: fc.constant(ErrorType.UNKNOWN),
              expectedSeverity: fc.constant(ErrorSeverity.MEDIUM),
              shouldLogError: fc.constant(true)
            }),
            fc.record({
              errorType: fc.constant(ErrorType.CLIENT),
              expectedSeverity: fc.constant(ErrorSeverity.MEDIUM),
              shouldLogError: fc.constant(true)
            }),
            fc.record({
              errorType: fc.constant(ErrorType.SERVER),
              expectedSeverity: fc.constant(ErrorSeverity.HIGH),
              shouldLogError: fc.constant(true)
            })
          ),
          fc.string({ minLength: 1, maxLength: 100 }),
          (errorConfig, errorMessage) => {
            // Clear previous console calls
            consoleErrorSpy.mockClear();
            consoleWarnSpy.mockClear();
            consoleInfoSpy.mockClear();

            const appError = new AppError(
              errorMessage,
              errorConfig.errorType,
              errorConfig.expectedSeverity
            );

            logError(appError, 'test-context');

            // Property: Should log with appropriate console method based on severity
            switch (errorConfig.expectedSeverity) {
              case ErrorSeverity.CRITICAL:
              case ErrorSeverity.HIGH:
                expect(consoleErrorSpy).toHaveBeenCalled();
                break;
              case ErrorSeverity.MEDIUM:
                expect(consoleWarnSpy).toHaveBeenCalled();
                break;
              case ErrorSeverity.LOW:
                expect(consoleInfoSpy).toHaveBeenCalled();
                break;
            }

            // Property: Should include error details in log
            const logCalls = [
              ...consoleErrorSpy.mock.calls,
              ...consoleWarnSpy.mock.calls,
              ...consoleInfoSpy.mock.calls
            ];

            expect(logCalls.length).toBeGreaterThan(0);
            
            const logCall = logCalls[0];
            expect(logCall[1]).toMatchObject({
              errorId: expect.stringMatching(/^[a-z]+-\d+-[a-z0-9]+$/),
              type: errorConfig.errorType,
              severity: errorConfig.expectedSeverity,
              message: errorMessage,
              context: 'test-context'
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain error log history with size limits', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.string({ minLength: 1, maxLength: 50 }),
            { minLength: 55, maxLength: 60 } // More than the 50 limit
          ),
          (errorMessages) => {
            // Clear storage
            localStorageMock.clear();

            // Log multiple errors
            errorMessages.forEach((message, index) => {
              const error = new AppError(message, ErrorType.UNKNOWN);
              logError(error, `context-${index}`);
            });

            // Property: Should maintain only the last 50 errors
            const storedLogs = JSON.parse(
              localStorageMock.getItem('docfiscal-error-logs') || '[]'
            );

            expect(storedLogs.length).toBeLessThanOrEqual(50);

            // Should keep the most recent errors
            if (errorMessages.length > 50) {
              const expectedMessages = errorMessages.slice(-50);
              const actualMessages = storedLogs.map((log: any) => log.message);
              expect(actualMessages).toEqual(expectedMessages);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle logging failures gracefully', () => {
      fc.assert(
        fc.property(
          unexpectedErrorGenerator,
          (errorData) => {
            // Mock localStorage to throw an error
            const originalSetItem = localStorageMock.setItem;
            localStorageMock.setItem = jest.fn().mockImplementation(() => {
              throw new Error('Storage quota exceeded');
            });

            const error = new Error(errorData.message);
            const classifiedError = classifyError(error);

            // Property: Should not throw when logging fails
            expect(() => {
              logError(classifiedError, 'test-context');
            }).not.toThrow();

            // Should still log to console even if localStorage fails
            expect(consoleWarnSpy).toHaveBeenCalledWith(
              'Failed to store error log:',
              expect.any(Error)
            );

            // Restore original setItem
            localStorageMock.setItem = originalSetItem;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include contextual information in error logs', () => {
      fc.assert(
        fc.property(
          unexpectedErrorGenerator,
          contextGenerator,
          (errorData, context) => {
            const error = new Error(errorData.message);
            const classifiedError = classifyError(error);
            
            // Add additional context to the error
            const errorWithContext = new AppError(
              errorData.message,
              ErrorType.UNKNOWN,
              ErrorSeverity.MEDIUM,
              {
                component: context.component,
                action: context.action,
                userId: context.userId,
                sessionId: context.sessionId,
                additionalData: context.additionalData
              }
            );

            logError(errorWithContext, context.component);

            // Property: Should include all contextual information in logs
            const storedLogs = JSON.parse(
              localStorageMock.getItem('docfiscal-error-logs') || '[]'
            );

            const latestLog = storedLogs[storedLogs.length - 1];
            expect(latestLog.additionalContext).toMatchObject({
              component: context.component,
              action: context.action,
              userId: context.userId,
              sessionId: context.sessionId,
              additionalData: context.additionalData
            });

            expect(latestLog.context).toBe(context.component);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique error IDs for tracking', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.string({ minLength: 1, maxLength: 50 }),
            { minLength: 10, maxLength: 20 }
          ),
          (errorMessages) => {
            localStorageMock.clear();
            const errorIds: string[] = [];

            // Log multiple errors and collect IDs
            errorMessages.forEach((message) => {
              const error = new AppError(message, ErrorType.UNKNOWN);
              logError(error, 'test-context');
              errorIds.push(error.errorId);
            });

            // Property: All error IDs should be unique
            const uniqueIds = new Set(errorIds);
            expect(uniqueIds.size).toBe(errorIds.length);

            // Property: Error IDs should follow expected format
            errorIds.forEach((id) => {
              expect(id).toMatch(/^[a-z]+-\d+-[a-z0-9]+$/);
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preserve error stack traces for debugging while hiding from users', () => {
      fc.assert(
        fc.property(
          unexpectedErrorGenerator,
          (errorData) => {
            const error = new Error(errorData.message);
            error.stack = errorData.stack;

            const classifiedError = classifyError(error);
            logError(classifiedError, 'test-context');

            // Property: Stack trace should be preserved in logs for debugging
            const storedLogs = JSON.parse(
              localStorageMock.getItem('docfiscal-error-logs') || '[]'
            );

            const latestLog = storedLogs[storedLogs.length - 1];
            expect(latestLog.stack).toBe(errorData.stack);

            // Property: But user-friendly message should not contain stack trace
            const userFriendlyMessage = getUserFriendlyMessage(classifiedError);
            expect(userFriendlyMessage).not.toContain(errorData.stack);
            expect(userFriendlyMessage).not.toMatch(/at\s+\w+\s+\(/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});