/**
 * Property-based tests for error boundary protection
 * **Feature: docfiscal-frontend, Property 14: Error boundary protection**
 * **Validates: Requirements 7.4**
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { render, screen, cleanup } from '@testing-library/react';
import fc from 'fast-check';
import React from 'react';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import {
  AppError,
  ErrorType,
  ErrorSeverity,
  classifyError,
  errorRecoveryManager,
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

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  // Mock console methods
  console.error = jest.fn();
  console.warn = jest.fn();

  localStorageMock.clear();

  // Clear any existing DOM content
  document.body.innerHTML = '';
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  localStorageMock.clear();

  // Clean up DOM
  document.body.innerHTML = '';
});

// Test component that throws errors
interface ErrorThrowingComponentProps {
  shouldThrow: boolean;
  errorMessage?: string;
  errorType?: string;
}

function ErrorThrowingComponent({
  shouldThrow,
  errorMessage = 'Test error',
  errorType = 'Error',
}: ErrorThrowingComponentProps) {
  if (shouldThrow) {
    switch (errorType) {
      case 'TypeError':
        throw new TypeError(errorMessage);
      case 'ReferenceError':
        throw new ReferenceError(errorMessage);
      case 'RangeError':
        throw new RangeError(errorMessage);
      default:
        throw new Error(errorMessage);
    }
  }
  return (
    <div data-testid="success-component">Component rendered successfully</div>
  );
}

// Generators for test data
const errorMessageGenerator = fc.string({ minLength: 1, maxLength: 100 });
const errorTypeGenerator = fc.oneof(
  fc.constant('Error'),
  fc.constant('TypeError'),
  fc.constant('ReferenceError'),
  fc.constant('RangeError')
);

const appErrorGenerator = fc.record({
  message: errorMessageGenerator,
  type: fc.oneof(
    fc.constant(ErrorType.NETWORK),
    fc.constant(ErrorType.VALIDATION),
    fc.constant(ErrorType.AUTHENTICATION),
    fc.constant(ErrorType.UPLOAD),
    fc.constant(ErrorType.PAYMENT),
    fc.constant(ErrorType.CLIENT),
    fc.constant(ErrorType.SERVER)
  ),
  severity: fc.oneof(
    fc.constant(ErrorSeverity.LOW),
    fc.constant(ErrorSeverity.MEDIUM),
    fc.constant(ErrorSeverity.HIGH),
    fc.constant(ErrorSeverity.CRITICAL)
  ),
});

describe('Error Boundary Property Tests', () => {
  describe('Property 14: Error boundary protection', () => {
    it('should catch and display error UI for any thrown error', () => {
      fc.assert(
        fc.property(
          errorMessageGenerator,
          errorTypeGenerator,
          (errorMessage, errorType) => {
            // Clean up any previous renders
            cleanup();

            // Render component that throws an error
            render(
              <ErrorBoundary>
                <ErrorThrowingComponent
                  shouldThrow={true}
                  errorMessage={errorMessage}
                  errorType={errorType}
                />
              </ErrorBoundary>
            );

            // Should display error UI instead of the component
            expect(
              screen.queryByTestId('success-component')
            ).not.toBeInTheDocument();
            expect(screen.getAllByText('Something went wrong')).toHaveLength(1);
            expect(
              screen.getByText(/We encountered an unexpected error/)
            ).toBeInTheDocument();

            // Clean up after this iteration
            cleanup();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should render children successfully when no error occurs', () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          (testContent) => {
            // Clean up any previous renders
            cleanup();

            const uniqueTestId = `test-content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const TestComponent = () => (
              <div data-testid={uniqueTestId}>{testContent}</div>
            );

            render(
              <ErrorBoundary>
                <TestComponent />
              </ErrorBoundary>
            );

            // Should render the component normally
            expect(screen.getByTestId(uniqueTestId)).toBeInTheDocument();
            expect(screen.getByText(testContent.trim())).toBeInTheDocument();
            expect(
              screen.queryByText('Something went wrong')
            ).not.toBeInTheDocument();

            // Clean up after this iteration
            cleanup();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should log errors to localStorage for debugging', () => {
      fc.assert(
        fc.property(errorMessageGenerator, (errorMessage) => {
          // Clear storage before each test iteration
          localStorageMock.clear();

          render(
            <ErrorBoundary>
              <ErrorThrowingComponent
                shouldThrow={true}
                errorMessage={errorMessage}
              />
            </ErrorBoundary>
          );

          // Check that error was logged to localStorage
          const storedErrors = JSON.parse(
            localStorageMock.getItem('docfiscal-errors') || '[]'
          );
          expect(storedErrors.length).toBeGreaterThanOrEqual(1);
          expect(storedErrors[storedErrors.length - 1]).toMatchObject({
            message: errorMessage,
            errorId: expect.stringMatching(/^error-\d+-[a-z0-9]+$/),
            timestamp: expect.any(String),
          });
        }),
        { numRuns: 30 }
      );
    });

    it('should provide retry functionality for recoverable errors', () => {
      fc.assert(
        fc.property(errorMessageGenerator, (errorMessage) => {
          const { container } = render(
            <ErrorBoundary>
              <ErrorThrowingComponent
                shouldThrow={true}
                errorMessage={errorMessage}
              />
            </ErrorBoundary>
          );

          // Should show retry button (use getAllByText to handle multiple instances)
          const retryButtons = screen.getAllByText(/Try Again/);
          expect(retryButtons.length).toBeGreaterThanOrEqual(1);

          // Should show reset button
          const resetButtons = screen.getAllByText(/Reset Component/);
          expect(resetButtons.length).toBeGreaterThanOrEqual(1);

          // Should show go home button
          const homeButtons = screen.getAllByText(/Go to Homepage/);
          expect(homeButtons.length).toBeGreaterThanOrEqual(1);
        }),
        { numRuns: 30 }
      );
    });

    it('should handle custom fallback UI when provided', () => {
      fc.assert(
        fc.property(
          errorMessageGenerator,
          fc
            .string({ minLength: 2, maxLength: 50 })
            .filter((s) => s.trim().length > 1),
          (errorMessage, fallbackText) => {
            // Clean up any previous renders
            cleanup();

            const uniqueTestId = `custom-fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const CustomFallback = () => (
              <div data-testid={uniqueTestId}>{fallbackText}</div>
            );

            render(
              <ErrorBoundary fallback={<CustomFallback />}>
                <ErrorThrowingComponent
                  shouldThrow={true}
                  errorMessage={errorMessage}
                />
              </ErrorBoundary>
            );

            // Should render custom fallback instead of default error UI
            expect(screen.getByTestId(uniqueTestId)).toBeInTheDocument();
            expect(screen.getAllByText(fallbackText.trim())).toHaveLength(1);
            expect(
              screen.queryByText('Something went wrong')
            ).not.toBeInTheDocument();

            // Clean up after this iteration
            cleanup();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should call custom error handler when provided', () => {
      fc.assert(
        fc.property(errorMessageGenerator, (errorMessage) => {
          const mockErrorHandler = jest.fn();

          render(
            <ErrorBoundary onError={mockErrorHandler}>
              <ErrorThrowingComponent
                shouldThrow={true}
                errorMessage={errorMessage}
              />
            </ErrorBoundary>
          );

          // Should call the custom error handler
          expect(mockErrorHandler).toHaveBeenCalledTimes(1);
          expect(mockErrorHandler).toHaveBeenCalledWith(
            expect.objectContaining({
              message: errorMessage,
            }),
            expect.objectContaining({
              componentStack: expect.any(String),
            })
          );
        }),
        { numRuns: 30 }
      );
    });

    it('should maintain error isolation between different error boundaries', () => {
      fc.assert(
        fc.property(errorMessageGenerator, (errorMessage) => {
          // Clean up any previous renders
          cleanup();

          const uniqueTestId = `working-component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          render(
            <div>
              <ErrorBoundary>
                <ErrorThrowingComponent
                  shouldThrow={true}
                  errorMessage={errorMessage}
                />
              </ErrorBoundary>
              <ErrorBoundary>
                <div data-testid={uniqueTestId}>This should still work</div>
              </ErrorBoundary>
            </div>
          );

          // First boundary should show error
          expect(screen.getAllByText('Something went wrong')).toHaveLength(1);

          // Second boundary should still render its children
          expect(screen.getByTestId(uniqueTestId)).toBeInTheDocument();
          expect(screen.getAllByText('This should still work')).toHaveLength(1);

          // Clean up after this iteration
          cleanup();
        }),
        { numRuns: 30 }
      );
    });

    it('should generate unique error IDs for different errors', () => {
      fc.assert(
        fc.property(
          fc.array(errorMessageGenerator, { minLength: 2, maxLength: 5 }),
          (errorMessages) => {
            const errorIds: string[] = [];

            errorMessages.forEach((errorMessage, index) => {
              // Clear previous errors
              localStorageMock.clear();

              render(
                <ErrorBoundary key={index}>
                  <ErrorThrowingComponent
                    shouldThrow={true}
                    errorMessage={errorMessage}
                  />
                </ErrorBoundary>
              );

              const storedErrors = JSON.parse(
                localStorageMock.getItem('docfiscal-errors') || '[]'
              );
              if (storedErrors.length > 0) {
                errorIds.push(storedErrors[0].errorId);
              }
            });

            // All error IDs should be unique
            const uniqueIds = new Set(errorIds);
            expect(uniqueIds.size).toBe(errorIds.length);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Error Classification Property Tests', () => {
    it('should correctly classify different types of errors', () => {
      fc.assert(
        fc.property(appErrorGenerator, (errorData) => {
          const originalError = new Error(errorData.message);
          const classifiedError = classifyError(originalError);

          // Should return an AppError instance
          expect(classifiedError).toBeInstanceOf(AppError);
          expect(classifiedError.message).toBe(errorData.message);
          expect(classifiedError.errorId).toMatch(/^[a-z]+-\d+-[a-z0-9]+$/);
          expect(classifiedError.timestamp).toBeInstanceOf(Date);
        }),
        { numRuns: 50 }
      );
    });

    it('should handle unknown error types gracefully', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            fc.record({ someProperty: fc.string() })
          ),
          (unknownError) => {
            const classifiedError = classifyError(unknownError);

            // Should always return an AppError
            expect(classifiedError).toBeInstanceOf(AppError);
            expect(classifiedError.type).toBe(ErrorType.UNKNOWN);
            expect(classifiedError.message).toBeTruthy();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Error Recovery Property Tests', () => {
    it('should attempt recovery for retryable errors', () => {
      fc.assert(
        fc.property(errorMessageGenerator, (errorMessage) => {
          const retryableError = new AppError(
            errorMessage,
            ErrorType.NETWORK,
            ErrorSeverity.MEDIUM,
            {},
            true // retryable
          );

          // Network errors should have recovery strategies available
          const recoveryOptions =
            errorRecoveryManager.getRecoveryOptions(retryableError);
          expect(recoveryOptions.length).toBeGreaterThan(0);

          // Should be marked as retryable
          expect(retryableError.retryable).toBe(true);
          expect(retryableError.type).toBe(ErrorType.NETWORK);
        }),
        { numRuns: 30 }
      );
    });
  });
});
