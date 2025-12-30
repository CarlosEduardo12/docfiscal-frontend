'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authTokenManager, AuthTokens } from '@/lib/AuthTokenManager';
import { apiClient } from '@/lib/api';
import { redirectManager } from '@/lib/redirectManager';
import { ErrorHandler, AppError } from '@/lib/errorHandler';
import { authLogger } from '@/lib/authLogger';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  lastError: AppError | null;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string; appError?: AppError }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<AppError | null>(null);
  const router = useRouter();

  const initializeAuth = useCallback(async () => {
    const startTime = Date.now();

    try {
      setIsLoading(true);
      console.log('🔄 Initializing authentication on page load...');

      // Initialize token manager (includes migration)
      const hasValidSession = await authTokenManager.initialize();
      console.log(
        '📋 Token manager initialized, has valid session:',
        hasValidSession
      );

      if (hasValidSession) {
        // Attempt to get a valid token (this will auto-refresh if needed)
        const validToken = await authTokenManager.getValidToken();

        if (validToken) {
          console.log('✅ Valid token obtained, fetching user profile...');

          // Fetch user profile with the valid token
          const userProfile = await fetchUserProfile(validToken);

          if (userProfile) {
            setUser(userProfile);
            authLogger.setUserId(userProfile.id);
            console.log(
              '✅ Session restored successfully for user:',
              userProfile.email
            );

            // Log successful session restoration
            authLogger.logSessionOperation({
              operation: 'restore',
              result: 'success',
              hasTokens: true,
              tokensValid: true,
              userProfile: true,
              duration: Date.now() - startTime,
            });
          } else {
            console.log('❌ Failed to fetch user profile, clearing tokens');
            await handleSessionFailure();

            // Log session restoration failure
            authLogger.logSessionOperation({
              operation: 'restore',
              result: 'failure',
              hasTokens: true,
              tokensValid: true,
              userProfile: false,
              duration: Date.now() - startTime,
            });
          }
        } else {
          console.log('❌ Could not obtain valid token, clearing session');
          await handleSessionFailure();

          // Log session restoration failure
          authLogger.logSessionOperation({
            operation: 'restore',
            result: 'failure',
            hasTokens: true,
            tokensValid: false,
            userProfile: false,
            duration: Date.now() - startTime,
          });
        }
      } else {
        console.log('ℹ️ No valid session found on page load');
        // Ensure clean state when no session exists
        setUser(null);

        // Log no session found
        authLogger.logSessionOperation({
          operation: 'initialize',
          result: 'success',
          hasTokens: false,
          tokensValid: false,
          userProfile: false,
          duration: Date.now() - startTime,
        });
      }

      // Log successful auth initialization
      authLogger.logAuthInitialization(
        'success',
        hasValidSession,
        undefined,
        Date.now() - startTime
      );
    } catch (error) {
      console.error('❌ Auth initialization failed:', error);
      await handleSessionFailure();

      // Log failed auth initialization
      authLogger.logAuthInitialization(
        'failure',
        false,
        error instanceof Error
          ? error
          : new Error('Unknown initialization error'),
        Date.now() - startTime
      );
    } finally {
      setIsLoading(false);
      console.log('✅ Auth initialization completed');
    }
  }, []);

  // Initialize authentication state on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const handleSessionFailure = async (appError?: AppError) => {
    console.log('🧹 Handling session failure - clearing all auth state');

    if (appError) {
      setLastError(appError);
      setError(ErrorHandler.getUserMessage(appError));
      ErrorHandler.logError(appError, 'SESSION_FAILURE');
    }

    authTokenManager.clearTokens();
    setUser(null);

    // Clear any redirect state to prevent loops
    redirectManager.clearRedirectState();
  };

  const handleRefreshFailure = async (reason: string, appError?: AppError) => {
    console.log('🚨 Handling refresh failure, reason:', reason);

    if (appError) {
      setLastError(appError);
      setError(ErrorHandler.getUserMessage(appError));
      ErrorHandler.logError(appError, 'REFRESH_FAILURE');
    }

    // Clear all authentication state
    authTokenManager.clearTokens();
    setUser(null);

    // Clear redirect state to prevent loops
    redirectManager.clearRedirectState();

    // Only redirect to login if we're not already there and not loading
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && !currentPath.startsWith('/login')) {
        console.log('🔄 Redirecting to login due to refresh failure');

        // Use safe redirect to prevent loops
        redirectManager.safeRedirect(
          router,
          '/login',
          `session refresh failed: ${reason}`,
          false
        );
      }
    }
  };

  const fetchUserProfile = async (token: string): Promise<User | null> => {
    const startTime = Date.now();

    try {
      const response = await apiClient.getProfile();

      if (response.success && response.data) {
        const user = {
          id: response.data.id,
          email: response.data.email,
          name: response.data.name,
        };

        // Log successful profile fetch
        authLogger.logProfileFetch(
          'success',
          user.id,
          undefined,
          Date.now() - startTime
        );

        return user;
      }
    } catch (error) {
      console.error('❌ Failed to fetch user profile:', error);

      // Log failed profile fetch
      authLogger.logProfileFetch(
        'failure',
        undefined,
        error instanceof Error ? error : new Error('Profile fetch failed'),
        Date.now() - startTime
      );

      // Check if this is an invalid token error
      const appError = (error as any).appError;
      if (appError && ErrorHandler.shouldClearTokens(appError)) {
        console.log(
          '🚨 Invalid token detected during profile fetch, cleaning up'
        );
        authTokenManager.cleanupInvalidTokens('invalid_token_profile_fetch');
      }
    }

    return null;
  };

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; appError?: AppError }> => {
    const startTime = Date.now();

    try {
      setIsLoading(true);
      setError(null);
      setLastError(null);

      const response = await apiClient.login({ email, password });

      if (response.success && response.data) {
        // Handle the actual API response structure where tokens are nested
        const tokenData = response.data.tokens || response.data;

        // Store tokens immediately and wait for completion
        const tokens: AuthTokens = {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          // Default to 1 hour if expires_in is not provided
          expiresAt: new Date(
            Date.now() + (tokenData.expires_in || 3600) * 1000
          ),
        };

        console.log('🔐 Storing tokens from login response:', {
          accessTokenLength: tokens.accessToken?.length || 0,
          refreshTokenLength: tokens.refreshToken?.length || 0,
          expiresAt: tokens.expiresAt.toISOString(),
          hasAccessToken: !!tokens.accessToken,
          hasRefreshToken: !!tokens.refreshToken,
        });

        // Store tokens synchronously to ensure immediate availability
        authTokenManager.storeTokens(tokens);

        // Verify tokens were stored correctly
        const storedTokens = authTokenManager.getStoredTokens();
        if (!storedTokens.accessToken || !storedTokens.refreshToken) {
          console.error('❌ Token storage verification failed');

          // Log failed login due to token storage
          authLogger.logLoginAttempt({
            email,
            userAgent:
              typeof window !== 'undefined'
                ? window.navigator.userAgent
                : undefined,
            timestamp: new Date().toISOString(),
            result: 'failure',
            failureReason: 'token_storage_failed',
            duration: Date.now() - startTime,
          });

          return {
            success: false,
            error: 'Failed to store authentication tokens',
          };
        }

        // Set user data immediately after successful token storage
        const userData = {
          id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.name,
        };

        setUser(userData);
        authLogger.setUserId(userData.id);

        // Double-check authentication state is synchronized
        const isAuthenticated = await authTokenManager.isAuthenticated();
        if (!isAuthenticated) {
          console.error('❌ Authentication state synchronization failed');
          authTokenManager.clearTokens();
          setUser(null);

          // Log failed login due to state sync
          authLogger.logLoginAttempt({
            email,
            userAgent:
              typeof window !== 'undefined'
                ? window.navigator.userAgent
                : undefined,
            timestamp: new Date().toISOString(),
            result: 'failure',
            failureReason: 'state_synchronization_failed',
            duration: Date.now() - startTime,
          });

          return {
            success: false,
            error: 'Authentication state synchronization failed',
          };
        }

        console.log(
          '✅ Login successful - tokens stored and state synchronized'
        );
        console.log('🔑 Access token stored:', !!storedTokens.accessToken);
        console.log('🔄 Refresh token stored:', !!storedTokens.refreshToken);
        console.log('👤 User state set:', !!userData);

        // Log successful login
        authLogger.logLoginAttempt({
          email,
          userAgent:
            typeof window !== 'undefined'
              ? window.navigator.userAgent
              : undefined,
          timestamp: new Date().toISOString(),
          result: 'success',
          duration: Date.now() - startTime,
        });

        // Log authentication state change
        authLogger.logAuthStateChange(
          'unauthenticated',
          'authenticated',
          'successful_login',
          userData.id
        );

        return { success: true };
      } else {
        const errorMessage = response.message || 'Login failed';
        console.error('❌ Login failed:', errorMessage);
        setError(errorMessage);

        // Log failed login
        authLogger.logLoginAttempt({
          email,
          userAgent:
            typeof window !== 'undefined'
              ? window.navigator.userAgent
              : undefined,
          timestamp: new Date().toISOString(),
          result: 'failure',
          failureReason: errorMessage,
          duration: Date.now() - startTime,
        });

        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('❌ Login error:', error);

      // Check if this is an enhanced error with appError
      const appError = (error as any).appError;
      if (appError) {
        setLastError(appError);
        setError(ErrorHandler.getUserMessage(appError));
        ErrorHandler.logError(appError, 'LOGIN');

        // Log failed login with app error
        authLogger.logLoginAttempt({
          email,
          userAgent:
            typeof window !== 'undefined'
              ? window.navigator.userAgent
              : undefined,
          timestamp: new Date().toISOString(),
          result: 'failure',
          failureReason: `${appError.code}: ${appError.message}`,
          duration: Date.now() - startTime,
        });

        return {
          success: false,
          error: ErrorHandler.getUserMessage(appError),
          appError,
        };
      }

      // Fallback for non-enhanced errors
      const errorMessage =
        error instanceof Error ? error.message : 'Network error';
      setError(errorMessage);

      // Log failed login with generic error
      authLogger.logLoginAttempt({
        email,
        userAgent:
          typeof window !== 'undefined'
            ? window.navigator.userAgent
            : undefined,
        timestamp: new Date().toISOString(),
        result: 'failure',
        failureReason: errorMessage,
        duration: Date.now() - startTime,
      });

      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    const startTime = Date.now();
    const currentUser = user;

    try {
      setIsLoading(true);

      // Call logout endpoint (optional - for server-side cleanup)
      try {
        await apiClient.logout();
      } catch (error) {
        console.warn(
          '⚠️ Server logout failed, continuing with client cleanup:',
          error
        );
      }

      // Clear tokens and user state
      authTokenManager.clearTokens();
      setUser(null);

      // Clear redirect state to prevent issues
      redirectManager.clearRedirectState();

      console.log('✅ Logout successful');

      // Log successful logout
      authLogger.logLogout(
        'success',
        'user_initiated',
        currentUser?.id,
        undefined,
        Date.now() - startTime
      );

      // Log authentication state change
      authLogger.logAuthStateChange(
        'authenticated',
        'unauthenticated',
        'user_logout',
        currentUser?.id
      );

      // Use safe redirect to login page
      redirectManager.safeRedirect(router, '/login', 'user logout', false);
    } catch (error) {
      console.error('❌ Logout error:', error);

      // Log failed logout
      authLogger.logLogout(
        'failure',
        'logout_error',
        currentUser?.id,
        error instanceof Error ? error : new Error('Logout failed'),
        Date.now() - startTime
      );

      // Even if logout fails, clear local state
      authTokenManager.clearTokens();
      setUser(null);
      redirectManager.clearRedirectState();
      redirectManager.safeRedirect(
        router,
        '/login',
        'logout error fallback',
        false
      );
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    try {
      console.log('🔄 Attempting session refresh...');

      const refreshResult = await authTokenManager.refreshToken();

      if (refreshResult.success && refreshResult.tokens) {
        console.log(
          '✅ Session refresh successful, fetching updated user profile...'
        );

        // Fetch updated user profile with the new token
        const userProfile = await fetchUserProfile(
          refreshResult.tokens.accessToken
        );

        if (userProfile) {
          setUser(userProfile);
          console.log('✅ User profile updated after session refresh');
          return true;
        } else {
          console.log('❌ Failed to fetch user profile after refresh');
          await handleRefreshFailure('profile_fetch_failed');
          return false;
        }
      } else {
        console.log('❌ Session refresh failed:', refreshResult.error);
        await handleRefreshFailure(
          refreshResult.error || 'refresh_failed',
          refreshResult.appError
        );
        return false;
      }
    } catch (error) {
      console.error('❌ Session refresh error:', error);

      // Classify the error
      const appError = ErrorHandler.classifyError(error);
      await handleRefreshFailure('refresh_exception', appError);
      return false;
    }
  };

  const checkAuth = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      setLastError(null);

      // Check if we have valid tokens
      const isAuthenticated = await authTokenManager.isAuthenticated();

      if (isAuthenticated) {
        // Fetch user profile
        const validToken = await authTokenManager.getValidToken();
        if (validToken) {
          const userProfile = await fetchUserProfile(validToken);
          if (userProfile) {
            setUser(userProfile);
          } else {
            // Invalid token, clear it
            authTokenManager.clearTokens();
            setUser(null);
          }
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('❌ Auth check failed:', error);

      // Classify the error
      const appError = ErrorHandler.classifyError(error);
      setLastError(appError);
      setError(ErrorHandler.getUserMessage(appError));
      ErrorHandler.logError(appError, 'AUTH_CHECK');

      authTokenManager.clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
    setLastError(null);
  };

  const contextValue: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    lastError,
    login,
    logout,
    refreshSession,
    checkAuth,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRequireAuth(): AuthContextType {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Use redirect manager for safe conditional redirects
    redirectManager.conditionalAuthRedirect(
      router,
      auth.isAuthenticated,
      auth.isLoading,
      pathname
    );
  }, [auth.isLoading, auth.isAuthenticated, router, pathname]);

  return auth;
}
