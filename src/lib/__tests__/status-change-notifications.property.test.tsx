/**
 * Property-Based Tests for Status Change Notifications
 * Feature: frontend-issues-resolution, Property 37: Status changes trigger immediate notifications
 * Validates: Requirements 9.5
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';
import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { 
  StatusNotification,
  StatusNotificationManager,
  ImmediateStatusNotification,
  useStatusNotifications,
  createStatusChangeNotification,
  generateStatusChangeMessage,
  type StatusChangeNotification
} from '@/components/ui/status-notifications';
import type { OrderStatus } from '@/types';

// Generators for property-based testing
const orderStatusGenerator = fc.oneof(
  fc.constant('pending_payment' as OrderStatus),
  fc.constant('paid' as OrderStatus),
  fc.constant('processing' as OrderStatus),
  fc.constant('completed' as OrderStatus),
  fc.constant('failed' as OrderStatus)
);

const orderIdGenerator = fc.string({ minLength: 8, maxLength: 32 });

const statusTransitionGenerator = fc.record({
  orderId: orderIdGenerator,
  previousStatus: orderStatusGenerator,
  newStatus: orderStatusGenerator
}).filter(({ previousStatus, newStatus }) => previousStatus !== newStatus);

const notificationGenerator = fc.record({
  id: fc.string({ minLength: 10, maxLength: 50 }),
  orderId: orderIdGenerator,
  previousStatus: orderStatusGenerator,
  newStatus: orderStatusGenerator,
  timestamp: fc.date(),
  message: fc.string({ minLength: 10, maxLength: 200 }),
  type: fc.oneof(
    fc.constant('success' as const),
    fc.constant('warning' as const),
    fc.constant('error' as const),
    fc.constant('info' as const)
  ),
  read: fc.boolean(),
  persistent: fc.boolean()
}).filter(({ previousStatus, newStatus }) => previousStatus !== newStatus);

const notificationArrayGenerator = fc.array(notificationGenerator, { minLength: 0, maxLength: 10 });

// Test component wrapper for hooks
function TestNotificationHook({ 
  onNotificationAdded 
}: { 
  onNotificationAdded?: (id: string) => void 
}) {
  const {
    notifications,
    addNotification,
    dismissNotification,
    markAsRead,
    clearAll,
    getUnreadCount
  } = useStatusNotifications();

  React.useEffect(() => {
    if (notifications.length > 0 && onNotificationAdded) {
      onNotificationAdded(notifications[0].id);
    }
  }, [notifications, onNotificationAdded]);

  return (
    <div data-testid="notification-hook">
      <div data-testid="notification-count">{notifications.length}</div>
      <div data-testid="unread-count">{getUnreadCount()}</div>
      <button 
        data-testid="add-notification"
        onClick={() => {
          // Generate unique order ID to avoid key conflicts
          const uniqueOrderId = `test-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          addNotification(uniqueOrderId, 'pending_payment', 'paid');
        }}
      >
        Add Notification
      </button>
      <button 
        data-testid="clear-all"
        onClick={clearAll}
      >
        Clear All
      </button>
      {notifications.map((notification) => (
        <div key={notification.id} data-testid={`notification-${notification.id}`}>
          <span data-testid="notification-message">{notification.message}</span>
          <button 
            data-testid={`dismiss-${notification.id}`}
            onClick={() => dismissNotification(notification.id)}
          >
            Dismiss
          </button>
          <button 
            data-testid={`mark-read-${notification.id}`}
            onClick={() => markAsRead(notification.id)}
          >
            Mark Read
          </button>
        </div>
      ))}
    </div>
  );
}

describe('Status Change Notifications Properties', () => {
  beforeEach(() => {
    // Clean up DOM before each test
    cleanup();
  });

  afterEach(() => {
    // Clean up DOM after each test
    cleanup();
    // Reset any fake timers
    if (jest.isMockFunction(setTimeout)) {
      jest.useRealTimers();
    }
  });
  /**
   * Property 37: Status changes trigger immediate notifications
   * For any status change, the system should immediately create and display
   * a notification with appropriate messaging and visual feedback
   */
  
  it('should create immediate notifications for all status transitions', () => {
    fc.assert(
      fc.property(statusTransitionGenerator, (transition) => {
        // Arrange & Act: Create notification for status change
        const notification = createStatusChangeNotification(
          transition.orderId,
          transition.previousStatus,
          transition.newStatus
        );
        
        // Assert: Verify notification structure
        expect(notification.id).toBeTruthy();
        expect(notification.orderId).toBe(transition.orderId);
        expect(notification.previousStatus).toBe(transition.previousStatus);
        expect(notification.newStatus).toBe(transition.newStatus);
        expect(notification.timestamp).toBeInstanceOf(Date);
        expect(notification.message).toBeTruthy();
        expect(['success', 'warning', 'error', 'info']).toContain(notification.type);
        expect(notification.read).toBe(false);
        
        // Verify message contains order ID reference
        expect(notification.message).toContain(transition.orderId.slice(-8));
        
        // Verify persistent flag for critical statuses
        if (notification.type === 'error' || transition.newStatus === 'completed') {
          expect(notification.persistent).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should generate appropriate messages for status transitions', () => {
    fc.assert(
      fc.property(statusTransitionGenerator, (transition) => {
        // Arrange & Act: Generate message for status change
        const { message, type } = generateStatusChangeMessage(
          transition.previousStatus,
          transition.newStatus,
          transition.orderId
        );
        
        // Assert: Verify message properties
        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(10);
        expect(['success', 'warning', 'error', 'info']).toContain(type);
        
        // Verify message contains order reference
        expect(message).toContain(transition.orderId.slice(-8));
        
        // Verify message type matches transition based on actual component mappings
        const transitionKey = `${transition.previousStatus}->${transition.newStatus}`;
        const knownTransitions = {
          'pending_payment->paid': 'success',
          'paid->processing': 'info',
          'processing->completed': 'success',
          'processing->failed': 'error',
          'pending_payment->failed': 'error',
          'paid->failed': 'error'
        };
        
        const expectedType = knownTransitions[transitionKey as keyof typeof knownTransitions] || 'info';
        expect(type).toBe(expectedType);
      }),
      { numRuns: 100 }
    );
  });

  it('should render individual notifications with immediate feedback', () => {
    fc.assert(
      fc.property(notificationGenerator, (notification) => {
        // Arrange & Act: Render individual notification in isolated container
        const { container, unmount } = render(
          <div data-testid="notification-container">
            <StatusNotification 
              notification={notification}
              onDismiss={jest.fn()}
              onMarkAsRead={jest.fn()}
            />
          </div>
        );
        
        try {
          // Assert: Verify immediate visual feedback
          const alertElement = container.querySelector('[role="alert"]');
          expect(alertElement).toBeTruthy();
          expect(alertElement?.getAttribute('aria-live')).toBe('polite');
          expect(alertElement?.getAttribute('aria-atomic')).toBe('true');
          
          // Verify notification content using container queries to avoid conflicts
          const statusText = container.querySelector('.text-sm.font-medium');
          expect(statusText?.textContent).toBe('Status Atualizado');
          
          const messageText = container.querySelector('.text-sm.mt-1');
          expect(messageText?.textContent).toBe(notification.message);
          
          // Verify status transition display
          const statusBadge = container.querySelector('.text-xs');
          expect(statusBadge?.textContent?.trim()).toContain(`${notification.previousStatus} → ${notification.newStatus}`);
          
          // Verify timestamp display
          const timestamp = notification.timestamp.toLocaleTimeString();
          expect(container.textContent).toContain(timestamp);
          
          // Verify dismiss button
          const dismissButton = container.querySelector('[aria-label="Dispensar notificação"]');
          expect(dismissButton).toBeTruthy();
        } finally {
          // Clean up this test's render
          unmount();
        }
      }),
      { numRuns: 50 }
    );
  });

  it('should manage multiple notifications with immediate updates', () => {
    fc.assert(
      fc.property(notificationArrayGenerator, (notifications) => {
        // Arrange & Act: Render notification manager in isolated container
        const mockDismiss = jest.fn();
        const mockMarkAsRead = jest.fn();
        const mockClearAll = jest.fn();
        
        const { container, unmount } = render(
          <div data-testid="manager-container">
            <StatusNotificationManager
              notifications={notifications}
              onDismiss={mockDismiss}
              onMarkAsRead={mockMarkAsRead}
              onClearAll={mockClearAll}
              maxVisible={5}
            />
          </div>
        );
        
        try {
          if (notifications.length === 0) {
            // Should not render anything for empty notifications
            const managerContent = container.querySelector('[data-testid="manager-container"]');
            expect(managerContent?.children.length).toBe(0);
            return;
          }
          
          // Assert: Verify manager structure using container queries
          const headerText = container.querySelector('h3.text-sm.font-medium');
          expect(headerText?.textContent).toBe('Notificações de Status');
          
          // Verify unread count display
          const unreadCount = notifications.filter(n => !n.read).length;
          if (unreadCount > 0) {
            const badgeElement = container.querySelector('.text-xs');
            expect(badgeElement?.textContent).toBe(unreadCount.toString());
          }
          
          // Verify clear all button
          const clearButton = container.querySelector('button');
          expect(clearButton?.textContent?.trim()).toBe('Limpar Todas');
          
          // Verify visible notifications (max 5)
          const visibleCount = Math.min(notifications.length, 5);
          const notificationElements = container.querySelectorAll('[role="alert"]');
          expect(notificationElements.length).toBe(visibleCount);
          
          // Verify overflow indicator
          if (notifications.length > 5) {
            const overflowText = `+${notifications.length - 5} notificações adicionais`;
            expect(container.textContent).toContain(overflowText);
          }
        } finally {
          // Clean up this test's render
          unmount();
        }
      }),
      { numRuns: 50 }
    );
  });

  it('should provide immediate status notifications with auto-dismiss', () => {
    fc.assert(
      fc.property(statusTransitionGenerator, (transition) => {
        // Arrange: Mock timers for auto-dismiss testing
        jest.useFakeTimers();
        
        const mockDismiss = jest.fn();
        
        // Act: Render immediate notification in isolated container
        const { container, unmount } = render(
          <div data-testid="immediate-container">
            <ImmediateStatusNotification
              orderId={transition.orderId}
              previousStatus={transition.previousStatus}
              newStatus={transition.newStatus}
              onDismiss={mockDismiss}
              duration={1000}
            />
          </div>
        );
        
        try {
          // Assert: Verify immediate display
          const alertElement = container.querySelector('[role="alert"]');
          expect(alertElement).toBeTruthy();
          expect(alertElement?.getAttribute('aria-live')).toBe('assertive');
          expect(alertElement?.getAttribute('aria-atomic')).toBe('true');
          
          // Verify positioning for immediate attention
          expect(alertElement?.className).toContain('fixed');
          expect(alertElement?.className).toContain('top-4');
          expect(alertElement?.className).toContain('right-4');
          expect(alertElement?.className).toContain('z-50');
          
          // Verify content using container queries
          const statusText = container.querySelector('.text-sm.font-medium');
          expect(statusText?.textContent).toBe('Status Atualizado');
          
          // Verify close button
          const closeButton = container.querySelector('[aria-label="Fechar notificação"]');
          expect(closeButton).toBeTruthy();
          
          // Test auto-dismiss - advance timers to trigger state change
          act(() => {
            jest.advanceTimersByTime(1000);
          });
          
          // After duration, the component should start dismiss process
          // The component uses internal state to control visibility
          // We can verify the dismiss callback will be called after animation
          act(() => {
            jest.advanceTimersByTime(300); // Animation duration
          });
          
          // The component should have triggered onDismiss
          expect(mockDismiss).toHaveBeenCalled();
        } finally {
          // Clean up this test's render and timers
          unmount();
          jest.useRealTimers();
        }
      }),
      { numRuns: 50 }
    );
  });

  it('should handle notification interactions immediately', async () => {
    fc.assert(
      fc.asyncProperty(notificationGenerator, async (notification) => {
        // Arrange: Setup user interactions
        const user = userEvent.setup();
        const mockDismiss = jest.fn();
        const mockMarkAsRead = jest.fn();
        
        // Act: Render notification with interactions in isolated container
        const { container, unmount } = render(
          <div data-testid="interaction-container">
            <StatusNotification 
              notification={notification}
              onDismiss={mockDismiss}
              onMarkAsRead={mockMarkAsRead}
            />
          </div>
        );
        
        try {
          // Assert: Test dismiss interaction
          const dismissButton = container.querySelector('[aria-label="Dispensar notificação"]');
          expect(dismissButton).toBeTruthy();
          
          await user.click(dismissButton!);
          
          // Should call dismiss immediately
          expect(mockDismiss).toHaveBeenCalledWith(notification.id);
        } finally {
          // Clean up this test's render
          unmount();
        }
      }),
      { numRuns: 30 }
    );
  });

  it('should maintain notification state with immediate updates', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (addCount) => {
        // Arrange: Setup hook test component in isolated container
        let notificationId: string | undefined;
        
        const { getByTestId, unmount } = render(
          <div data-testid="hook-container">
            <TestNotificationHook 
              onNotificationAdded={(id) => { notificationId = id; }}
            />
          </div>
        );
        
        try {
          // Act: Add notifications
          for (let i = 0; i < addCount; i++) {
            act(() => {
              // Use container-specific queries to avoid conflicts
              const container = getByTestId('hook-container');
              const addButton = container.querySelector('[data-testid="add-notification"]') as HTMLButtonElement;
              addButton.click();
            });
          }
          
          // Assert: Verify immediate state updates
          expect(getByTestId('notification-count').textContent).toBe(addCount.toString());
          expect(getByTestId('unread-count').textContent).toBe(addCount.toString());
          
          // Test clear all
          act(() => {
            const container = getByTestId('hook-container');
            const clearButton = container.querySelector('[data-testid="clear-all"]') as HTMLButtonElement;
            clearButton.click();
          });
          
          expect(getByTestId('notification-count').textContent).toBe('0');
          expect(getByTestId('unread-count').textContent).toBe('0');
        } finally {
          // Clean up this test's render
          unmount();
        }
      }),
      { numRuns: 30 }
    );
  });

  it('should provide consistent notification styling for immediate recognition', () => {
    fc.assert(
      fc.property(notificationGenerator, (notification) => {
        // Arrange & Act: Render notification in isolated container
        const { container, unmount } = render(
          <div data-testid="styling-container">
            <StatusNotification 
              notification={notification}
              onDismiss={jest.fn()}
              onMarkAsRead={jest.fn()}
            />
          </div>
        );
        
        try {
          // Assert: Verify consistent styling based on type
          const alertElement = container.querySelector('[role="alert"]');
          expect(alertElement).toBeTruthy();
          
          // Verify type-specific styling
          switch (notification.type) {
            case 'success':
              expect(alertElement?.className).toContain('bg-green-50');
              expect(alertElement?.className).toContain('border-green-200');
              expect(alertElement?.className).toContain('text-green-800');
              break;
            case 'error':
              expect(alertElement?.className).toContain('bg-red-50');
              expect(alertElement?.className).toContain('border-red-200');
              expect(alertElement?.className).toContain('text-red-800');
              break;
            case 'warning':
              expect(alertElement?.className).toContain('bg-yellow-50');
              expect(alertElement?.className).toContain('border-yellow-200');
              expect(alertElement?.className).toContain('text-yellow-800');
              break;
            case 'info':
              expect(alertElement?.className).toContain('bg-blue-50');
              expect(alertElement?.className).toContain('border-blue-200');
              expect(alertElement?.className).toContain('text-blue-800');
              break;
          }
          
          // Verify unread notification highlighting
          if (!notification.read) {
            expect(alertElement?.className).toContain('ring-2');
            expect(alertElement?.className).toContain('ring-offset-2');
            expect(alertElement?.className).toContain('ring-blue-500');
          }
        } finally {
          // Clean up this test's render
          unmount();
        }
      }),
      { numRuns: 50 }
    );
  });
});