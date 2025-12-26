/**
 * Enhanced Authentication Token Manager
 * Provides secure token storage, automatic refresh, and session persistence
 */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface TokenRefreshResult {
  success: boolean;
  tokens?: AuthTokens;
  error?: string;
}

export class AuthTokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'docfiscal_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'docfiscal_refresh_token';
  private static readonly EXPIRES_AT_KEY = 'docfiscal_token_expires_at';
  private static readonly TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

  /**
   * Store authentication tokens securely in localStorage
   */
  storeTokens(tokens: AuthTokens): void {
    try {
      if (typeof window === 'undefined') {
        console.warn('Cannot store tokens: window is undefined');
        return;
      }

      localStorage.setItem(AuthTokenManager.ACCESS_TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(AuthTokenManager.REFRESH_TOKEN_KEY, tokens.refreshToken);
      localStorage.setItem(AuthTokenManager.EXPIRES_AT_KEY, tokens.expiresAt.toISOString());

      console.log('✅ Tokens stored successfully');
    } catch (error) {
      console.error('❌ Failed to store tokens:', error);
      // Gracefully handle storage errors - don't throw
    }
  }

  /**
   * Retrieve stored authentication tokens
   */
  getStoredTokens(): AuthTokens {
    try {
      if (typeof window === 'undefined') {
        return {
          accessToken: null as any,
          refreshToken: null as any,
          expiresAt: null as any
        };
      }

      const accessToken = localStorage.getItem(AuthTokenManager.ACCESS_TOKEN_KEY);
      const refreshToken = localStorage.getItem(AuthTokenManager.REFRESH_TOKEN_KEY);
      const expiresAtStr = localStorage.getItem(AuthTokenManager.EXPIRES_AT_KEY);

      // Return null values if any token is missing or empty
      if (!accessToken || !refreshToken || !expiresAtStr || 
          accessToken.trim() === '' || refreshToken.trim() === '' || expiresAtStr.trim() === '') {
        return {
          accessToken: null as any,
          refreshToken: null as any,
          expiresAt: null as any
        };
      }

      return {
        accessToken,
        refreshToken,
        expiresAt: new Date(expiresAtStr)
      };
    } catch (error) {
      console.error('❌ Failed to retrieve tokens:', error);
      return {
        accessToken: null as any,
        refreshToken: null as any,
        expiresAt: null as any
      };
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidToken(): Promise<string | null> {
    const tokens = this.getStoredTokens();
    
    if (!tokens.accessToken) {
      return null;
    }

    // Check if token is expired or about to expire
    if (this.isTokenExpired(tokens.accessToken) || this.shouldRefreshToken(tokens.expiresAt)) {
      console.log('🔄 Token expired or about to expire, attempting refresh...');
      
      // Only attempt refresh if we have a refresh token
      if (!tokens.refreshToken) {
        console.log('❌ No refresh token available, clearing tokens');
        this.clearTokens();
        return null;
      }
      
      const refreshResult = await this.refreshToken();
      if (refreshResult.success && refreshResult.tokens) {
        return refreshResult.tokens.accessToken;
      } else {
        console.log('❌ Token refresh failed, clearing tokens');
        this.clearTokens();
        return null;
      }
    }

    return tokens.accessToken;
  }

  /**
   * Refresh the access token using the refresh token
   */
  async refreshToken(): Promise<TokenRefreshResult> {
    try {
      const tokens = this.getStoredTokens();
      
      if (!tokens.refreshToken) {
        return {
          success: false,
          error: 'No refresh token available'
        };
      }

      console.log('🔄 Attempting token refresh...');

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: tokens.refreshToken
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format');
      }
      
      if (data.success && data.tokens && typeof data.tokens === 'object') {
        // Validate required token fields
        if (!data.tokens.access_token || typeof data.tokens.access_token !== 'string') {
          throw new Error('Invalid access token in response');
        }
        
        const newTokens: AuthTokens = {
          accessToken: data.tokens.access_token,
          refreshToken: data.tokens.refresh_token || tokens.refreshToken,
          expiresAt: new Date(Date.now() + ((data.tokens.expires_in || 3600) * 1000))
        };

        this.storeTokens(newTokens);
        
        console.log('✅ Token refresh successful');
        return {
          success: true,
          tokens: newTokens
        };
      } else {
        throw new Error(data.error || 'Token refresh failed');
      }
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if a token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const tokens = this.getStoredTokens();
      if (!tokens.expiresAt) {
        return true;
      }

      return tokens.expiresAt.getTime() <= Date.now();
    } catch (error) {
      console.error('❌ Error checking token expiration:', error);
      return true; // Assume expired on error
    }
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
   */
  clearTokens(): void {
    try {
      if (typeof window === 'undefined') {
        console.warn('Cannot clear tokens: window is undefined');
        return;
      }

      localStorage.removeItem(AuthTokenManager.ACCESS_TOKEN_KEY);
      localStorage.removeItem(AuthTokenManager.REFRESH_TOKEN_KEY);
      localStorage.removeItem(AuthTokenManager.EXPIRES_AT_KEY);

      console.log('✅ Tokens cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear tokens:', error);
      // Don't throw - clearing should always succeed
    }
  }

  /**
   * Check if user is currently authenticated (has valid tokens)
   */
  async isAuthenticated(): Promise<boolean> {
    const validToken = await this.getValidToken();
    return validToken !== null;
  }

  /**
   * Initialize token manager and check for existing session
   */
  async initialize(): Promise<boolean> {
    try {
      const validToken = await this.getValidToken();
      return validToken !== null;
    } catch (error) {
      console.error('❌ Token manager initialization failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const authTokenManager = new AuthTokenManager();