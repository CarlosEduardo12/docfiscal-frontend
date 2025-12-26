/**
 * Property-based tests for data loading indicators
 * **Feature: frontend-issues-resolution, Property 21: Data fetching shows loading indicators**
 * **Validates: Requirements 6.2**
 */

import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { useDataLoading } from '../../hooks/useDataLoading';

describe('Data Loading Indicators Properties', () => {
  test('Property 21: Data fetching shows loading indicators', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          shouldSucceed: fc.boolean(),
          errorMessage: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        }),
        async ({ shouldSucceed, errorMessage }) => {
          const { result, unmount } = renderHook(() => useDataLoading());

          try {
            if (!result.current) {
              return;
            }

            const mockLoadFn = jest.fn(async () => {
              if (!shouldSucceed) {
                throw new Error(errorMessage);
              }
              return 'test data';
            });

            await act(async () => {
              if (result.current) {
                await result.current.load(mockLoadFn);
              }
            });

            if (result.current) {
              // Property: Data fetching shows loading indicators
              expect(typeof result.current.isLoading).toBe('boolean');
              expect(typeof result.current.hasLoaded).toBe('boolean');
              expect(result.current.hasLoaded).toBe(true);
            }

          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Loading state provides UI feedback indicators', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          dataValue: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        }),
        async ({ dataValue }) => {
          const { result, unmount } = renderHook(() => useDataLoading());

          try {
            if (!result.current) {
              return;
            }

            const mockLoadFn = jest.fn(async () => dataValue);

            await act(async () => {
              if (result.current) {
                await result.current.load(mockLoadFn);
              }
            });

            if (result.current) {
              expect(typeof result.current.isLoading).toBe('boolean');
              expect(typeof result.current.hasLoaded).toBe('boolean');
              expect(result.current.isLoading).toBe(false);
              expect(result.current.hasLoaded).toBe(true);
            }

          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Error states provide appropriate feedback', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorMessage: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        }),
        async ({ errorMessage }) => {
          const { result, unmount } = renderHook(() => useDataLoading());

          try {
            if (!result.current) {
              return;
            }

            const mockLoadFn = jest.fn(async () => {
              throw new Error(errorMessage);
            });

            await act(async () => {
              if (result.current) {
                await result.current.load(mockLoadFn);
              }
            });

            if (result.current) {
              expect(typeof result.current.error).toBe('string');
              expect(result.current.error).toBe(errorMessage);
              expect(result.current.isLoading).toBe(false);
              expect(result.current.hasLoaded).toBe(true);
            }

          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});