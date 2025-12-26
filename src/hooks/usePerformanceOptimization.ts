/**
 * Performance optimization hook
 * Provides utilities for lazy loading, caching, and asset optimization
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  AssetLazyLoadManager, 
  AssetOptimizer, 
  AssetPerformanceMonitor,
  type AssetInfo 
} from '@/lib/asset-optimization';
import { 
  CacheOptimizer, 
  CacheInvalidator, 
  CacheMetrics 
} from '@/lib/enhanced-caching';
import { 
  LazyLoadingMetrics, 
  shouldLazyLoadComponent 
} from '@/lib/lazy-loading';

/**
 * Performance optimization configuration
 */
interface PerformanceConfig {
  enableLazyLoading?: boolean;
  enableAssetOptimization?: boolean;
  enableCacheOptimization?: boolean;
  monitorPerformance?: boolean;
}

/**
 * Performance metrics interface
 */
interface PerformanceMetrics {
  cacheHitRatio: number;
  lazyLoadedComponents: number;
  optimizedAssets: number;
  bandwidthSaved: number;
  averageLoadTime: number;
}

/**
 * Hook for performance optimization
 */
export function usePerformanceOptimization(config: PerformanceConfig = {}) {
  const {
    enableLazyLoading = true,
    enableAssetOptimization = true,
    enableCacheOptimization = true,
    monitorPerformance = process.env.NODE_ENV === 'development',
  } = config;

  const queryClient = useQueryClient();
  const cacheOptimizer = useRef<CacheOptimizer>();
  const cacheInvalidator = useRef<CacheInvalidator>();
  const performanceObserver = useRef<PerformanceObserver>();

  // Initialize optimizers
  useEffect(() => {
    if (enableCacheOptimization) {
      cacheOptimizer.current = new CacheOptimizer(queryClient);
      cacheInvalidator.current = new CacheInvalidator(queryClient);
    }

    if (enableLazyLoading) {
      AssetLazyLoadManager.initialize();
    }

    // Set up performance monitoring
    if (monitorPerformance && typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      performanceObserver.current = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            console.log('Navigation timing:', entry);
          } else if (entry.entryType === 'resource') {
            console.log('Resource timing:', entry.name, entry.duration);
          }
        });
      });

      try {
        performanceObserver.current.observe({ 
          entryTypes: ['navigation', 'resource', 'measure'] 
        });
      } catch (error) {
        console.warn('Performance observer not supported:', error);
      }
    }

    return () => {
      if (enableLazyLoading) {
        AssetLazyLoadManager.cleanup();
      }
      
      if (performanceObserver.current) {
        performanceObserver.current.disconnect();
      }
    };
  }, [enableLazyLoading, enableAssetOptimization, enableCacheOptimization, monitorPerformance, queryClient]);

  /**
   * Optimize and preload assets
   */
  const optimizeAssets = useCallback((assets: AssetInfo[]) => {
    if (!enableAssetOptimization) return assets;

    const optimization = AssetOptimizer.optimizeAssets(assets);
    
    // Preload critical assets
    AssetLazyLoadManager.preloadCriticalAssets(assets);
    
    if (monitorPerformance) {
      console.log('Asset optimization results:', {
        totalSavings: `${(optimization.totalSavings * 100).toFixed(1)}%`,
        initialLoadSize: `${(optimization.initialLoadSize / 1024).toFixed(1)}KB`,
        totalSize: `${(optimization.totalSize / 1024).toFixed(1)}KB`,
      });
    }

    return optimization.results;
  }, [enableAssetOptimization, monitorPerformance]);

  /**
   * Set up lazy loading for an element
   */
  const setupLazyLoading = useCallback((element: HTMLElement) => {
    if (!enableLazyLoading) return;

    AssetLazyLoadManager.observe(element);
  }, [enableLazyLoading]);

  /**
   * Check if a component should be lazy loaded
   */
  const shouldLazyLoad = useCallback((componentName: string) => {
    if (!enableLazyLoading) return false;
    return shouldLazyLoadComponent(componentName);
  }, [enableLazyLoading]);

  /**
   * Invalidate cache intelligently
   */
  const invalidateCache = useCallback((mutationType: string, data: any) => {
    if (!enableCacheOptimization || !cacheInvalidator.current) return;

    cacheInvalidator.current.invalidateAfterMutation(mutationType, data);
    
    if (monitorPerformance) {
      CacheMetrics.recordInvalidation();
    }
  }, [enableCacheOptimization, monitorPerformance]);

  /**
   * Prefetch related data
   */
  const prefetchRelatedData = useCallback(async (queryKey: any[], data: any) => {
    if (!enableCacheOptimization || !cacheOptimizer.current) return;

    await cacheOptimizer.current.prefetchRelatedData(queryKey, data);
    
    if (monitorPerformance) {
      CacheMetrics.recordPrefetch();
    }
  }, [enableCacheOptimization, monitorPerformance]);

  /**
   * Optimize cache size
   */
  const optimizeCacheSize = useCallback(() => {
    if (!enableCacheOptimization || !cacheOptimizer.current) return;

    cacheOptimizer.current.optimizeCacheSize();
  }, [enableCacheOptimization]);

  /**
   * Get performance metrics
   */
  const getPerformanceMetrics = useCallback((): PerformanceMetrics => {
    const cacheMetrics = CacheMetrics.getMetrics();
    const lazyLoadMetrics = LazyLoadingMetrics.getMetrics();
    const assetMetrics = AssetPerformanceMonitor.getMetrics();

    return {
      cacheHitRatio: cacheMetrics.hitRatio,
      lazyLoadedComponents: lazyLoadMetrics.componentsLoaded,
      optimizedAssets: assetMetrics.loadedAssets,
      bandwidthSaved: assetMetrics.bandwidthSaved,
      averageLoadTime: assetMetrics.averageLoadTime,
    };
  }, []);

  /**
   * Measure performance of an operation
   */
  const measurePerformance = useCallback(<T>(
    name: string,
    operation: () => T | Promise<T>
  ): T | Promise<T> => {
    if (!monitorPerformance) return operation();

    const startTime = performance.now();
    const result = operation();

    if (result instanceof Promise) {
      return result.finally(() => {
        const endTime = performance.now();
        console.log(`${name} took ${endTime - startTime} milliseconds`);
        
        // Create a performance measure
        performance.mark(`${name}-end`);
        performance.measure(name, `${name}-start`, `${name}-end`);
      });
    } else {
      const endTime = performance.now();
      console.log(`${name} took ${endTime - startTime} milliseconds`);
      
      // Create a performance measure
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      
      return result;
    }
  }, [monitorPerformance]);

  /**
   * Create optimized image props for lazy loading
   */
  const createOptimizedImageProps = useCallback((
    src: string,
    options: {
      priority?: 'critical' | 'high' | 'medium' | 'low';
      position?: 'above-fold' | 'below-fold';
      placeholder?: string;
    } = {}
  ) => {
    const { priority = 'medium', position = 'below-fold', placeholder } = options;
    
    if (!enableLazyLoading || priority === 'critical') {
      return { src, loading: 'eager' as const };
    }

    return {
      src: placeholder || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNGM0Y0RjYiLz48L3N2Zz4=',
      'data-src': src,
      loading: 'lazy' as const,
      onLoad: (e: React.SyntheticEvent<HTMLImageElement>) => {
        setupLazyLoading(e.currentTarget);
      }
    };
  }, [enableLazyLoading, setupLazyLoading]);

  return {
    // Asset optimization
    optimizeAssets,
    setupLazyLoading,
    createOptimizedImageProps,
    
    // Component lazy loading
    shouldLazyLoad,
    
    // Cache optimization
    invalidateCache,
    prefetchRelatedData,
    optimizeCacheSize,
    
    // Performance monitoring
    getPerformanceMetrics,
    measurePerformance,
    
    // Configuration
    config: {
      enableLazyLoading,
      enableAssetOptimization,
      enableCacheOptimization,
      monitorPerformance,
    },
  };
}

/**
 * Hook for component-specific performance optimization
 */
export function useComponentPerformance(componentName: string) {
  const { shouldLazyLoad, measurePerformance } = usePerformanceOptimization();
  
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      LazyLoadingMetrics.recordComponentLoad(componentName, loadTime);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Component ${componentName} rendered in ${loadTime}ms`);
      }
    };
  }, [componentName]);

  return {
    shouldLazyLoad: shouldLazyLoad(componentName),
    measurePerformance,
  };
}

/**
 * Hook for asset-specific performance optimization
 */
export function useAssetPerformance() {
  const { optimizeAssets, createOptimizedImageProps } = usePerformanceOptimization();
  
  const recordAssetLoad = useCallback((asset: AssetInfo, loadTime: number) => {
    AssetPerformanceMonitor.recordAssetLoad(asset, loadTime, true);
  }, []);

  const recordAssetFailure = useCallback((asset: AssetInfo) => {
    AssetPerformanceMonitor.recordFailure(asset);
  }, []);

  return {
    optimizeAssets,
    createOptimizedImageProps,
    recordAssetLoad,
    recordAssetFailure,
  };
}