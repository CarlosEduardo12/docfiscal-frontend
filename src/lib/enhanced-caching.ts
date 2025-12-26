/**
 * Enhanced caching utilities for API optimization
 * Implements intelligent caching strategies and cache management
 */

import { QueryClient, QueryKey } from '@tanstack/react-query';

// Cache configuration
export const CACHE_CONFIG = {
  // Default stale times for different data types (in milliseconds)
  STALE_TIMES: {
    USER_DATA: 10 * 60 * 1000, // 10 minutes
    ORDER_DATA: 2 * 60 * 1000,  // 2 minutes
    STATIC_DATA: 60 * 60 * 1000, // 1 hour
    REAL_TIME_DATA: 30 * 1000,   // 30 seconds
  },
  
  // Garbage collection times
  GC_TIMES: {
    SHORT: 5 * 60 * 1000,      // 5 minutes
    MEDIUM: 30 * 60 * 1000,    // 30 minutes
    LONG: 24 * 60 * 60 * 1000, // 24 hours
  },
  
  // Cache size limits
  MAX_CACHE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_ENTRIES: 1000,
  
  // Retry configuration
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 1000, // 1 second
} as const;

/**
 * Enhanced query client with intelligent caching
 */
export function createEnhancedQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CACHE_CONFIG.STALE_TIMES.ORDER_DATA,
        gcTime: CACHE_CONFIG.GC_TIMES.MEDIUM,
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors (client errors)
          if (error instanceof Error) {
            const status = (error as any).status;
            if (status >= 400 && status < 500) {
              return false;
            }
          }
          
          return failureCount < CACHE_CONFIG.RETRY_ATTEMPTS;
        },
        retryDelay: (attemptIndex) => 
          Math.min(CACHE_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attemptIndex), 30000),
        
        // Enable background refetching for better UX
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: false, // Avoid unnecessary refetches
      },
      mutations: {
        retry: (failureCount, error) => {
          // Only retry mutations on network errors
          if (error instanceof Error && error.message.includes('fetch')) {
            return failureCount < 2;
          }
          return false;
        },
      },
    },
  });
}

/**
 * Cache key factory with consistent naming
 */
export const cacheKeys = {
  // User-related queries
  user: {
    profile: (userId: string) => ['user', 'profile', userId] as const,
    preferences: (userId: string) => ['user', 'preferences', userId] as const,
  },
  
  // Order-related queries
  orders: {
    all: ['orders'] as const,
    list: (filters?: Record<string, any>) => ['orders', 'list', filters] as const,
    byId: (orderId: string) => ['orders', 'detail', orderId] as const,
    byUser: (userId: string, params?: Record<string, any>) => 
      ['orders', 'user', userId, params] as const,
    status: (orderId: string) => ['orders', 'status', orderId] as const,
  },
  
  // Payment-related queries
  payments: {
    all: ['payments'] as const,
    byId: (paymentId: string) => ['payments', paymentId] as const,
    byOrder: (orderId: string) => ['payments', 'order', orderId] as const,
  },
  
  // Upload-related queries
  uploads: {
    progress: (uploadId: string) => ['uploads', 'progress', uploadId] as const,
    history: (userId: string) => ['uploads', 'history', userId] as const,
  },
  
  // Static data
  static: {
    config: ['static', 'config'] as const,
    pricing: ['static', 'pricing'] as const,
  },
} as const;

/**
 * Cache invalidation strategies
 */
export class CacheInvalidator {
  constructor(private queryClient: QueryClient) {}

  /**
   * Invalidate user-related data
   */
  invalidateUser(userId: string) {
    this.queryClient.invalidateQueries({
      queryKey: cacheKeys.user.profile(userId)
    });
    this.queryClient.invalidateQueries({
      queryKey: cacheKeys.user.preferences(userId)
    });
  }

  /**
   * Invalidate order-related data
   */
  invalidateOrders(userId?: string) {
    this.queryClient.invalidateQueries({
      queryKey: cacheKeys.orders.all
    });
    
    if (userId) {
      this.queryClient.invalidateQueries({
        queryKey: cacheKeys.orders.byUser(userId)
      });
    }
  }

  /**
   * Invalidate specific order
   */
  invalidateOrder(orderId: string) {
    this.queryClient.invalidateQueries({
      queryKey: cacheKeys.orders.byId(orderId)
    });
    this.queryClient.invalidateQueries({
      queryKey: cacheKeys.orders.status(orderId)
    });
  }

  /**
   * Invalidate payment data
   */
  invalidatePayments(orderId?: string) {
    this.queryClient.invalidateQueries({
      queryKey: cacheKeys.payments.all
    });
    
    if (orderId) {
      this.queryClient.invalidateQueries({
        queryKey: cacheKeys.payments.byOrder(orderId)
      });
    }
  }

