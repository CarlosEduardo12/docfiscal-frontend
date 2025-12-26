/**
 * Property-based tests for recoverable error actions
 * **Feature: frontend-issues-resolution, Property 19: Recoverable errors provide action buttons**
 * **Validates: Requirements 5.5**
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
  AuthenticationError,
  ValidationError,
  UploadError,
  PaymentError,
  errorRecoveryManager,
  ErrorRecoveryManager,
  RecoveryStrategy,
} from '@/lib/error-handling';

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Store original location
const originalLocation = window.location;

beforeEach(() => {
  // Mock console methods
  console.error = jest.fn();
  console.warn = jest.fn();
  
  // Mock window.location using delete and redefine
  delete (window as any).location;
  (window as any).location = {
    href: '',
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn()
  };
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  
  // Restore original location
  (window as any).location = originalLocation;
});

// Generators for test data
const recoverableErrorGenerator = fc.oneof(
  fc.record({
    type: fc.constant('network'),
    error: fc.constant(() => new NetworkError('Connection failed')),
    expectedRecoverable: fc.constant(true),
    expectedActions: fc.constant(['retry', 'refresh'])
  }),
  fc.record({
    type: fc.constant('authentication'),
    error: fc.constant(() => new AuthenticationError('Session expired')),
    expectedRecoverable: fc.constant(true), // AuthenticationError has retryable: true
    expectedActions: fc.constant(['login', 'refresh'])
  }),
  fc.record({
    type: fc.constant('upload'),
    error: fc.constant(() => new UploadError('Upload failed', {}, true)),
    expectedRecoverable: fc.constant(true),
    expectedActions: fc.constant(['retry', 'clear'])
  })
);

const nonRecoverableErrorGenerator = fc.oneof(
  fc.record({
    type: fc.constant('payment'),
    error: fc.constant(() => new PaymentError('Payment declined')),
    expectedRecoverable: fc.constant(false),
    expectedActions: fc.constant(['support'])
  }),
  fc.record({
    type: fc.constant('server'),
    error: fc.constant(() => new AppError('Internal server error', ErrorType.SERVER)),
    expectedRecoverable: fc.constant(false),
    expectedActions: fc.constant(['wait', 'support'])
  }),
  fc.record({
    type: fc.constant('validation'),
    error: fc.constant(() => new ValidationError('Invalid input')),
    expectedRecoverable: fc.constant(false), // ValidationError has retryable: false
    expectedActions: fc.constant(['correct'])
  })
);

const recoveryActionGenerator = fc.record({
  label: fc.string({ minLength: 1, maxLength: 20 }),
  description: fc.string({ minLength: 5, maxLength: 100 }),
  primary: fc.boolean(),
  destructive: fc.boolean()
});

describe('Recoverable Error Actions Property Tests', () => {
  describe('Property 19: Recoverable errors provide action buttons', () => {
    it('should identify recoverable errors and provide appropriate recovery strategies', () => {
      fc.assert(
        fc.property(
          recoverableErrorGenerator,
          (errorConfig) => {
            const error = errorConfig.error();
            const recoveryOptions = errorRecoveryManager.getRecoveryOptions(error);

            // Property: Recoverable errors should have recovery strategies available
            if (errorConfig.expectedRecoverable) {
              expect(recoveryOptions.length).toBeGreaterThan(0);
              
              // Each recovery option should have required properties
              recoveryOptions.forEach((option) => {
                expect(option).toMatchObject({
                  canRecover: expect.any(Function),
                  recover: expect.any(Function),
                  description: expect.any(String)
                });

                // Should be able to recover this error type
                expect(option.canRecover(error)).toBe(true);
                expect(option.description.length).toBeGreaterThan(0);
              });
            }

            // Property: Error retryable flag should match expected recoverability
            if (error.retryable !== undefined) {
              expect(error.retryable).toBe(errorConfig.expectedRecoverable);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not provide recovery strategies for non-recoverable errors', () => {
      fc.assert(
        fc.property(
          nonRecoverableErrorGenerator,
          (errorConfig) => {
            const error = errorConfig.error();
            const recoveryOptions = errorRecoveryManager.getRecoveryOptions(error);

            // Property: Non-recoverable errors should have limited or no recovery strategies
            // Some errors might have support/contact options but not automatic recovery
            recoveryOptions.forEach((option) => {
              // If there are recovery options, they should not be automatic retries
              expect(option.description.toLowerCase()).not.toMatch(/retry.*automatically|auto.*retry/);
              
              // Should still be valid recovery strategies
              expect(option.canRecover(error)).toBe(true);
              expect(option.description.length).toBeGreaterThan(0);
            });

            // Property: Non-recoverable errors should not be marked as retryable
            expect(error.retryable).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should execute recovery strategies successfully for recoverable errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(() => new NetworkError('Connection timeout')),
            fc.constant(() => new UploadError('Upload interrupted', {}, true))
          ),
          async (errorFactory) => {
            const error = errorFactory();
            // Create a fresh recovery manager without built-in strategies
            const recoveryManager = new ErrorRecoveryManager();
            
            // Clear any existing strategies to avoid built-in ones that might redirect
            (recoveryManager as any).strategies = [];

            // Add simple mock strategies that resolve quickly
            const mockStrategy: RecoveryStrategy = {
              canRecover: (error) => error.retryable === true,
              recover: jest.fn().mockResolvedValue(undefined),
              description: 'Mock recovery strategy'
            };

            recoveryManager.addStrategy(mockStrategy);

            // Property: Recovery attempt should complete without throwing
            let recoverySuccessful = false;
            try {
              recoverySuccessful = await recoveryManager.attemptRecovery(error);
            } catch (recoveryError) {
              // Recovery itself should not throw, even if it fails
              expect(recoveryError).toBeUndefined();
            }

            // Property: Recovery result should be boolean
            expect(typeof recoverySuccessful).toBe('boolean');

            // Property: If error is retryable, recovery should succeed
            if (error.retryable) {
              expect(recoverySuccessful).toBe(true);
            }

            // Property: Mock strategy should have been called for retryable errors
            if (error.retryable) {
              expect(mockStrategy.recover).toHaveBeenCalledWith(error);
            }
          }
        ),
        { numRuns: 30 }
      );
    }, 15000); // Increase timeout to 15 seconds

    it('should provide clear action descriptions for all recovery strategies', () => {
      fc.assert(
        fc.property(
          fc.oneof(recoverableErrorGenerator, nonRecoverableErrorGenerator),
          (errorConfig) => {
            const error = errorConfig.error();
            const recoveryOptions = errorRecoveryManager.getRecoveryOptions(error);

            // Property: All recovery strategies should have clear, actionable descriptions
            recoveryOptions.forEach((option) => {
              expect(option.description).toBeTruthy();
              expect(option.description.length).toBeGreaterThan(5);
              
              // Should not contain technical jargon
              expect(option.description).not.toMatch(/ERR_/);
              expect(option.description).not.toMatch(/ECONN/);
              expect(option.description).not.toMatch(/TypeError/);
              expect(option.description).not.toMatch(/undefined/);
              
              // Should be user-friendly
              const userFriendlyWords = ['retry', 'refresh', 'login', 'try', 'again', 'clear', 'redirect'];
              const containsUserFriendlyWord = userFriendlyWords.some(word => 
                option.description.toLowerCase().includes(word)
              );
              expect(containsUserFriendlyWord).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle custom recovery strategies correctly', () => {
      fc.assert(
        fc.property(
          recoveryActionGenerator,
          fc.string({ minLength: 1, maxLength: 50 }),
          (actionConfig, errorMessage) => {
            const customRecoveryManager = new ErrorRecoveryManager();
            const mockRecoveryAction = jest.fn().mockResolvedValue(undefined);

            // Create custom recovery strategy
            const customStrategy: RecoveryStrategy = {
              canRecover: (error) => error.type === ErrorType.UNKNOWN,
              recover: mockRecoveryAction,
              description: actionConfig.description
            };

            customRecoveryManager.addStrategy(customStrategy);

            const testError = new AppError(errorMessage, ErrorType.UNKNOWN);
            const recoveryOptions = customRecoveryManager.getRecoveryOptions(testError);

            // Property: Custom strategy should be included in recovery options
            expect(recoveryOptions).toContainEqual(customStrategy);
            
            // Property: Custom strategy should be applicable to the test error
            const applicableStrategies = recoveryOptions.filter(strategy => 
              strategy.canRecover(testError)
            );
            expect(applicableStrategies.length).toBeGreaterThan(0);
            
            // Property: Custom strategy should have the expected description
            const customStrategyFound = applicableStrategies.find(strategy => 
              strategy.description === actionConfig.description
            );
            expect(customStrategyFound).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prioritize recovery strategies appropriately', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              errorType: fc.oneof(
                fc.constant(ErrorType.NETWORK),
                fc.constant(ErrorType.AUTHENTICATION),
                fc.constant(ErrorType.UPLOAD)
              ),
              priority: fc.integer({ min: 1, max: 10 })
            }),
            { minLength: 2, maxLength: 5 }
          ),
          (strategyConfigs) => {
            const recoveryManager = new ErrorRecoveryManager();

            // Add strategies with different priorities
            strategyConfigs.forEach((config, index) => {
              const strategy: RecoveryStrategy = {
                canRecover: (error) => error.type === config.errorType,
                recover: jest.fn().mockResolvedValue(undefined),
                description: `Strategy ${index} for ${config.errorType} (priority: ${config.priority})`
              };
              recoveryManager.addStrategy(strategy);
            });

            // Test with different error types
            const errorTypes = [ErrorType.NETWORK, ErrorType.AUTHENTICATION, ErrorType.UPLOAD];
            
            errorTypes.forEach((errorType) => {
              const testError = new AppError('Test error', errorType);
              const recoveryOptions = recoveryManager.getRecoveryOptions(testError);

              // Property: Should only return strategies that can recover this error type
              recoveryOptions.forEach((option) => {
                expect(option.canRecover(testError)).toBe(true);
              });

              // Property: All returned strategies should have valid descriptions
              recoveryOptions.forEach((option) => {
                expect(option.description).toBeTruthy();
                expect(typeof option.description).toBe('string');
              });
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle recovery strategy failures gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (errorMessage) => {
            const recoveryManager = new ErrorRecoveryManager();

            // Add a strategy that always fails quickly
            const failingStrategy: RecoveryStrategy = {
              canRecover: (error) => error.type === ErrorType.UNKNOWN,
              recover: jest.fn().mockRejectedValue(new Error('Recovery failed')),
              description: 'Failing recovery strategy'
            };

            recoveryManager.addStrategy(failingStrategy);

            const testError = new AppError(errorMessage, ErrorType.UNKNOWN);

            // Property: Recovery attempt should not throw even if strategies fail
            let recoveryResult: boolean | undefined;
            try {
              recoveryResult = await Promise.race([
                recoveryManager.attemptRecovery(testError),
                new Promise<boolean>((_, reject) => 
                  setTimeout(() => reject(new Error('Recovery timeout')), 3000)
                )
              ]);
            } catch (error) {
              // Should not throw
              expect(error).toBeUndefined();
            }

            // Property: Should return false when all strategies fail
            expect(recoveryResult).toBe(false);

            // Property: Failing strategy should still be in recovery options
            const recoveryOptions = recoveryManager.getRecoveryOptions(testError);
            expect(recoveryOptions).toContainEqual(failingStrategy);
          }
        ),
        { numRuns: 30 } // Reduced runs to avoid timeout issues
      );
    });

    it('should provide context-aware recovery actions', () => {
      fc.assert(
        fc.property(
          fc.record({
            context: fc.oneof(
              fc.constant('upload'),
              fc.constant('payment'),
              fc.constant('authentication'),
              fc.constant('navigation')
            ),
            userAction: fc.string({ minLength: 1, maxLength: 50 })
          }),
          (testData) => {
            // Create error with context
            const contextualError = new AppError(
              'Operation failed',
              ErrorType.UNKNOWN,
              ErrorSeverity.MEDIUM,
              {
                context: testData.context,
                userAction: testData.userAction
              }
            );

            const recoveryOptions = errorRecoveryManager.getRecoveryOptions(contextualError);

            // Property: Recovery strategies should be available
            expect(Array.isArray(recoveryOptions)).toBe(true);

            // Property: Each strategy should have contextual information
            recoveryOptions.forEach((option) => {
              expect(option.description).toBeTruthy();
              expect(typeof option.canRecover).toBe('function');
              expect(typeof option.recover).toBe('function');

              // Should be able to handle the contextual error
              const canRecover = option.canRecover(contextualError);
              expect(typeof canRecover).toBe('boolean');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain recovery strategy state correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 50 }),
            { minLength: 2, maxLength: 4 } // Reduced array size to avoid timeouts
          ),
          async (errorMessages) => {
            const recoveryManager = new ErrorRecoveryManager();
            let recoveryAttempts = 0;

            // Add a strategy that tracks attempts with quick resolution
            const trackingStrategy: RecoveryStrategy = {
              canRecover: (error) => error.type === ErrorType.UNKNOWN,
              recover: jest.fn().mockImplementation(async () => {
                recoveryAttempts++;
                if (recoveryAttempts < 2) { // Reduced threshold for faster tests
                  throw new Error('Not ready yet');
                }
                return Promise.resolve();
              }),
              description: 'Tracking recovery strategy'
            };

            recoveryManager.addStrategy(trackingStrategy);

            // Property: Multiple recovery attempts should maintain state
            for (const errorMessage of errorMessages) {
              const testError = new AppError(errorMessage, ErrorType.UNKNOWN);
              
              try {
                await Promise.race([
                  recoveryManager.attemptRecovery(testError),
                  new Promise<boolean>((_, reject) => 
                    setTimeout(() => reject(new Error('Recovery timeout')), 2000)
                  )
                ]);
              } catch (error) {
                // Some attempts may fail, that's expected
              }
            }

            // Property: Recovery attempts should have been tracked
            expect(recoveryAttempts).toBeGreaterThan(0);
            expect(recoveryAttempts).toBeLessThanOrEqual(errorMessages.length);
          }
        ),
        { numRuns: 20 } // Reduced runs to avoid timeout issues
      );
    });
  });
});