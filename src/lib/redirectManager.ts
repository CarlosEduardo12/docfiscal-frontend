/**
 * Redirect Manager - Prevents infinite redirect loops and manages conditional redirects
 */

import { authLogger } from './authLogger';

interface RedirectState {
  lastRedirect: string | null;
  redirectCount: number;
  lastRedirectTime: number;
}

class RedirectManager {
  private static readonly STORAGE_KEY = 'docfiscal_redirect_state';
  private static readonly MAX_REDIRECTS = 3;
  private static readonly REDIRECT_COOLDOWN = 5000; // 5 seconds

  /**
   * Get current redirect state from sessionStorage
   */
  private getRedirectState(): RedirectState {
    if (typeof window === 'undefined') {
      return { lastRedirect: null, redirectCount: 0, lastRedirectTime: 0 };
    }

    try {
      const stored = sessionStorage.getItem(RedirectManager.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to parse redirect state:', error);
    }

    return { lastRedirect: null, redirectCount: 0, lastRedirectTime: 0 };
  }

  /**
   * Save redirect state to sessionStorage
   */
  private saveRedirectState(state: RedirectState): void {
    if (typeof window === 'undefined') return;

    try {
      sessionStorage.setItem(
        RedirectManager.STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      console.warn('Failed to save redirect state:', error);
    }
  }

  /**
   * Check if a redirect is safe to perform (prevents loops)
   */
  canRedirect(targetPath: string): boolean {
    const state = this.getRedirectState();
    const now = Date.now();

    // If this is the same redirect as last time
    if (state.lastRedirect === targetPath) {
      // Check if we're within cooldown period
      if (now - state.lastRedirectTime < RedirectManager.REDIRECT_COOLDOWN) {
        console.warn(
          `🚫 Redirect to ${targetPath} blocked - within cooldown period`
        );

        // Log prevented redirect loop
        authLogger.logRedirect({
          from:
            typeof window !== 'undefined'
              ? window.location.pathname
              : 'unknown',
          to: targetPath,
          reason: 'cooldown_period',
          method: 'safe_redirect',
          timestamp: new Date().toISOString(),
          wasAuthenticated: false, // Will be updated by caller if needed
          preventedLoop: true,
        });

        return false;
      }

      // Check if we've exceeded max redirects
      if (state.redirectCount >= RedirectManager.MAX_REDIRECTS) {
        console.warn(
          `🚫 Redirect to ${targetPath} blocked - max redirects exceeded`
        );

        // Log prevented redirect loop
        authLogger.logRedirect({
          from:
            typeof window !== 'undefined'
              ? window.location.pathname
              : 'unknown',
          to: targetPath,
          reason: 'max_redirects_exceeded',
          method: 'safe_redirect',
          timestamp: new Date().toISOString(),
          wasAuthenticated: false, // Will be updated by caller if needed
          preventedLoop: true,
        });

        return false;
      }
    }

    return true;
  }

  /**
   * Record a redirect attempt
   */
  recordRedirect(targetPath: string): void {
    const state = this.getRedirectState();
    const now = Date.now();

    if (state.lastRedirect === targetPath) {
      // Same redirect, increment count
      state.redirectCount += 1;
    } else {
      // Different redirect, reset count
      state.redirectCount = 1;
    }

    state.lastRedirect = targetPath;
    state.lastRedirectTime = now;

    this.saveRedirectState(state);
    console.log(
      `📝 Recorded redirect to ${targetPath} (count: ${state.redirectCount})`
    );
  }

  /**
   * Clear redirect state (call when user successfully navigates)
   */
  clearRedirectState(): void {
    if (typeof window === 'undefined') return;

    try {
      sessionStorage.removeItem(RedirectManager.STORAGE_KEY);
      console.log('✅ Redirect state cleared');
    } catch (error) {
      console.warn('Failed to clear redirect state:', error);
    }
  }

  /**
   * Safe redirect function that checks for loops
   */
  safeRedirect(
    router: any,
    targetPath: string,
    reason?: string,
    isAuthenticated?: boolean
  ): boolean {
    const currentPath =
      typeof window !== 'undefined' ? window.location.pathname : 'unknown';

    if (!this.canRedirect(targetPath)) {
      console.error(`🚫 Redirect to ${targetPath} blocked to prevent loop`);
      return false;
    }

    console.log(
      `🔄 Safe redirect to ${targetPath}${reason ? ` (${reason})` : ''}`
    );
    this.recordRedirect(targetPath);

    // Log the redirect
    authLogger.logRedirect({
      from: currentPath,
      to: targetPath,
      reason: reason || 'safe_redirect',
      method: 'safe_redirect',
      timestamp: new Date().toISOString(),
      wasAuthenticated: isAuthenticated || false,
      preventedLoop: false,
    });

    router.push(targetPath);
    return true;
  }

  /**
   * Conditional redirect based on authentication state
   */
  conditionalAuthRedirect(
    router: any,
    isAuthenticated: boolean,
    isLoading: boolean,
    currentPath: string
  ): boolean {
    // Don't redirect while loading
    if (isLoading) {
      return false;
    }

    // Define protected and public routes
    const protectedRoutes = ['/dashboard', '/upload', '/profile', '/orders'];
    const publicRoutes = ['/login', '/register', '/'];

    const isProtectedRoute = protectedRoutes.some((route) =>
      currentPath.startsWith(route)
    );
    const isPublicRoute = publicRoutes.some((route) => currentPath === route);

    // If user is not authenticated and on a protected route
    if (!isAuthenticated && isProtectedRoute) {
      return this.safeRedirect(
        router,
        '/login',
        'unauthenticated user on protected route',
        isAuthenticated
      );
    }

    // If user is authenticated and on login page
    if (isAuthenticated && currentPath === '/login') {
      return this.safeRedirect(
        router,
        '/dashboard',
        'authenticated user on login page',
        isAuthenticated
      );
    }

    return false;
  }
}

// Export singleton instance
export const redirectManager = new RedirectManager();
