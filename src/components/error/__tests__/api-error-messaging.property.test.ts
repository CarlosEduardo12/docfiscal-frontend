/**
 * Property-based tests for API error messaging
 * **Feature: frontend-issues-resolution, Property 16: API errors display user-friendly messages**
 * **Validates: Requirements 5.2**
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
  NetworkError,
  AuthenticationError,
  ValidationError,
  UploadError,
  PaymentError,
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

// Generators for test data
const apiErrorCodeGenerator = fc.oneof(
  fc.constant('NETWORK_ERROR'),
  fc.constant('UNAUTHORIZED'),
  fc.constant('FORBIDDEN'),
  fc.constant('NOT_FOUND'),
  fc.constant('VALIDATION_ERROR'),
  fc.constant('SERVER_ERROR'),
  fc.constant('TIMEOUT'),
  fc.constant('BAD_REQUEST'),
  fc.constant('CONFLICT'),
  fc.constant('INTERNAL_SERVER_ERROR')
);

const httpStatusCodeGenerator = fc.oneof(
  fc.constant(400), // Bad Request
  fc.constant(401), // Unauthorized
  fc.constant(403), // Forbidden
  fc.constant(404), // Not Found
  fc.constant(409), // Conflict
  fc.constant(422), // Unprocessable Entity
  fc.constant(429), // Too Many Requests
  fc.constant(500), // Internal Server Error
  fc.constant(502), // Bad Gateway
  fc.constant(503), // Service Unavailable
  fc.constant(504)  // Gateway Timeout
);

const technicalErrorMessageGenerator = fc.oneof(
  fc.constant('ERR_NETWORK'),
  fc.constant('ECONNREFUSED'),
  fc.constant('ETIMEDOUT'),
  fc.constant('fetch failed'),
  fc.constant('Request timeout'),
  fc.constant('Internal server error'),
  fc.constant('Database connection failed'),
  fc.constant('Invalid JSON response'),
  fc.constant('Unexpected token in JSON'),
  fc.constant('TypeError: Cannot read property'),
  fc.constant('ReferenceError: variable is not defined')
);

const apiResponseGenerator = fc.record({
  status: httpStatusCodeGenerator,
  statusText: fc.string({ minLength: 1, maxLength: 50 }),
  data: fc.record({
    error: fc.record({
      code: apiErrorCodeGenerator,
      message: technicalErrorMessageGenerator,
      details: fc.oneof(fc.string(), fc.record({ field: fc.string() }))
    })
  })
});

describe('API Error Messaging Property Tests', () => {
  describe('Property 16: API errors display user-friendly messages', () => {
    it('should convert any technical error message to user-friendly message', () => {
      fc.assert(
        fc.property(
          technicalErrorMessageGenerator,
          (technicalMessage) => {
            // Create an error from technical message
            const error = new Error(technicalMessage);
            const classifiedError = classifyError(error);
            const userFriendlyMessage = getUserFriendlyMessage(classifiedError);

            // Property: User-friendly message should not contain technical jargon
            expect(userFriendlyMessage).not.toMatch(/ERR_/);
            expect(userFriendlyMessage).not.toMatch(/ECONN/);
            expect(userFriendlyMessage).not.toMatch(/ETIMEDOUT/);
            expect(userFriendlyMessage).not.toMatch(/TypeError/);
            expect(userFriendlyMessage).not.toMatch(/ReferenceError/);
            expect(userFriendlyMessage).not.toMatch(/JSON/);
            expect(userFriendlyMessage).not.toMatch(/fetch failed/);
            expect(userFriendlyMessage).not.toMatch(/Database/);

            // Property: User-friendly message should be helpful and actionable
            expect(userFriendlyMessage.length).toBeGreaterThan(10);
            expect(userFriendlyMessage).toMatch(/[.!]/); // Should end with punctuation
            
            // Should contain helpful words
            const helpfulWords = ['try', 'check', 'please', 'again', 'connection', 'login', 'contact', 'support'];
            const containsHelpfulWord = helpfulWords.some(word => 
              userFriendlyMessage.toLowerCase().includes(word)
            );
            expect(containsHelpfulWord).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should categorize API errors correctly and provide appropriate messages', () => {
      fc.assert(
        fc.property(
          apiResponseGenerator,
          (apiResponse) => {
            // Simulate API error based on status code
            let error: AppError;
            
            switch (apiResponse.status) {
              case 401:
                error = new AuthenticationError('Unauthorized access');
                break;
              case 403:
                error = new AuthenticationError('Forbidden access');
                break;
              case 400:
              case 422:
                error = new ValidationError('Validation failed');
                break;
              case 404:
                error = new AppError('Not found', ErrorType.NOT_FOUND);
                break;
              case 429:
              case 502:
              case 503:
              case 504:
                error = new NetworkError('Network error');
                break;
              default:
                error = new AppError('Server error', ErrorType.SERVER);
            }

            const userFriendlyMessage = getUserFriendlyMessage(error);

            // Property: Message should match error type appropriately
            switch (error.type) {
              case ErrorType.AUTHENTICATION:
                expect(userFriendlyMessage.toLowerCase()).toMatch(/log.*in|session|permission/);
                break;
              case ErrorType.VALIDATION:
                expect(userFriendlyMessage.toLowerCase()).toMatch(/check.*input|try.*again/);
                break;
              case ErrorType.NOT_FOUND:
                expect(userFriendlyMessage.toLowerCase()).toMatch(/not.*found|resource/);
                break;
              case ErrorType.NETWORK:
                expect(userFriendlyMessage.toLowerCase()).toMatch(/connection|internet|network/);
                break;
              case ErrorType.SERVER:
                expect(userFriendlyMessage.toLowerCase()).toMatch(/server|try.*later/);
                break;
            }

            // Property: All messages should be user-friendly
            expect(userFriendlyMessage).not.toMatch(/\d{3}/); // No HTTP status codes
            expect(userFriendlyMessage).not.toMatch(/[A-Z_]{3,}/); // No technical constants
            expect(userFriendlyMessage.length).toBeGreaterThan(15);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle network-specific errors with appropriate messaging', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('fetch failed'),
            fc.constant('network error'),
            fc.constant('timeout'),
            fc.constant('connection refused'),
            fc.constant('ERR_NETWORK'),
            fc.constant('ECONNREFUSED'),
            fc.constant('ETIMEDOUT')
          ),
          (networkErrorMessage) => {
            const error = new Error(networkErrorMessage);
            const classifiedError = classifyError(error);
            const userFriendlyMessage = getUserFriendlyMessage(classifiedError);

            // Property: Network errors should provide connection-related guidance
            expect(classifiedError.type).toBe(ErrorType.NETWORK);
            expect(userFriendlyMessage.toLowerCase()).toMatch(/connection|internet|network/);
            expect(userFriendlyMessage.toLowerCase()).toMatch(/check|try.*again/);
            
            // Should not contain technical error codes
            expect(userFriendlyMessage).not.toMatch(/ERR_/);
            expect(userFriendlyMessage).not.toMatch(/ECONN/);
            expect(userFriendlyMessage).not.toMatch(/ETIMEDOUT/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle authentication errors with login guidance', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('unauthorized'),
            fc.constant('authentication failed'),
            fc.constant('login required'),
            fc.constant('invalid token'),
            fc.constant('session expired')
          ),
          (authErrorMessage) => {
            const error = new Error(authErrorMessage);
            const classifiedError = classifyError(error);
            const userFriendlyMessage = getUserFriendlyMessage(classifiedError);

            // Property: Authentication errors should guide users to login
            expect(classifiedError.type).toBe(ErrorType.AUTHENTICATION);
            expect(userFriendlyMessage.toLowerCase()).toMatch(/log.*in|session|authentication/);
            
            // Should be actionable
            expect(userFriendlyMessage.toLowerCase()).toMatch(/please|try|continue/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle validation errors with input guidance', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('validation failed'),
            fc.constant('invalid input'),
            fc.constant('required field missing'),
            fc.constant('format error'),
            fc.constant('invalid email')
          ),
          (validationErrorMessage) => {
            const error = new Error(validationErrorMessage);
            const classifiedError = classifyError(error);
            const userFriendlyMessage = getUserFriendlyMessage(classifiedError);

            // Property: Validation errors should guide users to check input
            expect(classifiedError.type).toBe(ErrorType.VALIDATION);
            expect(userFriendlyMessage.toLowerCase()).toMatch(/check.*input|try.*again|input/);
            
            // Should be helpful
            expect(userFriendlyMessage.toLowerCase()).toMatch(/please/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle upload errors with file-specific guidance', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('file too large'),
            fc.constant('invalid file type'),
            fc.constant('upload failed'),
            fc.constant('file corrupted'),
            fc.constant('size limit exceeded')
          ),
          (uploadErrorMessage) => {
            const error = new Error(uploadErrorMessage);
            const classifiedError = classifyError(error);
            const userFriendlyMessage = getUserFriendlyMessage(classifiedError);

            // Property: Upload errors should provide file-specific guidance
            expect(classifiedError.type).toBe(ErrorType.UPLOAD);
            expect(userFriendlyMessage.toLowerCase()).toMatch(/file|upload|check.*file|try.*again/);
            
            // Should be actionable
            expect(userFriendlyMessage.toLowerCase()).toMatch(/please|try|check/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle payment errors with payment-specific guidance', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('payment failed'),
            fc.constant('transaction declined'),
            fc.constant('mercadopago error'),
            fc.constant('payment timeout'),
            fc.constant('insufficient funds')
          ),
          (paymentErrorMessage) => {
            const error = new Error(paymentErrorMessage);
            const classifiedError = classifyError(error);
            const userFriendlyMessage = getUserFriendlyMessage(classifiedError);

            // Property: Payment errors should provide payment-specific guidance
            expect(classifiedError.type).toBe(ErrorType.PAYMENT);
            expect(userFriendlyMessage.toLowerCase()).toMatch(/payment|try.*again|contact.*support/);
            
            // Should be helpful
            expect(userFriendlyMessage.toLowerCase()).toMatch(/please|try|contact/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide fallback messages for unknown errors', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => 
            !s.includes('network') && 
            !s.includes('auth') && 
            !s.includes('valid') && 
            !s.includes('upload') && 
            !s.includes('payment') &&
            !s.includes('fetch') &&
            !s.includes('timeout')
          ),
          (unknownErrorMessage) => {
            const error = new Error(unknownErrorMessage);
            const classifiedError = classifyError(error);
            const userFriendlyMessage = getUserFriendlyMessage(classifiedError);

            // Property: Unknown errors should have generic but helpful messages
            expect(classifiedError.type).toBe(ErrorType.UNKNOWN);
            expect(userFriendlyMessage).toBeTruthy();
            expect(userFriendlyMessage.length).toBeGreaterThan(10);
            expect(userFriendlyMessage.toLowerCase()).toMatch(/try.*again|unexpected|error/);
            
            // Should not expose the original technical message
            expect(userFriendlyMessage).not.toBe(unknownErrorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});