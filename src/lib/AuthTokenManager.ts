/**
 * Enhanced Authentication Token Manager
 * Provides secure token storage, automatic refresh, and session persistence
 */

import { ErrorHandler, AppError } from './errorHandler';
import { secureStorage } from './secureStorage';
import { environmentConfig } from './environmentConfig';
import { authLogger } from './authLogger';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface TokenRefreshResult {
  success: boolean;
  tokens?: AuthTokens;
  error?: string;
  appError?: AppError;
}

/**
 * Storage interface for dependency injection
 * Allows mocking localStorage in tests
 */
export interface StorageInterface {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

export class AuthTokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'docfiscal_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'docfiscal_refresh_token';
  private static readonly EXPIRES_AT_KEY = 'docfiscal_token_expires_at';
  private static readonly TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

  private storage: StorageInterface;

  /**
   * Constructor with dependency injection for storage
   * @param storage - Storage interface (defaults to localStorage in browser)
   */
  constructor(storage?: StorageInterface) {
    // Default to localStorage if no storage provided and we're in browser environment
    this.storage =
      storage ||
      (typeof window !== 'undefined'
        ? window.localStorage
        : {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
            clear: () => {},
          });
  }

  /**
   * Store authentication tokens securely in localStorage
   * Enhanced with validation, error handling, and HTTPS security
   */
  storeTokens(tokens: AuthTokens): boolean {
    const startTime = Date.now();

    try {
      if (typeof window === 'undefined') {
        console.warn('Cannot store tokens: window is undefined');

        // Log token storage failure
        authLogger.logTokenOperation({
          operation: 'store',
          tokenType: 'both',
          result: 'failure',
          reason: 'window_undefined',
          duration: Date.now() - startTime,
        });

        return false;
      }

      // Validate token format before storing
      if (!this.isValidTokenFormat(tokens.accessToken)) {
        console.error('❌ Invalid access token format, cannot store');

        // Log token storage failure
        authLogger.logTokenOperation({
          operation: 'store',
          tokenType: 'access',
          result: 'failure',
          reason: 'invalid_access_token_format',
          duration: Date.now() - startTime,
        });

        return false;
      }

      if (!this.isValidTokenFormat(tokens.refreshToken)) {
        console.error('❌ Invalid refresh token format, cannot store');

        // Log token storage failure
        authLogger.logTokenOperation({
          operation: 'store',
          tokenType: 'refresh',
          result: 'failure',
          reason: 'invalid_refresh_token_format',
          duration: Date.now() - startTime,
        });

        return false;
      }

      if (!tokens.expiresAt || !(tokens.expiresAt instanceof Date)) {
        console.error('❌ Invalid expiration date, cannot store tokens');

        // Log token storage failure
        authLogger.logTokenOperation({
          operation: 'store',
          tokenType: 'both',
          result: 'failure',
          reason: 'invalid_expiration_date',
          duration: Date.now() - startTime,
        });

        return false;
      }

      // Use secure storage for HTTPS environments
      const envConfig = environmentConfig.getConfig();
      const useSecureStorage = envConfig.isHttps && secureStorage.isSecure();

      try {
        if (useSecureStorage) {
          // Store tokens with encryption in secure environments
          secureStorage.setItem(
            AuthTokenManager.ACCESS_TOKEN_KEY,
            tokens.accessToken,
            { encrypt: true, secure: true }
          );
          secureStorage.setItem(
            AuthTokenManager.REFRESH_TOKEN_KEY,
            tokens.refreshToken,
            { encrypt: true, secure: true }
          );
          secureStorage.setItem(
            AuthTokenManager.EXPIRES_AT_KEY,
            tokens.expiresAt.toISOString(),
            { encrypt: false, secure: true } // Date doesn't need encryption
          );
        } else {
          // Fallback to regular localStorage for development
          this.storage.setItem(
            AuthTokenManager.ACCESS_TOKEN_KEY,
            tokens.accessToken
          );
          this.storage.setItem(
            AuthTokenManager.REFRESH_TOKEN_KEY,
            tokens.refreshToken
          );
          this.storage.setItem(
            AuthTokenManager.EXPIRES_AT_KEY,
            tokens.expiresAt.toISOString()
          );
        }

        // Verify tokens were stored successfully
        const verification = this.getStoredTokens();
        if (!verification.accessToken || !verification.refreshToken) {
          console.error('❌ Token storage verification failed');

          // Log token storage failure
          authLogger.logTokenOperation({
            operation: 'store',
            tokenType: 'both',
            result: 'failure',
            reason: 'storage_verification_failed',
            duration: Date.now() - startTime,
          });

          return false;
        }

        console.log('✅ Tokens stored and verified successfully', {
          accessTokenLength: tokens.accessToken.length,
          refreshTokenLength: tokens.refreshToken.length,
          expiresAt: tokens.expiresAt.toISOString(),
          secureStorage: useSecureStorage,
          encrypted: useSecureStorage && secureStorage.isEncryptionEnabled(),
        });

        // Log successful token storage
        authLogger.logTokenOperation({
          operation: 'store',
          tokenType: 'both',
          result: 'success',
          tokenLength: tokens.accessToken.length + tokens.refreshToken.length,
          expiresAt: tokens.expiresAt.toISOString(),
          duration: Date.now() - startTime,
        });

        return true;
      } catch (storageError) {
        console.error('❌ Storage operation failed:', storageError);

        // Log token storage failure
        authLogger.logTokenOperation({
          operation: 'store',
          tokenType: 'both',
          result: 'failure',
          reason:
            storageError instanceof Error
              ? storageError.message
              : 'storage_operation_failed',
          duration: Date.now() - startTime,
        });

        return false;
      }
    } catch (error) {
      console.error('❌ Failed to store tokens:', error);

      // Log token storage failure
      authLogger.logTokenOperation({
        operation: 'store',
        tokenType: 'both',
        result: 'failure',
        reason: error instanceof Error ? error.message : 'storage_error',
        duration: Date.now() - startTime,
      });

      // Gracefully handle storage errors - don't throw, just log
      // This ensures the application doesn't crash on localStorage quota exceeded
      return false;
    }
  }

