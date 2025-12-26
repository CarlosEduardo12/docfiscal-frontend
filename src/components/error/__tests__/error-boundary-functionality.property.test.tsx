/**
 * Property-based tests for error boundary functionality
 * **Feature: frontend-issues-resolution, Property 15: Error boundaries catch component failures**
 * **Validates: Requirements 5.1**
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import fc from 'fast-check';
import React from 'react';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

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
  cleanup();
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
      case 'SyntaxError':
        throw new SyntaxError(errorMessage);
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
  fc.constant('RangeError'),
  fc.constant('SyntaxError')
);

describe('Error Boundary Functionality Property Tests', () => {
  describe('Property 15: Error boundaries catch component failures', () => {
    it('should catch and display user-friendly fallback UI for any JavaScript error', () => {
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

            // Property: Error boundary should catch the error and display fallback UI
            expect(
              screen.queryByTestId('success-component')
            ).not.toBeInTheDocument();
            
            // Should display user-friendly error message
            expect(screen.getByText('Something went wrong')).toBeInTheDocument();
            expect(
              screen.getByText(/We encountered an unexpected error/)
            ).toBeInTheDocument();

            // Clean up after this iteration
            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide recovery options for any caught error', () => {
      fc.assert(
        fc.property(
          errorMessageGenerator,
          errorTypeGenerator,
          (errorMessage, errorType) => {
            // Clean up any previous renders
            cleanup();

            render(
              <ErrorBoundary>
                <ErrorThrowingComponent
                  shouldThrow={true}
                  errorMessage={errorMessage}
                  errorType={errorType}
                />
              </ErrorBoundary>
            );

            // Property: Error boundary should provide recovery options
            // Should show retry button
            const retryButtons = screen.getAllByText(/Try Again/);
            expect(retryButtons.length).toBeGreaterThanOrEqual(1);

            // Should show reset button
            const resetButtons = screen.getAllByText(/Reset Component/);
            expect(resetButtons.length).toBeGreaterThanOrEqual(1);

            // Should show go home button
            const homeButtons = screen.getAllByText(/Go to Homepage/);
            expect(homeButtons.length).toBeGreaterThanOrEqual(1);

            // Clean up after this iteration
            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should isolate errors and not affect other components', () => {
      fc.assert(
        fc.property(
          errorMessageGenerator,
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          (errorMessage, workingComponentText) => {
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
                  <div data-testid={uniqueTestId}>{workingComponentText}</div>
                </ErrorBoundary>
              </div>
            );

            // Property: Error in one boundary should not affect other boundaries
            // First boundary should show error
            expect(screen.getByText('Something went wrong')).toBeInTheDocument();

            // Second boundary should still render its children
            expect(screen.getByTestId(uniqueTestId)).toBeInTheDocument();
            expect(screen.getByText(workingComponentText.trim())).toBeInTheDocument();

            // Clean up after this iteration
            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should call custom error handlers when provided', () => {
      fc.assert(
        fc.property(
          errorMessageGenerator,
          errorTypeGenerator,
          (errorMessage, errorType) => {
            // Clean up any previous renders
            cleanup();

            const mockErrorHandler = jest.fn();

            render(
              <ErrorBoundary onError={mockErrorHandler}>
                <ErrorThrowingComponent
                  shouldThrow={true}
                  errorMessage={errorMessage}
                  errorType={errorType}
                />
              </ErrorBoundary>
            );

            // Property: Custom error handlers should be called with error details
            expect(mockErrorHandler).toHaveBeenCalledTimes(1);
            expect(mockErrorHandler).toHaveBeenCalledWith(
              expect.objectContaining({
                message: errorMessage,
              }),
              expect.objectContaining({
                componentStack: expect.any(String),
              })
            );

            // Clean up after this iteration
            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should render children normally when no errors occur', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
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

            // Property: Error boundary should render children normally when no errors occur
            expect(screen.getByTestId(uniqueTestId)).toBeInTheDocument();
            expect(screen.getByText(testContent.trim())).toBeInTheDocument();
            expect(
              screen.queryByText('Something went wrong')
            ).not.toBeInTheDocument();

            // Clean up after this iteration
            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle retry functionality correctly', () => {
      fc.assert(
        fc.property(
          errorMessageGenerator,
          (errorMessage) => {
            // Clean up any previous renders
            cleanup();

            render(
              <ErrorBoundary>
                <ErrorThrowingComponent
                  shouldThrow={true}
                  errorMessage={errorMessage}
                />
              </ErrorBoundary>
            );

            // Property: Retry button should be functional
            const retryButton = screen.getAllByText(/Try Again/)[0];
            expect(retryButton).toBeInTheDocument();

            // Should be clickable (not disabled)
            expect(retryButton).not.toBeDisabled();

            // Click should not throw an error
            expect(() => {
              fireEvent.click(retryButton);
            }).not.toThrow();

            // Clean up after this iteration
            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});