'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/react-query';
import { useEffect } from 'react';
import {
  ErrorBoundary,
  handleErrorBoundaryError,
} from '@/components/error/ErrorBoundary';

// Navigation state initialization component
function NavigationStateInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Initialize navigation state management on app load
    const initializeNavigation = async () => {
      // Import navigation state manager dynamically to avoid SSR issues
      const { NavigationStateManager } = await import('@/lib/navigation-state');

      // Load persisted state
      if (typeof window !== 'undefined') {
        try {
          const manager = NavigationStateManager.getInstance();
          manager.loadFromStorage();
        } catch (error) {
          console.warn('Failed to initialize navigation state:', error);
        }
      }
    };

    initializeNavigation();
  }, []);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary onError={handleErrorBoundaryError}>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationStateInitializer>
            {children}
            {process.env.NODE_ENV === 'development' && (
              <ReactQueryDevtools initialIsOpen={false} />
            )}
          </NavigationStateInitializer>
        </QueryClientProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
