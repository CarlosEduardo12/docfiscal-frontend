/**
 * Environment Configuration Module
 *
 * Handles environment-specific configurations including:
 * - API URLs based on environment
 * - Automatic environment detection
 * - Production-specific settings
 * - HTTPS/HTTP protocol handling
 */

export type Environment = 'development' | 'production' | 'test';

export interface EnvironmentConfig {
  environment: Environment;
  apiUrl: string;
  frontendUrl: string;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  isHttps: boolean;
  corsEnabled: boolean;
  secureStorage: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableAuthLogging: boolean;
}

class EnvironmentConfigManager {
  private config: EnvironmentConfig;

  constructor() {
    this.config = this.detectEnvironment();
    this.validateConfiguration();
    this.logConfiguration();
  }

  /**
   * Detect current environment and build configuration
   */
  private detectEnvironment(): EnvironmentConfig {
    // Primary environment detection
    const nodeEnv = process.env.NODE_ENV as Environment;
    const explicitEnv = process.env.NEXT_PUBLIC_ENVIRONMENT as Environment;

    // Use explicit environment if set, otherwise fall back to NODE_ENV
    const environment: Environment = explicitEnv || nodeEnv || 'development';

    console.log('🔧 Environment detection:', {
      nodeEnv,
      explicitEnv,
      finalEnvironment: environment,
      envVars: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_FRONTEND_URL: process.env.NEXT_PUBLIC_FRONTEND_URL,
      },
    });

    // Detect if we're running in browser vs server
    const isBrowser = typeof window !== 'undefined';

    // Auto-detect URLs based on environment
    console.log(
      '🔧 About to call getApiUrlForEnvironment with environment:',
      environment
    );
    console.log(
      '🔧 Current process.env.NEXT_PUBLIC_API_URL:',
      process.env.NEXT_PUBLIC_API_URL
    );
    const apiUrl = this.getApiUrlForEnvironment(environment);
    console.log('🔧 getApiUrl returned:', apiUrl);

    console.log(
      '🔧 About to call getFrontendUrl with environment:',
      environment
    );
    console.log(
      '🔧 Current process.env.NEXT_PUBLIC_FRONTEND_URL:',
      process.env.NEXT_PUBLIC_FRONTEND_URL
    );
    const frontendUrl = this.getFrontendUrlForEnvironment(
      environment,
      isBrowser
    );
    console.log('🔧 getFrontendUrl returned:', frontendUrl);

    console.log('🔧 Detected URLs:', { apiUrl, frontendUrl });

    // Environment flags
    const isProduction = environment === 'production';
    const isDevelopment = environment === 'development';
    const isTest = environment === 'test';

    // Protocol detection
    const isHttps =
      apiUrl.startsWith('https://') || frontendUrl.startsWith('https://');

