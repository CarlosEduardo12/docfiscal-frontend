'use client';

import { useState, useCallback, useEffect } from 'react';

export interface DataLoadingState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
}

export interface UseDataLoadingOptions {
  initialData?: any;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  retryCount?: number;
  retryDelay?: number;
}

export function useDataLoading<T>(options: UseDataLoadingOptions = {}) {
  const {
    initialData = null,
    onSuccess,
    onError,
    retryCount = 0,
    retryDelay = 1000,
  } = options;

  const [state, setState] = useState<DataLoadingState<T>>({
    data: initialData,
    isLoading: false,
    error: null,
    hasLoaded: false,
  });

  const [retryAttempts, setRetryAttempts] = useState(0);

  const load = useCallback(async <TResult = T>(
    loadFn: () => Promise<TResult>
  ): Promise<TResult | null> => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const result = await loadFn();
      
      setState(prev => ({
        ...prev,
        data: result as T,
        isLoading: false,
        hasLoaded: true,
      }));

      setRetryAttempts(0);

      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        hasLoaded: true,
      }));

      if (onError) {
        onError(errorMessage);
      }

      // Auto-retry if configured
      if (retryAttempts < retryCount) {
        setRetryAttempts(prev => prev + 1);
        setTimeout(() => {
          load(loadFn);
        }, retryDelay);
      }

      return null;
    }
  }, [onSuccess, onError, retryAttempts, retryCount, retryDelay]);

  const reset = useCallback(() => {
    setState({
      data: initialData,
      isLoading: false,
      error: null,
      hasLoaded: false,
    });
    setRetryAttempts(0);
  }, [initialData]);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  return {
    ...state,
    load,
    reset,
    clearError,
    retryAttempts,
  };
}