'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface FormSubmissionState {
  isSubmitting: boolean;
  isDisabled: boolean;
  error: string | null;
  success: boolean;
}

export interface UseFormSubmissionOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  resetAfterSuccess?: boolean;
  resetAfterError?: boolean;
  successDuration?: number;
}

export function useFormSubmission(options: UseFormSubmissionOptions = {}) {
  const {
    onSuccess,
    onError,
    resetAfterSuccess = true,
    resetAfterError = false,
    successDuration = 3000,
  } = options;

  const [state, setState] = useState<FormSubmissionState>({
    isSubmitting: false,
    isDisabled: false,
    error: null,
    success: false,
  });

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  // Use ref to track submission state synchronously
  const isSubmittingRef = useRef(false);
  
  // Store options in refs to avoid stale closures
  const optionsRef = useRef({
    onSuccess,
    onError,
    resetAfterSuccess,
    resetAfterError,
    successDuration,
  });
  
  // Update options ref when they change
  useEffect(() => {
    optionsRef.current = {
      onSuccess,
      onError,
      resetAfterSuccess,
      resetAfterError,
      successDuration,
    };
  }, [onSuccess, onError, resetAfterSuccess, resetAfterError, successDuration]);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Clear all timeouts on unmount
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current = [];
    };
  }, []);

  const submit = useCallback(<T>(
    submitFn: () => Promise<T>
  ): Promise<T | null> | null => {
    // Prevent double submission using ref for immediate check
    if (isSubmittingRef.current) {
      return null;
    }

    // Set submitting flag immediately
    isSubmittingRef.current = true;

    setState(prev => ({
      ...prev,
      isSubmitting: true,
      isDisabled: true,
      error: null,
      success: false,
    }));

    // Return the actual async operation as a Promise
    return (async () => {
      try {
        const result = await submitFn();
        
        if (isMountedRef.current) {
          setState(prev => ({
            ...prev,
            isSubmitting: false,
            isDisabled: false,
            success: true,
          }));

          if (optionsRef.current.onSuccess) {
            optionsRef.current.onSuccess();
          }

          // Auto-reset success state
          if (optionsRef.current.resetAfterSuccess) {
            const timeout = setTimeout(() => {
              if (isMountedRef.current) {
                setState(prev => ({
                  ...prev,
                  success: false,
                }));
              }
            }, optionsRef.current.successDuration);
            timeoutRefs.current.push(timeout);
          }
        }

        // Reset submitting flag
        isSubmittingRef.current = false;
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        
        if (isMountedRef.current) {
          setState(prev => ({
            ...prev,
            isSubmitting: false,
            isDisabled: false,
            error: errorMessage,
          }));

          if (optionsRef.current.onError) {
            optionsRef.current.onError(errorMessage);
          }

          // Auto-reset error state if configured
          if (optionsRef.current.resetAfterError) {
            const timeout = setTimeout(() => {
              if (isMountedRef.current) {
                setState(prev => ({
                  ...prev,
                  error: null,
                }));
              }
            }, 3000);
            timeoutRefs.current.push(timeout);
          }
        }

        // Reset submitting flag
        isSubmittingRef.current = false;
        return null;
      }
    })();
  }, []); // Remove all dependencies to ensure the function is stable

  const reset = useCallback(() => {
    isSubmittingRef.current = false;
    setState({
      isSubmitting: false,
      isDisabled: false,
      error: null,
      success: false,
    });
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  return {
    ...state,
    submit,
    reset,
    clearError,
  };
}