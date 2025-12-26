'use client';

import { useState, useCallback, useRef } from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  actions?: ToastAction[];
  persistent?: boolean;
}

export interface UseToastOptions {
  maxToasts?: number;
  defaultDuration?: number;
}

export function useToast(options: UseToastOptions = {}) {
  const { maxToasts = 5, defaultDuration = 5000 } = options;
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const generateId = useCallback(() => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    
    // Clear timeout if exists
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
  }, []);

  const showToast = useCallback((toast: Omit<ToastNotification, 'id'>) => {
    const id = generateId();
    const duration = toast.duration ?? defaultDuration;
    
    const newToast: ToastNotification = {
      ...toast,
      id,
      duration, // Ensure duration is always set
    };

    setToasts(prev => {
      const updated = [...prev, newToast];
      // Remove oldest toasts if exceeding max
      if (updated.length > maxToasts) {
        const toRemove = updated.slice(0, updated.length - maxToasts);
        toRemove.forEach(t => {
          const timeout = timeoutRefs.current.get(t.id);
          if (timeout) {
            clearTimeout(timeout);
            timeoutRefs.current.delete(t.id);
          }
        });
        return updated.slice(-maxToasts);
      }
      return updated;
    });

    // Auto-remove after duration (unless persistent)
    if (!toast.persistent && duration > 0) {
      const timeout = setTimeout(() => {
        removeToast(id);
      }, duration);
      timeoutRefs.current.set(id, timeout);
    }

    return id;
  }, [generateId, defaultDuration, maxToasts, removeToast]);

  const showSuccess = useCallback((title: string, message: string, options?: Partial<ToastNotification>) => {
    return showToast({
      type: 'success',
      title,
      message,
      ...options,
    });
  }, [showToast]);

  const showError = useCallback((title: string, message: string, options?: Partial<ToastNotification>) => {
    return showToast({
      type: 'error',
      title,
      message,
      ...options,
    });
  }, [showToast]);

  const showWarning = useCallback((title: string, message: string, options?: Partial<ToastNotification>) => {
    return showToast({
      type: 'warning',
      title,
      message,
      ...options,
    });
  }, [showToast]);

  const showInfo = useCallback((title: string, message: string, options?: Partial<ToastNotification>) => {
    return showToast({
      type: 'info',
      title,
      message,
      ...options,
    });
  }, [showToast]);

  const clearAll = useCallback(() => {
    // Clear all timeouts
    timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    timeoutRefs.current.clear();
    
    setToasts([]);
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<ToastNotification>) => {
    setToasts(prev => prev.map(toast => 
      toast.id === id ? { ...toast, ...updates } : toast
    ));
  }, []);

  return {
    toasts,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeToast,
    clearAll,
    updateToast,
  };
}