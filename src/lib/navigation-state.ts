/**
 * Navigation state management utilities for preserving state across navigation
 * Implements Requirements 5.1, 5.5 for state persistence
 */

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

// Types for navigation state
export interface NavigationState {
  previousPath?: string;
  scrollPosition?: number;
  formData?: Record<string, any>;
  timestamp: number;
}

export interface PageState {
  [key: string]: any;
}

// Storage keys
const NAVIGATION_STATE_KEY = 'docfiscal-navigation-state';
const PAGE_STATE_KEY = 'docfiscal-page-state';

// Navigation state manager class
export class NavigationStateManager {
  private static instance: NavigationStateManager;
  private state: Map<string, NavigationState> = new Map();
  private pageState: Map<string, PageState> = new Map();

  static getInstance(): NavigationStateManager {
    if (!NavigationStateManager.instance) {
      NavigationStateManager.instance = new NavigationStateManager();
    }
    return NavigationStateManager.instance;
  }

  // Save navigation state for a specific path
  saveNavigationState(path: string, state: Partial<NavigationState>): void {
    const currentState = this.state.get(path) || { timestamp: Date.now() };
    const updatedState = {
      ...currentState,
      ...state,
      timestamp: Date.now(),
    };

    this.state.set(path, updatedState);
    this.persistToStorage();
  }

  // Get navigation state for a specific path
  getNavigationState(path: string): NavigationState | undefined {
    return this.state.get(path);
  }

  // Save page-specific state
  savePageState(path: string, state: PageState): void {
    this.pageState.set(path, state);
    this.persistPageStateToStorage();
  }

  // Get page-specific state
  getPageState(path: string): PageState | undefined {
    return this.pageState.get(path);
  }

  // Clear old navigation states (older than 1 hour)
  cleanupOldStates(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    Array.from(this.state.entries()).forEach(([path, state]) => {
      if (state.timestamp < oneHourAgo) {
        this.state.delete(path);
      }
    });

    this.persistToStorage();
  }

  // Persist navigation state to localStorage
  private persistToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stateObject = Object.fromEntries(this.state.entries());
      localStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(stateObject));
    } catch (error) {
      console.warn('Failed to persist navigation state:', error);
    }
  }

  // Persist page state to localStorage
  private persistPageStateToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stateObject = Object.fromEntries(this.pageState.entries());
      localStorage.setItem(PAGE_STATE_KEY, JSON.stringify(stateObject));
    } catch (error) {
      console.warn('Failed to persist page state:', error);
    }
  }

  // Load state from localStorage
  loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      // Load navigation state
      const navigationStateData = localStorage.getItem(NAVIGATION_STATE_KEY);
      if (navigationStateData) {
        const stateObject = JSON.parse(navigationStateData);
        this.state = new Map(Object.entries(stateObject));
      }

      // Load page state
      const pageStateData = localStorage.getItem(PAGE_STATE_KEY);
      if (pageStateData) {
        const stateObject = JSON.parse(pageStateData);
        this.pageState = new Map(Object.entries(stateObject));
      }

      // Clean up old states
      this.cleanupOldStates();
    } catch (error) {
      console.warn('Failed to load navigation state:', error);
      // Clear corrupted data
      localStorage.removeItem(NAVIGATION_STATE_KEY);
      localStorage.removeItem(PAGE_STATE_KEY);
    }
  }

  // Clear all navigation state
  clearAll(): void {
    this.state.clear();
    this.pageState.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(NAVIGATION_STATE_KEY);
      localStorage.removeItem(PAGE_STATE_KEY);
    }
  }
}

