/**
 * Global error handler for unhandled errors and promise rejections
 * Implements Requirements 7.4 for comprehensive error handling
 */

import {
  classifyError,
  logError,
  errorRecoveryManager,
} from './error-handling';

// Global error handler setup
export function setupGlobalErrorHandling() {
  if (typeof window === 'undefined') {
    return; // Skip on server-side
  }

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = classifyError(event.reason);
    logError(error, 'Unhandled Promise Rejection');

    // Attempt automatic recovery
    errorRecoveryManager.attemptRecovery(error).catch(() => {
      // Recovery failed, but we've already logged the error
    });

    // Prevent the default browser behavior (console error)
    event.preventDefault();
  });

  // Handle uncaught JavaScript errors
  window.addEventListener('error', (event) => {
    const error = classifyError(event.error || new Error(event.message));
    logError(error, 'Uncaught JavaScript Error');

    // Attempt automatic recovery
    errorRecoveryManager.attemptRecovery(error).catch(() => {
      // Recovery failed, but we've already logged the error
    });
  });

  // Handle resource loading errors (images, scripts, etc.)
  window.addEventListener(
    'error',
    (event) => {
      if (event.target && event.target !== window) {
        const target = event.target as HTMLElement;
        const error = classifyError(
          new Error(
            `Failed to load resource: ${target.tagName} - ${(target as any).src || (target as any).href}`
          )
        );
        logError(error, 'Resource Loading Error');
      }
    },
    true
  ); // Use capture phase to catch resource errors

  // Handle fetch errors globally
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);

      // Log failed HTTP requests
      if (!response.ok) {
        const error = classifyError(
          new Error(
            `HTTP ${response.status}: ${response.statusText} - ${args[0]}`
          )
        );
        logError(error, 'HTTP Request Failed');
      }

      return response;
    } catch (fetchError) {
      const error = classifyError(fetchError);
      logError(error, 'Fetch Network Error');
      throw error;
    }
  };

  // Handle visibility change to save state before page unload
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Save any pending error logs or state
      try {
        // Trigger any cleanup or state saving
        window.dispatchEvent(new CustomEvent('app:beforeUnload'));
      } catch (error) {
        console.warn('Error during visibility change cleanup:', error);
      }
    }
  });

  console.log('Global error handling initialized');
}

// Error reporting utility for manual error reporting
export function reportError(error: unknown, context?: string) {
  const appError = classifyError(error);
  logError(appError, context);

  // Attempt recovery
  errorRecoveryManager.attemptRecovery(appError).catch(() => {
    // Recovery failed, error is already logged
  });
}

// Performance monitoring for error correlation
export function setupPerformanceMonitoring() {
  if (typeof window === 'undefined' || !('performance' in window)) {
    return;
  }

  // Monitor long tasks that might cause errors
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            // Tasks longer than 50ms
            console.warn('Long task detected:', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
            });
          }
        }
      });

      observer.observe({ entryTypes: ['longtask'] });
    } catch (error) {
      console.warn('Performance monitoring not available:', error);
    }
  }

  // Monitor memory usage if available
  if ('memory' in performance) {
    const checkMemory = () => {
      const memory = (performance as any).memory;
      const usedPercent =
        (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

      if (usedPercent > 90) {
        console.warn('High memory usage detected:', {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
          percentage: usedPercent.toFixed(2) + '%',
        });
      }
    };

    // Check memory every 30 seconds
    setInterval(checkMemory, 30000);
  }
}

// Initialize error handling when this module is imported
if (typeof window !== 'undefined') {
  // Use setTimeout to ensure DOM is ready
  setTimeout(() => {
    setupGlobalErrorHandling();
    setupPerformanceMonitoring();
  }, 0);
}
