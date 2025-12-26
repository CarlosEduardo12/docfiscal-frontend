/**
 * Asset optimization utilities
 * Implements compression, lazy loading, and performance optimization for assets
 */

// Asset optimization configuration
export const ASSET_CONFIG = {
  // Size thresholds for optimization (in KB)
  COMPRESSION_THRESHOLD: 50,
  LAZY_LOAD_THRESHOLD: 100,
  PRELOAD_THRESHOLD: 20,
  
  // Compression ratios by format
  COMPRESSION_RATIOS: {
    'image/jpeg': 0.7,
    'image/png': 0.8,
    'image/webp': 0.6,
    'video/mp4': 0.9,
    'application/pdf': 0.85,
    'font/woff2': 0.75,
    'text/javascript': 0.65,
    'text/css': 0.7,
  },
  
  // Loading strategies
  LOADING_STRATEGIES: {
    CRITICAL: 'preload',
    ABOVE_FOLD: 'eager',
    BELOW_FOLD: 'lazy',
  },
  
  // Image formats by priority (best to worst)
  IMAGE_FORMAT_PRIORITY: ['webp', 'avif', 'jpeg', 'png'],
  
  // Intersection observer options
  OBSERVER_OPTIONS: {
    rootMargin: '50px',
    threshold: 0.1,
  },
} as const;

/**
 * Asset information interface
 */
export interface AssetInfo {
  url: string;
  type: 'image' | 'video' | 'document' | 'font' | 'script' | 'style';
  size: number; // in bytes
  format: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  position: 'above-fold' | 'below-fold';
}

/**
 * Optimization result interface
 */
export interface OptimizationResult {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  loadingStrategy: 'preload' | 'eager' | 'lazy';
  shouldCompress: boolean;
  format: string;
  optimizedUrl?: string;
}

/**
 * Asset optimizer class
 */
export class AssetOptimizer {
  private static compressionCache = new Map<string, OptimizationResult>();
  
  /**
   * Optimize a single asset
   */
  static optimizeAsset(asset: AssetInfo): OptimizationResult {
    const cacheKey = `${asset.url}-${asset.size}`;
    
    // Check cache first
    if (this.compressionCache.has(cacheKey)) {
      return this.compressionCache.get(cacheKey)!;
    }
    
    const result = this.calculateOptimization(asset);
    this.compressionCache.set(cacheKey, result);
    
    return result;
  }
  
  /**
   * Calculate optimization for an asset
   */
  private static calculateOptimization(asset: AssetInfo): OptimizationResult {
    const sizeInKB = asset.size / 1024;
    const compressionRatio = ASSET_CONFIG.COMPRESSION_RATIOS[
      asset.format as keyof typeof ASSET_CONFIG.COMPRESSION_RATIOS
    ] || 0.9;
    
    const shouldCompress = sizeInKB > ASSET_CONFIG.COMPRESSION_THRESHOLD;
    const optimizedSize = shouldCompress 
      ? Math.round(asset.size * compressionRatio)
      : asset.size;
    
    // Determine loading strategy
    let loadingStrategy: 'preload' | 'eager' | 'lazy';
    
    if (asset.priority === 'critical' || asset.priority === 'high') {
      loadingStrategy = 'preload';
    } else if (asset.position === 'above-fold' && sizeInKB <= ASSET_CONFIG.LAZY_LOAD_THRESHOLD) {
      loadingStrategy = 'eager';
    } else {
      loadingStrategy = 'lazy';
    }
    
    return {
      originalSize: asset.size,
      optimizedSize,
      compressionRatio,
      loadingStrategy,
      shouldCompress,
      format: asset.format,
    };
  }
  
  /**
   * Optimize multiple assets and calculate total savings
   */
  static optimizeAssets(assets: AssetInfo[]): {
    results: OptimizationResult[];
    totalSavings: number;
    initialLoadSize: number;
    totalSize: number;
  } {
    const results = assets.map(asset => this.optimizeAsset(asset));
    
    const totalOriginalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
    const totalOptimizedSize = results.reduce((sum, result) => sum + result.optimizedSize, 0);
    const totalSavings = totalOriginalSize > 0 
      ? (totalOriginalSize - totalOptimizedSize) / totalOriginalSize 
      : 0;
    
    const initialLoadSize = results
      .filter(result => result.loadingStrategy !== 'lazy')
      .reduce((sum, result) => sum + result.optimizedSize, 0);
    
    return {
      results,
      totalSavings,
      initialLoadSize,
      totalSize: totalOptimizedSize,
    };
  }
  
  /**
   * Get optimal image format based on browser support
   */
  static getOptimalImageFormat(originalFormat: string): string {
    if (typeof window === 'undefined') return originalFormat;
    
    // Check for WebP support
    if (this.supportsWebP()) {
      return 'image/webp';
    }
    
    // Check for AVIF support
    if (this.supportsAVIF()) {
      return 'image/avif';
    }
    
    return originalFormat;
  }
  
  /**
   * Check WebP support
   */
  private static supportsWebP(): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
  
  /**
   * Check AVIF support
   */
  private static supportsAVIF(): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
  }
}

/**
 * Lazy loading manager for assets
 */
export class AssetLazyLoadManager {
  private static observer: IntersectionObserver | null = null;
  private static loadedAssets = new Set<string>();
  private static loadingAssets = new Set<string>();
  