    return {
      environment,
      apiUrl,
      frontendUrl,
      isProduction,
      isDevelopment,
      isTest,
      isHttps,
      corsEnabled: this.shouldEnableCors(environment),
      secureStorage: isHttps && isProduction,
      logLevel: this.getLogLevelForEnvironment(environment),
      enableAuthLogging: this.shouldEnableAuthLogging(environment),
    };
  }

  /**
   * Get API URL based on environment - COMPLETELY REWRITTEN
   */
  private getApiUrlForEnvironment(environment: Environment): string {
    // COMPLETELY NEW IMPLEMENTATION
    console.log('🚨 NEW getApiUrl method called!');
    console.log('🚨 Environment:', environment);
    console.log(
      '🚨 process.env.NEXT_PUBLIC_API_URL:',
      process.env.NEXT_PUBLIC_API_URL
    );

    // Direct environment variable check
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl && apiUrl.length > 0) {
      console.log('🚨 Returning environment variable:', apiUrl);
      return apiUrl;
    }

    // Fallback to defaults
    console.log('🚨 Using fallback for environment:', environment);
    if (environment === 'production') {
      return 'https://responsible-balance-production.up.railway.app';
    } else if (environment === 'test') {
      return 'http://localhost:8001';
    } else {
      return 'http://localhost:8000';
    }
  }

  private getDefaultApiUrl(environment: Environment): string {
    switch (environment) {
      case 'production':
        return 'https://responsible-balance-production.up.railway.app';
      case 'test':
        return 'http://localhost:8001';
      case 'development':
      default:
        return 'http://localhost:8000';
    }
  }

  /**
   * Get frontend URL based on environment
   */
  private getFrontendUrlForEnvironment(
    environment: Environment,
    isBrowser: boolean
  ): string {
    // In browser, we can detect current origin
    if (isBrowser && typeof window !== 'undefined') {
      const origin = window.location.origin;
      // Only use detected origin if it looks reasonable
      if (origin && (origin.includes('localhost') || origin.includes('.'))) {
        console.log('🔧 Using browser-detected frontend URL:', origin);
        return origin;
      }
    }

    // Check for explicit frontend URL
    if (process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.NEXTAUTH_URL) {
      const url =
        process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.NEXTAUTH_URL!;
      console.log('🔧 Using explicit frontend URL:', url);
      return url;
    }

    console.log(
      '🔧 No explicit frontend URL found, using environment default for:',
      environment
    );
    // Environment-specific defaults
    switch (environment) {
      case 'production':
        return 'https://your-frontend-domain.com'; // This should be overridden by env vars
      case 'test':
        return 'http://localhost:3001'; // Different port for test
      case 'development':
      default:
        return 'http://localhost:3000';
    }
  }

  /**
   * Determine if CORS should be enabled
   */
  private shouldEnableCors(environment: Environment): boolean {
    // CORS is typically needed when frontend and backend are on different domains
    const apiUrl = this.getApiUrlForEnvironment(environment);
    const frontendUrl = this.getFrontendUrlForEnvironment(environment, false);

    try {
      const apiDomain = new URL(apiUrl).origin;
      const frontendDomain = new URL(frontendUrl).origin;
      return apiDomain !== frontendDomain;
    } catch {
      // If URL parsing fails, assume CORS is needed
      return true;
    }
  }

  /**
   * Get appropriate log level for environment
   */
  private getLogLevelForEnvironment(
    environment: Environment
  ): 'debug' | 'info' | 'warn' | 'error' {
    switch (environment) {
      case 'production':
        return 'warn';
      case 'test':
        return 'error';
      case 'development':
      default:
        return 'debug';
    }
  }

  /**
   * Determine if authentication logging should be enabled
   */
  private shouldEnableAuthLogging(environment: Environment): boolean {
    // Enable auth logging in development and test environments
    // In production, only enable if explicitly requested via environment variable
    switch (environment) {
      case 'development':
        return true;
      case 'test':
        return true; // Enable for testing
      case 'production':
        return process.env.ENABLE_AUTH_LOGGING === 'true';
      default:
        return false;
    }
  }

  /**
   * Validate configuration and warn about potential issues
   */
  private validateConfiguration(): void {
    const { apiUrl, frontendUrl, environment, isProduction } = this.config;

    // Skip validation if URLs are empty (during testing or initialization)
    if (!apiUrl || !frontendUrl) {
      return;
    }

    // Validate URLs
    try {
      new URL(apiUrl);
      new URL(frontendUrl);
    } catch (error) {
      console.error('❌ Invalid URL configuration:', { apiUrl, frontendUrl });
      throw new Error(`Invalid URL configuration: ${error}`);
    }

    // Production-specific validations
    if (isProduction) {
      if (apiUrl.includes('localhost')) {
        console.warn('⚠️ Production environment using localhost API URL');
      }

      if (frontendUrl.includes('localhost')) {
        console.warn('⚠️ Production environment using localhost frontend URL');
      }

      if (!apiUrl.startsWith('https://')) {
        console.warn('⚠️ Production API URL should use HTTPS');
      }

      if (!frontendUrl.startsWith('https://')) {
        console.warn('⚠️ Production frontend URL should use HTTPS');
      }
    }

    // Development-specific validations
    if (environment === 'development') {
      if (apiUrl.startsWith('https://') && !apiUrl.includes('localhost')) {
        console.info('ℹ️ Development environment using remote HTTPS API');
      }
    }
  }

  /**
   * Log current configuration (respecting log level)
   */
  private logConfiguration(): void {
    const { logLevel } = this.config;

    if (logLevel === 'debug' || logLevel === 'info') {
      console.log('🔧 Environment Configuration:', {
        environment: this.config.environment,
        apiUrl: this.config.apiUrl,
        frontendUrl: this.config.frontendUrl,
        isHttps: this.config.isHttps,
        corsEnabled: this.config.corsEnabled,
        secureStorage: this.config.secureStorage,
      });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): EnvironmentConfig {
    console.log('🔧 [DEBUG] getConfig called, this.config:', this.config);

    if (!this.config) {
      console.log('🔧 [DEBUG] No config found, returning defaults');
      // Return safe defaults if config is not initialized
      return {
        environment: 'development',
        apiUrl: 'http://localhost:8000',
        frontendUrl: 'http://localhost:3000',
        isProduction: false,
        isDevelopment: true,
        isTest: false,
        isHttps: false,
        corsEnabled: true,
        secureStorage: false,
        logLevel: 'debug',
        enableAuthLogging: true,
      };
    }

    // Ensure URLs are not empty
    const config = { ...this.config };
    console.log(
      '🔧 [DEBUG] Original config.apiUrl:',
      config.apiUrl,
      'truthy:',
      !!config.apiUrl
    );

    if (!config.apiUrl) {
      console.log('🔧 [DEBUG] apiUrl is empty, applying fallback');
      config.apiUrl = config.isProduction
        ? 'https://responsible-balance-production.up.railway.app'
        : 'http://localhost:8000';
    }
    if (!config.frontendUrl) {
      console.log('🔧 [DEBUG] frontendUrl is empty, applying fallback');
      config.frontendUrl = config.isProduction
        ? 'https://your-frontend-domain.com'
        : 'http://localhost:3000';
    }

    console.log('🔧 [DEBUG] Final config:', {
      apiUrl: config.apiUrl,
      frontendUrl: config.frontendUrl,
    });
    return config;
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.config?.isProduction || false;
  }

  /**
   * Get API URL (public interface)
   */
  getApiUrl(): string {
    return (
      this.config?.apiUrl ||
      (this.config?.isProduction
        ? 'https://responsible-balance-production.up.railway.app'
        : 'http://localhost:8000')
    );
  }

  /**
   * Get frontend URL (public interface)
   */
  getFrontendUrl(): string {
    return (
      this.config?.frontendUrl ||
      (this.config?.isProduction
        ? 'https://your-frontend-domain.com'
        : 'http://localhost:3000')
    );
  }

  /**
   * Get log level (public interface)
   */
  getLogLevel(): 'debug' | 'info' | 'warn' | 'error' {
    return this.config?.logLevel || 'error';
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.config?.isDevelopment || false;
  }

  /**
   * Check if HTTPS is enabled
   */
  isHttps(): boolean {
    return this.config?.isHttps || false;
  }

  /**
   * Check if secure storage should be used
   */
  shouldUseSecureStorage(): boolean {
    return this.config?.secureStorage || false;
  }

  /**
   * Get CORS configuration
   */
  getCorsConfig(): {
    enabled: boolean;
    apiUrl: string;
    frontendUrl: string;
    environment: Environment;
  } {
    const config = this.getConfig();
    return {
      enabled: config.corsEnabled,
      apiUrl: config.apiUrl,
      frontendUrl: config.frontendUrl,
      environment: config.environment,
    };
  }

  /**
   * Get payment URLs based on environment
   */
  getPaymentUrls(): {
    returnUrl: string;
    cancelUrl: string;
  } {
    const baseUrl = this.getFrontendUrl();

    return {
      returnUrl:
        process.env.NEXT_PUBLIC_PAYMENT_RETURN_URL ||
        `${baseUrl}/payment/success`,
      cancelUrl:
        process.env.NEXT_PUBLIC_PAYMENT_CANCEL_URL ||
        `${baseUrl}/payment/cancel`,
    };
  }

  /**
   * Refresh configuration (useful for testing or dynamic changes)
   */
  refresh(): void {
    this.config = this.detectEnvironment();
    this.validateConfiguration();
    this.logConfiguration();
  }
}