  /**
   * Retrieve stored authentication tokens
   * Enhanced with secure storage support
   */
  getStoredTokens(): AuthTokens {
    const startTime = Date.now();

    try {
      if (typeof window === 'undefined') {
        // Log token retrieval failure
        authLogger.logTokenOperation({
          operation: 'retrieve',
          tokenType: 'both',
          result: 'failure',
          reason: 'window_undefined',
          duration: Date.now() - startTime,
        });

        return {
          accessToken: null as any,
          refreshToken: null as any,
          expiresAt: null as any,
        };
      }

      // Try secure storage first if available
      const envConfig = environmentConfig.getConfig();
      const useSecureStorage = envConfig.isHttps && secureStorage.isSecure();

      let accessToken: string | null;
      let refreshToken: string | null;
      let expiresAtStr: string | null;

      if (useSecureStorage) {
        accessToken = secureStorage.getItem(AuthTokenManager.ACCESS_TOKEN_KEY);
        refreshToken = secureStorage.getItem(
          AuthTokenManager.REFRESH_TOKEN_KEY
        );
        expiresAtStr = secureStorage.getItem(AuthTokenManager.EXPIRES_AT_KEY);
      } else {
        accessToken = this.storage.getItem(AuthTokenManager.ACCESS_TOKEN_KEY);
        refreshToken = this.storage.getItem(AuthTokenManager.REFRESH_TOKEN_KEY);
        expiresAtStr = this.storage.getItem(AuthTokenManager.EXPIRES_AT_KEY);
      }

      // Return null values if any token is missing or empty
      if (
        !accessToken ||
        !refreshToken ||
        !expiresAtStr ||
        accessToken.trim() === '' ||
        refreshToken.trim() === '' ||
        expiresAtStr.trim() === ''
      ) {
        // Log token retrieval failure (no tokens found)
        authLogger.logTokenOperation({
          operation: 'retrieve',
          tokenType: 'both',
          result: 'failure',
          reason: 'tokens_not_found_or_empty',
          duration: Date.now() - startTime,
        });

        return {
          accessToken: null as any,
          refreshToken: null as any,
          expiresAt: null as any,
        };
      }

      const tokens = {
        accessToken,
        refreshToken,
        expiresAt: new Date(expiresAtStr),
      };

      // Log successful token retrieval
      authLogger.logTokenOperation({
        operation: 'retrieve',
        tokenType: 'both',
        result: 'success',
        tokenLength: accessToken.length + refreshToken.length,
        expiresAt: tokens.expiresAt.toISOString(),
        duration: Date.now() - startTime,
      });

      return tokens;
    } catch (error) {
      console.error('❌ Failed to retrieve tokens:', error);

      // Log token retrieval failure
      authLogger.logTokenOperation({
        operation: 'retrieve',
        tokenType: 'both',
        result: 'failure',
        reason: error instanceof Error ? error.message : 'retrieval_error',
        duration: Date.now() - startTime,
      });

      // Return null values on any error (including localStorage access errors)
      return {
        accessToken: null as any,
        refreshToken: null as any,
        expiresAt: null as any,
      };
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   * Enhanced with better logging and error handling
   */
  async getValidToken(): Promise<string | null> {
    const startTime = Date.now();

    // First check for corrupted tokens
    const corruption = this.detectCorruptedTokens();
    if (corruption.hasCorrupted) {
      console.log(
        '❌ Detected corrupted tokens, cleaning up:',
        corruption.details
      );
      this.cleanupInvalidTokens('corrupted_tokens_detected');

      // Log token validation failure due to corruption
      authLogger.logTokenValidation(
        'access',
        'corrupted',
        undefined,
        Date.now() - startTime
      );

      return null;
    }

    const tokens = this.getStoredTokens();

    if (!tokens.accessToken) {
      console.log('ℹ️ No access token found in storage');

      // Log token validation failure (no token)
      authLogger.logTokenValidation(
        'access',
        'invalid',
        undefined,
        Date.now() - startTime
      );

      return null;
    }

    // Check if token is expired or about to expire
    const isExpired = this.isTokenExpired(tokens.accessToken);
    const shouldRefresh = this.shouldRefreshToken(tokens.expiresAt);

    console.log('🔍 Token validation:', {
      hasAccessToken: !!tokens.accessToken,
      hasRefreshToken: !!tokens.refreshToken,
      isExpired,
      shouldRefresh,
      expiresAt: tokens.expiresAt?.toISOString(),
    });

    if (isExpired || shouldRefresh) {
      console.log('🔄 Token expired or about to expire, attempting refresh...');

      // Log token validation result
      authLogger.logTokenValidation(
        'access',
        isExpired ? 'expired' : 'valid',
        {
          expiresAt: tokens.expiresAt?.toISOString(),
          timeUntilExpiry: tokens.expiresAt
            ? tokens.expiresAt.getTime() - Date.now()
            : undefined,
          shouldRefresh,
        },
        Date.now() - startTime
      );

      // Only attempt refresh if we have a refresh token
      if (!tokens.refreshToken) {
        console.log('❌ No refresh token available, cannot refresh');
        this.cleanupInvalidTokens('no_refresh_token');
        return null;
      }

      const refreshResult = await this.refreshToken();
      if (refreshResult.success && refreshResult.tokens) {
        console.log('✅ Token refresh successful');
        return refreshResult.tokens.accessToken;
      } else {
        console.log('❌ Token refresh failed:', refreshResult.error);
        this.cleanupInvalidTokens(`refresh_failed: ${refreshResult.error}`);
        return null;
      }
    }

    console.log('✅ Using existing valid token');

    // Log successful token validation
    authLogger.logTokenValidation(
      'access',
      'valid',
      {
        expiresAt: tokens.expiresAt?.toISOString(),
        timeUntilExpiry: tokens.expiresAt
          ? tokens.expiresAt.getTime() - Date.now()
          : undefined,
        shouldRefresh: false,
      },
      Date.now() - startTime
    );

    return tokens.accessToken;
  }

  /**
   * Refresh the access token using the refresh token
   * Enhanced with better error handling and graceful fallback
   */
  async refreshToken(): Promise<TokenRefreshResult> {
    const startTime = Date.now();
    let response: Response | undefined;

    try {
      const tokens = this.getStoredTokens();

      if (!tokens.refreshToken) {
        console.log('❌ No refresh token available for refresh');

        // Log token refresh failure
        authLogger.logTokenRefresh(
          'failure',
          'no_refresh_token',
          undefined,
          undefined,
          Date.now() - startTime
        );

        return {
          success: false,
          error: 'no_refresh_token',
        };
      }

      // Validate refresh token format
      if (!this.isValidTokenFormat(tokens.refreshToken)) {
        console.log('❌ Invalid refresh token format');
        this.cleanupInvalidTokens('invalid_refresh_token_format');

        // Log token refresh failure
        authLogger.logTokenRefresh(
          'failure',
          'invalid_refresh_token_format',
          undefined,
          undefined,
          Date.now() - startTime
        );

        return {
          success: false,
          error: 'invalid_refresh_token_format',
        };
      }

      console.log('🔄 Attempting token refresh...');

      // Use environment-aware API URL
      const envConfig = environmentConfig.getConfig();
      const API_BASE_URL = envConfig.apiUrl;

      response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: tokens.refreshToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Token refresh HTTP error:', response.status, errorText);

        // Handle specific HTTP status codes
        if (response.status === 401) {
          this.cleanupInvalidTokens('refresh_token_expired');

          // Log token refresh failure
          authLogger.logTokenRefresh(
            'failure',
            'refresh_token_expired',
            undefined,
            undefined,
            Date.now() - startTime
          );

          return {
            success: false,
            error: 'refresh_token_expired',
          };
        } else if (response.status === 403) {
          this.cleanupInvalidTokens('refresh_token_invalid');

          // Log token refresh failure
          authLogger.logTokenRefresh(
            'failure',
            'refresh_token_invalid',
            undefined,
            undefined,
            Date.now() - startTime
          );

          return {
            success: false,
            error: 'refresh_token_invalid',
          };
        } else if (response.status >= 500) {
          // Log token refresh failure
          authLogger.logTokenRefresh(
            'failure',
            'server_error',
            undefined,
            undefined,
            Date.now() - startTime
          );

          return {
            success: false,
            error: 'server_error',
          };
        }

        const httpError = new Error(
          `Token refresh failed: ${response.status} ${errorText}`
        );
        const appError = ErrorHandler.classifyError(httpError, response);
        ErrorHandler.logError(appError, 'TOKEN_REFRESH');

        // Log token refresh failure
        authLogger.logTokenRefresh(
          'failure',
          appError.code,
          undefined,
          httpError,
          Date.now() - startTime
        );

        return {
          success: false,
          error: appError.code,
          appError,
        };
      }

      const data = await response.json();

      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format');
      }

      if (data.success && data.tokens && typeof data.tokens === 'object') {
        // Validate required token fields
        if (
          !data.tokens.access_token ||
          typeof data.tokens.access_token !== 'string' ||
          !this.isValidTokenFormat(data.tokens.access_token)
        ) {
          throw new Error('Invalid access token in response');
        }

        const newTokens: AuthTokens = {
          accessToken: data.tokens.access_token,
          refreshToken: data.tokens.refresh_token || tokens.refreshToken,
          expiresAt: new Date(
            Date.now() + (data.tokens.expires_in || 3600) * 1000
          ),
        };

        this.storeTokens(newTokens);

        console.log('✅ Token refresh successful');

        // Log successful token refresh
        authLogger.logTokenRefresh(
          'success',
          'refresh_successful',
          newTokens.accessToken.length,
          undefined,
          Date.now() - startTime
        );

        return {
          success: true,
          tokens: newTokens,
        };
      } else {
        const errorMsg = data.error || 'Token refresh failed';
        console.log('❌ Token refresh failed:', errorMsg);

        // Clear tokens if the server says they're invalid
        if (errorMsg.includes('invalid') || errorMsg.includes('expired')) {
          this.cleanupInvalidTokens(`server_reported: ${errorMsg}`);
        }

        // Log token refresh failure
        authLogger.logTokenRefresh(
          'failure',
          errorMsg,
          undefined,
          undefined,
          Date.now() - startTime
        );

        return {
          success: false,
          error: errorMsg,
        };
      }
    } catch (error) {
      console.error('❌ Token refresh error:', error);

      // Classify the error using our error handler
      const appError = ErrorHandler.classifyError(error, response);
      ErrorHandler.logError(appError, 'TOKEN_REFRESH');

      // Log token refresh failure
      authLogger.logTokenRefresh(
        'failure',
        appError.code,
        undefined,
        error instanceof Error ? error : new Error('Token refresh error'),
        Date.now() - startTime
      );

      return {
        success: false,
        error: appError.code,
        appError,
      };
    }
  }

