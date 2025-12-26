'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthPersistence } from '@/hooks/useAuthPersistence';

interface SessionPersistenceProps {
  children: React.ReactNode;
}

/**
 * Component that handles session persistence and automatic token refresh
 * Should be placed high in the component tree to ensure session is maintained
 */
export function SessionPersistence({ children }: SessionPersistenceProps) {
  const auth = useAuth();
  const persistence = useAuthPersistence();

  useEffect(() => {
    // Set up automatic token refresh interval
    const refreshInterval = setInterval(async () => {
      if (auth.isAuthenticated && !persistence.isRefreshing) {
        console.log('🔄 Performing automatic session refresh...');
        const success = await auth.refreshSession();
        
        if (!success) {
          console.log('❌ Automatic session refresh failed, user will need to re-login');
        }
      }
    }, 15 * 60 * 1000); // Refresh every 15 minutes

    return () => {
      clearInterval(refreshInterval);
    };
  }, [auth.isAuthenticated, auth.refreshSession, persistence.isRefreshing]);

  useEffect(() => {
    // Handle page visibility change - refresh session when page becomes visible
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && auth.isAuthenticated) {
        const timeSinceLastRefresh = persistence.lastRefreshAttempt 
          ? Date.now() - persistence.lastRefreshAttempt.getTime()
          : Infinity;

        // Only refresh if it's been more than 5 minutes since last refresh
        if (timeSinceLastRefresh > 5 * 60 * 1000) {
          console.log('🔄 Page became visible, refreshing session...');
          await auth.refreshSession();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [auth.isAuthenticated, auth.refreshSession, persistence.lastRefreshAttempt]);

  useEffect(() => {
    // Handle storage events (for multi-tab synchronization)
    const handleStorageChange = (event: StorageEvent) => {
      // If tokens were cleared in another tab, update this tab's state
      if (event.key?.startsWith('docfiscal_') && event.newValue === null) {
        console.log('🔄 Tokens cleared in another tab, updating state...');
        persistence.clearSession();
        
        if (auth.isAuthenticated) {
          auth.logout();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [auth.isAuthenticated, auth.logout, persistence.clearSession]);

  // Show loading state while initializing
  if (!persistence.isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Initializing session...</span>
      </div>
    );
  }

  return <>{children}</>;
}