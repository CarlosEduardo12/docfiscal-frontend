/**
 * Enhanced State Management System
 * 
 * Provides automatic UI updates for order status changes, state persistence during navigation,
 * single source of truth for data consistency, graceful handling of state update failures,
 * and optimistic updates with rollback functionality.
 */

import { QueryClient, QueryKey } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query';

export interface StateUpdateOptions {
  optimistic?: boolean;
  rollbackOnError?: boolean;
  persistAcrossNavigation?: boolean;
}

export interface StateRecoveryMechanism {
  retry: () => Promise<void>;
  rollback: () => void;
  refresh: () => Promise<void>;
}

export interface StateUpdateResult {
  success: boolean;
  error?: Error;
  recovery?: StateRecoveryMechanism;
}

/**
 * Enhanced State Manager for centralized state operations
 */
export class EnhancedStateManager {
  private queryClient: QueryClient;
  private optimisticUpdates: Map<string, any> = new Map();
  private rollbackData: Map<string, any> = new Map();

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  /**
   * Update order status with optimistic updates and rollback support
   */
  async updateOrderStatus(
    orderId: string, 
    newStatus: string, 
    options: StateUpdateOptions = {}
  ): Promise<StateUpdateResult> {
    const queryKey = queryKeys.orders.byId(orderId);
    const keyString = JSON.stringify(queryKey);

    try {
      // Store current data for potential rollback
      const currentData = this.queryClient.getQueryData(queryKey);
      if (currentData && options.rollbackOnError) {
        this.rollbackData.set(keyString, currentData);
      }

      // Apply optimistic update if requested
      if (options.optimistic) {
        const optimisticData = { ...currentData, status: newStatus };
        this.optimisticUpdates.set(keyString, optimisticData);
        this.queryClient.setQueryData(queryKey, optimisticData);
      }

      // Propagate updates to all related queries
      this.propagateStateChanges(orderId, { status: newStatus });

      return {
        success: true,
        recovery: this.createRecoveryMechanism(queryKey, keyString),
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        recovery: this.createRecoveryMechanism(queryKey, keyString),
      };
    }
  }

  /**
   * Propagate state changes to all relevant components
   */
  private propagateStateChanges(orderId: string, updates: Partial<any>): void {
    // Update individual order query
    const orderQueryKey = queryKeys.orders.byId(orderId);
    const currentOrderData = this.queryClient.getQueryData(orderQueryKey);
    if (currentOrderData) {
      this.queryClient.setQueryData(orderQueryKey, { ...currentOrderData, ...updates });
    }

    // Update user orders lists that might contain this order
    const queryCache = this.queryClient.getQueryCache();
    const queries = queryCache.getAll();

    queries.forEach(query => {
      const queryKey = query.queryKey;
      if (this.isUserOrdersQuery(queryKey)) {
        const data = query.state.data as any;
        if (data?.orders) {
          const updatedOrders = data.orders.map((order: any) =>
            order.id === orderId ? { ...order, ...updates } : order
          );
          this.queryClient.setQueryData(queryKey, { ...data, orders: updatedOrders });
        }
      }
    });
  }

  /**
   * Check if a query key represents a user orders query
   */
  private isUserOrdersQuery(queryKey: QueryKey): boolean {
    return Array.isArray(queryKey) && 
           queryKey.length >= 3 && 
           queryKey[0] === 'orders' && 
           queryKey[1] === 'user';
  }

  /**
   * Handle state update failures with recovery mechanisms
   */
  async handleStateFailure(
    queryKey: QueryKey, 
    error: Error, 
    options: StateUpdateOptions = {}
  ): Promise<StateRecoveryMechanism> {
    const keyString = JSON.stringify(queryKey);

    // Rollback optimistic update if it exists
    if (options.rollbackOnError && this.rollbackData.has(keyString)) {
      const rollbackData = this.rollbackData.get(keyString);
      this.queryClient.setQueryData(queryKey, rollbackData);
      this.optimisticUpdates.delete(keyString);
    }

    return this.createRecoveryMechanism(queryKey, keyString);
  }

  /**
   * Create recovery mechanisms for failed state updates
   */
  private createRecoveryMechanism(queryKey: QueryKey, keyString: string): StateRecoveryMechanism {
    return {
      retry: async () => {
        await this.queryClient.refetchQueries({ queryKey });
      },
      rollback: () => {
        if (this.rollbackData.has(keyString)) {
          const rollbackData = this.rollbackData.get(keyString);
          this.queryClient.setQueryData(queryKey, rollbackData);
          this.optimisticUpdates.delete(keyString);
          this.rollbackData.delete(keyString);
        }
      },
      refresh: async () => {
        await this.queryClient.invalidateQueries({ queryKey });
      },
    };
  }

  /**
   * Ensure data consistency across multiple components
   */
  ensureDataConsistency(orderId: string): void {
    const orderQueryKey = queryKeys.orders.byId(orderId);
    const orderData = this.queryClient.getQueryData(orderQueryKey);

    if (!orderData) return;

    // Ensure all queries using this order have consistent data
    const queryCache = this.queryClient.getQueryCache();
    const queries = queryCache.getAll();

    queries.forEach(query => {
      if (this.queryContainsOrder(query.queryKey, orderId)) {
        // Force consistency by invalidating and refetching
        this.queryClient.invalidateQueries({ queryKey: query.queryKey });
      }
    });
  }