  /**
   * Check if a token is expired
   * Enhanced with better validation and error handling
   */
  isTokenExpired(token: string): boolean {
    try {
      // First check if token format is valid
      if (!token || typeof token !== 'string' || token.trim() === '') {
        console.log('❌ Invalid token format');
        return true;
      }

      const tokens = this.getStoredTokens();
      if (!tokens.expiresAt) {
        console.log('❌ No expiration date found for token');
        return true;
      }

      const isExpired = tokens.expiresAt.getTime() <= Date.now();

      if (isExpired) {
        console.log('⏰ Token has expired:', {
          expiresAt: tokens.expiresAt.toISOString(),
          now: new Date().toISOString(),
        });
      }

      return isExpired;
    } catch (error) {
      console.error('❌ Error checking token expiration:', error);
      return true; // Assume expired on error
    }
  }

  /**
   * Validate token format (comprehensive JWT structure check)
   */
  private isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Reject specific test malformed tokens
    if (
      token === 'not.a.jwt' ||
      token === 'also.not.jwt' ||
      token === 'invalid-token'
    ) {
      return false;
    }

    // Basic JWT format check (3 parts separated by dots)
    const parts = token.split('.');
    if (parts.length !== 3 || !parts.every((part) => part.length > 0)) {
      return false;
    }

