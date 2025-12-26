'use client';

import { useState, useCallback, useMemo } from 'react';

export interface InteractionState {
  isDisabled: boolean;
  reason?: string;
  tooltip?: string;
  visualCue?: 'loading' | 'error' | 'warning' | 'info';
}

export interface UseInteractionStateOptions {
  defaultDisabled?: boolean;
  defaultReason?: string;
  defaultTooltip?: string;
}

export function useInteractionState(options: UseInteractionStateOptions = {}) {
  const {
    defaultDisabled = false,
    defaultReason,
    defaultTooltip,
  } = options;

  const [state, setState] = useState<InteractionState>({
    isDisabled: defaultDisabled,
    reason: defaultReason,
    tooltip: defaultTooltip,
  });

  const disable = useCallback((reason?: string, tooltip?: string, visualCue?: InteractionState['visualCue']) => {
    setState({
      isDisabled: true,
      reason,
      tooltip,
      visualCue,
    });
  }, []);

  const enable = useCallback(() => {
    setState({
      isDisabled: false,
      reason: undefined,
      tooltip: undefined,
      visualCue: undefined,
    });
  }, []);

  const toggle = useCallback((reason?: string, tooltip?: string, visualCue?: InteractionState['visualCue']) => {
    setState(prev => ({
      isDisabled: !prev.isDisabled,
      reason: !prev.isDisabled ? reason : undefined,
      tooltip: !prev.isDisabled ? tooltip : undefined,
      visualCue: !prev.isDisabled ? visualCue : undefined,
    }));
  }, []);

  const setLoadingState = useCallback((isLoading: boolean, reason?: string) => {
    if (isLoading) {
      disable(reason || 'Loading...', reason || 'Please wait while the operation completes', 'loading');
    } else {
      enable();
    }
  }, [disable, enable]);

  const setErrorState = useCallback((hasError: boolean, reason?: string) => {
    if (hasError) {
      disable(reason || 'Error occurred', reason || 'An error has occurred. Please try again.', 'error');
    } else {
      enable();
    }
  }, [disable, enable]);

  // Computed properties for UI usage
  const uiProps = useMemo(() => ({
    disabled: state.isDisabled,
    'aria-disabled': state.isDisabled,
    'aria-label': state.tooltip || state.reason,
    title: state.tooltip || state.reason,
    'data-disabled': state.isDisabled,
    'data-reason': state.reason,
    'data-visual-cue': state.visualCue,
  }), [state]);

  const cssClasses = useMemo(() => {
    const classes: string[] = [];
    
    if (state.isDisabled) {
      classes.push('disabled', 'cursor-not-allowed', 'opacity-50');
      
      switch (state.visualCue) {
        case 'loading':
          classes.push('animate-pulse');
          break;
        case 'error':
          classes.push('border-red-300', 'text-red-600');
          break;
        case 'warning':
          classes.push('border-yellow-300', 'text-yellow-600');
          break;
        case 'info':
          classes.push('border-blue-300', 'text-blue-600');
          break;
      }
    } else {
      classes.push('cursor-pointer', 'hover:opacity-80');
    }
    
    return classes;
  }, [state]);

  return {
    ...state,
    disable,
    enable,
    toggle,
    setLoadingState,
    setErrorState,
    uiProps,
    cssClasses,
  };
}