  /**
   * Smart invalidation based on mutation type
   */
  invalidateAfterMutation(mutationType: string, data: any) {
    switch (mutationType) {
      case 'createOrder':
        this.invalidateOrders(data.userId);
        break;
      case 'updateOrder':
        this.invalidateOrder(data.orderId);
        this.invalidateOrders(data.userId);
        break;
      case 'createPayment':
        this.invalidateOrder(data.orderId);
        this.invalidatePayments(data.orderId);
        break;
      case 'updateUser':
        this.invalidateUser(data.userId);
        break;
      default:
        // Conservative approach: invalidate all
        this.queryClient.invalidateQueries();
    }
  }
}

/**
 * Cache optimization utilities
 */
export class CacheOptimizer {
  constructor(private queryClient: QueryClient) {}

  /**
   * Prefetch related data
   */
  async prefetchRelatedData(queryKey: QueryKey, data: any) {
    // Prefetch user orders when user profile is loaded
    if (queryKey[0] === 'user' && queryKey[1] === 'profile') {
      const userId = queryKey[2] as string;
      await this.queryClient.prefetchQuery({
        queryKey: cacheKeys.orders.byUser(userId),
        queryFn: () => this.fetchUserOrders(userId),
        staleTime: CACHE_CONFIG.STALE_TIMES.ORDER_DATA,
      });
    }
    
    // Prefetch payment data when order is loaded
    if (queryKey[0] === 'orders' && queryKey[1] === 'detail') {
      const orderId = queryKey[2] as string;
      if (data.payment_id) {
        await this.queryClient.prefetchQuery({
          queryKey: cacheKeys.payments.byId(data.payment_id),
          queryFn: () => this.fetchPayment(data.payment_id),
          staleTime: CACHE_CONFIG.STALE_TIMES.ORDER_DATA,
        });
      }
    }
  }

  /**
   * Optimize cache size by removing old entries
   */
  optimizeCacheSize() {
    const cache = this.queryClient.getQueryCache();
    const queries = cache.getAll();
    
    // Sort by last updated time
    const sortedQueries = queries.sort((a, b) => {
      const aTime = a.state.dataUpdatedAt || 0;
      const bTime = b.state.dataUpdatedAt || 0;
      return aTime - bTime;
    });
    
    // Remove oldest entries if we exceed limits
    if (queries.length > CACHE_CONFIG.MAX_ENTRIES) {
      const toRemove = queries.length - CACHE_CONFIG.MAX_ENTRIES;
      for (let i = 0; i < toRemove; i++) {
        cache.remove(sortedQueries[i]);
      }
    }
  }

  /**
   * Set appropriate stale times based on data type
   */
  setOptimalStaleTime(queryKey: QueryKey): number {
    const [category, type] = queryKey;
    
    switch (category) {
      case 'user':
        return CACHE_CONFIG.STALE_TIMES.USER_DATA;
      case 'orders':
        if (type === 'status') {
          return CACHE_CONFIG.STALE_TIMES.REAL_TIME_DATA;
        }
        return CACHE_CONFIG.STALE_TIMES.ORDER_DATA;
      case 'static':
        return CACHE_CONFIG.STALE_TIMES.STATIC_DATA;
      default:
        return CACHE_CONFIG.STALE_TIMES.ORDER_DATA;
    }
  }

  // Mock fetch functions (would be replaced with actual API calls)
  private async fetchUserOrders(userId: string) {
    // Mock implementation
    return { orders: [], total: 0 };
  }

  private async fetchPayment(paymentId: string) {
    // Mock implementation
    return { id: paymentId, status: 'pending' };
  }
}

/**
 * Cache performance monitoring
 */
export class CacheMetrics {
  private static metrics = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    prefetches: 0,
    totalQueries: 0,
  };

  static recordHit() {
    this.metrics.hits++;
    this.metrics.totalQueries++;
  }

  static recordMiss() {
    this.metrics.misses++;
    this.metrics.totalQueries++;
  }

  static recordInvalidation() {
    this.metrics.invalidations++;
  }

  static recordPrefetch() {
    this.metrics.prefetches++;
  }

  static getHitRatio(): number {
    return this.metrics.totalQueries > 0 
      ? this.metrics.hits / this.metrics.totalQueries 
      : 0;
  }

  static getMetrics() {
    return {
      ...this.metrics,
      hitRatio: this.getHitRatio(),
    };
  }

  static reset() {
    this.metrics = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      prefetches: 0,
      totalQueries: 0,
    };
  }
}

/**
 * Enhanced cache persistence
 */
export class CachePersistence {
  private static readonly STORAGE_KEY = 'docfiscal-cache-v1';
  private static readonly MAX_STORAGE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Save cache to localStorage with size limits
   */
  static saveToStorage(data: any) {
    try {
      const serialized = JSON.stringify(data);
      
      if (serialized.length > this.MAX_STORAGE_SIZE) {
        console.warn('Cache data too large for localStorage, skipping persistence');
        return;
      }
      
      localStorage.setItem(this.STORAGE_KEY, serialized);
    } catch (error) {
      console.warn('Failed to save cache to localStorage:', error);
    }
  }

  /**
   * Load cache from localStorage
   */
  static loadFromStorage(): any {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error);
      return null;
    }
  }

  /**
   * Clear persisted cache
   */
  static clearStorage() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear cache from localStorage:', error);
    }
  }
}