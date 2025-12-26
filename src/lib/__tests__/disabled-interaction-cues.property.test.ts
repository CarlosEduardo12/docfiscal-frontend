/**
 * Property-based tests for disabled interaction cues
 * **Feature: frontend-issues-resolution, Property 24: Disabled interactions provide clear visual cues**
 * **Validates: Requirements 6.5**
 */

import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { useInteractionState } from '../../hooks/useInteractionState';

describe('Disabled Interaction Cues Properties', () => {
  test('Property 24: Disabled interactions provide clear visual cues', () => {
    fc.assert(
      fc.property(
        fc.record({
          reason: fc.string({ minLength: 1, maxLength: 100 }),
          tooltip: fc.string({ minLength: 1, maxLength: 200 }),
          visualCue: fc.oneof(
            fc.constant('loading'),
            fc.constant('error'),
            fc.constant('warning'),
            fc.constant('info')
          ),
        }),
        ({ reason, tooltip, visualCue }) => {
          const { result } = renderHook(() => useInteractionState());

          // Initially, should be enabled
          expect(result.current.isDisabled).toBe(false);
          expect(result.current.reason).toBeUndefined();
          expect(result.current.tooltip).toBeUndefined();
          expect(result.current.visualCue).toBeUndefined();

          // Disable with visual cues
          act(() => {
            result.current.disable(reason, tooltip, visualCue);
          });

          // Should be disabled with clear visual cues
          expect(result.current.isDisabled).toBe(true);
          expect(result.current.reason).toBe(reason);
          expect(result.current.tooltip).toBe(tooltip);
          expect(result.current.visualCue).toBe(visualCue);

          // UI props should provide accessibility attributes
          const uiProps = result.current.uiProps;
          expect(uiProps.disabled).toBe(true);
          expect(uiProps['aria-disabled']).toBe(true);
          expect(uiProps['aria-label']).toBe(tooltip); // tooltip takes precedence
          expect(uiProps.title).toBe(tooltip);
          expect(uiProps['data-disabled']).toBe(true);
          expect(uiProps['data-reason']).toBe(reason);
          expect(uiProps['data-visual-cue']).toBe(visualCue);

          // CSS classes should provide visual feedback
          const cssClasses = result.current.cssClasses;
          expect(cssClasses).toContain('disabled');
          expect(cssClasses).toContain('cursor-not-allowed');
          expect(cssClasses).toContain('opacity-50');

          // Visual cue specific classes
          switch (visualCue) {
            case 'loading':
              expect(cssClasses).toContain('animate-pulse');
              break;
            case 'error':
              expect(cssClasses).toContain('border-red-300');
              expect(cssClasses).toContain('text-red-600');
              break;
            case 'warning':
              expect(cssClasses).toContain('border-yellow-300');
              expect(cssClasses).toContain('text-yellow-600');
              break;
            case 'info':
              expect(cssClasses).toContain('border-blue-300');
              expect(cssClasses).toContain('text-blue-600');
              break;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Loading state provides appropriate visual cues', () => {
    fc.assert(
      fc.property(
        fc.record({
          loadingReason: fc.string({ minLength: 1, maxLength: 50 }),
          isLoading: fc.boolean(),
        }),
        ({ loadingReason, isLoading }) => {
          const { result } = renderHook(() => useInteractionState());

          // Set loading state
          act(() => {
            result.current.setLoadingState(isLoading, loadingReason);
          });

          if (isLoading) {
            // Should be disabled with loading visual cue
            expect(result.current.isDisabled).toBe(true);
            expect(result.current.visualCue).toBe('loading');
            expect(result.current.reason).toBe(loadingReason);
            
            // Should have loading-specific CSS classes
            expect(result.current.cssClasses).toContain('animate-pulse');
            expect(result.current.cssClasses).toContain('disabled');
            
            // UI props should indicate loading state
            expect(result.current.uiProps.disabled).toBe(true);
            expect(result.current.uiProps['data-visual-cue']).toBe('loading');
          } else {
            // Should be enabled
            expect(result.current.isDisabled).toBe(false);
            expect(result.current.visualCue).toBeUndefined();
            
            // Should have enabled CSS classes
            expect(result.current.cssClasses).toContain('cursor-pointer');
            expect(result.current.cssClasses).not.toContain('disabled');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Error state provides appropriate visual cues', () => {
    fc.assert(
      fc.property(
        fc.record({
          errorReason: fc.string({ minLength: 1, maxLength: 50 }),
          hasError: fc.boolean(),
        }),
        ({ errorReason, hasError }) => {
          const { result } = renderHook(() => useInteractionState());

          // Set error state
          act(() => {
            result.current.setErrorState(hasError, errorReason);
          });

          if (hasError) {
            // Should be disabled with error visual cue
            expect(result.current.isDisabled).toBe(true);
            expect(result.current.visualCue).toBe('error');
            expect(result.current.reason).toBe(errorReason);
            
            // Should have error-specific CSS classes
            expect(result.current.cssClasses).toContain('border-red-300');
            expect(result.current.cssClasses).toContain('text-red-600');
            expect(result.current.cssClasses).toContain('disabled');
            
            // UI props should indicate error state
            expect(result.current.uiProps.disabled).toBe(true);
            expect(result.current.uiProps['data-visual-cue']).toBe('error');
          } else {
            // Should be enabled
            expect(result.current.isDisabled).toBe(false);
            expect(result.current.visualCue).toBeUndefined();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Toggle functionality maintains visual cue consistency', () => {
    fc.assert(
      fc.property(
        fc.record({
          reason: fc.string({ minLength: 1, maxLength: 50 }),
          tooltip: fc.string({ minLength: 1, maxLength: 100 }),
          visualCue: fc.oneof(
            fc.constant('loading'),
            fc.constant('error'),
            fc.constant('warning'),
            fc.constant('info')
          ),
        }),
        ({ reason, tooltip, visualCue }) => {
          const { result } = renderHook(() => useInteractionState());

          // Initially enabled
          expect(result.current.isDisabled).toBe(false);

          // Toggle to disabled
          act(() => {
            result.current.toggle(reason, tooltip, visualCue);
          });

          // Should be disabled with visual cues
          expect(result.current.isDisabled).toBe(true);
          expect(result.current.reason).toBe(reason);
          expect(result.current.tooltip).toBe(tooltip);
          expect(result.current.visualCue).toBe(visualCue);

          // Toggle back to enabled
          act(() => {
            result.current.toggle();
          });

          // Should be enabled with cleared visual cues
          expect(result.current.isDisabled).toBe(false);
          expect(result.current.reason).toBeUndefined();
          expect(result.current.tooltip).toBeUndefined();
          expect(result.current.visualCue).toBeUndefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  test('UI props provide consistent accessibility attributes', () => {
    fc.assert(
      fc.property(
        fc.record({
          isDisabled: fc.boolean(),
          reason: fc.string({ minLength: 1, maxLength: 50 }),
          tooltip: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        ({ isDisabled, reason, tooltip }) => {
          const { result } = renderHook(() => useInteractionState());

          if (isDisabled) {
            act(() => {
              result.current.disable(reason, tooltip);
            });
          } else {
            act(() => {
              result.current.enable();
            });
          }

          const uiProps = result.current.uiProps;

          // Disabled state should be consistent across attributes
          expect(uiProps.disabled).toBe(isDisabled);
          expect(uiProps['aria-disabled']).toBe(isDisabled);
          expect(uiProps['data-disabled']).toBe(isDisabled);

          if (isDisabled) {
            // Should have accessibility labels
            expect(uiProps['aria-label']).toBe(tooltip); // tooltip takes precedence
            expect(uiProps.title).toBe(tooltip);
            expect(uiProps['data-reason']).toBe(reason);
            
            // Labels should be non-empty strings
            expect(typeof uiProps['aria-label']).toBe('string');
            expect(uiProps['aria-label']!.length).toBeGreaterThan(0);
          } else {
            // Enabled state should not have reason
            expect(uiProps['data-reason']).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('CSS classes provide appropriate visual feedback', () => {
    fc.assert(
      fc.property(
        fc.record({
          visualCue: fc.oneof(
            fc.constant('loading'),
            fc.constant('error'),
            fc.constant('warning'),
            fc.constant('info'),
            fc.constant(undefined)
          ),
        }),
        ({ visualCue }) => {
          const { result } = renderHook(() => useInteractionState());

          // Disable with visual cue
          act(() => {
            result.current.disable('test reason', 'test tooltip', visualCue);
          });

          const cssClasses = result.current.cssClasses;

          // Should always have disabled classes
          expect(cssClasses).toContain('disabled');
          expect(cssClasses).toContain('cursor-not-allowed');
          expect(cssClasses).toContain('opacity-50');

          // Should not have enabled classes
          expect(cssClasses).not.toContain('cursor-pointer');
          expect(cssClasses).not.toContain('hover:opacity-80');

          // Visual cue specific classes
          if (visualCue) {
            switch (visualCue) {
              case 'loading':
                expect(cssClasses).toContain('animate-pulse');
                break;
              case 'error':
                expect(cssClasses).toContain('border-red-300');
                expect(cssClasses).toContain('text-red-600');
                break;
              case 'warning':
                expect(cssClasses).toContain('border-yellow-300');
                expect(cssClasses).toContain('text-yellow-600');
                break;
              case 'info':
                expect(cssClasses).toContain('border-blue-300');
                expect(cssClasses).toContain('text-blue-600');
                break;
            }
          }

          // Enable and check enabled classes
          act(() => {
            result.current.enable();
          });

          const enabledClasses = result.current.cssClasses;
          expect(enabledClasses).toContain('cursor-pointer');
          expect(enabledClasses).toContain('hover:opacity-80');
          expect(enabledClasses).not.toContain('disabled');
          expect(enabledClasses).not.toContain('cursor-not-allowed');
          expect(enabledClasses).not.toContain('opacity-50');
        }
      ),
      { numRuns: 50 }
    );
  });
});