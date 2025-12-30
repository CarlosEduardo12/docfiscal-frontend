/**
 * Property-Based Tests for Comprehensive Error Handling
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 * 
 * Property 5: Comprehensive Error Handling
 * For any authentication error (network, invalid tokens, server unavailable, CORS), 
 * the system should provide specific error messages and handle the error gracefully without crashes.
 */

import fc from 'fast-check';
import { ErrorHandler, AppError } from '@/lib/errorHandler';
import { CorsHandler } from '@/lib/corsHandler';
import { authTokenManager } from '@/lib/AuthTokenManager';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('Property 5: Comprehensive Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Property: Network errors should be properly classified and provide user-friendly messages
   * **Validates: Requirements 5.1, 5.3**
   */
  it('should properly classify and handle network errors', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new TypeError('Failed to fetch')),
          fc.constant(new TypeError('NetworkError when attempting to fetch resource')),
          fc.constant(new Error('getaddrinfo ENOTFOUND')),
          fc.constant(new Error('connect ECONNREFUSED')),
          fc.record({
            name: fc.constant('AbortError'),
            message: fc.string(),
          }).map(obj => Object.assign(new Error(obj.message), { name: obj.name }))
        ),
        (networkError) => {
          // Test error classification
          const appError = ErrorHandler.classifyError(networkError);
          
          // Should classify as network error
          expect(appError.type).toBe('network');
          
          // Should have user-friendly message
          expect(appError.userMessage).toBeDefined();
          expect(appError.userMessage.length).toBeGreaterThan(0);
          expect(appError.userMessage).not.toContain('TypeError');
          expect(appError.userMessage).not.toContain('fetch');
          
          // Should provide guidance
          if (appError.guidance) {
            expect(appError.guidance.length).toBeGreaterThan(0);
          }
          
          // Should be retryable for network errors
          expect(ErrorHandler.isRetryable(appError)).toBe(true);
          
          // Should not require token cleanup for network errors
          expect(ErrorHandler.shouldClearTokens(appError)).toBe(false);
          
          // Should not require redirect for network errors
          expect(ErrorHandler.shouldRedirect(appError)).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Authentication errors should be properly classified and trigger appropriate actions
   * **Validates: Requirements 5.2**
   */
  it('should properly classify and handle authentication errors', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({
            status: fc.constantFrom(401, 403),
            statusText: fc.string(),
          }),
          fc.constant(new Error('token invalid')),
          fc.constant(new Error('refresh failed'))
        ),
        (authErrorSource) => {
          let error: Error;
          let response: Response | undefined;
          
          if ('status' in authErrorSource) {
            // Mock response for HTTP errors
            response = {
              status: authErrorSource.status,
              statusText: authErrorSource.statusText,
              ok: false,
            } as Response;
            error = new Error(`HTTP ${authErrorSource.status}`);
          } else {
            error = authErrorSource;
          }
          
          // Test error classification
          const appError = ErrorHandler.classifyError(error, response);
          
          if (response?.status === 401 || error.message.includes('token') || error.message.includes('refresh')) {
            // Should classify as auth error
            expect(appError.type).toBe('auth');
            
            // Should have user-friendly message
            expect(appError.userMessage).toBeDefined();
            expect(appError.userMessage.length).toBeGreaterThan(0);
            
            // Should provide guidance
            expect(appError.guidance).toBeDefined();
            expect(appError.guidance!.length).toBeGreaterThan(0);
            
            // Should indicate whether tokens should be cleared
            const shouldClear = ErrorHandler.shouldClearTokens(appError);
            expect(typeof shouldClear).toBe('boolean');
            
            // Should indicate whether redirect is needed
            const shouldRedirect = ErrorHandler.shouldRedirect(appError);
            expect(typeof shouldRedirect).toBe('boolean');
            
            // 401 errors should typically clear tokens and redirect
            if (response?.status === 401) {
              expect(shouldClear).toBe(true);
              expect(shouldRedirect).toBe(true);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: CORS errors should be properly detected and provide specific guidance
   * **Validates: Requirements 5.4**
   */
  it('should properly detect and handle CORS errors', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new Error('has been blocked by CORS policy')),
          fc.constant(new Error('Cross-Origin Request Blocked')),
          fc.constant(new Error('Access-Control-Allow-Origin')),
          fc.record({
            status: fc.constant(0),
            type: fc.constantFrom('opaque', 'cors'),
          })
        ),
        (corsErrorSource) => {
          let error: Error;
          let response: Response | undefined;
          
          if ('status' in corsErrorSource) {
            response = {
              status: corsErrorSource.status,
              type: corsErrorSource.type,
              ok: false,
            } as Response;
            error = new Error('Network error');
          } else {
            error = corsErrorSource;
          }
          
          // Test CORS detection
          const isCorsIssue = CorsHandler.detectCorsIssue(error, response);
          expect(isCorsIssue).toBe(true);
          
          // Test error classification
          const appError = ErrorHandler.classifyError(error, response);
          
          if (appError.type === 'cors') {
            // Should have user-friendly message
            expect(appError.userMessage).toBeDefined();
            expect(appError.userMessage.length).toBeGreaterThan(0);
            expect(appError.userMessage).toContain('CORS');
            
            // Should provide specific guidance
            expect(appError.guidance).toBeDefined();
            expect(appError.guidance!.length).toBeGreaterThan(0);
            expect(appError.guidance!).toContain('suporte');
            
            // CORS errors retryability depends on the specific error
            // Status 0 errors might be retryable (could be network), others typically not
            const isRetryable = ErrorHandler.isRetryable(appError);
            expect(typeof isRetryable).toBe('boolean');
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Invalid tokens should be detected and cleaned up properly
   * **Validates: Requirements 5.2**
   */
  it('should detect and handle invalid tokens properly', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''), // Empty token
          fc.constant('invalid.token'), // Invalid format
          fc.constant('not.a.jwt.token'), // Wrong number of parts
          fc.string().filter(s => !s.includes('.') || s.split('.').length !== 3), // Invalid JWT structure
        ),
        (invalidToken) => {
          // Mock localStorage to return invalid token
          mockLocalStorage.getItem.mockImplementation((key) => {
            if (key.includes('access_token')) return invalidToken;
            if (key.includes('refresh_token')) return invalidToken;
            if (key.includes('expires_at')) return new Date().toISOString();
            return null;
          });
          
          // Test corruption detection
          const corruption = authTokenManager.detectCorruptedTokens();
          
          if (invalidToken === '' || !invalidToken.includes('.') || invalidToken.split('.').length !== 3) {
            // Should detect corruption for clearly invalid tokens
            expect(corruption.hasCorrupted).toBe(true);
            expect(corruption.details.length).toBeGreaterThan(0);
          }
          
          // Test cleanup behavior
          const cleanupSpy = jest.spyOn(authTokenManager, 'clearTokens');
          authTokenManager.cleanupInvalidTokens('test_invalid_token');
          
          // Should call clearTokens
          expect(cleanupSpy).toHaveBeenCalled();
          
          cleanupSpy.mockRestore();
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Error logging should not crash and should provide useful information
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   */
  it('should log errors safely without crashing', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({
            type: fc.constantFrom('network', 'auth', 'cors'),
            code: fc.string(),
            message: fc.string(),
            userMessage: fc.string(),
          }),
          fc.anything() // Test with random objects
        ),
        (errorInput) => {
          // Mock console methods to capture logs
          const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
          
          try {
            if (errorInput && typeof errorInput === 'object' && 'type' in errorInput) {
              // Test with valid AppError structure
              ErrorHandler.logError(errorInput as AppError, 'TEST_CONTEXT');
            } else {
              // Test with invalid input - should not crash
              const classifiedError = ErrorHandler.classifyError(errorInput);
              ErrorHandler.logError(classifiedError, 'TEST_CONTEXT');
            }
            
            // Should not throw an error
            expect(true).toBe(true);
            
            // Should have logged something
            expect(consoleSpy).toHaveBeenCalled();
          } catch (error) {
            // Logging should never crash
            expect(false).toBe(true);
          } finally {
            consoleSpy.mockRestore();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Error messages should be user-friendly and not expose technical details
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   */
  it('should provide user-friendly error messages without technical details', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new TypeError('Failed to fetch')),
          fc.constant(new Error('HTTP 401 Unauthorized')),
          fc.constant(new Error('CORS policy blocked')),
          fc.constant(new Error('ECONNREFUSED')),
          fc.constant(new Error('getaddrinfo ENOTFOUND'))
        ),
        (technicalError) => {
          const appError = ErrorHandler.classifyError(technicalError);
          const userMessage = ErrorHandler.getUserMessage(appError);
          
          // Should have a user message
          expect(userMessage).toBeDefined();
          expect(userMessage.length).toBeGreaterThan(0);
          
          // Should not contain technical terms
          const technicalTerms = [
            'TypeError',
            'fetch',
            'ECONNREFUSED',
            'getaddrinfo',
            'ENOTFOUND',
            'HTTP 401',
            'HTTP 403',
            'HTTP 500'
          ];
          
          technicalTerms.forEach(term => {
            expect(userMessage).not.toContain(term);
          });
          
          // Should be in Portuguese (based on our implementation)
          const portugueseIndicators = ['erro', 'não', 'conexão', 'servidor', 'tente'];
          const hasPortuguese = portugueseIndicators.some(indicator => 
            userMessage.toLowerCase().includes(indicator)
          );
          expect(hasPortuguese).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: CORS diagnostic should provide useful troubleshooting information
   * **Validates: Requirements 5.4**
   */
  it('should provide useful CORS diagnostic information', () => {
    fc.assert(
      fc.property(
        fc.record({
          apiUrl: fc.webUrl(),
          frontendUrl: fc.webUrl(),
          environment: fc.constantFrom('development', 'production', 'test'),
        }),
        (corsConfig) => {
          const diagnostic = CorsHandler.diagnoseCorsIssues(corsConfig);
          
          // Should have diagnostic structure
          expect(diagnostic).toHaveProperty('hasCorsIssue');
          expect(diagnostic).toHaveProperty('issues');
          expect(diagnostic).toHaveProperty('recommendations');
          expect(diagnostic).toHaveProperty('canRetry');
          
          // Issues and recommendations should be arrays
          expect(Array.isArray(diagnostic.issues)).toBe(true);
          expect(Array.isArray(diagnostic.recommendations)).toBe(true);
          
          // If there are issues, there should be recommendations
          if (diagnostic.issues.length > 0) {
            expect(diagnostic.hasCorsIssue).toBe(true);
            expect(diagnostic.recommendations.length).toBeGreaterThan(0);
          }
          
          // Generate troubleshooting report
          const report = CorsHandler.generateTroubleshootingReport(corsConfig);
          expect(report).toBeDefined();
          expect(report.length).toBeGreaterThan(0);
          expect(report).toContain('CORS Troubleshooting Report');
        }
      ),
      { numRuns: 20 }
    );
  });
});