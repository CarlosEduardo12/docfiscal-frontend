'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authTokenManager, AuthTokens } from '@/lib/AuthTokenManager';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Initialize authentication state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      
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
          }
        }
      }
    } catch (error) {
      console.error('❌ Auth initialization failed:', error);
      authTokenManager.clearTokens();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserProfile = async (token: string): Promise<User | null> => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          id: data.id,
          email: data.email,
          name: data.name,
        };
      }
    } catch (error) {
      console.error('❌ Failed to fetch user profile:', error);
    }
    
    return null;
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store tokens
        const tokens: AuthTokens = {
          accessToken: data.tokens.access_token,
          refreshToken: data.tokens.refresh_token,
          expiresAt: new Date(Date.now() + (data.tokens.expires_in * 1000))
        };
        
        authTokenManager.storeTokens(tokens);

        // Set user data
        setUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
        });

        console.log('✅ Login successful');
        return { success: true };
      } else {
        const errorMessage = data.error || 'Login failed';
        console.error('❌ Login failed:', errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      console.error('❌ Login error:', error);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);

      // Call logout endpoint (optional - for server-side cleanup)
      try {
        const validToken = await authTokenManager.getValidToken();
        if (validToken) {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${validToken}`,
              'Content-Type': 'application/json',
            },
          });
        }
      } catch (error) {
        console.warn('⚠️ Server logout failed, continuing with client cleanup:', error);
      }

      // Clear tokens and user state
      authTokenManager.clearTokens();
      setUser(null);

      console.log('✅ Logout successful');
      
      // Redirect to login page
      router.push('/login');
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Even if logout fails, clear local state
      authTokenManager.clearTokens();
      setUser(null);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    try {
      const refreshResult = await authTokenManager.refreshToken();
      
      if (refreshResult.success && refreshResult.tokens) {
        // Fetch updated user profile
        const userProfile = await fetchUserProfile(refreshResult.tokens.accessToken);
        if (userProfile) {
          setUser(userProfile);
          return true;
        }
      }
      
      // Refresh failed, clear state
      authTokenManager.clearTokens();
      setUser(null);
      return false;
    } catch (error) {
      console.error('❌ Session refresh failed:', error);
      authTokenManager.clearTokens();
      setUser(null);
      return false;
    }
  };

  const contextValue: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
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

  useEffect(() => {
    // Only redirect if we're done loading AND not authenticated
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.push('/login');
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  return auth;
}