// Hook for managing navigation state
export const useNavigationState = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [manager] = useState(() => NavigationStateManager.getInstance());

  // Initialize state manager on mount
  useEffect(() => {
    manager.loadFromStorage();
  }, [manager]);

  // Save scroll position before navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      const scrollPosition = window.scrollY;
      manager.saveNavigationState(pathname, { scrollPosition });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const scrollPosition = window.scrollY;
        manager.saveNavigationState(pathname, { scrollPosition });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pathname, manager]);

  // Restore scroll position on navigation
  useEffect(() => {
    const state = manager.getNavigationState(pathname);
    if (state?.scrollPosition !== undefined) {
      // Delay scroll restoration to ensure content is loaded
      const timeoutId = setTimeout(() => {
        window.scrollTo(0, state.scrollPosition || 0);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [pathname, manager]);

  const saveNavigationState = useCallback(
    (state: Partial<NavigationState>) => {
      manager.saveNavigationState(pathname, state);
    },
    [pathname, manager]
  );

  const getNavigationState = useCallback(() => {
    return manager.getNavigationState(pathname);
  }, [pathname, manager]);

  const savePageState = useCallback(
    (state: PageState) => {
      manager.savePageState(pathname, state);
    },
    [pathname, manager]
  );

  const getPageState = useCallback(() => {
    return manager.getPageState(pathname);
  }, [pathname, manager]);

  const navigateWithState = useCallback(
    (path: string, state?: Partial<NavigationState>) => {
      // Save current state before navigation
      const scrollPosition = window.scrollY;
      manager.saveNavigationState(pathname, {
        scrollPosition,
        previousPath: pathname,
        ...state,
      });

      router.push(path);
    },
    [pathname, router, manager]
  );

  const clearNavigationState = useCallback(() => {
    manager.clearAll();
  }, [manager]);

  return {
    saveNavigationState,
    getNavigationState,
    savePageState,
    getPageState,
    navigateWithState,
    clearNavigationState,
    currentPath: pathname,
  };
};

// Hook for form state persistence
export const useFormStatePersistence = <T extends Record<string, any>>(
  formId: string,
  initialValues: T
) => {
  const { savePageState, getPageState } = useNavigationState();
  const [formData, setFormData] = useState<T>(initialValues);

  // Load persisted form data on mount
  useEffect(() => {
    const pageState = getPageState();
    const persistedFormData = pageState?.[formId];

    if (persistedFormData) {
      setFormData({ ...initialValues, ...persistedFormData });
    }
  }, [formId, getPageState, initialValues]);

  // Save form data when it changes
  const updateFormData = useCallback(
    (updates: Partial<T>) => {
      const newFormData = { ...formData, ...updates };
      setFormData(newFormData);

      // Persist to navigation state
      const currentPageState = getPageState() || {};
      savePageState({
        ...currentPageState,
        [formId]: newFormData,
      });
    },
    [formData, formId, savePageState, getPageState]
  );

  // Clear form data
  const clearFormData = useCallback(() => {
    setFormData(initialValues);
    const currentPageState = getPageState() || {};
    delete currentPageState[formId];
    savePageState(currentPageState);
  }, [formId, initialValues, savePageState, getPageState]);

  return {
    formData,
    updateFormData,
    clearFormData,
  };
};

// Hook for managing upload state persistence
export const useUploadStatePersistence = () => {
  const { savePageState, getPageState } = useNavigationState();

  const saveUploadState = useCallback(
    (
      uploadId: string,
      state: { progress: number; status: string; filename: string }
    ) => {
      const currentPageState = getPageState() || {};
      savePageState({
        ...currentPageState,
        uploads: {
          ...currentPageState.uploads,
          [uploadId]: state,
        },
      });
    },
    [savePageState, getPageState]
  );

  const getUploadState = useCallback(
    (uploadId: string) => {
      const pageState = getPageState();
      return pageState?.uploads?.[uploadId];
    },
    [getPageState]
  );

  const clearUploadState = useCallback(
    (uploadId: string) => {
      const currentPageState = getPageState() || {};
      if (currentPageState.uploads) {
        delete currentPageState.uploads[uploadId];
        savePageState(currentPageState);
      }
    },
    [savePageState, getPageState]
  );

  return {
    saveUploadState,
    getUploadState,
    clearUploadState,
  };
};
