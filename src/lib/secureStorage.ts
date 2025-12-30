/**
 * Secure Storage Module
 *
 * Handles secure storage of sensitive data with HTTPS-specific configurations:
 * - Secure localStorage handling for HTTPS environments
 * - Security headers and configurations
 * - Cross-origin security policies
 * - Storage encryption for production environments
 */

import { environmentConfig } from './environmentConfig';

export interface SecureStorageOptions {
  encrypt?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  httpOnly?: boolean;
}

export interface StorageSecurityConfig {
  useSecureStorage: boolean;
  encryptionEnabled: boolean;
  secureHeaders: Record<string, string>;
  storagePolicy: {
    maxAge: number;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
}

class SecureStorageManager {
  private config: StorageSecurityConfig;
  private encryptionKey: string | null = null;

  constructor() {
    try {
      this.config = this.buildSecurityConfig();
      this.initializeEncryption();
      this.validateStorageAccess();
    } catch (error) {
      console.warn(
        '⚠️ SecureStorage initialization failed, using defaults:',
        error
      );
      this.config = {
        useSecureStorage: false,
        encryptionEnabled: false,
        secureHeaders: {},
        storagePolicy: {
          maxAge: 3600,
          secure: false,
          sameSite: 'lax',
        },
      };
    }
  }

  /**
   * Build security configuration based on environment
   */
  private buildSecurityConfig(): StorageSecurityConfig {
    const envConfig = environmentConfig.getConfig();

    return {
      useSecureStorage: envConfig.secureStorage,
      encryptionEnabled: envConfig.isProduction && envConfig.isHttps,
      secureHeaders: this.getSecurityHeadersForEnvironment(envConfig),
      storagePolicy: {
        maxAge: envConfig.isProduction ? 86400 : 3600, // 24h prod, 1h dev
        secure: envConfig.isHttps,
        sameSite: envConfig.isProduction ? 'strict' : 'lax',
      },
    };
  }

  /**
   * Get security headers for HTTPS environments
   */
  private getSecurityHeadersForEnvironment(
    envConfig: any
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    if (envConfig.isHttps) {
      // Strict Transport Security
      headers['Strict-Transport-Security'] =
        'max-age=31536000; includeSubDomains; preload';

      // Content Security Policy
      headers['Content-Security-Policy'] = [
        "default-src 'self'",
        `connect-src 'self' ${envConfig.apiUrl}`,
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "frame-ancestors 'none'",
      ].join('; ');

      // X-Frame-Options
      headers['X-Frame-Options'] = 'DENY';

      // X-Content-Type-Options
      headers['X-Content-Type-Options'] = 'nosniff';

      // Referrer Policy
      headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';

      // Permissions Policy
      headers['Permissions-Policy'] =
        'geolocation=(), microphone=(), camera=()';
    }

    if (envConfig.isProduction) {
      // X-XSS-Protection (legacy but still useful)
      headers['X-XSS-Protection'] = '1; mode=block';
    }

    return headers;
  }

  /**
   * Initialize encryption for sensitive data
   */
  private initializeEncryption(): void {
    if (this.config.encryptionEnabled) {
      // In a real implementation, this would use a proper key derivation function
      // For now, we'll use a simple approach
      this.encryptionKey = this.deriveEncryptionKey();
    }
  }

  /**
   * Derive encryption key from environment and browser fingerprint
   */
  private deriveEncryptionKey(): string {
    if (typeof window === 'undefined') {
      return '';
    }

    // Create a simple key based on environment and browser characteristics
    const components = [
      window.location.origin,
      navigator.userAgent.slice(0, 50), // First 50 chars only
      Date.now().toString().slice(0, -6), // Remove last 6 digits for stability
    ];

    return btoa(components.join('|')).slice(0, 32);
  }