  /**
   * Initialize the intersection observer
   */
  static initialize() {
    if (typeof window === 'undefined' || this.observer) return;
    
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            this.loadAsset(element);
            this.observer?.unobserve(element);
          }
        });
      },
      ASSET_CONFIG.OBSERVER_OPTIONS
    );
  }
  
  /**
   * Observe an element for lazy loading
   */
  static observe(element: HTMLElement) {
    if (!this.observer) this.initialize();
    this.observer?.observe(element);
  }
  
  /**
   * Load an asset when it becomes visible
   */
  private static async loadAsset(element: HTMLElement) {
    const src = element.dataset.src;
    if (!src || this.loadedAssets.has(src) || this.loadingAssets.has(src)) {
      return;
    }
    
    this.loadingAssets.add(src);
    
    try {
      if (element.tagName === 'IMG') {
        await this.loadImage(element as HTMLImageElement, src);
      } else if (element.tagName === 'VIDEO') {
        await this.loadVideo(element as HTMLVideoElement, src);
      }
      
      this.loadedAssets.add(src);
    } catch (error) {
      console.warn(`Failed to load asset: ${src}`, error);
    } finally {
      this.loadingAssets.delete(src);
    }
  }
  
  /**
   * Load an image with optimization
   */
  private static async loadImage(img: HTMLImageElement, src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const optimizedSrc = this.getOptimizedImageUrl(src);
      
      img.onload = () => {
        img.removeAttribute('data-src');
        img.classList.remove('lazy-loading');
        img.classList.add('lazy-loaded');
        resolve();
      };
      
      img.onerror = () => {
        // Fallback to original src if optimized version fails
        if (optimizedSrc !== src) {
          img.src = src;
        } else {
          reject(new Error(`Failed to load image: ${src}`));
        }
      };
      
      img.src = optimizedSrc;
    });
  }
  
  /**
   * Load a video with optimization
   */
  private static async loadVideo(video: HTMLVideoElement, src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      video.onloadeddata = () => {
        video.removeAttribute('data-src');
        video.classList.remove('lazy-loading');
        video.classList.add('lazy-loaded');
        resolve();
      };
      
      video.onerror = () => {
        reject(new Error(`Failed to load video: ${src}`));
      };
      
      video.src = src;
    });
  }
  
  /**
   * Get optimized image URL (would integrate with CDN/image service)
   */
  private static getOptimizedImageUrl(originalUrl: string): string {
    // In a real implementation, this would generate URLs for optimized images
    // from a CDN or image optimization service
    
    const url = new URL(originalUrl, window.location.origin);
    
    // Add optimization parameters
    if (AssetOptimizer.supportsWebP()) {
      url.searchParams.set('format', 'webp');
    }
    
    // Add quality parameter for compression
    url.searchParams.set('quality', '85');
    
    return url.toString();
  }
  
  /**
   * Preload critical assets
   */
  static preloadCriticalAssets(assets: AssetInfo[]) {
    const criticalAssets = assets.filter(
      asset => asset.priority === 'critical' || asset.priority === 'high'
    );
    
    criticalAssets.forEach(asset => {
      if (this.loadedAssets.has(asset.url)) return;
      
      const link = document.createElement('link');
      link.rel = 'preload';
      
      // Set appropriate 'as' attribute
      switch (asset.type) {
        case 'image':
          link.as = 'image';
          break;
        case 'video':
          link.as = 'video';
          break;
        case 'font':
          link.as = 'font';
          link.crossOrigin = 'anonymous';
          break;
        case 'script':
          link.as = 'script';
          break;
        case 'style':
          link.as = 'style';
          break;
        default:
          link.as = 'fetch';
          link.crossOrigin = 'anonymous';
      }
      
      link.href = asset.url;
      document.head.appendChild(link);
      this.loadedAssets.add(asset.url);
    });
  }
  
  /**
   * Clean up resources
   */
  static cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.loadedAssets.clear();
    this.loadingAssets.clear();
  }
}

/**
 * Performance monitoring for asset loading
 */
export class AssetPerformanceMonitor {
  private static metrics = {
    totalAssets: 0,
    loadedAssets: 0,
    failedAssets: 0,
    totalLoadTime: 0,
    bandwidthSaved: 0,
    lazyLoadedAssets: 0,
  };
  
  static recordAssetLoad(asset: AssetInfo, loadTime: number, optimized: boolean) {
    this.metrics.totalAssets++;
    this.metrics.loadedAssets++;
    this.metrics.totalLoadTime += loadTime;
    
    if (optimized) {
      const result = AssetOptimizer.optimizeAsset(asset);
      this.metrics.bandwidthSaved += (result.originalSize - result.optimizedSize);
    }
  }
  
  static recordLazyLoad(asset: AssetInfo) {
    this.metrics.lazyLoadedAssets++;
  }
  
  static recordFailure(asset: AssetInfo) {
    this.metrics.failedAssets++;
  }
  
  static getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalAssets > 0 
        ? this.metrics.loadedAssets / this.metrics.totalAssets 
        : 0,
      averageLoadTime: this.metrics.loadedAssets > 0 
        ? this.metrics.totalLoadTime / this.metrics.loadedAssets 
        : 0,
      lazyLoadRatio: this.metrics.totalAssets > 0 
        ? this.metrics.lazyLoadedAssets / this.metrics.totalAssets 
        : 0,
    };
  }
  
  static reset() {
    this.metrics = {
      totalAssets: 0,
      loadedAssets: 0,
      failedAssets: 0,
      totalLoadTime: 0,
      bandwidthSaved: 0,
      lazyLoadedAssets: 0,
    };
  }
}

// Initialize on client side
if (typeof window !== 'undefined') {
  AssetLazyLoadManager.initialize();
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    AssetLazyLoadManager.cleanup();
  });
}