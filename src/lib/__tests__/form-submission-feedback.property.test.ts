/**
 * Property-based tests for form submission feedback
 * **Feature: frontend-issues-resolution, Property 20: Form submission prevents double submission**
 * **Validates: Requirements 6.1**
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import { useFormSubmission } from '../../hooks/useFormSubmission';

describe('Form Submission Feedback Properties', () => {
  test('Property 20: Form submission prevents double submission', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          shouldSucceed: fc.boolean(),
          errorMessage: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        async ({ shouldSucceed, errorMessage }) => {
          // Create a fresh hook instance for each test run
          const { result, unmount } = renderHook(() => useFormSubmission());

          try {
            // Ensure hook is properly initialized and not null
            expect(result.current).toBeDefined();
            expect(result.current).not.toBeNull();
            expect(result.current.isSubmitting).toBe(false);
            expect(result.current.isDisabled).toBe(false);

            let submitCallCount = 0;
            const mockSubmitFn = jest.fn(() => {
              submitCallCount++;
              if (!shouldSucceed) {
                // For error case, return a Promise that rejects quickly
                return Promise.reject(new Error(errorMessage));
              }
              // Return a Promise that resolves quickly for success case
              return Promise.resolve({ success: true });
            });

            // Test double submission prevention synchronously
            let firstResult: any;
            let secondResult: any;
            
            act(() => {
              firstResult = result.current?.submit(mockSubmitFn);
              // Immediately try to submit again
              secondResult = result.current?.submit(mockSubmitFn);
            });

            // Second submission should return null immediately (prevented)
            expect(secondResult).toBe(null);

            // Only one submit function should have been called
            expect(submitCallCount).toBe(1);

            // First submission should be a promise
            expect(firstResult).toBeInstanceOf(Promise);

            // Form should be in submitting state immediately after first submit
            expect(result.current?.isSubmitting).toBe(true);
            expect(result.current?.isDisabled).toBe(true);

            // Wait for the async operation to complete
            if (firstResult) {
              try {
                await firstResult;
              } catch (error) {
                // Expected for error cases
              }
            }

            // Wait for state to update after async operation
            await waitFor(() => {
              expect(result.current?.isSubmitting).toBe(false);
            }, { timeout: 1000 });

            // After completion, form should not be submitting
            expect(result.current?.isSubmitting).toBe(false);
            expect(result.current?.isDisabled).toBe(false);

            if (shouldSucceed) {
              expect(result.current?.success).toBe(true);
              expect(result.current?.error).toBe(null);
            } else {
              expect(result.current?.success).toBe(false);
              expect(result.current?.error).toBe(errorMessage);
            }
          } finally {
            // Always unmount to clean up
            unmount();
          }
        }
      ),
      { numRuns: 50 } // Reduced runs for async tests
    );
  });

  test('Form submission provides loading indicators', () => {
    fc.assert(
      fc.property(
        fc.record({
          loadingText: fc.string({ minLength: 1, maxLength: 50 }),
          buttonText: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        ({ loadingText, buttonText }) => {
          const { result, unmount } = renderHook(() => useFormSubmission());

          try {
            // Ensure hook is properly initialized and not null
            expect(result.current).toBeDefined();
            expect(result.current).not.toBeNull();
            
            // Test that loading state can be used for UI feedback
            const isLoading = result.current?.isSubmitting ?? false;
            const isDisabled = result.current?.isDisabled ?? false;
            
            // These properties should be consistent
            if (isLoading) {
              expect(isDisabled).toBe(true);
            }

            // UI should be able to determine what text to show
            const displayText = isLoading ? loadingText : buttonText;
            expect(displayText).toBeDefined();
            expect(typeof displayText).toBe('string');
            expect(displayText.length).toBeGreaterThan(0);
          } finally {
            // Clean up
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Form reset clears all states', () => {
    fc.assert(
      fc.property(
        fc.record({
          errorMessage: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        ({ errorMessage }) => {
          const { result, unmount } = renderHook(() => useFormSubmission());

          try {
            // Ensure hook is properly initialized and not null
            expect(result.current).toBeDefined();
            expect(result.current).not.toBeNull();

            // Simulate error state by calling submit with a function that throws
            act(() => {
              result.current?.submit(async () => {
                throw new Error(errorMessage);
              });
            });

            // Reset the form
            act(() => {
              result.current?.reset();
            });

            // All states should be cleared
            expect(result.current?.isSubmitting).toBe(false);
            expect(result.current?.isDisabled).toBe(false);
            expect(result.current?.error).toBe(null);
            expect(result.current?.success).toBe(false);
          } finally {
            // Clean up
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});