  /**
   * Validate that localStorage is accessible and secure
   */
  private validateStorageAccess(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // Test localStorage access
      const testKey = '__secure_storage_test__';
      localStorage.setItem(testKey, 'test');
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      if (retrieved !== 'test') {
        throw new Error('localStorage read/write test failed');
      }

      // Check for secure context in production
      if (this.config.useSecureStorage && !window.isSecureContext) {
        console.warn(
          '⚠️ Not running in secure context (HTTPS) but secure storage is required'
        );
      }

      // Log security status
      const envConfig = environmentConfig.getConfig();
      if (envConfig.logLevel === 'debug') {
        console.log('🔒 Secure storage initialized:', {
          isSecureContext: window.isSecureContext,
          useSecureStorage: this.config.useSecureStorage,
          encryptionEnabled: this.config.encryptionEnabled,
          protocol: window.location.protocol,
        });
      }
    } catch (error) {
      console.error('❌ localStorage validation failed:', error);
      throw new Error('Secure storage is not available');
    }
  }

  /**
   * Securely store data with optional encryption
   */
  setItem(
    key: string,
    value: string,
    options: SecureStorageOptions = {}
  ): void {
    try {
      if (typeof window === 'undefined') {
        console.warn('Cannot store data: window is undefined');
        return;
      }

      let processedValue = value;

      // Apply encryption if enabled and requested
      if (this.config.encryptionEnabled && options.encrypt !== false) {
        processedValue = this.encrypt(value);
      }

      // Add metadata for security validation
      const secureData = {
        value: processedValue,
        timestamp: Date.now(),
        secure: this.config.useSecureStorage,
        encrypted: this.config.encryptionEnabled && options.encrypt !== false,
      };

      localStorage.setItem(key, JSON.stringify(secureData));

      // Log storage operation (without sensitive data)
      const envConfig = environmentConfig.getConfig();
      if (envConfig.logLevel === 'debug') {
        console.log('🔒 Secure data stored:', {
          key,
          encrypted: secureData.encrypted,
          secure: secureData.secure,
          size: processedValue.length,
        });
      }
    } catch (error) {
      console.error('❌ Failed to store secure data:', error);
      throw new Error(`Secure storage failed: ${error}`);
    }
  }

  /**
   * Securely retrieve data with automatic decryption
   */
  getItem(key: string): string | null {
    try {
      if (typeof window === 'undefined') {
        return null;
      }

      const storedData = localStorage.getItem(key);
      if (!storedData) {
        return null;
      }

      // Try to parse as secure data format
      let secureData: any;
      try {
        secureData = JSON.parse(storedData);
      } catch {
        // Fallback to plain string for backward compatibility
        return storedData;
      }

      // Validate secure data structure
      if (!secureData || typeof secureData !== 'object' || !secureData.value) {
        console.warn('⚠️ Invalid secure data format for key:', key);
        return null;
      }

      // Check if data is too old (security measure)
      const maxAge = this.config.storagePolicy.maxAge * 1000;
      if (secureData.timestamp && Date.now() - secureData.timestamp > maxAge) {
        console.log('🕐 Secure data expired, removing:', key);
        this.removeItem(key);
        return null;
      }

      let value = secureData.value;

      // Apply decryption if data was encrypted
      if (secureData.encrypted && this.config.encryptionEnabled) {
        value = this.decrypt(value);
      }

      return value;
    } catch (error) {
      console.error('❌ Failed to retrieve secure data:', error);
      return null;
    }
  }

  /**
   * Remove item from secure storage
   */
  removeItem(key: string): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      localStorage.removeItem(key);

