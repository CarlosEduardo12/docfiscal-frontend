'use client';

import { useEffect, useState } from 'react';
import { authTokenManager } from '@/lib/AuthTokenManager';

interface AuthPersistenceState {
  isInitialized: boolean;
  hasValidSession: boolean;
  isRefreshing: boolean;
  lastRefreshAttempt: Date | null;
}

/**
 * Hook for managing authentication persistence across page refreshes
 * Automatically handles token refresh and session restoration
 */
export function useAuthPersistence() {
  const [state, setState] = useState<AuthPersistenceState>({
    isInitialized: false,
    hasValidSession: false,
    isRefreshing: false,
    lastRefreshAttempt: null,
  });

  useEffect(() => {
    initializePersistence();
  }, []);

  const initializePersistence = async () => {
    try {
      setState(prev => ({ ...prev, isRefreshing: true }));

      // Initialize the token manager
      const hasValidSession = await authTokenManager.initialize();

      setState({
        isInitialized: true,
        hasValidSession,
        isRefreshing: false,
        lastRefreshAttempt: new Date(),
      });

      console.log(`✅ Auth persistence initialized - Valid session: ${hasValidSession}`);
    } catch (error) {
      console.error('❌ Auth persistence initialization failed:', error);
      
      setState({
        isInitialized: true,
        hasValidSession: false,
        isRefreshing: false,
        lastRefreshAttempt: new Date(),
      });
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isRefreshing: true }));

      const refreshResult = await authTokenManager.refreshToken();
      const success = refreshResult.success;

      setState(prev => ({
        ...prev,
        hasValidSession: success,
        isRefreshing: false,
        lastRefreshAttempt: new Date(),
      }));

      return success;
    } catch (error) {
      console.error('❌ Session refresh failed:', error);
      
      setState(prev => ({
        ...prev,
        hasValidSession: false,
        isRefreshing: false,
        lastRefreshAttempt: new Date(),
      }));

      return false;
    }
  };

  const clearSession = () => {
    authTokenManager.clearTokens();
    setState(prev => ({
      ...prev,
      hasValidSession: false,
      lastRefreshAttempt: new Date(),
    }));
  };

  return {
    ...state,
    refreshSession,
    clearSession,
  };
}