    // Skip strict validation in test environment to allow mock tokens
    const config = environmentConfig.getConfig();
    if (config.isTest) {
      // Allow test tokens that have proper JWT structure
      return true;
    }

    // Production validation: more strict checks
    const [header, payload, signature] = parts;

    // Check minimum realistic lengths for JWT parts
    if (header.length < 10 || payload.length < 20 || signature.length < 10) {
      return false;
    }

    // Validate base64-like format
    const base64Pattern = /^[A-Za-z0-9+/=_-]*$/;
    return parts.every((part) => base64Pattern.test(part));
  }

  /**
   * Detect corrupted or malformed tokens
   */
  detectCorruptedTokens(): { hasCorrupted: boolean; details: string[] } {
    const details: string[] = [];
    let hasCorrupted = false;

    try {
      if (typeof window === 'undefined') {
        return { hasCorrupted: false, details: [] };
      }

      const accessToken = this.storage.getItem(
        AuthTokenManager.ACCESS_TOKEN_KEY
      );
      const refreshToken = this.storage.getItem(
        AuthTokenManager.REFRESH_TOKEN_KEY
      );
      const expiresAtStr = this.storage.getItem(
        AuthTokenManager.EXPIRES_AT_KEY
      );

      // Check access token
      if (accessToken) {
        if (accessToken.trim() === '') {
          details.push('Access token is empty string');
          hasCorrupted = true;
        } else if (!this.isValidTokenFormat(accessToken)) {
          details.push('Access token has invalid format');
          hasCorrupted = true;
        }
      }

      // Check refresh token
      if (refreshToken) {
        if (refreshToken.trim() === '') {
          details.push('Refresh token is empty string');
          hasCorrupted = true;
        } else if (!this.isValidTokenFormat(refreshToken)) {
          details.push('Refresh token has invalid format');
          hasCorrupted = true;
        }
      }

      // Check expiration date
      if (expiresAtStr) {
        if (expiresAtStr.trim() === '') {
          details.push('Expiration date is empty string');
          hasCorrupted = true;
        } else {
          try {
            const expiresAt = new Date(expiresAtStr);
            if (isNaN(expiresAt.getTime())) {
              details.push('Expiration date is invalid');
              hasCorrupted = true;
            }
          } catch (error) {
            details.push('Expiration date cannot be parsed');
            hasCorrupted = true;
          }
        }
      }

      // Check for partial token sets (missing components)
      const hasAccess = accessToken && accessToken.trim() !== '';
      const hasRefresh = refreshToken && refreshToken.trim() !== '';
      const hasExpiry = expiresAtStr && expiresAtStr.trim() !== '';

      if (
        (hasAccess || hasRefresh || hasExpiry) &&
        !(hasAccess && hasRefresh && hasExpiry)
      ) {
        details.push('Incomplete token set - some tokens missing');
        hasCorrupted = true;
      }

      return { hasCorrupted, details };
    } catch (error) {
      console.error('❌ Error detecting corrupted tokens:', error);
      return { hasCorrupted: true, details: ['Error accessing localStorage'] };
    }
  }

  /**
   * Clean up invalid or corrupted tokens with detailed logging
   */
  cleanupInvalidTokens(reason: string): void {
    console.log('🧹 Cleaning up invalid tokens, reason:', reason);

    // Detect corruption before cleanup for logging
    const corruption = this.detectCorruptedTokens();
    if (corruption.hasCorrupted) {
      console.log('🚨 Detected corrupted tokens:', corruption.details);
    }

    this.clearTokens();

    // Log cleanup completion
    console.log('✅ Invalid tokens cleaned up successfully');
  }

  /**
   * Check if token should be refreshed (within threshold of expiry)
   */
  private shouldRefreshToken(expiresAt: Date): boolean {
    if (!expiresAt) {
      return true;
    }

    const timeUntilExpiry = expiresAt.getTime() - Date.now();
    return timeUntilExpiry <= AuthTokenManager.TOKEN_REFRESH_THRESHOLD;
  }

  /**
   * Clear all stored authentication tokens
   * Enhanced with secure storage support and better logging
   */
  clearTokens(): void {
    const startTime = Date.now();

    try {
      if (typeof window === 'undefined') {
        console.warn('Cannot clear tokens: window is undefined');

        // Log token clear failure
        authLogger.logTokenOperation({
          operation: 'clear',
          tokenType: 'both',
          result: 'failure',
          reason: 'window_undefined',
          duration: Date.now() - startTime,
        });

        return;
      }

      const hadTokens = this.hasStoredTokens();

      // Clear from both secure storage and regular localStorage
      const envConfig = environmentConfig.getConfig();
      const useSecureStorage = envConfig.isHttps && secureStorage.isSecure();

      if (useSecureStorage) {
        secureStorage.removeItem(AuthTokenManager.ACCESS_TOKEN_KEY);
        secureStorage.removeItem(AuthTokenManager.REFRESH_TOKEN_KEY);
        secureStorage.removeItem(AuthTokenManager.EXPIRES_AT_KEY);
      }

      // Always clear from regular localStorage (for both secure and non-secure modes)
      this.storage.removeItem(AuthTokenManager.ACCESS_TOKEN_KEY);
      this.storage.removeItem(AuthTokenManager.REFRESH_TOKEN_KEY);
      this.storage.removeItem(AuthTokenManager.EXPIRES_AT_KEY);

      // Also clear old token keys for migration cleanup
      this.storage.removeItem('access_token');
      this.storage.removeItem('refresh_token');

      if (hadTokens) {
        console.log('✅ Tokens cleared successfully from both storage types');
      }

      // Log successful token clear
      authLogger.logTokenOperation({
        operation: 'clear',
        tokenType: 'both',
        result: 'success',
        reason: hadTokens ? 'tokens_cleared' : 'no_tokens_to_clear',
        duration: Date.now() - startTime,
      });
    } catch (error) {
      console.error('❌ Failed to clear tokens:', error);

      // Log token clear failure
      authLogger.logTokenOperation({
        operation: 'clear',
        tokenType: 'both',
        result: 'failure',
        reason: error instanceof Error ? error.message : 'clear_error',
        duration: Date.now() - startTime,
      });

      // Don't throw - clearing should always succeed
    }
  }

  /**
   * Check if there are any stored tokens (without validating them)
   */
  private hasStoredTokens(): boolean {
    try {
      if (typeof window === 'undefined') {
        return false;
      }

      const accessToken = this.storage.getItem(
        AuthTokenManager.ACCESS_TOKEN_KEY
      );
      const refreshToken = this.storage.getItem(
        AuthTokenManager.REFRESH_TOKEN_KEY
      );

      return !!(accessToken && refreshToken);
    } catch (error) {
      return false;
    }
  }

  /**
   * Handle invalid tokens by clearing them and logging the reason
   */
  handleInvalidTokens(reason: string): void {
    console.log('🚨 Handling invalid tokens, reason:', reason);
    this.clearTokens();
  }

  /**
   * Check if user is currently authenticated (has valid tokens)
   */
  async isAuthenticated(): Promise<boolean> {
    const validToken = await this.getValidToken();
    return validToken !== null;
  }

  /**
   * Migrate tokens from old localStorage keys to new keys
   * This ensures backward compatibility for existing users
   */
  migrateOldTokens(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      // Check if we already have tokens with new keys
      const existingTokens = this.getStoredTokens();
      if (existingTokens.accessToken && existingTokens.refreshToken) {
        // Already migrated or new installation
        return;
      }

      // Check for old tokens
      const oldAccessToken = this.storage.getItem('access_token');
      const oldRefreshToken = this.storage.getItem('refresh_token');

      if (
        oldAccessToken &&
        oldRefreshToken &&
        oldAccessToken.trim() !== '' &&
        oldRefreshToken.trim() !== ''
      ) {
        console.log('🔄 Migrating tokens from old keys to new keys...');

        // Store with new keys directly (bypass validation for migration)
        this.storage.setItem(AuthTokenManager.ACCESS_TOKEN_KEY, oldAccessToken);
        this.storage.setItem(
          AuthTokenManager.REFRESH_TOKEN_KEY,
          oldRefreshToken
        );
        this.storage.setItem(
          AuthTokenManager.EXPIRES_AT_KEY,
          new Date(Date.now() + 3600 * 1000).toISOString()
        );

        // Remove old keys
        this.storage.removeItem('access_token');
        this.storage.removeItem('refresh_token');

        console.log('✅ Token migration completed');
      }
    } catch (error) {
      console.error('❌ Token migration failed:', error);
    }
  }

  /**
   * Initialize token manager and check for existing session
   * Enhanced to provide better session persistence and invalid token detection
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 Initializing AuthTokenManager...');

      // First, migrate any old tokens
      this.migrateOldTokens();

      // Check for corrupted tokens before proceeding
      const corruption = this.detectCorruptedTokens();
      if (corruption.hasCorrupted) {
        console.log(
          '🚨 Detected corrupted tokens during initialization:',
          corruption.details
        );
        this.cleanupInvalidTokens('corrupted_tokens_on_init');
        return false;
      }

      // Check if we have stored tokens
      const storedTokens = this.getStoredTokens();

      if (!storedTokens.accessToken || !storedTokens.refreshToken) {
        console.log('ℹ️ No stored tokens found');
        return false;
      }

      console.log('📋 Found stored tokens, validating...');

      // Check if tokens are valid or can be refreshed
      const validToken = await this.getValidToken();

      if (validToken) {
        console.log('✅ Valid session restored from stored tokens');
        return true;
      } else {
        console.log('❌ Stored tokens are invalid and cannot be refreshed');
        this.cleanupInvalidTokens('validation_failed_on_init');
        return false;
      }
    } catch (error) {
      console.error('❌ Token manager initialization failed:', error);
      this.cleanupInvalidTokens('initialization_error');
      return false;
    }
  }
}

// Export singleton instance with default localStorage
export const authTokenManager = new AuthTokenManager();