// Export singleton instance
let environmentConfigInstance: EnvironmentConfigManager | null = null;

export const environmentConfig = {
  getInstance(): EnvironmentConfigManager {
    if (!environmentConfigInstance) {
      environmentConfigInstance = new EnvironmentConfigManager();
    }
    return environmentConfigInstance;
  },

  // For testing: reset the singleton
  reset(): void {
    environmentConfigInstance = null;
  },

  getConfig() {
    return this.getInstance().getConfig();
  },

  getApiUrl() {
    return this.getInstance().getApiUrl();
  },

  getFrontendUrl() {
    return this.getInstance().getFrontendUrl();
  },

  isProduction() {
    return this.getInstance().isProduction();
  },

  isDevelopment() {
    return this.getInstance().isDevelopment();
  },

  isHttps() {
    return this.getInstance().isHttps();
  },

  getCorsConfig() {
    return this.getInstance().getCorsConfig();
  },

  getPaymentUrls() {
    return this.getInstance().getPaymentUrls();
  },

  refresh() {
    return this.getInstance().refresh();
  },
};

// Export types and utilities
export { EnvironmentConfigManager };

// Convenience exports
export const getApiUrl = () => environmentConfig.getApiUrl();
export const getFrontendUrl = () => environmentConfig.getFrontendUrl();
export const isProduction = () => environmentConfig.isProduction();
export const isDevelopment = () => environmentConfig.isDevelopment();
export const isHttps = () => environmentConfig.isHttps();
export const getEnvironmentConfig = () => environmentConfig.getConfig();