  /**
   * Check if a query contains data for a specific order
   */
  private queryContainsOrder(queryKey: QueryKey, orderId: string): boolean {
    if (Array.isArray(queryKey)) {
      // Check if it's the specific order query
      if (queryKey[0] === 'orders' && queryKey[1] === orderId) {
        return true;
      }
      // Check if it's a user orders query that might contain this order
      if (queryKey[0] === 'orders' && queryKey[1] === 'user') {
        return true;
      }
    }
    return false;
  }

  /**
   * Persist state across navigation
   */
  persistStateAcrossNavigation(): void {
    // Configure query client for better persistence
    this.queryClient.setDefaultOptions({
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
    });
  }

  /**
   * Clean up optimistic updates and rollback data
   */
  cleanup(): void {
    this.optimisticUpdates.clear();
    this.rollbackData.clear();
  }

  /**
   * Get current optimistic updates
   */
  getOptimisticUpdates(): Map<string, any> {
    return new Map(this.optimisticUpdates);
  }

  /**
   * Check if there are pending optimistic updates
   */
  hasPendingOptimisticUpdates(): boolean {
    return this.optimisticUpdates.size > 0;
  }
}

/**
 * State synchronization utilities
 */
export class StateSynchronizer {
  private queryClient: QueryClient;
  private stateManager: EnhancedStateManager;

  constructor(queryClient: QueryClient, stateManager: EnhancedStateManager) {
    this.queryClient = queryClient;
    this.stateManager = stateManager;
  }

  /**
   * Synchronize state across multiple queries
   */
  async synchronizeQueries(queryKeys: QueryKey[]): Promise<void> {
    const promises = queryKeys.map(queryKey =>
      this.queryClient.refetchQueries({ queryKey })
    );

    try {
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to synchronize queries:', error);
      // Provide recovery mechanism
      throw error;
    }
  }

  /**
   * Handle concurrent state updates
   */
  async handleConcurrentUpdates(
    updates: Array<{ queryKey: QueryKey; data: any; options?: StateUpdateOptions }>
  ): Promise<StateUpdateResult[]> {
    const results: StateUpdateResult[] = [];

    // Process updates sequentially to avoid conflicts
    for (const update of updates) {
      try {
        const currentData = this.queryClient.getQueryData(update.queryKey);
        
        // Apply optimistic update if requested
        if (update.options?.optimistic) {
          this.queryClient.setQueryData(update.queryKey, update.data);
        }

        results.push({ success: true });
      } catch (error) {
        results.push({
          success: false,
          error: error as Error,
          recovery: this.stateManager['createRecoveryMechanism'](update.queryKey, JSON.stringify(update.queryKey)),
        });
      }
    }

    return results;
  }

  /**
   * Resolve state conflicts
   */
  resolveStateConflicts(
    queryKey: QueryKey,
    localData: any,
    serverData: any,
    strategy: 'server-wins' | 'local-wins' | 'merge' = 'server-wins'
  ): any {
    switch (strategy) {
      case 'server-wins':
        return serverData;
      case 'local-wins':
        return localData;
      case 'merge':
        return { ...localData, ...serverData };
      default:
        return serverData;
    }
  }
}

/**
 * Navigation state persistence manager
 */
export class NavigationStateManager {
  private queryClient: QueryClient;
  private persistedQueries: Set<string> = new Set();

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  /**
   * Mark queries for persistence across navigation
   */
  persistQuery(queryKey: QueryKey): void {
    const keyString = JSON.stringify(queryKey);
    this.persistedQueries.add(keyString);

    // Configure the specific query for persistence
    this.queryClient.setQueryDefaults(queryKey, {
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 60 * 60 * 1000, // 1 hour
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });
  }

  /**
   * Restore state after navigation
   */
  restoreStateAfterNavigation(): void {
    // Ensure persisted queries are not refetched unnecessarily
    this.persistedQueries.forEach(keyString => {
      const queryKey = JSON.parse(keyString);
      const query = this.queryClient.getQueryCache().find({ queryKey });
      
      if (query && query.state.data) {
        // Data is available, no need to refetch
        query.setState({
          ...query.state,
          dataUpdatedAt: Date.now(),
        });
      }
    });
  }

  /**
   * Clean up navigation state
   */
  cleanup(): void {
    this.persistedQueries.clear();
  }
}

/**
 * Factory function to create enhanced state management system
 */
export function createEnhancedStateManagement(queryClient: QueryClient) {
  const stateManager = new EnhancedStateManager(queryClient);
  const stateSynchronizer = new StateSynchronizer(queryClient, stateManager);
  const navigationStateManager = new NavigationStateManager(queryClient);

  // Configure query client for enhanced state management
  stateManager.persistStateAcrossNavigation();

  return {
    stateManager,
    stateSynchronizer,
    navigationStateManager,
    
    // Convenience methods
    updateOrderStatus: (orderId: string, status: string, options?: StateUpdateOptions) =>
      stateManager.updateOrderStatus(orderId, status, options),
    
    ensureConsistency: (orderId: string) =>
      stateManager.ensureDataConsistency(orderId),
    
    handleFailure: (queryKey: QueryKey, error: Error, options?: StateUpdateOptions) =>
      stateManager.handleStateFailure(queryKey, error, options),
    
    persistAcrossNavigation: (queryKey: QueryKey) =>
      navigationStateManager.persistQuery(queryKey),
    
    cleanup: () => {
      stateManager.cleanup();
      navigationStateManager.cleanup();
    },
  };
}