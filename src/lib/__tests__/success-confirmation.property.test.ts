/**
 * Property-based tests for success confirmation
 * **Feature: frontend-issues-resolution, Property 22: Successful actions provide visual confirmation**
 * **Validates: Requirements 6.3**
 */

import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { useToast } from '../../hooks/useToast';

describe('Success Confirmation Properties', () => {
  test('Property 22: Successful actions provide visual confirmation', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }),
          message: fc.string({ minLength: 1, maxLength: 200 }),
          duration: fc.integer({ min: 1000, max: 10000 }),
          maxToasts: fc.integer({ min: 1, max: 10 }),
        }),
        ({ title, message, duration, maxToasts }) => {
          const { result } = renderHook(() =>
            useToast({ maxToasts, defaultDuration: duration })
          );

          // Initially, no toasts should be present
          expect(result.current.toasts).toHaveLength(0);

          // Show success confirmation
          let toastId: string;
          act(() => {
            toastId = result.current.showSuccess(title, message);
          });

          // Toast should be added with correct properties
          expect(result.current.toasts).toHaveLength(1);
          const toast = result.current.toasts[0];
          
          expect(toast.id).toBe(toastId);
          expect(toast.type).toBe('success');
          expect(toast.title).toBe(title);
          expect(toast.message).toBe(message);
          expect(toast.duration).toBe(duration);

          // Visual confirmation should be identifiable
          expect(toast.type).toBe('success');
          expect(toast.title.length).toBeGreaterThan(0);
          expect(toast.message.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Multiple success confirmations are handled correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          confirmations: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 50 }),
              message: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          maxToasts: fc.integer({ min: 1, max: 10 }),
        }),
        ({ confirmations, maxToasts }) => {
          const { result } = renderHook(() =>
            useToast({ maxToasts, defaultDuration: 10000 })
          );

          const toastIds: string[] = [];

          // Show multiple success confirmations
          act(() => {
            confirmations.forEach(({ title, message }) => {
              const id = result.current.showSuccess(title, message);
              toastIds.push(id);
            });
          });

          // Should not exceed maxToasts
          expect(result.current.toasts.length).toBeLessThanOrEqual(maxToasts);
          
          // If we have fewer confirmations than maxToasts, all should be present
          if (confirmations.length <= maxToasts) {
            expect(result.current.toasts).toHaveLength(confirmations.length);
            
            // All toasts should be success type
            result.current.toasts.forEach(toast => {
              expect(toast.type).toBe('success');
            });
          }

          // Each visible toast should have valid content
          result.current.toasts.forEach(toast => {
            expect(toast.title.length).toBeGreaterThan(0);
            expect(toast.message.length).toBeGreaterThan(0);
            expect(toast.id).toBeDefined();
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Success confirmation with actions provides interactive feedback', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }),
          message: fc.string({ minLength: 1, maxLength: 100 }),
          actionLabel: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        ({ title, message, actionLabel }) => {
          const { result } = renderHook(() => useToast());

          let actionCalled = false;
          const mockAction = jest.fn(() => {
            actionCalled = true;
          });

          // Show success with action
          act(() => {
            result.current.showSuccess(title, message, {
              actions: [
                {
                  label: actionLabel,
                  onClick: mockAction,
                  variant: 'primary',
                },
              ],
            });
          });

          expect(result.current.toasts).toHaveLength(1);
          const toast = result.current.toasts[0];

          // Toast should have actions
          expect(toast.actions).toBeDefined();
          expect(toast.actions).toHaveLength(1);
          expect(toast.actions![0].label).toBe(actionLabel);
          expect(toast.actions![0].variant).toBe('primary');

          // Action should be callable
          act(() => {
            toast.actions![0].onClick();
          });

          expect(mockAction).toHaveBeenCalledTimes(1);
          expect(actionCalled).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Different confirmation types provide distinct visual feedback', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }),
          message: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        ({ title, message }) => {
          const { result } = renderHook(() => useToast());

          // Show different types of confirmations
          act(() => {
            result.current.showSuccess(title, message);
            result.current.showError(title, message);
            result.current.showWarning(title, message);
            result.current.showInfo(title, message);
          });

          expect(result.current.toasts).toHaveLength(4);

          // Each toast should have a distinct type
          const types = result.current.toasts.map(toast => toast.type);
          expect(types).toContain('success');
          expect(types).toContain('error');
          expect(types).toContain('warning');
          expect(types).toContain('info');

          // All types should be valid
          types.forEach(type => {
            expect(['success', 'error', 'warning', 'info']).toContain(type);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Toast removal works correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }),
          message: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        ({ title, message }) => {
          const { result } = renderHook(() => useToast());

          // Show success confirmation
          let toastId: string;
          act(() => {
            toastId = result.current.showSuccess(title, message);
          });

          expect(result.current.toasts).toHaveLength(1);

          // Remove the toast
          act(() => {
            result.current.removeToast(toastId);
          });

          expect(result.current.toasts).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Clear all toasts works correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          toastCount: fc.integer({ min: 1, max: 5 }),
          title: fc.string({ minLength: 1, maxLength: 50 }),
          message: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        ({ toastCount, title, message }) => {
          const { result } = renderHook(() => useToast());

          // Show multiple toasts
          act(() => {
            for (let i = 0; i < toastCount; i++) {
              result.current.showSuccess(`${title} ${i}`, `${message} ${i}`);
            }
          });

          expect(result.current.toasts).toHaveLength(toastCount);

          // Clear all toasts
          act(() => {
            result.current.clearAll();
          });

          expect(result.current.toasts).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});