      const envConfig = environmentConfig.getConfig();
      if (envConfig.logLevel === 'debug') {
        console.log('🗑️ Secure data removed:', key);
      }
    } catch (error) {
      console.error('❌ Failed to remove secure data:', error);
    }
  }

  /**
   * Clear all secure storage (with confirmation)
   */
  clear(confirm: boolean = false): void {
    if (!confirm) {
      throw new Error('Clear operation requires explicit confirmation');
    }

    try {
      if (typeof window === 'undefined') {
        return;
      }

      localStorage.clear();
      console.log('🧹 All secure storage cleared');
    } catch (error) {
      console.error('❌ Failed to clear secure storage:', error);
    }
  }

  /**
   * Simple encryption (for demonstration - use proper crypto in production)
   */
  private encrypt(data: string): string {
    if (!this.encryptionKey) {
      return data;
    }

    try {
      // Simple XOR encryption (NOT secure for production)
      // In production, use Web Crypto API or a proper encryption library
      let encrypted = '';
      for (let i = 0; i < data.length; i++) {
        const keyChar = this.encryptionKey.charCodeAt(
          i % this.encryptionKey.length
        );
        const dataChar = data.charCodeAt(i);
        encrypted += String.fromCharCode(dataChar ^ keyChar);
      }
      return btoa(encrypted);
    } catch (error) {
      console.error('❌ Encryption failed:', error);
      return data; // Fallback to unencrypted
    }
  }

  /**
   * Simple decryption (matches encrypt method)
   */
  private decrypt(encryptedData: string): string {
    if (!this.encryptionKey) {
      return encryptedData;
    }

    try {
      const encrypted = atob(encryptedData);
      let decrypted = '';
      for (let i = 0; i < encrypted.length; i++) {
        const keyChar = this.encryptionKey.charCodeAt(
          i % this.encryptionKey.length
        );
        const encryptedChar = encrypted.charCodeAt(i);
        decrypted += String.fromCharCode(encryptedChar ^ keyChar);
      }
      return decrypted;
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      return encryptedData; // Fallback to encrypted data
    }
  }

  /**
   * Get security headers for HTTP requests
   */
  getSecurityHeaders(): Record<string, string> {
    return this.config?.secureHeaders ? { ...this.config.secureHeaders } : {};
  }

  /**
   * Get storage policy configuration
   */
  getStoragePolicy(): StorageSecurityConfig['storagePolicy'] {
    return this.config?.storagePolicy
      ? { ...this.config.storagePolicy }
      : {
          maxAge: 3600,
          secure: false,
          sameSite: 'lax',
        };
  }

  /**
   * Check if storage is running in secure mode
   */
  isSecure(): boolean {
    return this.config?.useSecureStorage || false;
  }

  /**
   * Check if encryption is enabled
   */
  isEncryptionEnabled(): boolean {
    return this.config?.encryptionEnabled || false;
  }

  /**
   * Validate storage security for current environment
   */
  validateSecurity(): {
    isValid: boolean;
    warnings: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let isValid = true;

    const envConfig = environmentConfig.getConfig();

    // Check secure context
    if (typeof window !== 'undefined') {
      if (envConfig.isProduction && !window.isSecureContext) {
        warnings.push('Running in production without secure context (HTTPS)');
        recommendations.push('Deploy application over HTTPS');
        isValid = false;
      }

      if (envConfig.isHttps && window.location.protocol !== 'https:') {
        warnings.push('Environment configured for HTTPS but running over HTTP');
        recommendations.push('Ensure application is served over HTTPS');
        isValid = false;
      }
    }

    // Check encryption
    if (envConfig.isProduction && !this.config.encryptionEnabled) {
      warnings.push('Encryption disabled in production environment');
      recommendations.push(
        'Enable encryption for sensitive data in production'
      );
    }

    // Check storage policy
    if (this.config.storagePolicy.maxAge > 86400 && envConfig.isProduction) {
      warnings.push(
        'Storage max age is longer than recommended for production'
      );
      recommendations.push('Consider shorter storage expiration times');
    }

    return {
      isValid,
      warnings,
      recommendations,
    };
  }
}

// Export singleton instance
export const secureStorage = new SecureStorageManager();

// Export types and utilities
export { SecureStorageManager };

// Convenience functions
export const setSecureItem = (
  key: string,
  value: string,
  options?: SecureStorageOptions
) => secureStorage.setItem(key, value, options);

export const getSecureItem = (key: string) => secureStorage.getItem(key);

export const removeSecureItem = (key: string) => secureStorage.removeItem(key);

export const getSecurityHeaders = () => secureStorage.getSecurityHeaders();

export const validateStorageSecurity = () => secureStorage.validateSecurity();
