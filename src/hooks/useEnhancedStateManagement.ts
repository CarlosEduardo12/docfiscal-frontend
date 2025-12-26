/**
 * React Hooks for Enhanced State Management
 * 
 * Provides hooks for automatic UI updates, state persistence, data consistency,
 * failure recovery, and optimistic updates.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  createEnhancedStateManagement, 
  StateUpdateOptions, 
  StateUpdateResult,
  EnhancedStateManager,
  StateSynchronizer,
  NavigationStateManager
} from '@/lib/enhanced-state-management';
import { queryKeys } from '@/lib/react-query';

/**
 * Hook for enhanced state management with automatic UI updates
 */
export function useEnhancedStateManagement() {
  const queryClient = useQueryClient();
  const stateSystemRef = useRef<ReturnType<typeof createEnhancedStateManagement> | null>(null);

  // Initialize state management system
  if (!stateSystemRef.current) {
    stateSystemRef.current = createEnhancedStateManagement(queryClient);
  }

  const stateSystem = stateSystemRef.current;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stateSystem.cleanup();
    };
  }, [stateSystem]);

  return stateSystem;
}

/**
 * Hook for optimistic order status updates with rollback support
 */
export function useOptimisticOrderUpdate() {
  const { updateOrderStatus, handleFailure } = useEnhancedStateManagement();

  const updateStatus = useCallback(async (
    orderId: string,
    newStatus: string,
    options: StateUpdateOptions = { optimistic: true, rollbackOnError: true }
  ): Promise<StateUpdateResult> => {
    try {
      const result = await updateOrderStatus(orderId, newStatus, options);
      
      if (!result.success && result.error) {
        // Handle failure with recovery mechanisms
        const queryKey = queryKeys.orders.byId(orderId);
        await handleFailure(queryKey, result.error, options);
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }, [updateOrderStatus, handleFailure]);

  return { updateStatus };
}

/**
 * Hook for state persistence across navigation
 */
export function useStatePersistence() {
  const { persistAcrossNavigation } = useEnhancedStateManagement();

  const persistQuery = useCallback((queryKey: any) => {
    persistAcrossNavigation(queryKey);
  }, [persistAcrossNavigation]);

  const persistOrderQueries = useCallback((orderId: string) => {
    persistQuery(queryKeys.orders.byId(orderId));
  }, [persistQuery]);

  const persistUserQueries = useCallback((userId: string) => {
    persistQuery(queryKeys.orders.byUser(userId));
    persistQuery(queryKeys.auth.currentUser);
  }, [persistQuery]);

  return {
    persistQuery,
    persistOrderQueries,
    persistUserQueries,
  };
}

/**
 * Hook for ensuring data consistency across components
 */
export function useDataConsistency() {
  const { ensureConsistency } = useEnhancedStateManagement();

  const ensureOrderConsistency = useCallback((orderId: string) => {
    ensureConsistency(orderId);
  }, [ensureConsistency]);

  const ensureGlobalConsistency = useCallback(() => {
    // Invalidate all queries to ensure consistency
    const queryClient = useQueryClient();
    queryClient.invalidateQueries();
  }, []);

  return {
    ensureOrderConsistency,
    ensureGlobalConsistency,
  };
}

/**
 * Hook for handling state update failures with recovery
 */
export function useStateRecovery() {
  const queryClient = useQueryClient();
  const { handleFailure } = useEnhancedStateManagement();

  const recoverFromFailure = useCallback(async (
    queryKey: any,
    error: Error,
    options?: StateUpdateOptions
  ) => {
    const recovery = await handleFailure(queryKey, error, options);
    return recovery;
  }, [handleFailure]);

  const retryQuery = useCallback(async (queryKey: any) => {
    await queryClient.refetchQueries({ queryKey });
  }, [queryClient]);

  const rollbackQuery = useCallback((queryKey: any, rollbackData: any) => {
    queryClient.setQueryData(queryKey, rollbackData);
  }, [queryClient]);

  const refreshQuery = useCallback(async (queryKey: any) => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient]);

  return {
    recoverFromFailure,
    retryQuery,
    rollbackQuery,
    refreshQuery,
  };
}

/**
 * Hook for monitoring state changes and propagating updates
 */
export function useStateChangeMonitor() {
  const queryClient = useQueryClient();
  const { stateManager } = useEnhancedStateManagement();

  const monitorOrderChanges = useCallback((orderId: string, callback: (newData: any) => void) => {
    const queryKey = queryKeys.orders.byId(orderId);
    
    // Subscribe to query changes
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && 
          event.query.queryKey.toString() === queryKey.toString()) {
        callback(event.query.state.data);
      }
    });

    return unsubscribe;
  }, [queryClient]);

  const getOptimisticUpdates = useCallback(() => {
    return stateManager.getOptimisticUpdates();
  }, [stateManager]);

  const hasPendingUpdates = useCallback(() => {
    return stateManager.hasPendingOptimisticUpdates();
  }, [stateManager]);

  return {
    monitorOrderChanges,
    getOptimisticUpdates,
    hasPendingUpdates,
  };
}

/**
 * Hook for batch state operations
 */
export function useBatchStateOperations() {
  const { stateSynchronizer } = useEnhancedStateManagement();

  const batchUpdateOrders = useCallback(async (
    updates: Array<{ orderId: string; data: any; options?: StateUpdateOptions }>
  ) => {
    const queryUpdates = updates.map(update => ({
      queryKey: queryKeys.orders.byId(update.orderId),
      data: update.data,
      options: update.options,
    }));

    return await stateSynchronizer.handleConcurrentUpdates(queryUpdates);
  }, [stateSynchronizer]);

  const synchronizeQueries = useCallback(async (queryKeys: any[]) => {
    await stateSynchronizer.synchronizeQueries(queryKeys);
  }, [stateSynchronizer]);

  return {
    batchUpdateOrders,
    synchronizeQueries,
  };
}

/**
 * Hook for automatic state management setup
 */
export function useAutoStateManagement(options: {
  enableOptimisticUpdates?: boolean;
  enableStatePersistence?: boolean;
  enableAutoRecovery?: boolean;
} = {}) {
  const {
    enableOptimisticUpdates = true,
    enableStatePersistence = true,
    enableAutoRecovery = true,
  } = options;

  const { updateStatus } = useOptimisticOrderUpdate();
  const { persistUserQueries } = useStatePersistence();
  const { ensureGlobalConsistency } = useDataConsistency();
  const { recoverFromFailure } = useStateRecovery();

  // Auto-setup based on options
  useEffect(() => {
    if (enableStatePersistence) {
      // Persist common queries
      persistUserQueries('current');
    }

    if (enableAutoRecovery) {
      // Set up global error handling
      window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        // Could trigger recovery mechanisms here
      });
    }
  }, [enableStatePersistence, enableAutoRecovery, persistUserQueries]);

  const updateOrderWithOptions = useCallback(async (
    orderId: string,
    newStatus: string
  ) => {
    const options: StateUpdateOptions = {
      optimistic: enableOptimisticUpdates,
      rollbackOnError: enableAutoRecovery,
      persistAcrossNavigation: enableStatePersistence,
    };

    return await updateStatus(orderId, newStatus, options);
  }, [updateStatus, enableOptimisticUpdates, enableAutoRecovery, enableStatePersistence]);

  return {
    updateOrder: updateOrderWithOptions,
    ensureConsistency: ensureGlobalConsistency,
    recoverFromFailure,
  };
}