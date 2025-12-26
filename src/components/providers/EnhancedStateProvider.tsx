/**
 * Enhanced State Management Provider
 * 
 * Provides enhanced state management capabilities throughout the application,
 * including automatic UI updates, state persistence, data consistency,
 * failure recovery, and optimistic updates.
 */

'use client';

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  createEnhancedStateManagement,
  EnhancedStateManager,
  StateSynchronizer,
  NavigationStateManager
} from '@/lib/enhanced-state-management';

interface EnhancedStateContextValue {
  stateManager: EnhancedStateManager;
  stateSynchronizer: StateSynchronizer;
  navigationStateManager: NavigationStateManager;
  updateOrderStatus: (orderId: string, status: string, options?: any) => Promise<any>;
  ensureConsistency: (orderId: string) => void;
  handleFailure: (queryKey: any, error: Error, options?: any) => Promise<any>;
  persistAcrossNavigation: (queryKey: any) => void;
  cleanup: () => void;
}

const EnhancedStateContext = createContext<EnhancedStateContextValue | null>(null);

export interface EnhancedStateProviderProps {
  children: React.ReactNode;
  enableOptimisticUpdates?: boolean;
  enableStatePersistence?: boolean;
  enableAutoRecovery?: boolean;
}

export function EnhancedStateProvider({
  children,
  enableOptimisticUpdates = true,
  enableStatePersistence = true,
  enableAutoRecovery = true,
}: EnhancedStateProviderProps) {
  const queryClient = useQueryClient();
  const stateSystemRef = useRef<EnhancedStateContextValue | null>(null);

  // Initialize enhanced state management system
  if (!stateSystemRef.current) {
    const stateSystem = createEnhancedStateManagement(queryClient);
    stateSystemRef.current = stateSystem;
  }

  const stateSystem = stateSystemRef.current;

  // Setup automatic state management features
  useEffect(() => {
    if (enableStatePersistence) {
      // Configure query client for better persistence
      queryClient.setDefaultOptions({
        queries: {
          staleTime: 5 * 60 * 1000, // 5 minutes
          gcTime: 30 * 60 * 1000, // 30 minutes
          refetchOnWindowFocus: false,
          refetchOnMount: false,
        },
      });
    }

    if (enableAutoRecovery) {
      // Set up global error handling for state recovery
      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        console.error('Unhandled promise rejection in state management:', event.reason);
        
        // Could implement automatic recovery mechanisms here
        if (event.reason?.message?.includes('network') || 
            event.reason?.message?.includes('fetch')) {
          // Network error - could trigger retry logic
          console.log('Network error detected, recovery mechanisms available');
        }
      };

      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      return () => {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }
  }, [queryClient, enableStatePersistence, enableAutoRecovery]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stateSystem.cleanup();
    };
  }, [stateSystem]);

  return (
    <EnhancedStateContext.Provider value={stateSystem}>
      {children}
    </EnhancedStateContext.Provider>
  );
}

/**
 * Hook to access enhanced state management context
 */
export function useEnhancedStateContext() {
  const context = useContext(EnhancedStateContext);
  
  if (!context) {
    throw new Error('useEnhancedStateContext must be used within an EnhancedStateProvider');
  }
  
  return context;
}

/**
 * Higher-order component for enhanced state management
 */
export function withEnhancedState<P extends object>(
  Component: React.ComponentType<P>
) {
  return function EnhancedStateComponent(props: P) {
    return (
      <EnhancedStateProvider>
        <Component {...props} />
      </EnhancedStateProvider>
    );
  };
}

/**
 * Hook for component-level state management integration
 */
export function useComponentStateManagement(componentId: string) {
  const { 
    stateManager, 
    updateOrderStatus, 
    ensureConsistency,
    handleFailure 
  } = useEnhancedStateContext();

  const componentRef = useRef(componentId);

  // Track component state changes
  useEffect(() => {
    console.log(`Component ${componentId} initialized with enhanced state management`);
    
    return () => {
      console.log(`Component ${componentId} cleanup`);
    };
  }, [componentId]);

  const updateOrderWithTracking = async (orderId: string, status: string, options?: any) => {
    console.log(`Component ${componentId} updating order ${orderId} to status ${status}`);
    
    try {
      const result = await updateOrderStatus(orderId, status, {
        optimistic: true,
        rollbackOnError: true,
        ...options,
      });
      
      if (result.success) {
        console.log(`Component ${componentId} successfully updated order ${orderId}`);
      } else {
        console.error(`Component ${componentId} failed to update order ${orderId}:`, result.error);
      }
      
      return result;
    } catch (error) {
      console.error(`Component ${componentId} error updating order ${orderId}:`, error);
      throw error;
    }
  };

  const ensureOrderConsistency = (orderId: string) => {
    console.log(`Component ${componentId} ensuring consistency for order ${orderId}`);
    ensureConsistency(orderId);
  };

  return {
    updateOrder: updateOrderWithTracking,
    ensureConsistency: ensureOrderConsistency,
    handleFailure,
    stateManager,
  };
}

/**
 * Debug component for state management monitoring
 */
export function StateManagementDebugger() {
  const { stateManager } = useEnhancedStateContext();

  useEffect(() => {
    const interval = setInterval(() => {
      const optimisticUpdates = stateManager.getOptimisticUpdates();
      const hasPending = stateManager.hasPendingOptimisticUpdates();
      
      if (hasPending) {
        console.log('Pending optimistic updates:', Array.from(optimisticUpdates.entries()));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [stateManager]);

  return null; // This is a debug component, no UI
}